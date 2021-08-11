# @intlify/rollup-plugin-vue-i18n

[![Lint](https://github.com/intlify/bundle-tools/actions/workflows/lint.yml/badge.svg)](https://github.com/intlify/bundle-tools/actions/workflows/lint.yml)
[![Test](https://github.com/intlify/bundle-tools/actions/workflows/test.yml/badge.svg)](https://github.com/intlify/bundle-tools/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@intlify/rollup-plugin-vue-i18n.svg?color=red)](https://www.npmjs.com/package/@intlify/rollup-plugin-vue-i18n)

Rollup plugin for Vue I18n


## ⚠️ Notice

This package of `@intlify/bundle-tools` is for Vue I18n v9 or later!

The version for Vue I18n v8.x is now in [`@intlify/rollup-plugin-vue-i18n`](https://github.com/intlify/rollup-plugin-vue-i18n/tree/master) repo!


## ❗ Requirement

You need to install the follwoing:

- `rollup-plugin-vue@6.0.0`

If you use rollup-plugin-vue, We recommend you should read the [docs](https://rollup-plugin-vue.vuejs.org/)


## 🌟 Features
- i18n resources pre-compilation
- i18n custom block


## 💿 Installation

### npm

```sh
$ npm i --save-dev @intlify/rollup-plugin-vue-i18n@next
```

### yarn

```sh
$ yarn add -D @intlify/rollup-plugin-vue-i18n@next
```

## 🚀 Usages

### i18n resource pre-compilation

Since `vue-i18n@v9.0`, The locale messages are handled with message compiler, which converts them to javascript functions after compiling. After compiling, message compiler converts them into javascript functions, which can improve the performance of the application.

However, with the message compiler, the javascript function conversion will not work in some environments (e.g. CSP). For this reason, `vue-i18n@v9.0` and later offer a full version that includes compiler and runtime, and a runtime only version.

If you are using the runtime version, you will need to compile before importing locale messages by managing them in a file such as `.json`.

#### Rollup Config

The below rollup configi example:

```js
import VuePlugin from 'rollup-plugin-vue'
import VueI18nPlugin from 'rollup-plugin-vue-i18n'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'

export default [
  {
    input: path.resolve(__dirname, `./path/to/src/main.js`),
    output: {
      file: path.resolve(__dirname, `./path/to/dist/index.js`),
      format: 'cjs'
    },
    plugins: [
      // set `customBlocks` opton to `rollup-plugin-vue`
      VuePlugin({ customBlocks: ['i18n'] }),
      // set `rollup-plugin-vue-i18n` after **`rollup-plugin-vue`**
      VueI18nPlugin({
        // `include` option for i18n resources bundling
        include: path.resolve(__dirname, `./path/to/src/locales/**`)
      }),
      resolve(),
      commonjs()
    ]
  }
]
```

#### Notes on using with other i18n resource loading plugins

If you use the plugin like `@rollup/plugin-json`, make sure that the i18n resource to be pre-compiled with `rollup-plugin-vue-i18n` is not loaded. you need to filter with the plugin options.


### `i18n` custom block

the below example that `examples/composition/App.vue` have `i18n` custom block:

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
- json5

example `yaml` foramt:

```vue
<i18n lang="yaml">
en:
  hello: "Hello World!"
ja:
  hello: "こんにちは、世界！"
</i18n>
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


### `forceStringify`

- **Type:** `boolean`
- **Default:** `false`

  Whether pre-compile number and boolean values as message functions that return the string value.

  for example, the following json resources:

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

  Configration example:

  ```ts
  import VuePlugin from 'rollup-plugin-vue'
  import VueI18nPlugin from 'rollup-plugin-vue-i18n'
  import resolve from '@rollup/plugin-node-resolve'
  import commonjs from '@rollup/plugin-commonjs'
  import path from 'path'

  export default [
    {
      input: path.resolve(__dirname, `./src/main.js`),
      output: {
        file: path.resolve(__dirname, `./dist/index.js`),
        format: 'cjs'
      },
      plugins: [
        VuePlugin({ customBlocks: ['i18n'] }),
        VueI18nPlugin({
          include: path.resolve(__dirname, `./path/to/src/locales/**`)
          // `forceStringify` option
          forceStringify: true
        }),
        resolve(),
        commonjs()
      ]
    }
  ]
  ```

## 📜 Changelog
Details changes for each release are documented in the [CHANGELOG.md](https://github.com/intlify/bundle-tools/blob/main/packages/rollup-plugin-vue-i18n/CHANGELOG.md)


## ©️ License

[MIT](http://opensource.org/licenses/MIT)
