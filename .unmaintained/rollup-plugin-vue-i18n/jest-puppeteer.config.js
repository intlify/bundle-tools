module.exports = {
  server: {
    port: 8080,
    launchTimeout: 10000,
    command: 'serve ./examples -p 8080'
  },
  launch: {
    dumpio: false,
    headless: process.env.HEADLESS !== 'false'
  },
  browser: 'chromium',
  browserContext: 'default'
}
