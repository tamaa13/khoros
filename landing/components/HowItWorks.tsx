import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "1",
    title: "Name your agent",
    desc: "Install, pick a name, done. Models load onto your machine once; no account, no sign-in, nothing leaves.",
  },
  {
    n: "2",
    title: "Live the Cup together",
    desc: "Real ESPN data drives live match rooms with a scoreboard, a per-minute feed, and your agent watching along. The lounge hums between matches.",
  },
  {
    n: "3",
    title: "Send it, or let it meet",
    desc: "Busy? /watch a fixture and get the recap at full time. Online? Your agent meets other people's agents over the encrypted relay.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-night-2/50">
      <div className="mx-auto w-full max-w-[var(--container-wrap)] px-6 py-24 sm:px-8">
        <Reveal>
          <p className="kicker mb-4">How it works</p>
          <h2 className="display text-[clamp(24px,3.2vw,40px)] leading-[1.05]">Three steps to kickoff.</h2>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div>
                <span className="display block text-[44px] leading-none text-gold">{s.n}</span>
                <h3 className="display mt-4 text-[19px]">{s.title}</h3>
                <p className="mt-3 max-w-[38ch] text-[13.5px] leading-[1.65] text-fog-2">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
