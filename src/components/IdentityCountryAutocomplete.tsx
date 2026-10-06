import { useEffect, useMemo, useRef } from 'react';
import type { IdentityFormatCountry } from '../data/identityDocumentCountries';
import {
  formatIdentityCountryNameInput,
  getCountryInlineCompletion,
} from '../data/identityDocumentCountries';

interface IdentityCountryAutocompleteProps {
  value: string;
  placeholder?: string;
  onChange: (countryName: string, formatCountry: IdentityFormatCountry | null) => void;
  required?: boolean;
}

export function IdentityCountryAutocomplete({
  value,
  placeholder = 'Ülke adı yazın…',
  onChange,
  required,
}: IdentityCountryAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  const completion = useMemo(() => getCountryInlineCompletion(value), [value]);

  const acceptCompletion = () => {
    if (!completion?.fullLabel) return;
    onChange(completion.fullLabel, completion.formatCountry);
    lastValueRef.current = completion.fullLabel;
  };

  const handleChange = (input: string) => {
    const raw = formatIdentityCountryNameInput(input);
    const prev = lastValueRef.current;
    const isDeleting = raw.length < prev.length;
    lastValueRef.current = raw;

    if (isDeleting) {
      onChange(raw, null);
      return;
    }

    const inline = getCountryInlineCompletion(raw);
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.fullLabel &&
      inline.suffix === ''
    ) {
      onChange(inline.fullLabel, inline.formatCountry);
      lastValueRef.current = inline.fullLabel;
      return;
    }
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.suffix &&
      inline.fullLabel.length > raw.length
    ) {
      onChange(inline.fullLabel, inline.formatCountry);
      lastValueRef.current = inline.fullLabel;
      return;
    }
    onChange(raw, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      return;
    }
    if (!completion?.suffix && !completion?.uniquePrefix) return;
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'End') {
      if (completion.fullLabel && completion.fullLabel !== value) {
        e.preventDefault();
        acceptCompletion();
      }
    }
  };

  const showGhost = Boolean(
    completion?.suffix &&
      completion.suffix.length > 0 &&
      completion.fullLabel !== value,
  );

  return (
    <div className="identity-country-inline voucher-entity-search">
      {showGhost && (
        <div className="identity-country-inline-ghost" aria-hidden>
          <span className="identity-country-inline-typed">{value}</span>
          <span className="identity-country-inline-suffix">{completion?.suffix}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className="voucher-entity-search-input identity-country-inline-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-required={required}
        aria-autocomplete="inline"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
    </div>
  );
}
