// Brand mark — an emerald rounded square with a chat/receipt glyph + wordmark.
// `tone` switches between the dark sidebar and light auth screens.
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
          <path
            d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8 10h8M8 14h5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWord && (
        <span className={`font-display text-[19px] font-semibold tracking-tight ${word}`}>
          Back Office
        </span>
      )}
    </div>
  );
}
