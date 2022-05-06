# @intlify/unplugin-vue-i18n

[![Lint](https://github.com/intlify/bundle-tools/actions/workflows/lint.yml/badge.svg)](https://github.com/intlify/bundle-tools/actions/workflows/lint.yml)
[![Test](https://github.com/intlify/bundle-tools/actions/workflows/test.yml/badge.svg)](https://github.com/intlify/bundle-tools/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@intlify/unplugin-vue-i18n.svg?color=yellow)](https://www.npmjs.com/package/@intlify/unplugin-vue-i18n)


unplugin for Vue I18n

## 🌟 Features
- i18n resource pre-compilation
- i18n custom block
  - i18n resource definition
  - i18n resource importing
  - Locale of i18n resource definition
  - Locale of i18n resource definition for global scope
  - i18n resource formatting


## 💿 Installation

```sh
npm i @intlify/unplugin-vue-i18n
```

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import vueI18n from 'unplugin-vue-i18n/vite'

export default defineConfig({
  plugins: [
    vueI18n({ /* options */ }),
  ],
})
```

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
const VueI18nPlugin = require('unplugin-vue-i18n/webpack')

// webpack.config.js
module.exports = {
  /* ... */
  plugins: [
    VueI18nPlugin({ /* options */ })
  ]
}
```

<br></details>


## 🔧 Options

### `include`

- **Type:** `string | string[] | undefined`
- **Default:** `undefined`

  A [minimatch](https://github.com/isaacs/minimatch) pattern, or array of patterns, you can specify a path to pre-compile i18n resources files. The extensions of i18n resources to be precompiled are as follows:

  ```
  - json
  - json5
  - yaml
  - yml
  ```

  Note `json` resources matches this option, it will be handled **before the internal json plugin of Vite, and will not be processed afterwards**, else the option doesn't match, the Vite side will handle.

### `forceStringify`

- **Type:** `boolean`
- **Default:** `false`

  Whether pre-compile number and boolean values as message functions that return the string value.

  For example, the following json resources:

  ```json
  {
    "trueValue": true,
    "falseValue": false,
    "nullValue": null,
    "numberValue": 1
  }
  ```

  after pre-compiled (development):

  ```js
  export default {
    "trueValue": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["true"])};fn.source="true";return fn;})(),
    "falseValue": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["false"])};fn.source="false";return fn;})(),
    "nullValue": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["null"])};fn.source="null";return fn;})(),
    "numberValue": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["1"])};fn.source="1";return fn;})()
  }
  ```

### `defaultSFCLang`

- **Type:** `string`
- **Default:** `'json'`

  Specify the content for all your inlined `i18n` custom blocks on your `SFC`.

  `defaultSFCLang` must have one of the following values:

  ```
  - json
  - json5
  - yaml
  - yml
  ```

  On inlined `i18n` custom blocks that have specified the `lang` attribute, the `defaultSFCLang` is not applied.

  For example, with `defaultSFCLang: "yaml"` or `defaultSFCLang: "yml"`, this custom block:
  ```html
  <i18n lang="yaml">
  en:
    hello: Hello
  es:
    hello: Hola
  </i18n>
  ```

  and this another one, are equivalent:
  ```html
  <i18n>
  en:
    hello: Hello
  es:
    hello: Hola
  </i18n>
  ```

### `globalSFCScope`

- **Type:** `boolean`
- **Default:** `undefined`

  Whether to include all `i18n` custom blocks on your `SFC` on `global` scope.

  If `true`, it will be applied to all inlined `i18n` or `imported` custom blocks.

  **Warning**: beware enabling `globalSFCScope: true`, all `i18n` custom blocks in all your `SFC` will be on `global` scope.

  For example, with `globalSFCScope: true`, this custom block:

  ```html
  <i18n lang="yaml" global>
  en:
    hello: Hello
  es:
    hello: Hola
  </i18n>
  ```

  and this another one, are equivalent:

  ```html
  <i18n lang="yaml">
  en:
    hello: Hello
  es:
    hello: Hola
  </i18n>
  ```

  You can also use `defaultSFCLang: "yaml"`, following with previous example, this another is also equivalent to previous ones:

  ```html
  <i18n>
  en:
    hello: Hello
  es:
    hello: Hola
  </i18n>
  ```

### `bridge`

- **Type:** `boolean`
- **Default:** `false`

  The mode to birdge the i18n custom block to work in both vue-i18n@v8.x and vue-i18n@v9.x environments.

  To support in a smooth transition from vue-i18n@v8.x to vue-i18n@v9.x, we provide a mode that bundles the i18n custom block to be available in either version.

  > ⚠️ Note that if you set `bridge: true`, the bundle size will increase. It is recommended to disable this mode after the migration from vue-i18n@v8.26 to vue-i18n@v9.x is completed.

### `useClassComponent`

- **Type:** `boolean`
- **Default:** `false`

  This option that to use i18n custom blocks in `vue-class-component`.


## ✅ TODO
- [ ] Virtual resource importing 
- [ ] Bundling optimizations
- [ ] i18n custom block birdge mode (for vite)
- [ ] Support nuxt

## 📜 Changelog

Details changes for each release are documented in the [CHANGELOG.md](https://github.com/intlify/bundle-tools/blob/main/packages/unplugin-vue-i18n/CHANGELOG.md)

## ©️ License

[MIT](http://opensource.org/licenses/MIT)
