import path from 'path'
import webpack from 'webpack'
import loaderUtils from 'loader-utils'
import { parse, ParsedUrlQuery } from 'querystring'
import { RawSourceMap } from 'source-map'
import { isEmptyObject, isString } from '@intlify/shared'
import { generateJSON, generateYAML } from '@intlify/bundle-utils'
import { createBridgeCodeGenerator } from './legacy'

import type { CodeGenOptions, DevEnv } from '@intlify/bundle-utils'
import type { VueI18nLoaderOptions } from './options'

const loader: webpack.loader.Loader = function (
  source: string | Buffer,
  sourceMap: RawSourceMap | undefined
): void {
  const loaderContext = this // eslint-disable-line @typescript-eslint/no-this-alias
  const loaderOptions = loaderUtils.getOptions(loaderContext) || {}
  const { bridge } = loaderOptions as VueI18nLoaderOptions

  const query = parse(loaderContext.resourceQuery)
  const options = getOptions(loaderContext, query, sourceMap) as CodeGenOptions
  // console.log('query', this.resourcePath, this.resourceQuery, query, source)
  const langInfo = !isEmptyObject(query)
    ? isString(query.lang)
      ? query.lang
      : 'json'
    : path.parse(loaderContext.resourcePath).ext

  try {
    this.cacheable && this.cacheable()
    // if (sourceMap) {
    //   console.log('in map', sourceMap)
    // }
    // if (sourceMap) {
    //   const s = new SourceMapConsumer(sourceMap)
    //   console.log('sourcemap raw', sourceMap)
    //   s.eachMapping(m => {
    //     console.log(m)
    //   })
    // }
    const generate = /json5?/.test(langInfo) ? generateJSON : generateYAML
    const { code, map } = generate(
      source,
      options,
      bridge ? createBridgeCodeGenerator(source, query) : undefined
    )
    // console.log('code', code)
    this.callback(null, code, map)
  } catch (err) {
    this.emitError(`[vue-i18n-loader]: ${(err as Error).message}`)
  }
}

function getOptions(
  loaderContext: webpack.loader.LoaderContext,
  query: ParsedUrlQuery,
  inSourceMap?: RawSourceMap
): Record<string, unknown> {
  const loaderOptions = loaderUtils.getOptions(loaderContext) || {}
  const { resourcePath: filename, mode } = loaderContext
  const { forceStringify, productionSourceMap, bridge, useClassComponent } =
    loaderOptions as VueI18nLoaderOptions

  const baseOptions = {
    filename,
    bridge,
    sourceMap: productionSourceMap || false,
    inSourceMap,
    forceStringify,
    useClassComponent,
    env: mode as DevEnv,
    onWarn: (msg: string): void => {
      loaderContext.emitWarning(
        `[vue-i18n-loader]: ${loaderContext.resourcePath} ${msg}`
      )
    },
    onError: (msg: string): void => {
      loaderContext.emitError(
        `[vue-i18n-loader]: ${loaderContext.resourcePath} ${msg}`
      )
    }
  }

  if (!isEmptyObject(query)) {
    return Object.assign(baseOptions, {
      type: 'sfc',
      locale: isString(query.locale) ? query.locale : '',
      isGlobal: query.global != null
    })
  } else {
    return Object.assign(baseOptions, {
      type: 'plain',
      isGlobal: false
    })
  }
}

export default loader
