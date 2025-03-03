import pc from 'picocolors'
import { PKG_NAME } from '../constants'

export function warn(...args: unknown[]) {
  console.warn(pc.yellow(pc.bold(`[${PKG_NAME}] `)), ...args)
}

export function error(...args: unknown[]) {
  console.error(pc.red(pc.bold(`[${PKG_NAME}] `)), ...args)
}

export function raiseError(message: string) {
  throw new Error(`[${PKG_NAME}] ${message}`)
}

// TODO: extract warn/error messages similar to vue-i18n structure
export function getWebpackNotSupportedMessage(optionName: string) {
  return (
    `The '${optionName}' option still is not supported for webpack.\n` +
    `We are waiting for your Pull Request 🙂.`
  )
}
