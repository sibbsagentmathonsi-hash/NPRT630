import React from 'react';

export const BrandLogo = ({
  size = 36,
  variant = 'worker', // 'worker' | 'admin'
  className = '',
}) => {
  const isWorker = variant === 'worker';
  const primaryGradId = `ss-brand-grad-${variant}`;

  return (
    <div
      className={`app-brand-mark ${variant === 'admin' ? 'admin' : ''} ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-label="SyncStock mark"
    >
      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={primaryGradId} x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isWorker ? '#4f7cff' : '#6d5efc'} />
            <stop offset="100%" stopColor={isWorker ? '#18b89a' : '#8f78ff'} />
          </linearGradient>
        </defs>
        <path d="M7 8.5h11.5a3.5 3.5 0 0 1 0 7H7a3.5 3.5 0 0 1 0-7Z" fill={`url(#${primaryGradId})`} />
        <path d="M13.5 16.5H25a3.5 3.5 0 0 1 0 7H13.5a3.5 3.5 0 0 1 0-7Z" fill={`url(#${primaryGradId})`} opacity=".7" />
        <circle cx="9" cy="12" r="2" fill="#fff" />
        <circle cx="23" cy="20" r="2" fill="#fff" />
      </svg>
    </div>
  );
};
