import { promises as fs } from 'fs'

export function warn(...args: unknown[]) {
  console.warn(`[unplugin-vue-i18n] `, ...args)
}

export function error(...args: unknown[]) {
  console.error(`[unplugin-vue-i18n] `, ...args)
}

export async function getRaw(path: string): Promise<string> {
  return fs.readFile(path, { encoding: 'utf-8' })
}

export function raiseError(message: string) {
  throw new Error(`[unplugin-vue-i18n] ${message}`)
}
