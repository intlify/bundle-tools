<p align="center"><img width="373px" height="168px" src="./assets/vue-i18n-loader.png" alt="Vue I18n Loader logo"></p>

<h1 align="center">@intlify/vue-i18n-loader</h1>

<p align="center">
  <a href="https://github.com/intlify/bundle-tools/actions/workflows/lint.yml"><img src="https://github.com/intlify/bundle-tools/actions/workflows/lint.yml/badge.svg" alt="Lint Status"></a>
  <a href="https://github.com/intlify/bundle-tools/actions/workflows/test.yml"><img src="https://github.com/intlify/bundle-tools/actions/workflows/test.yml/badge.svg" alt="Test Status"></a>
  <a href="https://www.npmjs.com/package/@intlify/vue-i18n-loader"><img src="https://img.shields.io/npm/v/@intlify/vue-i18n-loader.svg?label=%20&color=blue" alt="npm"></a>
</p>

<h2 align="center">vue-i18n for webpack loader</h2>

<br/>

## ⚠️ Notice

This package of `@intlify/bundle-tools` is for **Vue I18n v9 or later**!

The version **for Vue I18n v8.x** is now in [`@intlify/vue-i18n-loader`](https://github.com/intlify/vue-i18n-loader/tree/master) **v1.x!**


## 🌟 Features
- i18n resource pre-compilation
- i18n custom block
  - i18n resource definition
  - i18n resource importing
  - Locale of i18n resource definition
  - Locale of i18n resource definition for global scope
  - i18n resource formatting
- i18n custom block birdge mode


## 💿 Installation

### npm

```sh
$ npm i --save-dev @intlify/vue-i18n-loader@next
```

### yarn

```sh
$ yarn add -D @intlify/vue-i18n-loader@next
```

## 🚀 i18n resource pre-compilation

### Why do we need to require the configuration?

Since vue-i18n@v9.0, The locale messages are handled with message compiler, which converts them to javascript functions after compiling. After compiling, message compiler converts them into javascript functions, which can improve the performance of the application.

However, with the message compiler, the javascript function conversion will not work in some environments (e.g. CSP). For this reason, vue-i18n@v9.0 and later offer a full version that includes compiler and runtime, and a runtime only version.

If you are using the runtime version, you will need to compile before importing locale messages by managing them in a file such as `.json`.

You can pre-compile by configuring vue-i18n-loader as the webpack loader.

### webpack configration

As an example, if your project has the locale messagess in `src/locales`, your webpack config will look like this:

```
├── dist
├── index.html
├── package.json
├── src
│   ├── App.vue
│   ├── locales
│   │   ├── en.json
│   │   └── ja.json
│   └── main.js
└── webpack.config.js
```

```js
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n' // import from runtime only
import App from './App.vue'

// import i18n resources
import en from './locale/en.json'
import ja from './locale/ja.json'

const i18n = createI18n({
  locale: 'ja',
  messages: {
    en,
    ja
  }
})

const app = createApp(App)
app.use(i18n)
app.mount('#app')
```

In the case of the above project, you can use vue-i18n with webpack configuration to the following for runtime only:

```javascript
module.exports = {
  module: {
    rules: [
      // ...
      {
        test: /\.(json5?|ya?ml)$/, // target json, json5, yaml and yml files
        type: 'javascript/auto',
        loader: '@intlify/vue-i18n-loader',
        include: [ // Use `Rule.include` to specify the files of locale messages to be pre-compiled
          path.resolve(__dirname, 'src/locales')
        ]
      },
      // ...
    ]
  }
}
```

The above uses webpack's `Rule.include` to specify the i18n resources to be precompiled. You can also use [`Rule.exclude`](https://webpack.js.org/configuration/module/#ruleexclude) to set the target.


## 🚀 i18n custom block

The below example that `App.vue` have i18n custom block:

### i18n resource definition

```vue
<template>
  <p>{{ t('hello') }}</p>
</template>

<script>
import { useI18n } from 'vue-i18n'

export default {
  name: 'app',
  setup() {
    const { t, locale } = useI18n({
      // ...
    })

    // Somthing todo ...

    return {
      // ...
      t,
      locale,
      // ...
      })
    }
  }
}
</script>

<i18n>
{
  "en": {
    "hello": "hello world!"
  },
  "ja": {
    "hello": "こんにちは、世界!"
  }
}
</i18n>
```

The locale messages defined at i18n custom blocks are **json format default**.

### i18n resource importing

You also can use `src` attribute:

```vue
<i18n src="./myLang.json"></i18n>
```

```json5
// ./myLang.json
{
  "en": {
    "hello": "hello world!"
  },
  "ja": {
    "hello": "こんにちは、世界!"
  }
}
```

### Locale of i18n resource definition

You can define locale messages for each locale with `locale` attribute in single-file components:

```vue
<i18n locale="en">
{
  "hello": "hello world!"
}
</i18n>

<i18n locale="ja">
{
  "hello": "こんにちは、世界!"
}
</i18n>
```

The above defines two locales, which are merged at target single-file components.

### Locale of i18n resource definition for global scope

You can define locale messages for global scope with `global` attribute:

```vue
<i18n global>
{
  "en": {
    "hello": "hello world!"
  }
}
</i18n>
```

### i18n resource formatting

Besides json format, You can be used by specifying the following format in the `lang` attribute:

- yaml
- json5

example yaml foramt:

```vue
<i18n locale="en" lang="yaml">
  hello: "hello world!"
</i18n>

<i18n locale="ja" lang="yml">
  hello: "こんにちは、世界！"
</i18n>
```

example json5 format:

```vue
<i18n lang="json5">
{
  "en": {
    // comments
    "hello": "hello world!"
  }
}
</i18n>
```

### JavaScript

```javascript
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

// setup i18n instance with globaly
const i18n = createI18n({
  locale: 'ja',
  messages: {
    en: {
      // ...
    },
    ja: {
      // ...
    }
  }
})

const app = createApp(App)

app.use(i18n)
app.mount('#app')
```

### webpack Config

`vue-loader` (`next` version):

```javascript
module.exports = {
  module: {
    rules: [
      // ...
      {
        resourceQuery: /blockType=i18n/,
        type: 'javascript/auto',
        loader: '@intlify/vue-i18n-loader'
      },
      // ...
    ]
  }
}
```
## i18n custom block bridge mode

To support in a smooth transition from vue-i18n@v8.x to vue-i18n@v9.x, we provide a mode that bundles the i18n custom block to be available in either version.

This is for use when using vue-i18n@v8.x + [vue-i18n-bridge](https://github.com/intlify/vue-i18n-next/tree/master/packages/vue-i18n-bridge).

About details, See here.

## 🔧 Options

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

  webpack configration:

  ```javascript
  module.exports = {
    module: {
      rules: [
        // ...
        {
          test: /\.(json5?|ya?ml)$/,
          type: 'javascript/auto',
          include: [path.resolve(__dirname, './src/locales')],
          use: [
            {
              loader: '@intlify/vue-i18n-loader',
              options: {
                forceStringify: true
              }
            }
          ]
        },
        // ...
      ]
    }
  }
  ```

### `productionSourceMap`

- **Type:** `boolean`
- **Default:** `false`

  Whether to generate source map.


### `bridge`

- **Type:** `boolean`
- **Default:** `false`

  The mode to birdge the i18n custom block to work in both vue-i18n@v8.x and vue-i18n@v9.x environments.

  To support in a smooth transition from vue-i18n@v8.x to vue-i18n@v9.x, we provide a mode that bundles the i18n custom block to be available in either version.

  > ⚠️ Note that if you set `bridge: true`, the bundle size will increase. It is recommended to disable this mode after the migration from vue-i18n@v8.26 to vue-i18n@v9.x is completed.

## 📜 Changelog

Details changes for each release are documented in the [CHANGELOG.md](https://github.com/intlify/bundle-tools/blob/main/packages/vue-i18n-loader/CHANGELOG.md).

## ©️ License

[MIT](http://opensource.org/licenses/MIT)
