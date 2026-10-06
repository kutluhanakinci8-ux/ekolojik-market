const RULES: Array<{ id: string; pattern: RegExp }> = [
  { id: 'cocuk', pattern: /детск|child|yibeile|çocuk|beb[eé]k/i },
  { id: 'temizlik', pattern: /deterjan|чист|домаш|household|bulaşık|çamaşır|стирк|мыть|посуд/i },
  { id: 'kagit-mendil', pattern: /салфет|mendil|бумаг|kağıt|tissue|napkin/i },
  { id: 'makyaj', pattern: /makyaj|makeup|pink point|декоратив|помад|тушь|тени/i },
  { id: 'cilt-bakim', pattern: /крем|mask|balm|maske|losyon|уход|кож|aloe|sealuxe|nemlendir/i },
  { id: 'kisisel-bakim', pattern: /шампун|shampoo|волос|saç|diş|зуб|sabun|duş|душ|гигиен|fırça|macun/i },
];

export function guessCategory(name: string): string {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.id;
  }
  return 'kisisel-bakim';
}
