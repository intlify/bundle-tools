import Locale from '~target'
import * as exports from '~target'

if (typeof window !== 'undefined') {
  window.module = Locale
  window.exports = exports
}

export default Locale
