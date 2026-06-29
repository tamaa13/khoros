/**
 * Electron Forge config. The QVAC plugin bundles the Bare worker, verifies its
 * native addons, and tree-shakes prebuilds that aren't for the target arch.
 * Build per-arch (darwin-arm64 / darwin-x64) — universal isn't supported.
 */
const QvacForgePlugin = require("@qvac/sdk/electron-forge");

module.exports = {
  packagerConfig: {
    name: "Khoros",
    appBundleId: "io.khoros.desktop",
    asar: true,
    // runtime needs only the built main + @qvac/sdk; skip source/build tooling
    ignore: [/^\/src/, /^\/build\.mjs$/, /^\/forge\.config\.cjs$/, /^\/README\.md$/],
  },
  makers: [
    { name: "@electron-forge/maker-dmg", config: { name: "Khoros" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
  ],
  plugins: [new QvacForgePlugin({})],
};
