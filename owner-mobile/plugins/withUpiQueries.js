const { withAndroidManifest } = require('@expo/config-plugins');

const UPI_PACKAGES = [
  'com.phonepe.app',
  'com.google.android.apps.nbu.paisa.user',
  'net.one97.paytm',
  'in.org.npci.upiapp',
];

/**
 * Injects <queries> for Indian UPI apps into AndroidManifest.xml so Android 11+
 * can launch PhonePe, Google Pay, Paytm, and BHIM without package visibility blocks.
 */
module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [];
    }

    let queriesEntry = manifest.queries[0];
    if (!queriesEntry) {
      queriesEntry = {};
      manifest.queries.push(queriesEntry);
    }
    if (!queriesEntry.package) {
      queriesEntry.package = [];
    }

    UPI_PACKAGES.forEach((pkg) => {
      const exists = queriesEntry.package.some(
        (item) => item?.$?.['android:name'] === pkg
      );
      if (!exists) {
        queriesEntry.package.push({ $: { 'android:name': pkg } });
      }
    });

    return modConfig;
  });
};
