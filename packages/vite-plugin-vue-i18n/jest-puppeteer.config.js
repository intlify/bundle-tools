module.exports = {
  server: {
    port: 8080,
    launchTimeout: 10000,
    command: 'npx vite examples --port 8080 -c examples/vite.config.ts'
  },
  launch: {
    dumpio: false,
    headless: process.env.HEADLESS !== 'false'
  },
  browser: 'chromium',
  browserContext: 'default'
}
