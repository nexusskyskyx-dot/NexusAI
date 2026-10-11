// NexusAI · Inline SVG icon set (stroke = currentColor)
const I = ({ d, size = 18, sw = 2, fill = 'none', children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

export const IconChat = (p) => <I {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
export const IconAgents = (p) => (
  <I {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <rect x="3" y="3" width="4" height="4" rx="1" />
    <rect x="17" y="3" width="4" height="4" rx="1" />
    <rect x="3" y="17" width="4" height="4" rx="1" />
    <rect x="17" y="17" width="4" height="4" rx="1" />
    <path d="M7 5h10M5 7v10M19 7v10M7 19h10" />
  </I>
);
export const IconCode = (p) => <I {...p} d="M16 18l6-6-6-6M8 6l-6 6 6 6" />;
export const IconKeys = (p) => (
  <I {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.5 12.5L21 2M15 8l3 3M18 5l3 3" />
  </I>
);
export const IconPlus = (p) => <I {...p} d="M12 5v14M5 12h14" />;
export const IconSend = (p) => <I {...p} d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />;
export const IconStop = (p) => <I {...p} d="M6 6h12v12H6z" fill="currentColor" />;
export const IconCopy = (p) => (
  <I {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </I>
);
export const IconCheck = (p) => <I {...p} d="M20 6L9 17l-5-5" />;
export const IconRefresh = (p) => <I {...p} d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />;
export const IconTrash = (p) => <I {...p} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />;
export const IconDownload = (p) => <I {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />;
export const IconExternal = (p) => <I {...p} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />;
export const IconPlay = (p) => <I {...p} d="M6 4l14 8-14 8z" />;
export const IconBolt = (p) => <I {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
export const IconShield = (p) => <I {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
export const IconEdit = (p) => <I {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />;
export const IconChevron = (p) => <I {...p} d="M6 9l6 6 6-6" />;
export const IconX = (p) => <I {...p} d="M18 6L6 18M6 6l12 12" />;
export const IconSearch = (p) => <I {...p} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />;
export const IconSparkle = (p) => <I {...p} d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2L12 3zM19 15l.9 2.6L22.5 18l-2.6.9L19 22l-.9-3.1L15.5 18l2.6-.4L19 15z" />;
export const IconBrain = (p) => <I {...p} d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4 2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44A2.5 2.5 0 0 0 20 17.5v-11A2.5 2.5 0 0 0 17.5 4 2.5 2.5 0 0 0 14.5 2z" />;
export const IconEye = (p) => <I {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />;
export const IconEyeOff = (p) => <I {...p} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88M1 1l22 22" />;
export const IconSettings = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </I>
);
export const IconMonitor = (p) => <I {...p} d="M2 3h20v14H2zM8 21h8M12 17v4" />;
export const IconPhone = (p) => <I {...p} d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 19h2" />;
export const IconTerminal = (p) => <I {...p} d="M4 17l6-5-6-5M12 19h8" />;

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="NexusAI">
      <defs>
        <linearGradient id="nxg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--acc)" />
          <stop offset="1" stopColor="var(--acc2)" />
        </linearGradient>
      </defs>
      <path d="M16 2 29 9v14L16 30 3 23V9z" fill="none" stroke="url(#nxg)" strokeWidth="2.5" />
      <path d="M11 22V10l10 12V10" stroke="url(#nxg)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
