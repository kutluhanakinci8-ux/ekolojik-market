# POS Lite tenant (ör. Lima Market)

Ayrı işletme = **ayrı tenant**. Veri `data/tenants/{tenantId}/store.json` altında tutulur; `main` (Ekolojik) ile karışmaz.

## Profil: `productProfile: pos-lite`

| Özellik | Davranış |
|---------|----------|
| Veri | Sadece o tenant’ın ürün/satış/stok kayıtları |
| Sekmeler (yönetici) | Panel, Satış, Stok, Raporlar, İşlemler, Ayarlar |
| Posta | Sihirbaz açılmaz; `posta` sekmesi yok |
| Raporlar | Gelir, Gider, Stok, Kasa, İşlemler (+ yönetici: Kullanıcı/Güvenlik). **Müşteri / tedarikçi / ortak / döviz raporları gizli** |
| Kasiyer önerisi | Satış + Stok + İşlemler (müşteri/cari sekmesi seçilemez) |

API ve tarayıcı tenant’ı `?tenant=lima-market` ile taşır (`storeApi.ts`, giriş sonrası `localStorage`).

## 1) Tenant oluşturma

### A) Sunucuda script (önerilen — Lima)

```bash
cd /var/www/ekolojik-market-pos
node scripts/provision-pos-lite-tenant.mjs \
  --data-dir /var/www/market-pos/data \
  --business "Lima Market" \
  --email info@firma.com \
  --phone 05001234567 \
  --admin "Lima Yönetici" \
  --username limaadmin \
  --password 'GucluSifre123'
```

Çıktıdaki **tenantId** = girişteki **Mağaza Kodu** (ör. `lima-market`).

### B) Web kayıt API

`POST /api/auth/register` body:

```json
{
  "businessName": "Lima Market",
  "email": "info@firma.com",
  "phone": "05001234567",
  "adminName": "Lima Yönetici",
  "username": "limaadmin",
  "password": "GucluSifre123",
  "plan": "pos-lite",
  "productProfile": "pos-lite"
}
```

## 2) Giriş

- URL: `https://<host>/giris?tenant=<tenantId>`
- **Mağaza Kodu:** `tenantId` (main kullanıcıları boş bırakır)
- Kullanıcı adı / şifre veya kasiyer PIN

## 3) Kasiyer kullanıcı

**Ayarlar → Kullanıcılar → Kasiyer** — sekmeler: **Satış**, **Stok**, **İşlemler** (POS Lite’da başka sekme seçilemez).

Satışta müşteri kaydı / veresiye kullanmayın (KVKK ve cari disiplini).

## 4) Raporlar

- **Yönetici:** üst menü **Raporlar** → gelir, stok, kasa, işlem listesi.
- **Kasiyer (sadece İşlemler yetkisi):** menüde **İşlemler** → satış/iade listesi.

Tüm raporlar tenant store’dan hesaplanır; başka mağazanın verisi gelmez.

## 5) Mevcut tenant’ı POS Lite’a çevirme

`data/tenants/<id>/store.json` içinde:

```json
"settings": {
  "productProfile": "pos-lite",
  ...
}
```

Yönetici `allowedTabs` listesinden `posta`, `customers`, `accounting`, `cashier` kaldırın; Posta onboarding `status: "dismissed"` yapın. Deploy sonrası yeniden giriş.

## 6) InPOS (yazar kasa)

Kasa Windows PC’de `inpos-bridge` — tenant’tan bağımsız, yerel `127.0.0.1:9191`. Bkz. `inpos-bridge/KURULUM.md`.
