/** Kullanıcı işlemleri — premium UI yardımcıları */

import type { ChangeEvent, ReactNode } from 'react';

export function userInitials(displayName: string, username: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const base = displayName.trim() || username;
  return base.slice(0, 2).toUpperCase();
}

export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

type RingProps = {
  pct: number;
  size?: number;
  label?: string;
  variant?: 'brand' | 'warn' | 'muted';
};

export function RingProgress({ pct, size = 52, label, variant = 'brand' }: RingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="platform-ring-wrap" title={label}>
      <svg width={size} height={size} className={`platform-ring platform-ring--${variant}`} aria-hidden>
        <circle
          className="platform-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="platform-ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="platform-ring-label">{Math.round(clamped)}%</span>
    </div>
  );
}

export function KpiIcon({ name }: { name: string }) {
  return <span className={`platform-kpi-icon platform-kpi-icon--${name}`} aria-hidden />;
}

type FilterSelectProps = {
  label: string;
  icon: 'store' | 'status' | 'role';
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

export function PlatformFilterSelect({ label, icon, value, onChange, children }: FilterSelectProps) {
  const active = value !== 'all';
  return (
    <label className={`platform-users-select-field ${active ? 'is-active' : ''}`}>
      <span className="platform-users-select-field-label">{label}</span>
      <div className="platform-users-select-shell">
        <span className={`platform-users-select-icon platform-users-select-icon--${icon}`} aria-hidden />
        <select
          className="platform-users-select"
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          aria-label={label}
        >
          {children}
        </select>
        <span className="platform-users-select-chevron" aria-hidden />
      </div>
    </label>
  );
}
