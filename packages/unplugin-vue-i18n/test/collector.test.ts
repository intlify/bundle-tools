import { createUsedKeysCollector } from '../src/core/collector'

describe('UsedKeysCollector', () => {
  describe('addKey / shouldKeepKey', () => {
    test('keeps exact match keys', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('hello')
      collector.addKey('nested.greeting')
      expect(collector.shouldKeepKey('hello')).toBe(true)
      expect(collector.shouldKeepKey('nested.greeting')).toBe(true)
      expect(collector.shouldKeepKey('unused')).toBe(false)
    })

    test('keeps parent object keys (prefix matching)', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('nav.home')
      expect(collector.shouldKeepKey('nav')).toBe(true)
      expect(collector.shouldKeepKey('nav.home')).toBe(true)
      expect(collector.shouldKeepKey('nav.about')).toBe(false)
    })

    test('handles deeply nested prefixes', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('a.b.c.d')
      expect(collector.shouldKeepKey('a')).toBe(true)
      expect(collector.shouldKeepKey('a.b')).toBe(true)
      expect(collector.shouldKeepKey('a.b.c')).toBe(true)
      expect(collector.shouldKeepKey('a.b.c.d')).toBe(true)
      expect(collector.shouldKeepKey('a.b.c.e')).toBe(false)
      expect(collector.shouldKeepKey('a.x')).toBe(false)
    })
  })

  describe('dynamicKeyStrategy', () => {
    test('keep-all: keeps all keys when dynamic detected', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('hello')
      collector.markDynamic()
      expect(collector.shouldKeepKey('anything')).toBe(true)
      expect(collector.shouldKeepKey('random.key')).toBe(true)
    })

    test('keep-all: normal filtering when no dynamic keys', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('hello')
      // no markDynamic() called
      expect(collector.shouldKeepKey('hello')).toBe(true)
      expect(collector.shouldKeepKey('unused')).toBe(false)
    })

    test('ignore: continues filtering despite dynamic keys', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'ignore' })
      collector.addKey('hello')
      collector.markDynamic()
      expect(collector.shouldKeepKey('hello')).toBe(true)
      expect(collector.shouldKeepKey('anything')).toBe(false)
    })
  })

  describe('safelist', () => {
    test('keeps keys matching single-level wildcard', () => {
      const collector = createUsedKeysCollector({
        dynamicKeyStrategy: 'keep-all',
        safelist: ['errors.*']
      })
      expect(collector.shouldKeepKey('errors.notFound')).toBe(true)
      expect(collector.shouldKeepKey('errors.timeout')).toBe(true)
      expect(collector.shouldKeepKey('errors.nested.deep')).toBe(false)
      expect(collector.shouldKeepKey('random.key')).toBe(false)
    })

    test('keeps keys matching double-level wildcard', () => {
      const collector = createUsedKeysCollector({
        dynamicKeyStrategy: 'keep-all',
        safelist: ['validation.**']
      })
      expect(collector.shouldKeepKey('validation.email')).toBe(true)
      expect(collector.shouldKeepKey('validation.email.required')).toBe(true)
      expect(collector.shouldKeepKey('random.key')).toBe(false)
    })

    test('keeps keys matching exact pattern', () => {
      const collector = createUsedKeysCollector({
        dynamicKeyStrategy: 'keep-all',
        safelist: ['specific.key']
      })
      expect(collector.shouldKeepKey('specific.key')).toBe(true)
      expect(collector.shouldKeepKey('specific.other')).toBe(false)
    })
  })

  describe('diagnostics', () => {
    test('tracks removed keys by file', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      collector.addKey('hello')
      collector.reportRemoved('en.json', 'unused')
      collector.reportRemoved('en.json', 'other')
      collector.reportRemoved('ja.json', 'another')
      const diag = collector.getDiagnostics()
      expect(diag.totalRemoved).toBe(3)
      expect(diag.byFile.get('en.json')).toEqual(['unused', 'other'])
      expect(diag.byFile.get('ja.json')).toEqual(['another'])
    })

    test('returns zero when nothing removed', () => {
      const collector = createUsedKeysCollector({ dynamicKeyStrategy: 'keep-all' })
      const diag = collector.getDiagnostics()
      expect(diag.totalRemoved).toBe(0)
    })
  })
})
