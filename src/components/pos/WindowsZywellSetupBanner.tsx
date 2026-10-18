import { useCallback, useEffect, useState } from 'react';
import {
  STANDARD_WINDOWS_ZYWELL_PRINTER_NAME,
  WINDOWS_ZYWELL_SETUP_PS1_PATH,
} from '../../config/standardReceiptPrinter';
import { isLimaRawPrintReadyForReceipt } from '../../utils/limaRawReceiptPrint';

function isWindowsDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.userAgent) || /Windows/i.test(navigator.platform);
}

const DISMISS_KEY = 'market-pos-zywell-setup-dismissed';

interface WindowsZywellSetupBannerProps {
  onApplyPrinterSettings?: () => void;
}

/**
 * Windows kasa: Zywell + fiş köprüsü kurulu değilse tek tık kurulum rehberi.
 * Tarayıcı yazıcıyı otomatik kuramaz; kullanıcı indirilen .ps1'i bir kez çalıştırır.
 */
export function WindowsZywellSetupBanner({ onApplyPrinterSettings }: WindowsZywellSetupBannerProps) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bridgeMsg, setBridgeMsg] = useState('');

  const recheck = useCallback(async () => {
    setChecking(true);
    const ready = await isLimaRawPrintReadyForReceipt();
    setBridgeMsg(ready.message);
    setVisible(!ready.bridgeUp);
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!isWindowsDesktop()) {
      setChecking(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setChecking(false);
        return;
      }
    } catch {
      /* ignore */
    }
    void recheck();
  }, [recheck]);

  if (!isWindowsDesktop() || (!visible && !checking)) {
    return null;
  }

  const setupUrl = `${window.location.origin}${WINDOWS_ZYWELL_SETUP_PS1_PATH}`;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="zywell-setup-banner" role="region" aria-label="Zywell yazıcı kurulumu">
      <div className="zywell-setup-banner-inner">
        <strong>Zywell POS-80 fiş yazıcısı</strong>
        <p className="module-hint">
          Bu programda standart yazıcı <code>{STANDARD_WINDOWS_ZYWELL_PRINTER_NAME}</code>.
          Windows’ta yazıcı ve fiş servisi henüz hazır değil{checking ? ' (kontrol ediliyor…)' : ''}.
        </p>
        {bridgeMsg && !checking ? <p className="module-hint">{bridgeMsg}</p> : null}
        <ol className="module-hint zywell-setup-steps">
          <li>
            <a className="btn btn-primary" href={setupUrl} download="ekolojik-zywell-setup.ps1">
              Kurulum dosyasını indir
            </a>
          </li>
          <li>İndirilen dosyaya sağ tık → <strong>PowerShell ile Çalıştır</strong> (Node.js LTS; sadece kurulum için).</li>
          <li>USB Zywell takılı olsun. Kurulumdan sonra fiş servisi <strong>arka planda</strong> çalışır; kasiyer terminal açmaz.</li>
        </ol>
        <div className="zywell-setup-actions">
          <button type="button" className="btn btn-outline" onClick={() => void recheck()}>
            Tekrar kontrol
          </button>
          {onApplyPrinterSettings ? (
            <button type="button" className="btn btn-outline" onClick={onApplyPrinterSettings}>
              Ayarlara Zywell adını yaz
            </button>
          ) : null}
          <button type="button" className="btn btn-text" onClick={dismiss}>
            Bu oturumda gizle
          </button>
        </div>
      </div>
    </div>
  );
}
