// Minimal inline-SVG icons (no dependency). 1.7px strokes, 18px default.
type P = { className?: string; size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const OverviewIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const InvoiceIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

export const DownloadIcon = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 21h16" />
  </svg>
);

export const ArrowIcon = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M5 12h14m0 0-5-5m5 5-5 5" />
  </svg>
);

export const LogoutIcon = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const CoinIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
);

export const CheckIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

export const StackIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5M3 16.5l9 5 9-5" />
  </svg>
);

export const SettingsIcon = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);
