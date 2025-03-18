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
$ pnpm # install the dependencies of the project
```

A high level overview of tools used:

- [TypeScript](https://www.typescriptlang.org/) as the development language
- [Vitest](https://vitest.dev/) for unit testing and e2e testing
- [Playwright](https://pptr.dev/) for e2e testing
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io/) for code formatting

## Scripts

### `pnpm build`

The `build` script builds transpile to CommonJS module file.

### `pnpm test`

The `pnpm test` script simply calls the `vitest` binary

```sh
# run all tests
$ pnpm test

# run unit tests
$ pnpm test:unit

# run unit test coverages
$ pnpm test:cover

# run unit tests in watch mode
$ pnpm test:watch

# run e2e tests
$ pnpm test:e2e
```

## Contributing Tests

Unit tests are collocated with directories named `test` at each package. Consult the [Vitest docs](https://vitest.dev/) and existing test cases for how to write new test specs. Here are some additional guidelines:
