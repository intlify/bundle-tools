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

You will need [Node.js](http://nodejs.org) **version 18+**, and [PNPM v10](https://pnpm.io/).

After cloning the repo, run:

```sh
$ yarn # install the dependencies of the project
```

A high level overview of tools used:

- [TypeScript](https://www.typescriptlang.org/) as the development language
- [Vite](https://vitejs.dev/) for bundling at `@intlify/vite-plugin-vue-i18n`
- [Webpack](https://webpack.js.org/) for bundling at `@intlify/vue-i18n-loader`
- [Vitest](https://vitest.dev/) for unit testing and e2e testing
- [Playwright](https://playwright.dev/) for e2e testing
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io/) for code formatting

## Scripts

### `pnpm build`

The `build` script builds transpile to ES Modules and CommonJS file with [`unbuild`](https://github.com/unjs/unbuild).

### `pnpm test`

The `pnpm test` script simply calls the `vitest` binary, so all [Vitest CLI Options](https://vitest.dev/guide/cli.html) can be used. Some examples:

```bash
# run all tests
$ pnpm test

# run unit tests
$ pnpm test:unit

# run e2e tests
$ pnpm test:e2e
```

## Contributing Tests

Unit tests are collocated with directories named `test` at each package. Consult the [Vitest docs](https://vitest.dev/api/) and existing test cases for how to write new test specs. Here are some additional guidelines:
