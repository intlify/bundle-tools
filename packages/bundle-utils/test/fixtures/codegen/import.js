import mod1 from './module1'
import { mod2 } from './module2'

export default {
  foo: 'foo',
  mod1,
  nest: {
    bar: 'bar',
    mod2: mod2
  }
}
