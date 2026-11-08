// Synthetic presentation checks. No fixture code is shipped in the application.
import { pathToFileURL, URL } from 'node:url'
import process from 'node:process'
import console from 'node:console'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    pathToFileURL(
      `${process.env.HOME}/.local/share/malone-cli-tools/playwright/node_modules/playwright/index.mjs`
    ).href
)
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const port = server.httpServer.address().port
const base = `http://127.0.0.1:${port}/SelfStarter/`
const output = 'artifacts/minimal-copy'
await mkdir(output, { recursive: true })
const names = [
  'Orbit Garden',
  'Paper Lantern',
  'Moss & Morning',
  'Little Observatory',
  'Bluebird Studio',
  'Weekend Sketchbook',
  'Field Notes',
  'Open Window',
]
const users = names.map((displayName, index) => ({
  did: `did:plc:synthetic${index}`,
  handle: `${displayName.toLowerCase().replace(/[^a-z]+/g, '-')}.example`,
  displayName,
  interactionCount: 0,
  interactions: {
    likes: 44 - index * 4,
    replies: 15 - index,
    reposts: 9 - index,
    mentions: 4,
    quotes: index % 3,
  },
}))
const hooks = `import React from '/SelfStarter/node_modules/.vite/deps/react.js'; const { useState, useRef } = React;
export function useBlueskyAuth() { const [session, setSession] = useState(null); return { session, isLoading: false, error: null, login: async () => setSession({ did: 'did:plc:syntheticpublisher', handle: 'starter-garden.example' }), logout: async () => setSession(null) } }
export function useInteractions() { const [isLoading, setLoading] = useState(false); const generation = useRef(0); return { isLoading, error: null, progress: 'Counting likes, replies, reposts, mentions, and quotes…', cancel: () => { generation.current++; setLoading(false) }, analyze: async () => { const version = ++generation.current; setLoading(true); await new Promise(resolve => setTimeout(resolve, 700)); if (version !== generation.current) return null; setLoading(false); return ${JSON.stringify(users)} }, reset: () => { generation.current++; setLoading(false) } } }
export function useStarterPack() { return { isPublishing: false, publishedUrl: null, error: null, publish: async () => { throw new Error('Synthetic checks never publish') }, reset: () => {} } }`
const browser = await chromium.launch({ headless: true })
let checks = 0
try {
  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 1100 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    const external = []
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.hostname !== '127.0.0.1') {
        external.push(url.href)
        return route.abort()
      }
      if (url.pathname.endsWith('/src/popup/hooks/index.ts'))
        return route.fulfill({ contentType: 'text/javascript', body: hooks })
      return route.continue()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
      console.error('Browser error:', error.message)
    })
    await page.goto(base)
    await page.getByRole('button', { name: 'Analyze' }).waitFor()
    await page.locator('.brand-mark img').evaluate(async (image) => {
      await image.decode()
      if (!image.complete || image.naturalWidth !== 64) throw new Error('Brand icon did not load')
    })
    assert.equal(await page.title(), 'SelfStarter')
    assert.doesNotMatch(
      await page.locator('body').innerText(),
      /good conversations|great starting point|good place to start|made for bluesky|who’s in the conversation|make it yours|nothing is published|public data only|review before publishing|never collects|on your terms/i
    )
    assert.equal(await page.getByRole('heading', { name: 'Accounts', exact: true }).count(), 1)
    const favicon = await page.locator('link[rel=icon]').getAttribute('href')
    assert.ok(favicon.endsWith('/selfstarter.svg'))
    assert.equal((await page.request.get(new URL(favicon, base).href)).status(), 200)
    await page.locator('.site-header').screenshot({ path: `${output}/${label}-header.png` })
    await page.screenshot({ path: `${output}/${label}-empty.png`, fullPage: true })
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      ),
      true
    )
    await page
      .locator('.analysis-form')
      .getByRole('textbox', { name: 'Handle', exact: true })
      .fill('conversation-garden.example')
    await page.getByRole('button', { name: 'Analyze' }).click()
    await page
      .getByRole('status')
      .filter({ hasText: 'Counting likes, replies, reposts, mentions, and quotes…' })
      .waitFor()
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Analyze' }).isEnabled(), true)
    assert.equal(await page.getByRole('checkbox', { name: /^Select @/ }).count(), 0)
    await page.getByRole('button', { name: 'Analyze' }).click()
    await page.getByText('Orbit Garden', { exact: true }).waitFor()
    await page.screenshot({ path: `${output}/${label}-results.png`, fullPage: true })
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      ),
      true
    )
    await page.getByRole('button', { name: 'None', exact: true }).click()
    await page.getByRole('slider', { name: 'Likes' }).fill('7')
    assert.equal(
      await page
        .getByRole('checkbox', { name: /^Select @/ })
        .evaluateAll((items) => items.filter((item) => item.checked).length),
      0
    )
    await page.getByRole('searchbox', { name: 'Filter profiles' }).fill('Orbit')
    assert.equal(await page.getByRole('checkbox', { name: /^Select @/ }).count(), 1)
    await page.getByRole('checkbox', { name: /^Select @/ }).focus()
    await page.keyboard.press('Space')
    assert.equal(await page.getByRole('checkbox', { name: /^Select @/ }).isChecked(), true)
    await page.getByRole('searchbox', { name: 'Filter profiles' }).fill('')
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await page
      .locator('.auth-form')
      .getByRole('textbox', { name: 'Handle', exact: true })
      .fill('starter-garden.example')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('button', { name: 'Review' }).waitFor()
    await page.getByRole('button', { name: 'Review' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(await dialog.getByText('@starter-garden.example', { exact: true }).count(), 1)
    assert.equal(await dialog.getByText('@orbit-garden.example', { exact: true }).count(), 1)
    await page.screenshot({ path: `${output}/${label}-confirmation.png` })
    await page.keyboard.press('Tab')
    assert.equal(
      await dialog
        .getByRole('textbox', { name: 'Name *', exact: true })
        .evaluate((element) => globalThis.document.activeElement === element),
      false
    )
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.getByRole('button', { name: 'Review' }).scrollIntoViewIfNeeded()
    const bottom = await page.locator('.selection-bar').boundingBox()
    assert.ok(bottom && bottom.y + bottom.height <= viewport.height + 1)
    await page.evaluate(() =>
      globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight)
    )
    const lastProfile = await page.locator('.profile-card').last().boundingBox()
    assert.equal(await page.locator('.page-footer').count(), 0)
    assert.ok(
      lastProfile && bottom && lastProfile.y + lastProfile.height < bottom.y,
      'Last profile must scroll clear of the selection bar'
    )
    await page.screenshot({ path: `${output}/${label}-bottom.png` })
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    checks++
    await context.close()
  }
  console.log(
    `Passed ${checks} viewport workflows: empty/results/confirmation screenshots, no overflow, loading, None + rerank, filter, keyboard selection, account review, Escape, fixed action bar, zero external requests/page errors.`
  )
} finally {
  await browser.close()
  await server.close()
}
