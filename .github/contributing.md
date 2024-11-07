# `@intlify/bundle-tools` Contributing Guide

Hi! We are really excited that you are interested in contributing to `@intlify/bundle-tools`. Before submitting your contribution, please make sure to take a moment and read through the following guide:

## Work Step Example

- Fork the repository from [`@intlify/bundle-tools`](https://github.com/intlify/bundle-tools) !
- Create your topic branch from `main`: `git branch my-new-topic origin/main`
- Add codes and pass tests !
- Commit your changes: `git commit -am 'Add some topic'`
- Push to the branch: `git push origin my-new-topic`
- Submit a pull request to `main` branch of `@intlify/bundle-tools` repository !

## Development Setup

You will need [Node.js](http://nodejs.org) **version 12+**, and [Yarn v1](https://classic.yarnpkg.com/).

After cloning the repo, run:

```sh
$ yarn # install the dependencies of the project
```

A high level overview of tools used:

- [TypeScript](https://www.typescriptlang.org/) as the development language
- [Vite](https://vitejs.dev/) for bundling at `@intlify/vite-plugin-vue-i18n`
- [webpack](https://webpack.js.org/) for bundling at `@intlify/vue-i18n-loader`
- [Rollup](https://rollupjs.org) for bundling at `@intlify/rollup-plugin-vue-i18n`
- [Jest](https://jestjs.io/) for unit testing and e2e testing
- [Puppeteer](https://pptr.dev/) for e2e testing
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io/) for code formatting

## Scripts

### `yarn build`

The `build` script builds transpile to CommonJS module file.

### `yarn test`

The `yarn test` script simply calls the `jest` binary, so all [Jest CLI Options](https://jestjs.io/docs/en/cli) can be used. Some examples:

```bash
# run all tests
$ yarn test

# run unit tests
$ yarn test:unit

# run unit test coverages
$ yarn test:cover

# run unit tests in watch mode
$ yarn test:watch

# run e2e tests
$ yarn test:e2e
```

## Contributing Tests

Unit tests are collocated with directories named `test` at each package. Consult the [Jest docs](https://jestjs.io/docs/en/using-matchers) and existing test cases for how to write new test specs. Here are some additional guidelines:
