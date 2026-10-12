# Arşiv — kapatılan açık PR’lar (2026-10-12)

`main` ile uyumsuz / üst üste binen eski dallar. **Canlıya alınmadı**; yedek burada.

| PR | Dal | Açıklama |
|----|-----|----------|
| #62 | `cursor/lima-main-urun-stok-f967` | POS Lite stok / görsel |
| #63 | `cursor/lima-sepet-compact-f967` | Kompakt sepet |
| #64 | `cursor/lima-zywell-printer-f967` | Zywell fiş (eski receipt dalı) |
| #65 | `cursor/lima-receipt-cut-fix-b923` | Fiş kesim v8–v15 denemeleri |
| #66 | `cursor/lima-qa-hardening-b923` | QA + receipt (65 üzerine) |

Her `pr-NN/` klasöründe: `pr-meta.json`, `head-sha.txt`, `commits.txt`, `full.diff`.

Dal geri yükleme (gerekirse, GitHub’da dal silinmeden önce):

```bash
git fetch origin <dal-adı>
git checkout -b restore/<dal-adı> origin/<dal-adı>
```

Güncel geliştirme yalnızca **`main`** — bkz. `docs/MAIN-GELISTIRME.md`.
