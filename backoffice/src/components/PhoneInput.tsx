import { useState } from 'react';

const COUNTRY_CODES = [
  { code: '+33', country: 'FR', label: 'France (+33)' },
  { code: '+49', country: 'DE', label: 'Allemagne (+49)' },
  { code: '+34', country: 'ES', label: 'Espagne (+34)' },
  { code: '+39', country: 'IT', label: 'Italie (+39)' },
  { code: '+44', country: 'GB', label: 'Royaume-Uni (+44)' },
  { code: '+1', country: 'US', label: 'USA / Canada (+1)' },
  { code: '+41', country: 'CH', label: 'Suisse (+41)' },
  { code: '+32', country: 'BE', label: 'Belgique (+32)' },
  { code: '+352', country: 'LU', label: 'Luxembourg (+352)' },
  { code: '+351', country: 'PT', label: 'Portugal (+351)' },
  { code: '+31', country: 'NL', label: 'Pays-Bas (+31)' },
  { code: '+43', country: 'AT', label: 'Autriche (+43)' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, className, placeholder }: PhoneInputProps) {
  // Parse existing value to detect country code
  const detectCountryCode = (val: string): { prefix: string; number: string } => {
    for (const cc of COUNTRY_CODES) {
      if (val.startsWith(cc.code)) {
        return { prefix: cc.code, number: val.slice(cc.code.length) };
      }
    }
    return { prefix: '+33', number: val.replace(/^\+?\d{1,3}/, '') };
  };

  const { prefix: initialPrefix, number: initialNumber } = detectCountryCode(value);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [number, setNumber] = useState(initialNumber);

  const handlePrefixChange = (newPrefix: string) => {
    setPrefix(newPrefix);
    onChange(newPrefix + number);
  };

  const handleNumberChange = (newNumber: string) => {
    // Only allow digits and spaces
    const cleaned = newNumber.replace(/[^\d\s]/g, '');
    setNumber(cleaned);
    onChange(prefix + cleaned.replace(/\s/g, ''));
  };

  return (
    <div className={`flex gap-2 ${className || ''}`} style={{ minWidth: 0 }}>
      <select
        value={prefix}
        onChange={(e) => handlePrefixChange(e.target.value)}
        className="input flex-shrink-0"
        style={{ width: '140px', minWidth: '140px' }}
      >
        {COUNTRY_CODES.map((cc) => (
          <option key={cc.code} value={cc.code}>
            {cc.country} {cc.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        className="input"
        style={{ flex: '1 1 auto', minWidth: 0 }}
        placeholder={placeholder || '6 12 34 56 78'}
      />
    </div>
  );
}
