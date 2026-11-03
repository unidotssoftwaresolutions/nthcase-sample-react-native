// A local config plugin: the Android settings app.json has no key for. `npx expo prebuild` writes them into the
// generated android/ folder, which is not committed (Continuous Native Generation).
const { withGradleProperties } = require('expo/config-plugins');

/** Sets a gradle.properties key, replacing any value the template wrote. */
function setProperty(properties, key, value) {
  const existing = properties.find((p) => p.type === 'property' && p.key === key);
  if (existing) existing.value = value;
  else properties.push({ type: 'property', key, value });
}

module.exports = function withMossgroveAndroid(config) {
  return withGradleProperties(config, (cfg) => {
    // This repository is built on a shared machine and on CI runners: a 3 GB heap and three workers at most.
    setProperty(cfg.modResults, 'org.gradle.jvmargs', '-Xmx3g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8');
    setProperty(cfg.modResults, 'org.gradle.workers.max', '3');
    return cfg;
  });
};
