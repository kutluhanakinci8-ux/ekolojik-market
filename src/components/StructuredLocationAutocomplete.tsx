import { useEffect, useMemo, useRef } from 'react';
import type { StructuredAddressCountry } from '../utils/structuredAddressLocation';
import {
  formatStructuredLocationInput,
  getDistrictInlineCompletion,
  getRegionInlineCompletion,
  resolveStructuredRegion,
} from '../utils/structuredAddressLocation';

interface StructuredLocationAutocompleteProps {
  country: StructuredAddressCountry;
  mode: 'province' | 'district';
  value: string;
  regionContext?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  required?: boolean;
}

function getCompletion(
  country: StructuredAddressCountry,
  mode: 'province' | 'district',
  value: string,
  regionContext?: string,
) {
  if (mode === 'province') {
    return getRegionInlineCompletion(value, country);
  }
  if (!regionContext?.trim()) return null;
  const resolvedRegion = resolveStructuredRegion(regionContext, country) ?? regionContext;
  return getDistrictInlineCompletion(value, resolvedRegion, country);
}

export function StructuredLocationAutocomplete({
  country,
  mode,
  value,
  regionContext,
  placeholder,
  onChange,
  required,
}: StructuredLocationAutocompleteProps) {
  const lastValueRef = useRef(value);

  const resolvedRegion = useMemo(
    () => (regionContext?.trim() ? resolveStructuredRegion(regionContext, country) : null),
    [regionContext, country],
  );

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  const completion = useMemo(
    () =>
      getCompletion(
        country,
        mode,
        value,
        mode === 'district' ? resolvedRegion ?? regionContext : undefined,
      ),
    [country, mode, value, regionContext, resolvedRegion],
  );

  const acceptCompletion = () => {
    if (!completion?.fullLabel) return;
    onChange(completion.fullLabel);
    lastValueRef.current = completion.fullLabel;
  };

  const handleChange = (input: string) => {
    const raw = formatStructuredLocationInput(input, country);
    const prev = lastValueRef.current;
    const isDeleting = raw.length < prev.length;
    lastValueRef.current = raw;

    if (isDeleting) {
      onChange(raw);
      return;
    }

    const inline = getCompletion(
      country,
      mode,
      raw,
      mode === 'district' ? resolvedRegion ?? regionContext : undefined,
    );
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.fullLabel &&
      inline.suffix === ''
    ) {
      onChange(inline.fullLabel);
      lastValueRef.current = inline.fullLabel;
      return;
    }
    if (
      inline?.uniquePrefix &&
      raw.trim().length >= 2 &&
      inline.suffix &&
      inline.fullLabel.length > raw.length
    ) {
      onChange(inline.fullLabel);
      lastValueRef.current = inline.fullLabel;
      return;
    }
    onChange(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') return;
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

  const districtProvinceKey =
    mode === 'district' ? resolveStructuredRegion(regionContext ?? '', country) : null;
  const disabledDistrict =
    mode === 'district' && !districtProvinceKey && !(regionContext ?? '').trim();

  return (
    <div className="identity-country-inline voucher-entity-search">
      {showGhost && (
        <div className="identity-country-inline-ghost" aria-hidden>
          <span className="identity-country-inline-typed">{value}</span>
          <span className="identity-country-inline-suffix">{completion?.suffix}</span>
        </div>
      )}
      <input
        type="text"
        className="voucher-entity-search-input identity-country-inline-input"
        placeholder={disabledDistrict ? 'Önce il / bölge seçin' : placeholder}
        value={value}
        disabled={disabledDistrict}
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
