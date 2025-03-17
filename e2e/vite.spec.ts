import { startServer } from './setup-server'
import { getText } from './helper'

import type { ServerContext } from './setup-server'
import type { Browser, Page } from 'playwright-core'
import { describe, expect, test, beforeAll, afterAll } from 'vitest'

// TODO: extract to shim.d.ts
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace global {
  let browser: Browser
  let page: Page
}

let ctx: ServerContext
describe('vite', () => {
  beforeAll(async () => {
    ctx = await startServer()
    await global.page.goto(ctx.url('/'))
  })

  afterAll(async () => {
    ctx.serverProcess.kill()
  })

  test('initial rendering', async () => {
    expect(await getText(global.page, '#lang label')).toMatch('言語')
    expect(await getText(global.page, '#fruits label')).toMatch(
      'バナナが欲しい？'
    )
    expect(await getText(global.page, '#msg')).toMatch('こんにちは、世界！')
    expect(await getText(global.page, '#custom-directive')).toMatch('やあ！')
  })

  test('change locale', async () => {
    await global.page.selectOption('#lang select', 'en')
    expect(await getText(global.page, '#lang label')).toMatch('Language')
    expect(await getText(global.page, '#msg')).toMatch('hello, world!')
    expect(await getText(global.page, '#custom-directive')).toMatch('Hi!')
  })

  test('change banana select', async () => {
    await global.page.selectOption('#fruits select', '3')
    expect(await getText(global.page, '#banana')).toMatch('バナナ 3 個')
  })
})
