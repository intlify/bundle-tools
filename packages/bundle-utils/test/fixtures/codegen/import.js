import mod1 from './module1'
import { mod2, mod3 as testing } from './module2'

export default {
  foo: 'foo',
  mod1,
  nest: {
    bar: 'bar',
    mod2: mod2
  },
  toot: testing
}
