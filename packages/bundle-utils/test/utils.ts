import { parse } from 'acorn'
import path from 'path'
import { promises as fs } from 'fs'

export async function readFile(
  filepath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<{ filename: string; source: string }> {
  const filename = path.resolve(__dirname, filepath)
  const source = await fs.readFile(filename, { encoding })
  return { filename, source }
}

export function validateSyntax(code: string): boolean {
  let ret = false
  try {
    parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })
    ret = true
  } catch (e) {
    console.log(`invalid sytanx on \n${code}`)
    console.error(e)
  }
  return ret
}
