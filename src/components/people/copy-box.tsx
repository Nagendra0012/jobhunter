"use client";

import { useState } from "react";

export function CopyBox({ label, text, limit }: { label: string; text: string; limit?: number }) {
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  const over = limit != null && value.length > limit;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="flex items-center gap-3">
          {limit != null && (
            <span className={over ? "text-bad" : "text-muted"}>
              {value.length}/{limit}
            </span>
          )}
          <button
            type="button"
            className="btn-ghost !px-2 !py-0.5 text-xs"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </div>
      <textarea
        className="input text-sm leading-relaxed"
        rows={Math.min(10, value.split("\n").length + 1)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {over && <p className="text-xs text-bad">LinkedIn cuts connection notes at {limit} characters.</p>}
    </div>
  );
}
