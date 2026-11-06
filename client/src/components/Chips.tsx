import { useRef } from 'react';
import styles from './Chips.module.css';

// Compact single-select listbox: arrow keys move focus; Space/Enter select.
export function Chips<T extends string>({ label, options, value, onChange, disabled = false }: {
  label: string; options: readonly { value: T; label: string }[];
  value: T | null; onChange: (value: T) => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tabStop = Math.max(0, options.findIndex(option => option.value === value));
  return <div ref={ref} role="listbox" aria-label={label} aria-orientation="horizontal" className={styles.chips}>
    {options.map((option, index) => <button key={option.value} type="button" role="option"
      aria-selected={value === option.value} disabled={disabled}
      tabIndex={index === tabStop ? 0 : -1}
      onClick={() => onChange(option.value)}
      onKeyDown={event => {
        const buttons = Array.from(ref.current!.querySelectorAll('button'));
        const target = ({ ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 })[event.key];
        if (target !== undefined) { event.preventDefault(); buttons[target].focus(); }
      }}>{option.label}</button>)}
  </div>;
}
