export interface SoleProprietorshipTaxCalendarSettings {
  /** Şahıs firması vergi hatırlatıcıları otomatik eklenir */
  enabled: boolean;
  /** Muhtasar / stopaj hatırlatıcısı */
  includeMuhtasar: boolean;
  /** Ba-Bs form hatırlatıcısı */
  includeBaBs: boolean;
  /** SGK prim hatırlatıcısı (personel varsa) */
  includeSgk: boolean;
  lastSeededAt?: string;
}

export const DEFAULT_SOLE_PROPRIETORSHIP_TAX_CALENDAR: SoleProprietorshipTaxCalendarSettings = {
  enabled: true,
  includeMuhtasar: true,
  includeBaBs: true,
  includeSgk: true,
};

export function normalizeSoleProprietorshipTaxCalendar(
  raw?: Partial<SoleProprietorshipTaxCalendarSettings> | null,
): SoleProprietorshipTaxCalendarSettings {
  const base = { ...DEFAULT_SOLE_PROPRIETORSHIP_TAX_CALENDAR, ...(raw ?? {}) };
  return {
    enabled: base.enabled !== false,
    includeMuhtasar: base.includeMuhtasar !== false,
    includeBaBs: base.includeBaBs !== false,
    includeSgk: base.includeSgk !== false,
    lastSeededAt: typeof base.lastSeededAt === 'string' ? base.lastSeededAt : undefined,
  };
}
