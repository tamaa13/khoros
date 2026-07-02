import { Reveal } from "./Reveal";

/** Every QVAC primitive as a product gesture — editorial rows, not card soup. */
const FEATURES: { n: string; name: string; primitive: string; desc: string }[] = [
  { n: "01", name: "Talk", primitive: "LLM + embeddings", desc: "A personal agent with persistent memory. It remembers your takes and calls its shots back: kan bener kata gua." },
  { n: "02", name: "Listen", primitive: "Whisper STT", desc: "Speak Indonesian, English, whatever. Your voice becomes the message, transcribed entirely on your machine." },
  { n: "03", name: "Speak", primitive: "on-device TTS", desc: "Replies read out loud when you want them, silent when you don't." },
  { n: "04", name: "Read", primitive: "OCR", desc: "Share a photo of a schedule, a ticket, a scoreboard. The agent reads the text in it and reacts." },
  { n: "05", name: "Imagine", primitive: "diffusion", desc: "Generate celebration scenes; ask in chat for real player photos when accuracy matters. Art is art, photos are photos." },
  { n: "06", name: "Evolve", primitive: "LoRA fine-tune", desc: "The agent fine-tunes on your own takes while your machine is idle and charging. Your voice, gradually." },
  { n: "07", name: "Watch for me", primitive: "live ESPN data", desc: "Can't watch Portugal vs Croatia? Send your agent. It follows the real match and reports back at full time." },
  { n: "08", name: "Meet", primitive: "E2E relay", desc: "Match rooms and a lounge where your agent talks with other people's local agents, across machines." },
];

export function Features() {
  return (
    <section className="mx-auto w-full max-w-[var(--container-wrap)] px-6 py-24 sm:px-8">
      <Reveal>
        <p className="kicker mb-4">The society&apos;s repertoire</p>
        <h2 className="display max-w-[24ch] text-[clamp(24px,3.2vw,40px)] leading-[1.05]">Every QVAC primitive, firing in one app.</h2>
      </Reveal>
      <div className="mt-14 grid gap-x-14 lg:grid-cols-2">
        {FEATURES.map((f, i) => (
          <Reveal key={f.n} delay={Math.min(i * 0.04, 0.2)}>
            <div className="flex gap-6 border-t border-line py-7">
              <span className="display pt-[2px] text-[13px] text-gold-deep">{f.n}</span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="display text-[19px]">{f.name}</h3>
                  <span className="kicker !text-[10px]">{f.primitive}</span>
                </div>
                <p className="mt-2 max-w-[46ch] text-[13.5px] leading-[1.65] text-fog-2">{f.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
