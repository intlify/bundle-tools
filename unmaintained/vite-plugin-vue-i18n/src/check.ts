// eslint-disable-next-line @typescript-eslint/ban-types
export function checkVueI18nBridgeInstallPackage(debug: Function): boolean {
  let ret = false;
  try {
    debug(`vue-i18n-bridge load path: ${require.resolve("vue-i18n-bridge")}`);
    ret = true;
  } catch (e) {
    debug(`cannot find 'vue-i18n-bridge'`, e);
  }
  return ret;
}
