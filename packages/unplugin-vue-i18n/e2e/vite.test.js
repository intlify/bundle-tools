describe('vite', () => {
  beforeAll(async () => {
    await page.goto(`http://localhost:8080/`)
  })

  test('initial rendering', async () => {
    await expect(page).toMatch('言語')
    await expect(page).toMatch('こんにちは、世界！')
    await expect(page).toMatch('バナナが欲しい？')
    await expect(page).toMatch('バナナ 0 個')
    await expect(page).toMatch('やあ！')
  })

  test('change locale', async () => {
    await page.select('#app select', 'en')
    await expect(page).toMatch('Language')
    await expect(page).toMatch('hello, world!')
    await expect(page).toMatch('Hi!')
  })

  test('change banana select', async () => {
    await page.select('#fruits select', '3')
    await expect(page).toMatch('バナナ 3 個')
  })
})
