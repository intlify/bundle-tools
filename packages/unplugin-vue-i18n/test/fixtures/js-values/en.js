import pages from './pages.js'

const Keys = { welcome: 'welcome' }

export default {
  home: pages.home,
  title: pages.home.title,
  [Keys.welcome]: 'Welcome'
}
