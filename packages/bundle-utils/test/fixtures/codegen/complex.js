const val1 = 1
export default {
  hi: 'hi there!',
  nested: {
    hello: `hello world!`,
    more: {
      plural: "@.caml:{'no apples'} | {0} apple | {n} apples"
    },
    list: 'hi, {0} !'
  },
  template: `hello ${val1} world!`,
  こんにちは: 'こんにちは！',
  'single-quote': "I don't know!",
  emoji: '😺',
  unicode: '\u0041',
  'unicode-escape': '\\u0041',
  'backslash-single-quote': "\\'",
  'backslash-backslash': '\\\\',
  errors: ['ERROR1001', 'ERROR1002'],
  complex: {
    warnings: [
      'NOTE: This is warning',
      {
        'named-waring': 'this is {type} warining'
      }
    ]
  }
}
