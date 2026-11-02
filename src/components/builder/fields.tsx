"use client";

import { useId } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string | null;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-ok">{hint}</p>}
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <textarea
        id={id}
        className="input leading-relaxed"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function EntryControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1">
      <button type="button" className="btn-ghost !px-2 !py-0.5 text-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
        ↑
      </button>
      <button type="button" className="btn-ghost !px-2 !py-0.5 text-xs" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
        ↓
      </button>
      <button type="button" className="btn-ghost !px-2 !py-0.5 text-xs hover:!border-bad hover:!text-bad" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
