/**
 * The 38px window titlebar — a draggable strip with the KHOROS wordmark centered.
 * On macOS the OS traffic lights overlay the left (titleBarStyle: hiddenInset),
 * so we reserve space there.
 */
export function Titlebar() {
  return (
    <div className="app-drag flex h-[38px] flex-shrink-0 items-center border-b border-[rgb(var(--c1f2128))] bg-gradient-to-b from-surface-0 to-[rgb(var(--c0c0d11))] px-[14px]">
      <span className="w-[58px] flex-shrink-0" />
      <span className="display mx-auto text-[12px] tracking-[.04em] text-content-faint">KHOROS</span>
      <span className="w-[58px] flex-shrink-0" />
    </div>
  );
}
