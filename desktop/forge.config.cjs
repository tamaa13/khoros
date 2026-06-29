/**
 * Electron Forge config. The QVAC plugin bundles the Bare worker, verifies its
 * native addons, and tree-shakes prebuilds that aren't for the target platform.
 *
 * IMPORTANT — build PER-PLATFORM, on that platform:
 *   - macOS installer (.dmg) builds on macOS, Windows (.exe) on Windows, Linux
 *     (.deb) on Linux. QVAC's native addons are per-OS/per-arch and the plugin
 *     keeps only the build host's binaries, so native addons can't cross-compile
 *     and "universal" isn't supported. (Tether ships its own Workbench the same
 *     way: separate .dmg / .msix / .AppImage.)
 *   - Each maker below only runs when its platform matches the build host.
 */
const QvacForgePlugin = require("@qvac/sdk/electron-forge");

module.exports = {
  packagerConfig: {
    name: "Khoros",
    // Deterministic binary name so makers (esp. maker-deb) find it; without this
    // the Linux .deb maker looked for "khoros-desktop" while the binary was "Khoros".
    executableName: "khoros",
    appBundleId: "io.khoros.desktop",
    asar: true,
    // runtime needs only the built main + @qvac/sdk; skip source/build tooling
    ignore: [/^\/src/, /^\/build\.mjs$/, /^\/forge\.config\.cjs$/, /^\/README\.md$/],
  },
  makers: [
    // macOS — disk image
    { name: "@electron-forge/maker-dmg", platforms: ["darwin"], config: { name: "Khoros" } },
    // Windows — Squirrel installer (Khoros-Setup.exe)
    { name: "@electron-forge/maker-squirrel", platforms: ["win32"], config: { name: "Khoros", setupExe: "Khoros-Setup.exe" } },
    // Linux — Debian package
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: { options: { name: "khoros", bin: "khoros", productName: "Khoros", genericName: "World Cup Agent", categories: ["Utility"] } },
    },
    // Portable zip — all desktop platforms
    { name: "@electron-forge/maker-zip", platforms: ["darwin", "linux", "win32"] },
  ],
  plugins: [new QvacForgePlugin({})],
};
