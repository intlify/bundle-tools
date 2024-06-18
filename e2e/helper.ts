import type { Page } from 'playwright'

export async function getText(
  page: Page,
  selector: string,
  options?: Parameters<Page['locator']>[1]
) {
  return (await page.locator(selector, options).allTextContents())[0]
}
