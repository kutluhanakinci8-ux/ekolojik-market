# Lima — GitHub vs canlı (2026-10-10)

**Eşit değiller.** Canlı tek gerçek kaynak.

| Özellik | GitHub (`backups/seeds/lima-market.demo-store.json`) | Canlı (`/var/www/market-pos/data/tenants/lima-market/`) |
|---------|-----------------------------------------------------|-----------------------------------------------------------|
| Boyut | ~6 KB | ~147 KB |
| Ürün | 4 demo | 4 (aynı kodlar, canlı fiyat/stok) |
| Satış | 0 | 59 |
| Stok hareketi | 8 (seed) | 59 |
| Muhasebe / CRM / kullanıcı | Yok | Dolu |

SHA canlı (örnek): `288e799d…` — repo demo: `87c05c2e…`

Fazlalık tenant klasörleri (test) sunucuda `data/backups/archived-tenants/` altına alındı.
