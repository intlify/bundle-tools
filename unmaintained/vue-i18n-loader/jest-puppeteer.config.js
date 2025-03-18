module.exports = {
  server: {
    port: 8080,
    launchTimeout: 10000,
    command: "webpack serve --config examples/webpack.config.js --inline --hot",
  },
  launch: {
    dumpio: false,
    headless: process.env.HEADLESS !== "false",
  },
  browser: "chromium",
  browserContext: "default",
};
