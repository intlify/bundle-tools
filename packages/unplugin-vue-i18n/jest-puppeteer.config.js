module.exports = {
  server: {
    port: 8080,
    launchTimeout: 10000,
    command:
      'npx vite examples/vite --port 8080 -c examples/vite/vite.config.ts'
  },
  launch: {
    dumpio: false,
    headless: process.env.HEADLESS !== 'false'
  },
  browser: 'chromium',
  browserContext: 'default'
}
