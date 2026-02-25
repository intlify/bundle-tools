import { filterMessageKeys, filterMultiLocaleMessages } from '../../src/codegen'
import { generate as generateJSON } from '../../src/json'
import { generate as generateYAML } from '../../src/yaml'

describe('filterMessageKeys', () => {
  test('flat keys: keeps used, removes unused', () => {
    const messages = { hello: 'hello!', goodbye: 'goodbye!', unused: 'unused!' }
    const usedKeys = new Set(['hello', 'goodbye'])
    const result = filterMessageKeys(messages, key => usedKeys.has(key))
    expect(result).toEqual({ hello: 'hello!', goodbye: 'goodbye!' })
  })

  test('nested keys: keeps parent objects for used children', () => {
    const messages = {
      nav: { home: 'Home', about: 'About', contact: 'Contact' },
      footer: { copyright: '2024' }
    }
    const usedKeys = new Set(['nav.home'])
    const shouldKeep = (key: string) =>
      usedKeys.has(key) || [...usedKeys].some(k => k.startsWith(key + '.'))
    const result = filterMessageKeys(messages, shouldKeep)
    expect(result).toEqual({ nav: { home: 'Home' } })
  })

  test('deeply nested keys', () => {
    const messages = {
      a: { b: { c: { d: 'deep' }, e: 'shallow' } }
    }
    const usedKeys = new Set(['a.b.c.d'])
    const shouldKeep = (key: string) =>
      usedKeys.has(key) || [...usedKeys].some(k => k.startsWith(key + '.'))
    const result = filterMessageKeys(messages, shouldKeep)
    expect(result).toEqual({ a: { b: { c: { d: 'deep' } } } })
  })

  test('empty result when no keys match', () => {
    const messages = { hello: 'hello!' }
    const result = filterMessageKeys(messages, () => false)
    expect(result).toEqual({})
  })

  test('all keys kept when all match', () => {
    const messages = { a: '1', b: '2' }
    const result = filterMessageKeys(messages, () => true)
    expect(result).toEqual(messages)
  })

  test('array values preserved when key matches', () => {
    const messages = { errors: ['E001', 'E002'], unused: 'x' }
    const result = filterMessageKeys(messages, key => key === 'errors')
    expect(result).toEqual({ errors: ['E001', 'E002'] })
  })

  test('sibling keys: keeps only matching siblings', () => {
    const messages = {
      nav: { home: 'Home', about: 'About' },
      auth: { login: 'Login', logout: 'Logout' }
    }
    const usedKeys = new Set(['nav.home', 'auth.login'])
    const shouldKeep = (key: string) =>
      usedKeys.has(key) || [...usedKeys].some(k => k.startsWith(key + '.'))
    const result = filterMessageKeys(messages, shouldKeep)
    expect(result).toEqual({
      nav: { home: 'Home' },
      auth: { login: 'Login' }
    })
  })
})

describe('filterMultiLocaleMessages', () => {
  test('filters keys within each locale independently', () => {
    const messages = {
      en: { hello: 'Hello', unused: 'X' },
      ja: { hello: 'こんにちは', unused: 'Y' }
    }
    const result = filterMultiLocaleMessages(messages, key => key === 'hello')
    expect(result).toEqual({
      en: { hello: 'Hello' },
      ja: { hello: 'こんにちは' }
    })
  })

  test('removes empty locale entries', () => {
    const messages = {
      en: { hello: 'Hello' },
      ja: { unused: 'Y' }
    }
    const result = filterMultiLocaleMessages(messages, key => key === 'hello')
    expect(result).toEqual({ en: { hello: 'Hello' } })
  })

  test('preserves non-object locale values', () => {
    const messages = {
      en: { hello: 'Hello' },
      count: 42
    } as Record<string, unknown>
    const result = filterMultiLocaleMessages(messages, key => key === 'hello')
    expect(result).toEqual({ en: { hello: 'Hello' }, count: 42 })
  })
})

describe('generateJSON with usedKeyFilter', () => {
  test('filters unused keys from output', () => {
    const source = JSON.stringify({
      hello: 'hello world!',
      unused: 'this should be removed',
      nested: { greeting: 'hi', farewell: 'bye' }
    })
    const { code } = generateJSON(source, {
      env: 'production',
      usedKeyFilter: key => key === 'hello' || key === 'nested.greeting' || key === 'nested' // parent needed
    })
    expect(code).toContain('hello')
    expect(code).toContain('greeting')
    expect(code).not.toContain('unused')
    expect(code).not.toContain('farewell')
  })

  test('generates valid code when all keys filtered', () => {
    const source = JSON.stringify({ unused: 'remove me' })
    const { code } = generateJSON(source, {
      env: 'production',
      usedKeyFilter: () => false
    })
    // Empty object generates a resource with no keys
    expect(code).not.toContain('unused')
    expect(code).not.toContain('remove me')
  })
})

describe('generateYAML with usedKeyFilter', () => {
  test('filters unused keys from output', () => {
    const source = `hello: hello world!
unused: this should be removed
nested:
  greeting: hi
  farewell: bye`
    const { code } = generateYAML(source, {
      env: 'production',
      usedKeyFilter: key => key === 'hello' || key === 'nested.greeting' || key === 'nested'
    })
    expect(code).toContain('hello')
    expect(code).toContain('greeting')
    expect(code).not.toContain('unused')
    expect(code).not.toContain('farewell')
  })
})
