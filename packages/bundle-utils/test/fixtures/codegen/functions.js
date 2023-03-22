export default {
  hello: 'hello',
  pagination: {
    pages: ({ named }) => `${named('number')}/page`,
    total: ({ named }) => `${named('number')} records in total`
  },
  foo: {
    bar: 'bar'
  }
}
