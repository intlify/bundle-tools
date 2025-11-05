import { promises as fs } from 'fs'
import { parseSync } from 'oxc-parser'
import path from 'path'

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
    parseSync('test.js', code, {
      sourceType: 'module'
    })
    ret = true
  } catch (e) {
    console.log(`invalid syntax on \n${code}`)
    console.error(e)
  }
  return ret
}
