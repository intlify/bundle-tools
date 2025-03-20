import { DOMWindow } from 'jsdom'

declare global {
  interface Window {
    module: any
    exports: any
  }
}
