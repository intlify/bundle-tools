<p align="center"><img width="373px" height="168px" src="./assets/vue-i18n-loader.png" alt="Vue I18n Loader logo"></p>

<h1 align="center">@intlify/vue-i18n-loader</h1>

<p align="center">
  <a href="https://github.com/intlify/vue-i18n-loader/actions?query=workflow%3ATest"><img src="https://github.com/intlify/vue-i18n-loader/workflows/Test/badge.svg" alt="Build Status"></a>
  <a href="https://www.npmjs.com/package/@intlify/vue-i18n-loader"><img src="https://img.shields.io/npm/v/@intlify/vue-i18n-loader/next.svg" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@intlify/vue-i18n-loader"><img src="https://img.shields.io/npm/v/@intlify/vue-i18n-loader.svg" alt="npm"></a>
</p>

<p align="center">vue-i18n for webpack loader</p>

<h2 align="center">🤝 Supporting Intlify Project</h2>

Intlify Project is an open source project that is included Vue I18n and i18n tooling and libraries with its ongoing development made possible entirely by the support of Sponsors. If you would like to become a sponsor, please consider:

<p align="center">
  <a
    href="https://github.com/sponsors/kazupon"
    target="_blank">
    Become a Sponsor on GitHub
  </a>
</p>

<h3 align="center">🥇 Gold Sponsors</h3>

<p align="center">
  <a
    href="https://nuxtjs.org/"
    target="_blank">
    <img
      src="https://raw.githubusercontent.com/intlify/vue-i18n-next/master/docs/public/nuxt.png"
      width="240px"
    />
  </a>
</p>

<h3 align="center">🥈 Silver Sponsors</h3>

<p align="center">
  <a
    href="https://www.codeandweb.com/babeledit?utm_campaign=vue-i18n-2019-01" 
    target="_blank">
    <img
      src="https://secure.codeandweb.com/static/babeledit.svg"
      width="200px"
    />
  </a>
</p>

<h3 align="center">🥉 Bronze Sponsors</h3>

<p align="center">
  <a href="https://zenarchitects.co.jp/" target="_blank">
    <img
      src="https://raw.githubusercontent.com/intlify/vue-i18n-next/master/docs/public/zenarchitects.png"
      width="144px"
    />
  </a>
</p>
<p align="center">
  <a href="https://www.sendcloud.com/" target="_blank">
    <img
      src="https://raw.githubusercontent.com/intlify/vue-i18n-next/master/docs/public/sendcloud.png"
      width="144px"
    />
  </a>
</p>
<p align="center">
  <a href="https://www.vuemastery.com/" target="_blank">
    <img
      src="https://raw.githubusercontent.com/intlify/vue-i18n-next/master/docs/public/vuemastery.png"
      width="144px"
    />
  </a>
</p>

<br/>

## :warning: Notice

This `next` branch is development branch for Vue 3! The version for Vue 2 is now in [`master`](https://github.com/intlify/vue-i18n-loader/tree/master) branch!


<br/>


## :star: Features
- i18n resource pre-compilation
- i18n custom block
  - i18n resource definition
  - i18n resource importing
  - Locale of i18n resource definition
  - Locale of i18n resource definition for global scope
  - i18n resource formatting


## :cd: Installation

### NPM

```sh
$ npm i --save-dev @intlify/vue-i18n-loader@next
```

### YARN

```sh
$ yarn add -D @intlify/vue-i18n-loader@next
```

**NOTE:** :warning: `@intlify/vue-i18n-loader@next` is for Vue I18n v9 or later, if you want to use Vue I18n v8.x, you need to install `@intlify/vue-i18n-loader`.


## :rocket: i18n resource pre-compilation

### Why do we need to require the configuration?

Since vue-i18n@v9.0, The locale messages are handled with message compiler, which converts them to javascript functions after compiling. After compiling, message compiler converts them into javascript functions, which can improve the performance of the application.

However, with the message compiler, the javascript function conversion will not work in some environments (e.g. CSP). For this reason, vue-i18n@v9.0 and later offer a full version that includes compiler and runtime, and a runtime only version.

If you are using the runtime version, you will need to compile before importing locale messages by managing them in a file such as `.json`.

You can pre-commpile by configuring vue-i18n-loader as the webpack loader.

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


## :rocket: i18n custom block

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


## :wrench: Options

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

## :scroll: Changelog
Details changes for each release are documented in the [CHANGELOG.md](https://github.com/intlify/vue-i18n-loader/blob/master/CHANGELOG.md).

## :muscle: Contribution
Please make sure to read the [Contributing Guide](https://github.com/intlify/vue-i18n-loader/blob/master/.github/CONTRIBUTING.md) before making a pull request.

## :copyright: License

[MIT](http://opensource.org/licenses/MIT)
