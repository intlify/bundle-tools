// `~target` is an alias of the fixture directory (see `bundleVite` in `../utils.ts`)
const modules = import.meta.glob('~target/*.yaml', { eager: true })

if (typeof window !== 'undefined') {
  window.module = modules
}
