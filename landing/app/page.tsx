import { IntroOverlay } from "@/components/IntroOverlay";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ValueProp } from "@/components/ValueProp";
import { WhyKhoros } from "@/components/WhyKhoros";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { ClosingCta, Footer } from "@/components/Footer";

// Marketing landing — hero → statement → repertoire → how it works → CTA →
// footer. Same composition as arca/dashboard, in Khoros's stadium-night voice.
export default function Page() {
  return (
    <>
      <IntroOverlay />
      <Navbar />
      <main>
        <Hero />
        <ValueProp />
        <WhyKhoros />
        <Features />
        <HowItWorks />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
