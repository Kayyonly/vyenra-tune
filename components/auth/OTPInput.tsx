'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

type OTPInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
};

const OTP_LENGTH = 6;

const sanitizeDigits = (raw: string) => raw.replace(/\D/g, '').slice(0, OTP_LENGTH);

export function OTPInput({ value, onChange, onComplete, disabled = false, hasError = false }: OTPInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (!disabled) {
      refs.current[0]?.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (value.length === OTP_LENGTH) {
      onComplete?.(value);
    }
  }, [value, onComplete]);

  const applyDigits = (startIndex: number, rawValue: string) => {
    const incoming = sanitizeDigits(rawValue);
    if (!incoming) return;

    const nextDigits = [...digits];
    incoming.split('').forEach((digit, offset) => {
      const target = startIndex + offset;
      if (target < OTP_LENGTH) {
        nextDigits[target] = digit;
      }
    });

    const nextValue = nextDigits.join('').slice(0, OTP_LENGTH);;
    onChange(nextValue);

    const nextFocus = Math.min(startIndex + incoming.length, OTP_LENGTH - 1);
    refs.current[nextFocus]?.focus();
    setActiveIndex(nextFocus);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        onChange(nextDigits.join(''));
        return;
      }

      if (index > 0) {
        refs.current[index - 1]?.focus();
        setActiveIndex(index - 1);
      }
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
      setActiveIndex(index - 1);
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    const pasted = sanitizeDigits(event.clipboardData.getData('text'));
    if (!pasted) return;

    applyDigits(index, pasted);
  };

  return (
    <div className={`flex items-center justify-between gap-2 ${hasError ? 'animate-[shake_0.35s_ease-in-out]' : ''}`}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          onFocus={() => setActiveIndex(index)}
          onChange={(event) => applyDigits(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(event, index)}
          className={`h-12 w-10 rounded-lg border text-center text-lg font-semibold text-white outline-none transition-all duration-200 disabled:opacity-60 ${
            hasError
              ? 'border-red-500 bg-red-500/10 focus:ring-2 focus:ring-red-500/60'
              : activeIndex === index
                ? 'border-white/70 bg-white/15 ring-2 ring-white/40'
                : 'border-white/10 bg-white/10 focus:border-white/70 focus:ring-2 focus:ring-white/40'
          }`}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
