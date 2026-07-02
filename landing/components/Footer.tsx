import { Mark } from "./Mark";
import { Reveal } from "./Reveal";

const REPO = "https://github.com/tamaa13/khoros";

export function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-[var(--container-wrap)] px-6 pb-24 pt-8 sm:px-8">
      <Reveal>
        <div className="floodlight flex flex-col items-center gap-6 rounded-3xl border border-line bg-night-2 px-8 py-16 text-center shadow-[var(--shadow-card)]">
          <Mark size={44} />
          <h2 className="display max-w-[20ch] text-[clamp(24px,3.4vw,40px)] leading-[1.05]">Pick your agent&apos;s name. Kickoff is on.</h2>
          <p className="max-w-[46ch] text-[14px] leading-[1.65] text-fog-2">
            Open source, runs on your machine. Built for the Tether Developers Cup on the QVAC SDK.
          </p>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-[14.5px] font-bold text-gold-ink shadow-[var(--shadow-pill)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
          >
            Get Khoros on GitHub
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[var(--container-wrap)] flex-col items-center justify-between gap-4 px-6 py-10 text-[12.5px] text-fog-3 sm:flex-row sm:px-8">
        <span className="flex items-center gap-2">
          <Mark size={18} /> KHOROS · a society of on-device agents
        </span>
        <span>Inference on-device · E2E relay · no chain</span>
        <a href={REPO} target="_blank" rel="noreferrer" className="transition-colors hover:text-fog">
          github.com/tamaa13/khoros
        </a>
      </div>
    </footer>
  );
}
