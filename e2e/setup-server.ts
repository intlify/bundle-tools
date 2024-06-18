import { getRandomPort, waitForPort } from 'get-port-please'
import { ChildProcess, spawn } from 'node:child_process'

export type ServerContext = {
  serverProcess: ChildProcess
  url: (val: string) => string
}
export async function startServer(): Promise<ServerContext> {
  const host = '127.0.0.1'
  const port = await getRandomPort(host)

  const serverProcess = spawn(
    'pnpm',
    ['play:vite', '--port', String(port), '--host', host],
    { stdio: 'inherit', env: { ...process.env } }
  )

  await waitForPort(port, { retries: 32, host })

  return {
    serverProcess,
    url: (val: string) => `http://${host}:${port}${val}`
  }
}
