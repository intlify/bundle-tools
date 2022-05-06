/**
 * Vue SFC Query, forked from the below:
 * - original repository url: https://github.com/vitejs/vite/tree/main/packages/plugin-vue
 * - code url: https://github.com/vitejs/vite/blob/main/packages/plugin-vue/src/utils/query.ts
 * - author: Evan You (https://github.com/yyx990803)
 * - license: MIT
 */

export interface VueQuery {
  vue?: boolean
  src?: boolean
  global?: boolean
  type?: 'script' | 'template' | 'style' | 'custom' | 'i18n'
  blockType?: string
  index?: number
  locale?: string
  lang?: string
  raw?: boolean
  issuerPath?: string
}

export function parseVueRequest(id: string) {
  const [filename, rawQuery] = id.split(`?`, 2)
  const params = new URLSearchParams(rawQuery)
  const ret = {} as VueQuery
  const langPart = Object.keys(Object.fromEntries(params)).find(key =>
    /lang\./i.test(key)
  )
  ret.vue = params.has('vue')
  ret.global = params.has('global')
  ret.src = params.has('src')
  ret.raw = params.has('raw')
  if (params.has('type')) {
    ret.type = params.get('type') as VueQuery['type']
  }
  if (params.has('blockType')) {
    ret.blockType = params.get('blockType') as VueQuery['blockType']
  }
  if (params.has('index')) {
    ret.index = Number(params.get('index'))
  }
  if (params.has('locale')) {
    ret.locale = params.get('locale') as VueQuery['locale']
  }
  if (langPart) {
    const [, lang] = langPart.split('.')
    ret.lang = lang
  } else if (params.has('lang')) {
    ret.lang = params.get('lang') as VueQuery['lang']
  }
  if (params.has('issuerPath')) {
    ret.issuerPath = params.get('issuerPath') as VueQuery['issuerPath']
  }
  return {
    filename,
    query: ret
  }
}
