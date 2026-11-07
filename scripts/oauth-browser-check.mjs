// Synthetic-only Chromium checks. Uses an existing user-local Playwright install.
import { pathToFileURL, URL, URLSearchParams } from 'node:url'
import process from 'node:process'
import console from 'node:console'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    pathToFileURL(
      `${process.env.HOME}/.local/share/malone-cli-tools/playwright/node_modules/playwright/index.mjs`
    ).href
)
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve('dist')
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    const relative = pathname.replace(/^\/SelfStarter\//, '') || 'index.html'
    const file = resolve(root, relative)
    if (!file.startsWith(root + '/')) throw new Error('invalid path')
    const data = await readFile(file)
    response.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      }[extname(file)] || 'application/octet-stream'
    )
    response.end(data)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const port = server.address().port
const base = `http://127.0.0.1:${port}/SelfStarter/`
const browser = await chromium.launch({ headless: true })
let checks = 0
try {
  for (const host of ['127.0.0.1', 'localhost']) {
    const context = await browser.newContext()
    const external = []
    await context.route('**/*', async (route) => {
      if (['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname))
        return route.continue()
      external.push(route.request().url())
      await route.abort()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(base.replace('127.0.0.1', host))
    await page.getByRole('button', { name: 'Sign in with Bluesky' }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.locator('input[type=password]').count(), 0)
    assert.equal(await page.getByRole('textbox', { name: 'Public handle to analyze' }).count(), 1)
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    assert.equal(['127.0.0.1', 'localhost'].includes(new URL(page.url()).hostname), true)
    checks++
    await context.close()
  }
  const context = await browser.newContext()
  await context.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()
  )
  const page = await context.newPage()
  await page.goto(`${base}?keep=query#state=synthetic&error=access_denied&keep=fragment`)
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /cancelled|denied|could not sign in/i)
  assert.equal(new URL(page.url()).searchParams.get('keep'), 'query')
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('keep'), 'fragment')
  assert.equal(new URL(page.url()).hash.includes('state='), false)
  assert.equal(await page.getByText('Starter Pack Created!').count(), 0)
  checks++
  const response = await page.request.get(`${base}oauth-client-metadata.json`)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['content-type'], /application\/json/)
  const metadata = await response.json()
  assert.equal(
    metadata.client_id,
    'https://proptermalone.github.io/SelfStarter/oauth-client-metadata.json'
  )
  assert.deepEqual(metadata.redirect_uris, ['https://proptermalone.github.io/SelfStarter/'])
  checks++
  await context.close()
  const authorization = await browser.newContext()
  let pushed
  const requests = []
  await authorization.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1') return route.continue()
    requests.push(url.href)
    const json = (body) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    if (url.hostname === 'bsky.social' && url.pathname.endsWith('resolveHandle'))
      return json({ did: 'did:plc:abcdefghijklmnopqrstuvwx' })
    if (url.hostname === 'plc.directory')
      return json({
        id: 'did:plc:abcdefghijklmnopqrstuvwx',
        alsoKnownAs: ['at://test.example'],
        verificationMethod: [],
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.example',
          },
        ],
      })
    if (url.hostname === 'pds.example' && url.pathname === '/.well-known/oauth-protected-resource')
      return json({
        resource: 'https://pds.example',
        authorization_servers: ['https://auth.example'],
      })
    if (
      url.hostname === 'auth.example' &&
      url.pathname === '/.well-known/oauth-authorization-server'
    )
      return json({
        issuer: 'https://auth.example',
        client_id_metadata_document_supported: true,
        authorization_endpoint: 'https://auth.example/authorize',
        token_endpoint: 'https://auth.example/token',
        pushed_authorization_request_endpoint: 'https://auth.example/par',
        response_types_supported: ['code'],
        response_modes_supported: ['fragment'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        dpop_signing_alg_values_supported: ['ES256'],
        scopes_supported: ['atproto'],
        require_pushed_authorization_requests: true,
        authorization_response_iss_parameter_supported: true,
      })
    if (url.href === 'https://auth.example/par') {
      pushed = new URLSearchParams(request.postData())
      assert.ok(request.headers().dpop)
      return json({ request_uri: 'urn:ietf:params:oauth:request_uri:synthetic', expires_in: 90 })
    }
    if (url.hostname === 'auth.example' && url.pathname === '/authorize')
      return route.fulfill({
        contentType: 'text/html',
        body: '<h1>Synthetic authorization server</h1>',
      })
    throw new Error(`Unexpected outbound fixture request: ${url.href}`)
  })
  const signInPage = await authorization.newPage()
  await signInPage.goto(base)
  await signInPage.getByRole('textbox', { name: 'Your account handle' }).fill('test.example')
  await signInPage.getByRole('button', { name: 'Sign in with Bluesky' }).click()
  try {
    await signInPage
      .getByRole('heading', { name: 'Synthetic authorization server' })
      .waitFor({ timeout: 10000 })
  } catch (error) {
    console.error({ requests, alert: await signInPage.getByRole('alert').allTextContents() })
    throw error
  }
  assert.equal(pushed.get('scope'), metadata.scope)
  assert.equal(pushed.get('redirect_uri'), base)
  assert.equal(new URL(pushed.get('client_id')).pathname, '/')
  assert.equal(new URL(pushed.get('client_id')).hostname, 'localhost')
  assert.equal(pushed.get('response_mode'), 'fragment')
  assert.equal(pushed.get('code_challenge_method'), 'S256')
  assert.ok(pushed.get('code_challenge'))
  assert.equal(
    requests.some((url) => url.includes('/token')),
    false
  )
  checks++
  await authorization.close()
  console.log(
    `PASS ${checks} Chromium checks: real SDK IP/localhost startup, callback scrub/preserved state, static metadata, mocked discovery/PAR/DPoP/authorization redirect. All external requests fulfilled locally; no tokens issued or account writes.`
  )
} finally {
  await browser.close()
  await new Promise((done) => server.close(done))
}
