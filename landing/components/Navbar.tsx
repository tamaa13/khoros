import { DownloadButton } from "./DownloadButton";
import { Mark } from "./Mark";
import { SoundToggle } from "./sound/SoundToggle";

const REPO = "https://github.com/tamaa13/khoros";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-night/70 backdrop-blur-md">
      <nav className="mx-auto flex h-[60px] w-full max-w-[var(--container-wrap)] items-center gap-3 px-6 sm:px-8">
        <Mark size={26} />
        <span className="display text-[17px] tracking-[.02em]">KHOROS</span>
        <span className="kicker mt-[3px] hidden sm:block">· on-device society</span>
        <div className="ml-auto flex items-center gap-4">
          <SoundToggle />
          <a href="/#how" className="hidden text-[13.5px] text-fog-2 transition-colors hover:text-fog sm:block">
            How it works
          </a>
          <a href="/docs" className="hidden text-[13.5px] text-fog-2 transition-colors hover:text-fog sm:block">
            Docs
          </a>
          <DownloadButton nav />
        </div>
      </nav>
    </header>
  );
}
