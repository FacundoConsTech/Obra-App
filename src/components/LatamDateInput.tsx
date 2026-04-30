import { useEffect, useState } from 'react';
import { formatDateLatam } from '../lib/dateUtils';

type LatamDateInputProps = {
  value: string;
  onChange: (nextIsoDate: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
};

const maskLatamDate = (input: string) => {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const toIsoIfValid = (latam: string) => {
  const match = latam.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 9999) return null;

  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return null;

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

export default function LatamDateInput({
  value,
  onChange,
  className,
  required,
  placeholder = 'dd/mm/yyyy',
}: LatamDateInputProps) {
  const [displayValue, setDisplayValue] = useState(formatDateLatam(value));

  useEffect(() => {
    setDisplayValue(formatDateLatam(value));
  }, [value]);

  const handleChange = (nextRawValue: string) => {
    const masked = maskLatamDate(nextRawValue);
    setDisplayValue(masked);

    if (!masked) {
      onChange('');
      return;
    }

    const iso = toIsoIfValid(masked);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    if (!displayValue) return;
    const iso = toIsoIfValid(displayValue);
    if (!iso) {
      setDisplayValue(formatDateLatam(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      required={required}
    />
  );
}
