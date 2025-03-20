/* eslint-disable @typescript-eslint/no-explicit-any */

// import { parse as parseQuery } from 'querystring'
// import webpack from 'webpack'
// import { ReplaceSource } from 'webpack-sources'
// import { isFunction, isObject, isRegExp, isString } from '@intlify/shared'
// const Dependency = require('webpack/lib/Dependency') // eslint-disable-line @typescript-eslint/no-var-requires
// const NullFactory = require('webpack/lib/NullFactory') // eslint-disable-line @typescript-eslint/no-var-requires
//
// const PLUGIN_ID = 'IntlifyVuePlugin'
//
// interface NormalModule extends webpack.compilation.Module {
//   resource?: string
//   request?: string
//   userRequest?: string
//   addDependency(dep: unknown): void
//   parser?: webpack.compilation.normalModuleFactory.Parser
//   loaders?: Array<{
//     loader: string
//     options: any
//     indent?: string
//     type?: string
//   }>
// }
//
// type InjectionValues = Record<string, any>
//
// class VueComponentDependency extends Dependency {
//   static Template: VueComponentDependencyTemplate
//   script?: NormalModule
//   template?: NormalModule
//   values: InjectionValues
//   statement: any
//
//   constructor(
//     script: NormalModule | undefined,
//     template: NormalModule | undefined,
//     values: InjectionValues,
//     statement: any
//   ) {
//     super()
//     this.script = script
//     this.template = template
//     this.values = values
//     this.statement = statement
//   }
//
//   get type() {
//     return 'harmony export expression'
//   }
//
//   getExports() {
//     return {
//       exports: ['default'],
//       dependencies: undefined
//     }
//   }
//
//   updateHash(hash: any) {
//     super.updateHash(hash)
//     const scriptModule = this.script
//     hash.update(
//       (scriptModule &&
//         (!scriptModule.buildMeta || scriptModule.buildMeta.exportsType)) + ''
//     )
//     hash.update((scriptModule && scriptModule.id) + '')
//     const templateModule = this.template
//     hash.update(
//       (templateModule &&
//         (!templateModule.buildMeta || templateModule.buildMeta.exportsType)) +
//         ''
//     )
//     hash.update((templateModule && templateModule.id) + '')
//   }
// }
//
// function stringifyObj(obj: Record<string, any>): string {
//   return `Object({${Object.keys(obj)
//     .map(key => {
//       const code = obj[key]
//       return `${JSON.stringify(key)}:${toCode(code)}`
//     })
//     .join(',')}})`
// }
//
// function toCode(code: any): string {
//   if (code === null) {
//     return 'null'
//   }
//
//   if (code === undefined) {
//     return 'undefined'
//   }
//
//   if (isString(code)) {
//     return JSON.stringify(code)
//   }
//
//   if (isRegExp(code) && code.toString) {
//     return code.toString()
//   }
//
//   if (isFunction(code) && code.toString) {
//     return '(' + code.toString() + ')'
//   }
//
//   if (isObject(code)) {
//     return stringifyObj(code)
//   }
//
//   return code + ''
// }
//
// function generateCode(dep: VueComponentDependency, importVar: string): string {
//   const injectionCodes = ['']
//   Object.keys(dep.values).forEach(key => {
//     const code = dep.values[key]
//     if (isFunction(code)) {
//       injectionCodes.push(`${importVar}.${key} = ${JSON.stringify(code(dep))}`)
//     } else {
//       injectionCodes.push(`${importVar}.${key} = ${toCode(code)}`)
//     }
//   })
//
//   // console.log('generateCode', injectionCodes)
//   let ret = injectionCodes.join('\n')
//   ret = ret.length > 0 ? `\n${ret}\n` : ''
//   return (ret += `/* harmony default export */ __webpack_exports__["default"] = (${importVar});`)
// }
//
// class VueComponentDependencyTemplate {
//   apply(dep: VueComponentDependency, source: ReplaceSource) {
//     const repleacements = source.replacements
//     const orgReplace = repleacements[repleacements.length - 1]
//     if (dep.statement.declaration.start !== orgReplace.start) {
//       return
//     }
//
//     const code = generateCode(dep, orgReplace.content)
//     // console.log('generateCode', code, dep.statement, orgReplace)
//     source.replace(orgReplace.start, orgReplace.end, code)
//   }
// }
//
// VueComponentDependency.Template = VueComponentDependencyTemplate
//
// function getScriptBlockModule(parser: any): NormalModule | undefined {
//   return parser.state.current.dependencies.find((dep: any) => {
//     const req = dep.userRequest || dep.request
//     if (req && dep.originModule) {
//       const query = parseQuery(req)
//       return query.type === 'script' && query.lang === 'js'
//     } else {
//       return false
//     }
//   })
// }
//
// function getTemplateBlockModule(parser: any): NormalModule | undefined {
//   return parser.state.current.dependencies.find((dep: any) => {
//     const req = dep.userRequest || dep.request
//     if (req && dep.originModule) {
//       const query = parseQuery(req)
//       return query.type === 'template'
//     } else {
//       return false
//     }
//   })
// }
//
// function toVueComponentDependency(parser: any, values: InjectionValues) {
//   return function vueComponentDependency(statement: any) {
//     // console.log('toVueComponentDependency##statement', statement)
//     const dep = new VueComponentDependency(
//       getScriptBlockModule(parser),
//       getTemplateBlockModule(parser),
//       values,
//       statement
//     )
//     // dep.loc = statement.loc
//     parser.state.current.addDependency(dep)
//     return true
//   }
// }
//
// export default class IntlifyVuePlugin implements webpack.Plugin {
//   injections: InjectionValues
//
//   constructor(injections: InjectionValues = {}) {
//     this.injections = injections
//   }
//
//   apply(compiler: webpack.Compiler): void {
//     const injections = this.injections
//
//     compiler.hooks.compilation.tap(
//       PLUGIN_ID,
//       // @ts-ignore
//       (compilation, { normalModuleFactory }) => {
//         compilation.dependencyFactories.set(
//           // @ts-ignore
//           VueComponentDependency,
//           new NullFactory()
//         )
//         compilation.dependencyTemplates.set(
//           // @ts-ignore
//           VueComponentDependency,
//           // @ts-ignore
//           new VueComponentDependency.Template()
//         )
//
//         const handler = (
//           parser: webpack.compilation.normalModuleFactory.Parser
//         ) => {
//           parser.hooks.exportExpression.tap(
//             PLUGIN_ID,
//             // @ts-ignore
//             (statement, declaration) => {
//               // console.log(
//               //   'exportExpression',
//               //   (parser as any).state.module.resource,
//               //   declaration.name
//               // )
//               if (
//                 (parser as any).state.module.resource.endsWith('.vue') &&
//                 declaration.name === 'script'
//               ) {
//                 // console.log('exportExpression', statement, declaration)
//                 return toVueComponentDependency(parser, injections)(statement)
//               }
//             }
//           )
//         }
//
//         normalModuleFactory.hooks.parser
//           .for('javascript/auto')
//           .tap(PLUGIN_ID, handler)
//         normalModuleFactory.hooks.parser
//           .for('javascript/dynamic')
//           .tap(PLUGIN_ID, handler)
//         normalModuleFactory.hooks.parser
//           .for('javascript/esm')
//           .tap(PLUGIN_ID, handler)
//       }
//     )
//   }
// }

/* eslint-enable @typescript-eslint/no-explicit-any */
