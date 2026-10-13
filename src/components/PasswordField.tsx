import { useState } from 'react';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  id?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 6.5a5.5 5.5 0 0 1 5.37 4.26l1.46-.73C17.2 7.28 14.77 5.5 12 5.5 7 5.5 2.73 8.61 1 13c.67 1.7 1.78 3.17 3.18 4.26l1.28-1.6A5.48 5.48 0 0 1 12 6.5zm-6.9 7.35L3.64 16.2A10.97 10.97 0 0 0 12 20.5c3.04 0 5.8-1.23 7.82-3.22l-1.46-1.17a8.48 8.48 0 0 1-11.26.74zM2.71 3.16 1.29 4.58l18 18 1.42-1.42-3.05-3.05C20.27 16.39 21.73 14.36 23 12c-1.73-4.39-6-7.5-11-7.5-2.34 0-4.52.68-6.38 1.85L2.71 3.16z"
      />
    </svg>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  id,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="password-field" htmlFor={id}>
      <span>{label}</span>
      <span className="password-field-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className="password-field-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          aria-pressed={visible}
          tabIndex={0}
        >
          <EyeIcon open={visible} />
        </button>
      </span>
    </label>
  );
}
