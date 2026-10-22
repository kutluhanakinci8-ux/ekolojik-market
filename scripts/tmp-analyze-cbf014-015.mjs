import fs from 'node:fs';

const storePath = process.argv[2] || '/var/www/market-pos/data/store.json';
const s = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const ids = new Set([14, 15]);

const moves = (s.stockMovements || [])
  .filter((m) => ids.has(m.productId))
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

console.log('=== STOCK MOVEMENTS (last 40) ===');
for (const m of moves.slice(-40)) {
  console.log(
    [
      m.createdAt?.slice(0, 19),
      `p${m.productId}`,
      m.type,
      `qty=${m.quantity}`,
      m.saleId ? `sale=${m.saleId}` : '',
      (m.note || '').slice(0, 70),
    ].filter(Boolean).join(' | '),
  );
}

console.log('\n=== SALES with product 14 or 15 ===');
const sales = (s.sales || []).filter((sale) =>
  sale.items?.some((item) => ids.has(item.productId)),
);
for (const sale of sales.slice(-25)) {
  const items = sale.items.filter((item) => ids.has(item.productId));
  console.log(
    sale.createdAt?.slice(0, 19),
    sale.id,
    items.map((i) => `p${i.productId}x${i.quantity}`).join(', '),
  );
}
