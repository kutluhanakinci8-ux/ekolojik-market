import { useEffect, useMemo, useRef } from 'react';
import {
  composeStoredPhone,
  extractNationalDigits,
  resolvePhoneProfile,
} from '../utils/phoneNumberFormat';

interface CustomerPhoneInputProps {
  countryName: string;
  value: string;
  onChange: (value: string) => void;
}

export function CustomerPhoneInput({ countryName, value, onChange }: CustomerPhoneInputProps) {
  const profile = useMemo(() => resolvePhoneProfile(countryName), [countryName]);
  const profileRef = useRef(profile);

  const nationalDisplay = useMemo(() => {
    const digits = extractNationalDigits(value, profile);
    if (!digits) return '';
    return profile.formatNational(digits);
  }, [value, profile]);

  useEffect(() => {
    const prev = profileRef.current;
    if (prev.dialCode === profile.dialCode) {
      profileRef.current = profile;
      return;
    }
    profileRef.current = profile;
    if (!value.trim()) return;
    const national = extractNationalDigits(value, prev);
    if (!national) return;
    const next = composeStoredPhone(profile, national);
    if (next !== value) onChange(next);
  }, [profile, value, onChange]);

  const handleChange = (input: string) => {
    const national = profile.normalizeNationalDigits(input);
    onChange(composeStoredPhone(profile, national));
  };

  return (
    <div className="customer-phone-input">
      <span className="customer-phone-input__dial" aria-hidden="true">
        {profile.dialCode}
      </span>
      <input
        type="tel"
        className="customer-phone-input__field"
        value={nationalDisplay}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={profile.placeholder}
        autoComplete="tel-national"
        inputMode="tel"
      />
    </div>
  );
}
