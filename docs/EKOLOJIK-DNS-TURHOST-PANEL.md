# Turhost DNS — SPF, DMARC, DKIM (ekolojikmarket.com.tr)

Alan adı NS: `dns1.turhost.com`, `dns2.turhost.com`. Kayıtlar **Turhost müşteri paneli → DNS yönetimi** üzerinden eklenir (VPS veya uygulama DNS yazamaz).

## Hazır değerler (VPS)

Sunucuda tek komut:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-txt-onerileri.sh /var/www/market-pos
```

OpenDKIM anahtarı (selector `ekolojik`):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-opendkim-kur.sh
```

## Turhost panel — üç TXT kaydı

| Tür | Host / ad | TXT değeri |
|-----|-----------|------------|
| SPF | `@` (veya boş kök) | `v=spf1 a mx ip4:168.231.109.27 ~all` |
| DMARC | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:bildirim@ekolojikmarket.com.tr; pct=100` |
| DKIM | `ekolojik._domainkey` | Sunucudaki tek satır `v=DKIM1;…` (script çıktısı) |

Notlar:

- Turhost bazen host alanına yalnızca `_dmarc` veya `ekolojik._domainkey` ister; tam FQDN gerekirse panel yardımına bakın.
- DKIM değeri **tırnak içinde tek satır** olmalı; satır kırılırsa doğrulama başarısız olur.
- Yayılım 5–60 dakika sürebilir.

## Uygulama paneli

POS → **Ayarlar → E-posta / Outbox** → **Gönderen & DNS (deliverability)** bölümünde SPF/DMARC/DKIM durumu, Turhost satırları ve **Tümünü kopyala** bulunur.

## Doğrulama

Uyarı modu:

```bash
EKOLOJIK_DNS_STRICT=0 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-mail-dogrula.sh
```

Kapı (panel kayıtları yayında olmalı):

```bash
EKOLOJIK_DNS_STRICT=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-mail-dogrula.sh
```

Yayılım beklerken (ops):

```bash
EKOLOJIK_DNS_STRICT=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-strict-kapisi.sh
```

İlgili runbook: `docs/EKOLOJIK-FAZ6-SMTP-RUNBOOK.md`, plan: `docs/PLAN-KIRILMA-GIDERIM.md` (Faz 3).
