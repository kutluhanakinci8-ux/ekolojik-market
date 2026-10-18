export interface VoucherSearchOption {
  id: string;
  label: string;
  hint?: string;
  /** Stok no, ürün kodu vb. ek arama */
  searchText?: string;
}

export interface VoucherEntityInlineCompletion {
  option: VoucherSearchOption;
  fullLabel: string;
  suffix: string;
  uniquePrefix: boolean;
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function formatVoucherEntityQueryInput(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

function displayLabel(label: string): string {
  return label.toLocaleUpperCase('tr-TR');
}

function scoreOption(option: VoucherSearchOption, query: string): number {
  const q = normalizeQuery(query);
  if (!q) return 99;
  const label = normalizeQuery(option.label);
  const hint = option.hint ? normalizeQuery(option.hint) : '';
  const extra = option.searchText ? normalizeQuery(option.searchText) : '';
  const qDigits = query.replace(/\D/g, '');
  const hintDigits = option.hint?.replace(/\D/g, '') ?? '';
  const idDigits = option.id.replace(/\D/g, '');

  if (qDigits.length > 0 && qDigits === idDigits) return 0;
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (hint === q) return 2;
  if (hint.startsWith(q)) return 3;
  if (qDigits.length >= 3 && hintDigits.includes(qDigits)) return 4;
  if (label.includes(q)) return 5;
  if (hint.includes(q)) return 6;
  if (extra === q) return 7;
  if (extra.startsWith(q)) return 8;
  if (extra.includes(q)) return 9;
  return 99;
}

function rankOptions(options: VoucherSearchOption[], query: string): VoucherSearchOption[] {
  const q = query.trim();
  if (!q) return [];
  return options
    .filter((o) => scoreOption(o, q) < 99)
    .sort((a, b) => scoreOption(a, q) - scoreOption(b, q));
}

export function getVoucherEntityInlineCompletion(
  options: VoucherSearchOption[],
  query: string,
): VoucherEntityInlineCompletion | null {
  const q = query.trim();
  if (!q) return null;

  const ranked = rankOptions(options, q);
  const best = ranked[0];
  if (!best) return null;

  const fullLabel = displayLabel(best.label);
  const typedUpper = formatVoucherEntityQueryInput(q);
  const labelNorm = normalizeQuery(best.label);
  const qNorm = normalizeQuery(q);

  const prefixMatches = options.filter((o) => normalizeQuery(o.label).startsWith(qNorm));
  const uniquePrefix = prefixMatches.length === 1;

  let suffix = '';
  if (labelNorm.startsWith(qNorm) && typedUpper.length < fullLabel.length) {
    suffix = fullLabel.slice(typedUpper.length);
  }

  return { option: best, fullLabel, suffix, uniquePrefix };
}
