type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const SunIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </svg>
);
export const CalendarIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
export const RouteIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8 17.2C12.5 16 9 10.5 12.5 9.2 14 8.6 15.2 8 16.2 7.4" />
  </svg>
);
export const ChevronLeft = ({ size = 22 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronRight = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const ArrowRight = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const CloseIcon = ({ size = 22 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const CheckIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const PlusIcon = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const LockIcon = ({ size = 13 }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const BellIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const GearIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </svg>
);
export const SlidersIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const ShareIcon =({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 11h-1" />
  </svg>
);
