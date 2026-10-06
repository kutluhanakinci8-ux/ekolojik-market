import { useEffect, useState } from 'react';
import { checkFiscalBridge } from '../services/fiscalBridge';

export function useFiscalBridge() {
  const [fiscalOnline, setFiscalOnline] = useState(false);
  const [fiscalLabel, setFiscalLabel] = useState('Yazar kasa: kontrol...');

  useEffect(() => {
    checkFiscalBridge().then((s) => {
      setFiscalOnline(s.online);
      if (!s.online) {
        setFiscalLabel('M530 köprü bağlantısı yok');
      } else if (s.message?.includes('Test modu')) {
        setFiscalLabel('InPOS M530 (test modu)');
      } else {
        setFiscalLabel('InPOS M530 bağlı');
      }
    });
  }, []);

  return { fiscalOnline, fiscalLabel };
}
