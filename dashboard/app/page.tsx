import Link from "next/link";
import { Logo } from "@/components/brand";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo tone="light" />
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgba(4,120,87,0.5)] hover:bg-brand-strong transition-colors"
            >
              Get early access
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-24 pt-20">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="animate-rise">
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand"
                style={{ animationDelay: "0ms" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Now in early access
              </div>
              <h1 className="font-display text-5xl font-semibold leading-[1.1] tracking-tight text-ink lg:text-6xl">
                Run your business from a chat message.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-ink-muted">
                Generate invoices, track payments, and stay on top of your books
                — just by texting your bot.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(4,120,87,0.7)] hover:bg-brand-strong transition-colors"
                >
                  Get early access
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-line-strong px-6 py-3 text-sm font-semibold text-ink hover:bg-surface transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Mock chat */}
            <div
              className="animate-rise rounded-card bg-sidebar p-6 shadow-card"
              style={{ animationDelay: "120ms" }}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-2 text-xs text-sidebar-muted">Ordeva Bot</span>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <ChatBubble side="user">
                  Invoice Apex Solutions for £4,500 — branding project, due in
                  30 days
                </ChatBubble>
                <ChatBubble side="bot">
                  Got it. Here&apos;s what I&apos;ll create:
                  <br />
                  <br />
                  <strong className="text-white">Client:</strong> Apex Solutions
                  <br />
                  <strong className="text-white">Amount:</strong> £4,500.00
                  <br />
                  <strong className="text-white">Service:</strong> Branding
                  project
                  <br />
                  <strong className="text-white">Due:</strong> 9 Jul 2026
                  <br />
                  <br />
                  Reply <em>yes</em> to confirm.
                </ChatBubble>
                <ChatBubble side="user">yes</ChatBubble>
                <ChatBubble side="bot">
                  ✓ Invoice #INV-0042 created and sent.
                  <br />
                  <span className="text-sidebar-muted">
                    PDF attached · £4,500.00 outstanding
                  </span>
                </ChatBubble>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line bg-surface px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-ink">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink-muted">
              Three steps from message to filed record. No spreadsheets, no
              copying between tabs.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="animate-rise rounded-card border border-line bg-paper p-6 shadow-card"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="font-display text-4xl font-semibold text-brand/30">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-ink">
              Everything your back office needs
            </h2>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <div
                  key={f.label}
                  className="animate-rise flex flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand-soft text-brand">
                    {f.icon}
                  </span>
                  <p className="font-semibold text-ink">{f.label}</p>
                  <p className="text-sm leading-relaxed text-ink-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust band */}
        <section className="bg-sidebar px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold text-white">
              Trusted with your money.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-sidebar-muted">
              Ordeva never acts on a financial request without your explicit
              confirmation. Every invoice and payment is reviewed by you before
              anything is created or sent.
            </p>
            <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
              {trust.map((t) => (
                <div
                  key={t.title}
                  className="rounded-card border border-sidebar-line bg-[#1f1e24] p-5"
                >
                  <p className="font-semibold text-white">{t.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-sidebar-muted">
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-24 text-center">
          <div className="mx-auto max-w-xl animate-rise">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
              Ready to run your business from chat?
            </h2>
            <p className="mt-4 text-base text-ink-muted">
              Join early access — free to start, no credit card required.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(4,120,87,0.8)] hover:bg-brand-strong transition-colors"
            >
              Get early access
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Logo tone="light" />
          <p className="text-sm text-ink-muted">
            Invoices, payments, and records — created the moment you message
            your bot.
          </p>
          <div className="flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/login" className="hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink transition-colors">
              Sign up
            </Link>
            <span>© {new Date().getFullYear()} Ordeva</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatBubble({
  side,
  children,
}: {
  side: "user" | "bot";
  children: React.ReactNode;
}) {
  return (
    <div className={`flex ${side === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
          side === "user"
            ? "rounded-br-sm bg-brand text-white"
            : "rounded-bl-sm bg-[#2a2930] text-sidebar-muted"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const steps = [
  {
    title: "Message your bot",
    body: "Type a plain-English request — 'Invoice Apex for £4,500 branding work' — directly in Telegram or WhatsApp.",
  },
  {
    title: "Confirm the details",
    body: "Ordeva echoes back every field it extracted. Nothing is created until you reply yes.",
  },
  {
    title: "Done",
    body: "PDF invoice generated, record stored, reply sent with the invoice attached. All in seconds.",
  },
];

const features = [
  {
    label: "Invoices from chat",
    desc: "Generate branded PDF invoices from a single message. No forms, no templates to fill.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Payment tracking",
    desc: "Record payments in chat. See outstanding balances and paid invoices at a glance.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Weekly summaries",
    desc: "A bot message every week with revenue, outstanding invoices, and recent payments.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Full dashboard",
    desc: "Every invoice and payment available in a clean web dashboard. No extra setup needed.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

const trust = [
  {
    title: "Confirmation required",
    body: "Every invoice and payment change is confirmed by you before it is created. The bot never acts on ambiguity.",
  },
  {
    title: "Code does the maths",
    body: "The AI extracts fields only — amounts, totals, and tax are computed by deterministic code, never by the model.",
  },
  {
    title: "Full audit log",
    body: "Every create or modify of financial data is written to an immutable audit log with actor, action, and timestamp.",
  },
];
