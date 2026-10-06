import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatVoucherEntityQueryInput,
  getVoucherEntityInlineCompletion,
  type VoucherSearchOption,
} from '../utils/voucherEntityInlineSearch';

export type { VoucherSearchOption };

interface VoucherEntitySearchProps {
  options: VoucherSearchOption[];
  valueId: string;
  placeholder: string;
  onSelect: (id: string) => void;
  error?: string;
  required?: boolean;
  /** Liste yalnızca bu kadar karakter yazıldıktan sonra açılır */
  minQueryLength?: number;
  /** inline: ghost tamamlama (müşteri); list: açılır liste */
  mode?: 'list' | 'inline';
}

export function VoucherEntitySearch({
  options,
  valueId,
  placeholder,
  onSelect,
  error,
  required,
  minQueryLength = 1,
  mode = 'list',
}: VoucherEntitySearchProps) {
  const selected = options.find((o) => o.id === valueId);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef(query);

  useEffect(() => {
    const match = options.find((o) => o.id === valueId);
    const next = mode === 'inline' && match?.label
      ? formatVoucherEntityQueryInput(match.label)
      : (match?.label ?? '');
    setQuery(next);
    lastQueryRef.current = next;
  }, [valueId, options, mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < minQueryLength) return [];
    const qDigits = q.replace(/\D/g, '');
    return options
      .filter((o) => {
        const haystack = `${o.label} ${o.hint ?? ''} ${o.searchText ?? ''} ${o.id}`.toLowerCase();
        if (haystack.includes(q)) return true;
        if (qDigits.length > 0 && o.id.replace(/\D/g, '') === qDigits) return true;
        if (qDigits.length >= 2 && o.id.replace(/\D/g, '').includes(qDigits)) return true;
        return false;
      })
      .slice(0, 12);
  }, [options, query, minQueryLength]);

  const inlineCompletion = useMemo(
    () => (mode === 'inline' ? getVoucherEntityInlineCompletion(options, query) : null),
    [mode, options, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filtered.length]);

  useEffect(() => {
    if (mode === 'inline') return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [mode]);

  const pick = (option: VoucherSearchOption) => {
    onSelect(option.id);
    const label = mode === 'inline' ? formatVoucherEntityQueryInput(option.label) : option.label;
    setQuery(label);
    lastQueryRef.current = label;
    setOpen(false);
  };

  const acceptInlineCompletion = () => {
    if (!inlineCompletion) return;
    pick(inlineCompletion.option);
  };

  const handleInlineChange = (input: string) => {
    const raw = formatVoucherEntityQueryInput(input);
    const prev = lastQueryRef.current;
    const isDeleting = raw.length < prev.length;
    lastQueryRef.current = raw;

    if (!raw.trim()) {
      setQuery('');
      onSelect('');
      return;
    }

    if (isDeleting) {
      setQuery(raw);
      onSelect('');
      return;
    }

    const inline = getVoucherEntityInlineCompletion(options, raw);
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.suffix === '' &&
      inline.fullLabel
    ) {
      pick(inline.option);
      return;
    }
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.suffix &&
      inline.fullLabel.length > raw.length
    ) {
      pick(inline.option);
      return;
    }

    setQuery(raw);
    onSelect('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === 'inline') {
      if (e.key === 'Backspace' || e.key === 'Delete') return;
      if (e.key === 'Enter') {
        if (inlineCompletion) {
          e.preventDefault();
          acceptInlineCompletion();
        }
        return;
      }
      if (!inlineCompletion?.suffix && !inlineCompletion?.uniquePrefix) return;
      if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'End') {
        if (inlineCompletion.fullLabel && inlineCompletion.fullLabel !== query) {
          e.preventDefault();
          acceptInlineCompletion();
        }
      }
      return;
    }

    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      pick(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showGhost = Boolean(
    mode === 'inline' &&
      inlineCompletion?.suffix &&
      inlineCompletion.suffix.length > 0 &&
      inlineCompletion.fullLabel !== query,
  );

  if (mode === 'inline') {
    return (
      <div className={`identity-country-inline voucher-entity-search ${error ? 'has-error' : ''}`} ref={wrapRef}>
        {showGhost && (
          <div className="identity-country-inline-ghost" aria-hidden>
            <span className="identity-country-inline-typed">{query}</span>
            <span className="identity-country-inline-suffix">{inlineCompletion?.suffix}</span>
          </div>
        )}
        <input
          type="search"
          className="voucher-entity-search-input identity-country-inline-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInlineChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-autocomplete="inline"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        {error && <span className="voucher-field-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`voucher-entity-search ${error ? 'has-error' : ''}`} ref={wrapRef}>
      <input
        type="search"
        className="voucher-entity-search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onSelect('');
        }}
        onFocus={() => {
          if (query.trim().length >= minQueryLength) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        aria-required={required}
        aria-invalid={Boolean(error)}
      />
      {open && query.trim().length >= minQueryLength && filtered.length === 0 && (
        <p className="voucher-entity-search-empty">Eşleşen kayıt bulunamadı</p>
      )}
      {open && filtered.length > 0 && (
        <ul className="voucher-entity-search-list" role="listbox">
          {filtered.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
              >
                <span>{option.label}</span>
                {option.hint && <small>{option.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="voucher-field-error">{error}</span>}
    </div>
  );
}
