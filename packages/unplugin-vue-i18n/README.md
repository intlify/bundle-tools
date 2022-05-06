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
import vueI18n from '@intlify/unplugin-vue-i18n/vite'

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
const VueI18nPlugin = require('@intlify/unplugin-vue-i18n/webpack')

// webpack.config.js
module.exports = {
  /* ... */
  plugins: [
    VueI18nPlugin({ /* options */ })
  ]
}
```

<br></details>

## 🚀 Usage

### i18n resources pre-compilation

Since `vue-i18n@v9.x`, the locale messages are handled with message compiler, which converts them to javascript functions after compiling. After compiling, message compiler converts them into javascript functions, which can improve the performance of the application.

However, with the message compiler, the javascript function conversion will not work in some environments (e.g. CSP). For this reason, `vue-i18n@v9.x` and later offer a full version that includes compiler and runtime, and a runtime only version.

If you are using the runtime version, you will need to compile before importing locale messages by managing them in a file such as `.json`.


### i18n custom block

The below example that `examples/vite/src/App.vue` have `i18n` custom block:

```vue
<template>
  <form>
    <label>{{ t('language') }}</label>
    <select v-model="locale">
      <option value="en">en</option>
      <option value="ja">ja</option>
    </select>
  </form>
  <p>{{ t('hello') }}</p>
  <Banana />
</template>

<script>
import { useI18n } from 'vue-i18n'
import Banana from './Banana.vue'

export default {
  name: 'App',
  components: {
    Banana
  },
  setup() {
    const { t, locale } = useI18n({
      inheritLocale: true,
      useScope: 'local'
    })
    return { t, locale }
  }
}
</script>

<i18n>
{
  "en": {
    "language": "Language",
    "hello": "hello, world!"
  },
  "ja": {
    "language": "言語",
    "hello": "こんにちは、世界！"
  }
}
</i18n>
```

### Locale Messages formatting

You can be used by specifying the following format in the `lang` attribute:

- json (default)
- yaml
- yml
- json5

example `yaml` format:

```vue
<i18n lang="yaml">
en:
  hello: 'Hello World!'
ja:
  hello: 'こんにちは、世界！'
</i18n>
```

### Static bundle importing

unplugin-vue-i18n allows you to statically bundle i18n resources such as `json` or `yaml` specified by the [`include` option](#include) of the plugin described below as locale messages with the `import` syntax.

In this case, only one i18n resource can be statically bundled at a time with `import` syntax, so the these code will be redundant for multiple locales.

```js
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
/*
 * The i18n resources in the path specified in the plugin `include` option can be read
 * as vue-i18n optimized locale messages using the import syntax
 */
import en from './src/locales/en.json'
import ja from './src/locales/ja.yaml'
import fr from './src/locales/fr.json5'

const i18n = createI18n({
  locale: 'en',
  messages: {
    en,
    ja,
    fr
  }
})

const app = createApp()
app.use(i18n).mount('#app')
```

unplugin-vue-i18n can use the bundler virtual mechanism to import all locales at once, using the special identifier `@intlify/unplugin-vue-i18n/messages`, as the bellow:

```js
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
/*
 * All i18n resources specified in the plugin `include` option can be loaded
 * at once using the import syntax
 */
import messages from '@intlify/unplugin-vue-i18n/messages'

const i18n = createI18n({
  locale: 'en',
  messages
})

const app = createApp()
app.use(i18n).mount('#app')
```

### Types

If you want type definition of `@intlify/unplugin-vue-i18n/messages`, add `unplugin-vue-i18n/messages` to `compilerOptions.types` of your tsconfig:

```json
{
  "compilerOptions": {
    "types": ["@intlify/unplugin-vue-i18n/messages"]
  }
}
```

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

  Note `json` resources matches this option, it will be handled **before the internal json plugin of bundler, and will not be processed afterwards**, else the option doesn't match, the bundler side will handle.

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
- [ ] Bundling optimizations
- [ ] Support nuxt

## 📜 Changelog

Details changes for each release are documented in the [CHANGELOG.md](https://github.com/intlify/bundle-tools/blob/main/packages/unplugin-vue-i18n/CHANGELOG.md)

## ©️ License

[MIT](http://opensource.org/licenses/MIT)
