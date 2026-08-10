import {
  ArrowRight,
  Camera,
  MapPin,
  Sparkles,
  TrendingUp,
  Leaf,
  ShieldCheck,
} from "lucide-react";

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-white text-ink">

      {/* NAVBAR */}

      <nav className="border-b border-border bg-white/90 backdrop-blur sticky top-0 z-40">

        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          <div className="h-16 flex items-center justify-between">

            {/* LOGO */}

            <div className="flex items-center gap-2">

              <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
                <Leaf
                  size={19}
                  className="text-white"
                />
              </div>

              <span className="font-bold text-xl tracking-tight">
                Rescue<span className="text-brand">OS</span>
              </span>

            </div>

            {/* NAV LINKS */}

            <div className="hidden md:flex items-center gap-8 text-sm text-muted">

              <a
                href="#how-it-works"
                className="hover:text-ink transition-colors"
              >
                How It Works
              </a>

              <a
                href="#impact"
                className="hover:text-ink transition-colors"
              >
                Impact
              </a>

              <a
                href="#why-rescue"
                className="hover:text-ink transition-colors"
              >
                Why RescueOS
              </a>

            </div>

            {/* ACTION */}

            <button
              onClick={onGetStarted}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90 transition-colors"
            >
              Get Started
            </button>

          </div>

        </div>

      </nav>

      {/* HERO */}

      <section className="relative overflow-hidden">

        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 lg:py-24">

          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* LEFT */}

            <div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-light text-brand text-xs font-semibold mb-6">

                <Sparkles size={14} />

                AI-powered food rescue

              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">

                Turn surplus produce

                <span className="block text-brand mt-2">
                  into opportunity.
                </span>

              </h1>

              <p className="mt-6 text-base sm:text-lg text-muted leading-relaxed max-w-xl">

                RescueOS helps farmers and sellers
                rescue surplus produce before it
                becomes food waste — using AI,
                location intelligence and smart
                buyer matching.

              </p>

              <div className="mt-8 flex flex-wrap gap-3">

                <button
                  onClick={onGetStarted}
                  className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand/90 transition-colors"
                >
                  Start Rescuing

                  <ArrowRight size={17} />

                </button>

                <a
                  href="#how-it-works"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  See How It Works
                </a>

              </div>

              {/* TRUST */}

              <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-muted">

                <div className="flex items-center gap-1.5">

                  <ShieldCheck
                    size={15}
                    className="text-brand"
                  />

                  AI-assisted decisions

                </div>

                <div className="flex items-center gap-1.5">

                  <MapPin
                    size={15}
                    className="text-brand"
                  />

                  Location-aware

                </div>

                <div className="flex items-center gap-1.5">

                  <Leaf
                    size={15}
                    className="text-brand"
                  />

                  Waste reduction

                </div>

              </div>

            </div>

            {/* RIGHT — RESCUE CARD */}

            <div className="relative">

              <div className="absolute -top-10 -right-10 w-48 h-48 bg-brand-light rounded-full blur-3xl opacity-70" />

              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-brand-light rounded-full blur-3xl opacity-60" />

              <div className="relative bg-panel border border-border rounded-2xl shadow-xl p-5 sm:p-6 max-w-md mx-auto">

                {/* CARD HEADER */}

                <div className="flex items-center justify-between mb-5">

                  <div>

                    <p className="text-xs text-muted">
                      AI Rescue Analysis
                    </p>

                    <h3 className="text-lg font-bold mt-1">
                      Fresh Produce
                    </h3>

                  </div>

                  <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">

                    <Camera
                      size={19}
                      className="text-brand"
                    />

                  </div>

                </div>

                {/* PRODUCE */}

                <div className="rounded-xl bg-brand-light/50 border border-border p-4">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs text-muted">
                        Detected produce
                      </p>

                      <p className="font-bold text-xl mt-1">
                        Tomatoes
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-xs text-muted">
                        Quantity
                      </p>

                      <p className="font-bold mt-1">
                        180 kg
                      </p>

                    </div>

                  </div>

                </div>

                {/* SCORE */}

                <div className="mt-4 grid grid-cols-2 gap-3">

                  <div className="border border-border rounded-xl p-4">

                    <p className="text-xs text-muted">
                      Rescue Score
                    </p>

                    <div className="flex items-end gap-1 mt-1">

                      <span className="text-3xl font-bold text-brand">
                        91
                      </span>

                      <span className="text-xs text-muted mb-1">
                        /100
                      </span>

                    </div>

                    <p className="text-xs text-brand font-medium mt-1">
                      High priority
                    </p>

                  </div>

                  <div className="border border-border rounded-xl p-4">

                    <p className="text-xs text-muted">
                      Shelf life
                    </p>

                    <p className="text-2xl font-bold mt-1">
                      18h
                    </p>

                    <p className="text-xs text-muted mt-1">
                      Act soon
                    </p>

                  </div>

                </div>

                {/* MATCH */}

                <div className="mt-4 border border-border rounded-xl p-4">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs text-muted">
                        Best nearby match
                      </p>

                      <p className="font-semibold mt-1">
                        Fresh Foods Processing
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-xs text-muted">
                        Distance
                      </p>

                      <p className="font-semibold mt-1">
                        2.4 km
                      </p>

                    </div>

                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">

                    <span className="text-sm text-muted">
                      Suggested price
                    </span>

                    <span className="font-bold text-brand">
                      ₹26/kg
                    </span>

                  </div>

                </div>

                <button
                  onClick={onGetStarted}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-semibold text-sm hover:bg-brand/90 transition-colors"
                >
                  Find Best Match
                  <ArrowRight size={16} />
                </button>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* STATS */}

      <section
        id="impact"
        className="border-y border-border bg-panel"
      >

        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

            <Stat
              value="12,480+"
              label="kg food rescued"
            />

            <Stat
              value="₹4.2L+"
              label="value recovered"
            />

            <Stat
              value="850+"
              label="batches connected"
            />

            <Stat
              value="96%"
              label="successful matches"
            />

          </div>

        </div>

      </section>

      {/* HOW IT WORKS */}

      <section
        id="how-it-works"
        className="max-w-7xl mx-auto px-5 sm:px-8 py-20"
      >

        <div className="max-w-2xl mb-12">

          <p className="text-brand text-sm font-bold uppercase tracking-wider">
            How it works
          </p>

          <h2 className="text-3xl sm:text-4xl font-bold mt-2 tracking-tight">
            From surplus to rescue in minutes.
          </h2>

          <p className="text-muted mt-4 leading-relaxed">
            RescueOS connects the entire journey —
            from identifying surplus produce to finding
            the best nearby opportunity for it.
          </p>

        </div>

        <div className="grid md:grid-cols-3 gap-5">

          <StepCard
            number="01"
            icon={Camera}
            title="Capture"
            description="Take a photo or upload your produce. RescueOS can identify what you have."
          />

          <StepCard
            number="02"
            icon={Sparkles}
            title="Analyze"
            description="AI evaluates urgency, shelf life, pricing and the best action for your batch."
          />

          <StepCard
            number="03"
            icon={MapPin}
            title="Rescue"
            description="Find nearby buyers or NGOs and choose the best match based on distance and capacity."
          />

        </div>

      </section>

      {/* WHY RESCUEOS */}

      <section
        id="why-rescue"
        className="bg-brand text-white"
      >

        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">

          <div className="grid lg:grid-cols-2 gap-12 items-center">

            <div>

              <p className="text-white/70 text-sm font-bold uppercase tracking-wider">
                Why RescueOS
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold mt-2 tracking-tight">
                Every harvest deserves a second chance.
              </h2>

              <p className="text-white/75 mt-5 leading-relaxed max-w-xl">
                Instead of letting surplus produce become
                waste, RescueOS helps turn it into recovered
                value, food for communities and better
                decisions for sellers.
              </p>

              <button
                onClick={onGetStarted}
                className="mt-7 inline-flex items-center gap-2 bg-white text-brand px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors"
              >
                Start Rescuing
                <ArrowRight size={17} />
              </button>

            </div>

            <div className="grid grid-cols-2 gap-4">

              <ImpactCard
                icon={TrendingUp}
                title="Recover Value"
                text="Give surplus produce a better chance to generate revenue."
              />

              <ImpactCard
                icon={MapPin}
                title="Go Nearby"
                text="Connect with relevant opportunities close to you."
              />

              <ImpactCard
                icon={Sparkles}
                title="Use AI"
                text="Turn photos and batch data into useful recommendations."
              />

              <ImpactCard
                icon={Leaf}
                title="Reduce Waste"
                text="Move food faster before it reaches the point of waste."
              />

            </div>

          </div>

        </div>

      </section>

      {/* CTA */}

      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">

        <div className="w-14 h-14 rounded-xl bg-brand-light flex items-center justify-center mx-auto">

          <Leaf
            size={25}
            className="text-brand"
          />

        </div>

        <h2 className="text-3xl sm:text-4xl font-bold mt-5 tracking-tight">
          Ready to rescue your next batch?
        </h2>

        <p className="text-muted mt-4 max-w-xl mx-auto">
          Start with a photo, get an AI-powered
          recommendation and find your next opportunity.
        </p>

        <button
          onClick={onGetStarted}
          className="mt-7 inline-flex items-center gap-2 bg-brand text-white px-7 py-3 rounded-lg font-semibold hover:bg-brand/90 transition-colors"
        >
          Get Started
          <ArrowRight size={17} />
        </button>

      </section>

      {/* FOOTER */}

      <footer className="border-t border-border">

        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">

          <div className="flex items-center gap-2">

            <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">

              <Leaf
                size={14}
                className="text-white"
              />

            </div>

            <span className="font-semibold">
              RescueOS
            </span>

          </div>

          <p className="text-xs text-muted">
            Turning surplus into opportunity.
          </p>

        </div>

      </footer>

    </div>
  );
}

/* =========================
   STAT
========================= */

function Stat({ value, label }) {
  return (
    <div className="text-center md:text-left">

      <p className="text-2xl sm:text-3xl font-bold text-ink">
        {value}
      </p>

      <p className="text-xs sm:text-sm text-muted mt-1">
        {label}
      </p>

    </div>
  );
}

/* =========================
   STEP CARD
========================= */

function StepCard({
  number,
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="border border-border rounded-xl p-6 bg-white hover:shadow-card transition-shadow">

      <div className="flex items-center justify-between">

        <span className="text-xs font-bold text-brand">
          {number}
        </span>

        <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">

          <Icon
            size={19}
            className="text-brand"
          />

        </div>

      </div>

      <h3 className="font-bold text-lg mt-6">
        {title}
      </h3>

      <p className="text-muted text-sm leading-relaxed mt-2">
        {description}
      </p>

    </div>
  );
}

/* =========================
   IMPACT CARD
========================= */

function ImpactCard({
  icon: Icon,
  title,
  text,
}) {
  return (
    <div className="border border-white/15 bg-white/10 rounded-xl p-5">

      <Icon
        size={20}
        className="text-white mb-4"
      />

      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="text-white/70 text-sm leading-relaxed mt-2">
        {text}
      </p>

    </div>
  );
}