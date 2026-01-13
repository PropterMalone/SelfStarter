import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Mock Chrome APIs
const mockStorage: Record<string, unknown> = {}

globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string | string[] | null) => {
        return new Promise((resolve) => {
          if (keys === null) {
            resolve(mockStorage)
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage[keys] })
          } else {
            const result: Record<string, unknown> = {}
            for (const key of keys) {
              result[key] = mockStorage[key]
            }
            resolve(result)
          }
        })
      },
      set: (items: Record<string, unknown>) => {
        return new Promise<void>((resolve) => {
          Object.assign(mockStorage, items)
          resolve()
        })
      },
      remove: (keys: string | string[]) => {
        return new Promise<void>((resolve) => {
          const keysArray = typeof keys === 'string' ? [keys] : keys
          for (const key of keysArray) {
            delete mockStorage[key]
          }
          resolve()
        })
      },
    },
  },
} as unknown as typeof chrome

// Reset storage between tests
beforeEach(() => {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key]
  }
})
