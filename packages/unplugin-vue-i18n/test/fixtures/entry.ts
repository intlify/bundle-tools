// @ts-ignore -- NOTE: Test
import Component from '~target'
// @ts-ignore -- NOTE: Test
import * as exports from '~target'

console.log('testtest', Component, exports)
if (typeof window !== 'undefined') {
  window.module = Component
  window.exports = exports
}
