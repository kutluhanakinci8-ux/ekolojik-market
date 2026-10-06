/**
 * Market POS — InPOS M530 köprü servisi
 *
 * Windows kasa bilgisayarında çalıştırın:
 *   cd inpos-bridge && npm install && npm start
 *
 * Önkoşullar (M530):
 *   - inposgmp3.exe kurulu ve cihaz eşleşmiş
 *   - Port: 59000
 *   - InPOS'tan alınmış Uygulama No tanımlı
 *
 * GMP-3 DLL entegrasyonu InPOS SDK geldiğinde bu dosyaya eklenir.
 */
import cors from 'cors';
import express from 'express';

const PORT = Number(process.env.INPOS_BRIDGE_PORT || 9191);
const GMP3_PORT = process.env.INPOS_GMP3_PORT || '59000';
const APP_NO = process.env.INPOS_APP_NO || ''; // InPOS'tan alınacak
const SIMULATE = process.env.INPOS_SIMULATE !== '0'; // SDK yokken test modu

const app = express();
app.use(cors());
app.use(express.json());

let receiptCounter = 1000;
let returnCounter = 5000;
let cashReportCounter = 9000;

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    device: 'InPOS M530',
    gmp3Port: GMP3_PORT,
    appNo: APP_NO || '(henüz tanımlanmadı)',
    mode: SIMULATE ? 'simulation' : 'live',
    message: SIMULATE
      ? 'Test modu — gerçek fiş kesilmez. INPOS_SIMULATE=0 ve SDK ile canlı mod.'
      : 'Canlı mod',
  });
});

app.post('/api/fiscal/receipt', async (req, res) => {
  const { items, paymentMethod, total } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Sepet boş' });
  }
  if (!total || total <= 0) {
    return res.status(400).json({ success: false, message: 'Geçersiz tutar' });
  }

  const paymentLabel =
    paymentMethod === 'cash' ? 'Nakit' : paymentMethod === 'card' ? 'Kredi Kartı' : 'Havale';

  if (SIMULATE) {
    receiptCounter += 1;
    console.log(`[SIM] Fiş #${receiptCounter} | ${paymentLabel} | ₺${total} | ${items.length} kalem`);
    return res.json({
      success: true,
      receiptNo: `SIM-${receiptCounter}`,
      message: 'Test fişi (M530 bağlı değil)',
      simulated: true,
    });
  }

  // TODO: InPOS GMP-3 SDK çağrısı buraya gelecek
  // 1. GMP3_StartReceipt()
  // 2. GMP3_AddItem() her kalem için (KDV %20)
  // 3. GMP3_AddPayment(paymentType, amount)
  // 4. GMP3_CloseReceipt() → fiş no döner

  if (!APP_NO) {
    return res.status(503).json({
      success: false,
      message: 'INPOS_APP_NO tanımlı değil. InPOS servisten uygulama numarası alın.',
    });
  }

  res.status(501).json({
    success: false,
    message: 'GMP-3 SDK entegrasyonu bekleniyor. InPOS entegrasyon paketini paylaşın.',
  });
});

app.post('/api/fiscal/return', async (req, res) => {
  const {
    originalSaleId,
    returnId,
    items,
    refundMethod,
    refundTotal,
    reason,
    note,
  } = req.body ?? {};

  if (!originalSaleId || !returnId) {
    return res.status(400).json({ success: false, message: 'Orijinal fiş ve iade no zorunlu' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'İade kalemi boş' });
  }

  const paymentLabel =
    refundMethod === 'cash' ? 'Nakit' : refundMethod === 'card' ? 'Kredi Kartı' : 'Havale';

  if (SIMULATE) {
    returnCounter += 1;
    console.log(
      `[SIM] İADE #${returnCounter} | Orijinal: ${originalSaleId} | ${paymentLabel} | -₺${refundTotal ?? 0} | ${items.length} kalem | ${reason ?? '—'}`,
    );
    if (note) console.log(`       Not: ${note}`);
    return res.json({
      success: true,
      documentType: 'return',
      receiptNo: `SIM-RET-${returnCounter}`,
      message: 'Test iade fişi (M530 bağlı değil)',
      simulated: true,
    });
  }

  // TODO: InPOS GMP-3 iade / iptal fişi
  // 1. GMP3_StartReturnReceipt(originalSaleId)
  // 2. GMP3_AddReturnItem() her kalem için (negatif tutar veya iade tipi)
  // 3. GMP3_AddRefundPayment(paymentType, amount)
  // 4. GMP3_CloseReturnReceipt() → iade fiş no

  if (!APP_NO) {
    return res.status(503).json({
      success: false,
      message: 'INPOS_APP_NO tanımlı değil. InPOS servisten uygulama numarası alın.',
    });
  }

  res.status(501).json({
    success: false,
    message: 'GMP-3 iade fişi entegrasyonu bekleniyor.',
  });
});

app.post('/api/fiscal/cash-report', async (req, res) => {
  const {
    reportType,
    businessDate,
    openingBalance,
    closingBalance,
    cashierName,
    handover,
    movements,
  } = req.body ?? {};

  if (!reportType || !businessDate) {
    return res.status(400).json({ success: false, message: 'Rapor tipi ve iş günü zorunlu' });
  }

  const label = reportType === 'day_close' ? 'GÜN KAPANIŞ' : 'YÖNETİME DEVİR';

  if (SIMULATE) {
    cashReportCounter += 1;
    console.log(
      `[SIM] KASA ${label} #${cashReportCounter} | ${businessDate} | Açılış: ₺${openingBalance ?? 0} | Kapanış: ₺${closingBalance ?? 0} | ${Array.isArray(movements) ? movements.length : 0} hareket`,
    );
    if (cashierName) console.log(`       Kasiyer: ${cashierName}`);
    if (handover?.amount) {
      console.log(`       Devir: ₺${handover.amount} → ${handover.recipient ?? 'Yönetim'}`);
    }
    return res.json({
      success: true,
      receiptNo: `SIM-CASH-${cashReportCounter}`,
      message: 'Test kasa fişi (M530 bağlı değil)',
      simulated: true,
    });
  }

  res.status(501).json({
    success: false,
    message: 'GMP-3 kasa raporu entegrasyonu bekleniyor.',
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`InPOS M530 köprü → http://127.0.0.1:${PORT}`);
  console.log(`  GMP3 port: ${GMP3_PORT} | Uygulama No: ${APP_NO || '—'} | Mod: ${SIMULATE ? 'SIM' : 'CANLI'}`);
});
