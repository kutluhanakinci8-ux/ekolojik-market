import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Product } from '../types/product';
import {
  buildSearchSuggestions,
  type SearchHint,
  type SearchSuggestion,
} from '../utils/productSearch';
import type { BarcodeScanApplyResult } from '../utils/barcodeScan';
import { normalizeBarcodeScanInput } from '../utils/barcodeScan';

export interface PremiumProductSearchHandle {
  focus: () => void;
  select: () => void;
}

interface PremiumProductSearchProps {
  value: string;
  products: Product[];
  lowStockThreshold: number;
  hints: SearchHint[];
  onChange: (value: string) => void;
  onClear: () => void;
  /** Enter veya tam barkod eşleşmesi — sepete ekle */
  onBarcodeScan?: (normalized: string) => BarcodeScanApplyResult;
  onScanFeedback?: (result: BarcodeScanApplyResult) => void;
}

export const PremiumProductSearch = forwardRef<PremiumProductSearchHandle, PremiumProductSearchProps>(
  function PremiumProductSearch(
    {
      value,
      products,
      lowStockThreshold,
      hints,
      onChange,
      onClear,
      onBarcodeScan,
      onScanFeedback,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      select: () => inputRef.current?.select(),
    }));

    const suggestions = useMemo(
      () => buildSearchSuggestions(products, value, lowStockThreshold),
      [products, value, lowStockThreshold],
    );

    useEffect(() => {
      setActiveIndex(0);
    }, [value, suggestions.length]);

    useEffect(() => {
      const handlePointerDown = (event: MouseEvent) => {
        if (!wrapRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handlePointerDown);
      return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const applySuggestion = (suggestion: SearchSuggestion) => {
      onChange(suggestion.insertValue);
      setOpen(false);
    };

    const tryScanFromInput = (): boolean => {
      if (!onBarcodeScan) return false;
      const normalized = normalizeBarcodeScanInput(value);
      if (normalized.length < 1) return false;
      const result = onBarcodeScan(normalized);
      onScanFeedback?.(result);
      if (result.ok) {
        onClear();
        setOpen(false);
        inputRef.current?.focus();
        return true;
      }
      return false;
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        if (tryScanFromInput()) {
          event.preventDefault();
          return;
        }
      }

      if (!open || suggestions.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === 'Enter' && suggestions[activeIndex]) {
        event.preventDefault();
        applySuggestion(suggestions[activeIndex]);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const hasValue = value.trim().length > 0;

    return (
      <div className="premium-search premium-search--barcode" ref={wrapRef}>
        <div className={`search-box premium-search-box ${open ? 'is-open' : ''}`}>
          <span className="search-icon" aria-hidden>📷</span>
          <input
            ref={inputRef}
            type="search"
            className="premium-search-input"
            placeholder="Barkod okutun veya ürün arayın…"
            value={value}
            data-pos-scan="1"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            aria-label="Barkod okuyucu ve ürün arama"
            aria-expanded={open && suggestions.length > 0}
            aria-autocomplete="list"
          />
          {hasValue && (
            <button
              type="button"
              className="premium-search-clear"
              onClick={() => {
                onClear();
                setOpen(false);
                inputRef.current?.focus();
              }}
              aria-label="Aramayı temizle"
            >
              ✕
            </button>
          )}
        </div>

        <p className="premium-search-barcode-hint" role="note">
          USB okuyucu: bu kutuya odaklanın, okutun — otomatik sepete eklenir.
        </p>

        {hints.length > 0 && (
          <div className="premium-search-hints" aria-label="Aktif arama filtreleri">
            {hints.map((hint) => (
              <span key={`${hint.type}-${hint.value}`} className={`premium-search-hint premium-search-hint--${hint.type}`}>
                {hint.label}
              </span>
            ))}
          </div>
        )}

        {open && suggestions.length > 0 && (
          <ul className="premium-search-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`premium-search-suggestion ${index === activeIndex ? 'is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                >
                  <span className={`premium-search-suggestion-type premium-search-suggestion-type--${suggestion.type}`}>
                    {suggestion.hint}
                  </span>
                  <span className="premium-search-suggestion-label">{suggestion.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
