// Rendered inline (not as an <img src="...svg">) specifically so the
// var(--blue) / var(--surface) etc. references below resolve against the
// page's live CSS variables — an externally-loaded SVG file is a separate
// document and can't see the parent page's custom properties, so this
// illustration wouldn't react to theme/accent changes if it were a static
// asset like the login page's illustration is.
function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 380" role="img" style={{ width: "100%", maxWidth: 420, height: "auto" }}>
      <title>Illustration of a phone showing a confirmed service booking</title>

      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--blue)" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      <ellipse cx="240" cy="348" rx="150" ry="14" fill="var(--ink)" opacity="0.06" />

      {/* House, softly behind the phone */}
      <g opacity="0.9">
        <polygon points="70,230 70,150 150,95 230,150 230,230" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        <polygon points="55,158 150,90 245,158 230,158 150,102 70,158" fill="url(#heroGrad)" />
        <rect x="95" y="185" width="38" height="45" rx="3" fill="var(--blue-soft)" />
        <rect x="165" y="185" width="38" height="45" rx="3" fill="var(--blue-soft)" />
      </g>

      {/* Floating service icons */}
      <g>
        <circle cx="55" cy="90" r="22" fill="var(--blue-soft)" />
        <text x="55" y="98" fontSize="20" textAnchor="middle">🔧</text>
      </g>
      <g>
        <circle cx="400" cy="90" r="22" fill="var(--blue-soft)" />
        <text x="400" y="98" fontSize="20" textAnchor="middle">🧹</text>
      </g>
      <g>
        <circle cx="415" cy="220" r="20" fill="var(--blue-soft)" />
        <text x="415" y="227" fontSize="18" textAnchor="middle">💡</text>
      </g>

      {/* Phone mockup, front and center */}
      <g transform="translate(255,60)">
        <rect x="0" y="0" width="150" height="270" rx="26" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="3" />
        <rect x="10" y="16" width="130" height="238" rx="14" fill="var(--bg)" />
        <rect x="55" y="4" width="40" height="7" rx="3.5" fill="var(--border-strong)" />

        <rect x="10" y="16" width="130" height="46" rx="14" fill="url(#heroGrad)" />
        <circle cx="30" cy="39" r="10" fill="#ffffff" opacity="0.9" />
        <rect x="46" y="32" width="70" height="6" rx="3" fill="#ffffff" opacity="0.9" />
        <rect x="46" y="44" width="50" height="5" rx="2.5" fill="#ffffff" opacity="0.7" />

        <rect x="20" y="76" width="110" height="86" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <circle cx="45" cy="102" r="14" fill="var(--green-bg)" />
        <path d="M39 102 L44 107 L52 96" stroke="var(--green)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="65" y="94" width="55" height="6" rx="3" fill="var(--ink)" opacity="0.8" />
        <rect x="65" y="105" width="40" height="5" rx="2.5" fill="var(--muted)" />
        <rect x="30" y="128" width="90" height="5" rx="2.5" fill="var(--border-strong)" />
        <rect x="30" y="140" width="70" height="5" rx="2.5" fill="var(--border-strong)" />

        <rect x="20" y="172" width="110" height="30" rx="15" fill="url(#heroGrad)" />
        <rect x="45" y="184" width="60" height="6" rx="3" fill="#ffffff" opacity="0.95" />

        <text x="20" y="222" fontSize="14">★★★★★</text>
        <rect x="20" y="230" width="80" height="5" rx="2.5" fill="var(--border-strong)" />
      </g>
    </svg>
  );
}

export default HeroIllustration;
