// Brand mark — an emerald rounded square holding the Ordeva "order" mark
// (three settling lines = records put in order) + the Fraunces wordmark.
// `tone` switches between the dark sidebar and the light auth screens.
export function Logo({
  tone = "light",
  showWord = true,
}: {
  tone?: "light" | "dark";
  showWord?: boolean;
}) {
  const word = tone === "dark" ? "text-white" : "text-ink";
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand text-white shadow-[0_4px_12px_-4px_rgba(4,120,87,0.6)]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="8" x2="18" y2="8" />
            <line x1="6" y1="12" x2="15" y2="12" />
            <line x1="6" y1="16" x2="12" y2="16" />
          </g>
        </svg>
      </span>
      {showWord && (
        <span className={`font-display text-[19px] font-semibold tracking-tight ${word}`}>
          Ordeva
        </span>
      )}
    </div>
  );
}
