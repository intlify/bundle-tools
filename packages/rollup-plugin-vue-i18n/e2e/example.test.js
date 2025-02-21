describe('composition', () => {
  beforeAll(async () => {
    await page.goto(`http://localhost:8080/composition/`)
  })

  test('initial rendering', async () => {
    await expect(page).toMatch('言語')
    await expect(page).toMatch('こんにちは、世界！')
    await expect(page).toMatch('バナナが欲しい？')
  })

  test('change locale', async () => {
    await page.select('#app select', 'en')
    await expect(page).toMatch('Language')
    await expect(page).toMatch('hello, world!')
  })

  test('change select', async () => {
    await page.select('#fruits select', '2')
    await expect(page).toMatch('バナナ 2 個')
  })
})

describe('legacy', () => {
  beforeAll(async () => {
    await page.goto(`http://localhost:8080/legacy/`)
  })

  test('initial rendering', async () => {
    await expect(page).toMatch('言語')
    await expect(page).toMatch('こんにちは、世界！')
    await expect(page).toMatch('バナナが欲しい？')
  })

  test('change select', async () => {
    await page.select('#fruits select', '2')
    await expect(page).toMatch('バナナ 2 個')
  })

  test('change locale', async () => {
    await page.select('#app select', 'en')
    await expect(page).toMatch('Language')
    await expect(page).toMatch('hello, world!')
    await expect(page).toMatch('Do you want banana?')
    await expect(page).toMatch('2 bananas')
  })
})

describe('global', () => {
  beforeAll(async () => {
    await page.goto(`http://localhost:8080/global/`)
  })

  test('initial rendering', async () => {
    await expect(page).toMatch('言語')
    await expect(page).toMatch('こんにちは、世界！')
  })

  test('change locale', async () => {
    await page.select('#app select', 'en')
    await expect(page).toMatch('Language')
    await expect(page).toMatch('hello, world!')
  })
})
