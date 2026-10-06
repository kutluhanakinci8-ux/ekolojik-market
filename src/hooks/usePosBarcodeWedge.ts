import { useEffect, useRef } from 'react';
import { BARCODE_WEDGE_MAX_GAP_MS, BARCODE_WEDGE_MIN_LENGTH, normalizeBarcodeScanInput } from '../utils/barcodeScan';

function isPosScanInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement && el.dataset.posScan === '1';
}

function shouldIgnoreWedgeTarget(el: Element | null): boolean {
  if (!el) return false;
  if (isPosScanInput(el)) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === 'password' || type === 'email' || type === 'number') return true;
    if (el.closest('.sale-customer-bar')) return true;
    if (el.closest('.cart-crm-row')) return true;
  }
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

/**
 * USB barkod okuyucu (klavye wedge): odak müşteri alanında değilken
 * hızlı tuş dizisi + Enter ile barkodu yakalar.
 */
export function usePosBarcodeWedge(
  enabled: boolean,
  onScan: (normalized: string) => void,
): void {
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      bufferRef.current = '';
      lastKeyAtRef.current = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (shouldIgnoreWedgeTarget(target)) {
        reset();
        return;
      }

      const now = Date.now();
      if (lastKeyAtRef.current > 0 && now - lastKeyAtRef.current > BARCODE_WEDGE_MAX_GAP_MS) {
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        const raw = bufferRef.current;
        reset();
        const normalized = normalizeBarcodeScanInput(raw);
        if (normalized.length >= BARCODE_WEDGE_MIN_LENGTH) {
          event.preventDefault();
          event.stopPropagation();
          onScan(normalized);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
        lastKeyAtRef.current = now;
      } else if (event.key === 'Backspace') {
        bufferRef.current = bufferRef.current.slice(0, -1);
        lastKeyAtRef.current = now;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      reset();
    };
  }, [enabled, onScan]);
}
