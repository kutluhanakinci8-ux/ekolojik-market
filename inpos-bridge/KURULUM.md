# InPOS M530 — Mali Yazıcı Köprüsü

Bu servis **kasa bilgisayarında (Windows)** çalışır, Ubuntu VPS sunucusunda değil.

POS web uygulaması tarayıcıdan `http://127.0.0.1:9191` adresine istek atar; köprü InPOS cihazına fiş keser.

## Nerede kurulur?

| Ortam | Yol | Açıklama |
|-------|-----|----------|
| VPS (Linux) | `/var/www/ekolojik-market-pos/inpos-bridge` | Sadece kaynak kod — **burada çalıştırmayın** |
| Kasa PC (Windows) | Repo kopyası veya `inpos-bridge` klasörü | **Burada çalıştırın** |

## Windows kasa PC kurulumu

1. `market-pos/inpos-bridge` klasörünü kasa bilgisayara kopyalayın
2. [Node.js 18+](https://nodejs.org/) kurulu olsun
3. PowerShell veya CMD:

```bat
cd C:\market-pos\inpos-bridge
npm install
npm start
```

Servis: `http://127.0.0.1:9191`

## Test modu (cihaz yokken)

Varsayılan simülasyon açıktır. Konsolda `[SIM] Fiş` ve `[SIM] İADE` logları görünür.

Canlı mod için ortam değişkenleri:

```
INPOS_SIMULATE=0
INPOS_APP_NO=<InPOS uygulama numarası>
INPOS_GMP3_PORT=59000
```

## API uçları

- `GET /api/status` — köprü durumu
- `POST /api/fiscal/receipt` — satış fişi
- `POST /api/fiscal/return` — **iade fişi**

## VPS'te yanlış komut

Sunucuda `cd market-pos/inpos-bridge` çalışmaz çünkü home dizininde repo yok.

Doğru repo yolu:

```bash
cd /var/www/ekolojik-market-pos/inpos-bridge   # kaynak var, ama Linux'ta fiş kesilmez
```

Mali yazıcı kasadaki Windows PC'ye bağlıdır.
