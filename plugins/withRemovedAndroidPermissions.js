const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Strips Android permissions that are pulled in transitively by autolinked libraries but
 * that Comma does not use. RECORD_AUDIO and SYSTEM_ALERT_WINDOW are dangerous/special-access
 * permissions a local earnings/mileage tracker has no feature for; shipping them draws Play
 * Store review flags (and SYSTEM_ALERT_WINDOW commonly triggers manual review / rejection).
 *
 * We add an explicit `tools:node="remove"` directive so the manifest merger drops every
 * library-supplied copy regardless of merge order.
 */
const BLOCKED_PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

module.exports = function withRemovedAndroidPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the `tools` namespace is declared, otherwise tools:node is ignored.
    manifest.$ = manifest.$ || {};
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const name of BLOCKED_PERMISSIONS) {
      // Remove any existing declaration of this permission...
      manifest["uses-permission"] = manifest["uses-permission"].filter(
        (perm) => perm.$ && perm.$["android:name"] !== name
      );
      // ...and add a remove directive so the merger also strips library copies.
      manifest["uses-permission"].push({
        $: { "android:name": name, "tools:node": "remove" },
      });
    }

    return cfg;
  });
};
