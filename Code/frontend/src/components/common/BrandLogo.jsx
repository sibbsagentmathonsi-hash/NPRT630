import React from 'react';

/**
 * Modern, professional vector logo for SyncStock
 * Clean geometric isometric glyph symbolizing synchronized inventory & cloud connectivity
 */
export const BrandLogo = ({
  size = 36,
  variant = 'worker', // 'worker' | 'admin'
  className = '',
}) => {
  const isWorker = variant === 'worker';

  // Worker: Teal / Cobalt supply-chain gradient
  // Admin: Indigo / Royal Violet security gradient
  const primaryGradId = `ss-brand-grad-${variant}`;
  const accentGradId = `ss-accent-grad-${variant}`;

  return (
    <div
      className={`app-brand-mark ${variant === 'admin' ? 'admin' : ''} ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-label="SyncStock Logo"
    >
      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={primaryGradId} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            {isWorker ? (
              <>
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </>
            )}
          </linearGradient>

          <linearGradient id={accentGradId} x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
            {isWorker ? (
              <>
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#e879f9" stopOpacity="0.9" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Isometric Cube / Shield Foundation */}
        {isWorker ? (
          // Dynamic Synchronized Cube Mark
          <>
            {/* Top diamond facet */}
            <path
              d="M16 3L27 9.5L16 16L5 9.5L16 3Z"
              fill={`url(#${primaryGradId})`}
              fillOpacity="0.95"
            />
            {/* Left facet */}
            <path
              d="M5 11.5L14.5 17.2V28.5L5 22.8V11.5Z"
              fill={`url(#${primaryGradId})`}
              fillOpacity="0.75"
            />
            {/* Right facet */}
            <path
              d="M27 11.5L17.5 17.2V28.5L27 22.8V11.5Z"
              fill={`url(#${primaryGradId})`}
              fillOpacity="0.6"
            />
            {/* Inner sync node - crisp center highlight */}
            <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
            <path
              d="M16 10L20.5 12.8M16 22V17"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          // Admin Security Shield Crest
          <>
            <path
              d="M16 3L27 7.5V15.5C27 22.5 22.2 28.2 16 30C9.8 28.2 5 22.5 5 15.5V7.5L16 3Z"
              fill={`url(#${primaryGradId})`}
              fillOpacity="0.2"
              stroke={`url(#${primaryGradId})`}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Inner Keyhole / Check glyph */}
            <path
              d="M11 15.5L14.5 19L21.5 12"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="7" r="1.5" fill="#ffffff" />
          </>
        )}
      </svg>
    </div>
  );
};
