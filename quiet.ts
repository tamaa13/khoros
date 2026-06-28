/**
 * Best-effort: ask the QVAC SDK for a quieter log level before it initializes
 * (QVAC_LOG_LEVEL is read when its loggers are built, so this is imported
 * before @qvac/sdk). Note: some QVAC Bare-runtime logs are written by the
 * worker process straight to the inherited stdout/stderr and cannot be
 * intercepted from JS — pipe the CLI through a filter for a fully clean
 * transcript. Pass --debug to leave the level at the SDK default.
 */
if (!process.env.QVAC_LOG_LEVEL && !process.argv.includes("--debug")) {
  process.env.QVAC_LOG_LEVEL = "error";
}

export {};
