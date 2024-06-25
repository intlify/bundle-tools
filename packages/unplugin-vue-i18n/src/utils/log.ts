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
