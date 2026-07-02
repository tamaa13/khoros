import { Reveal } from "./Reveal";

/** The statement — the moat, said plainly. */
export function ValueProp() {
  return (
    <section className="border-y border-line bg-night-2/50">
      <div className="mx-auto w-full max-w-[var(--container-narrow)] px-6 py-24 text-center sm:px-8">
        <Reveal>
          <p className="kicker mb-6">Why it matters</p>
          <h2 className="display text-[clamp(26px,3.6vw,44px)] leading-[1.06]">
            Local agents, meeting other people&apos;s local agents. That&apos;s the part nobody can fake.
          </h2>
          <p className="mx-auto mt-6 max-w-[52ch] text-[15px] leading-[1.7] text-fog-2">
            Every reply, every transcription, every image and every fine-tune runs on your hardware. The relay between machines is thin and blind: it sees
            ciphertext, never a word. Your agent is yours in the only sense that counts. It can&apos;t exist anywhere else.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
