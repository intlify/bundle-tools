import { PKG_NAME } from '../constants'
import { error } from './log'

import type { RollupPlugin, VitePlugin } from 'unplugin'

export function resolveNamespace(name: string): string {
  return `${PKG_NAME}:${name}`
}

// @ts-expect-error -- FIXME: plugin type
type UserConfig = Parameters<VitePlugin['configResolved']>[0]

export function getVitePlugin(config: UserConfig, name: string): RollupPlugin | null {
  // vite plugin has compoaibility for rollup plugin
  return config.plugins.find(p => p.name === name) as RollupPlugin
}

export function checkVuePlugin(vuePlugin: RollupPlugin | null): boolean {
  if (vuePlugin == null || !vuePlugin.api) {
    error(
      '`@vitejs/plugin-vue` plugin is not found or invalid version. Please install `@vitejs/plugin-vue` v4.3.4 or later version.'
    )
    return false
  }
  return true
}
