"use client";

import { useState } from "react";

const NUMBERS: Array<{ key: string; label: string }> = [
  { key: "20", label: "20" },
  { key: "19", label: "19" },
  { key: "18", label: "18" },
  { key: "17", label: "17" },
  { key: "16", label: "16" },
  { key: "15", label: "15" },
  { key: "BULL", label: "Bull" },
];

interface CricketBoardProps {
  disabled?: boolean;
  onSubmit: (input: { cricketMarks: Record<string, number>; dartsUsed: number }) => Promise<void>;
}

export function CricketBoard({ disabled, onSubmit }: CricketBoardProps) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [dartsUsed, setDartsUsed] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const totalMarks = Object.values(marks).reduce((sum, v) => sum + v, 0);

  function cycleMark(key: string) {
    setMarks((prev) => ({ ...prev, [key]: ((prev[key] ?? 0) + 1) % 4 }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ cricketMarks: marks, dartsUsed });
      setMarks({});
      setDartsUsed(3);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Tapez sur un numéro pour ajouter une marque (0 → 1 → 2 → 3 → 0).</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {NUMBERS.map((n) => (
          <button
            key={n.key}
            type="button"
            className="relative rounded-xl bg-slate-100 py-6 text-lg font-semibold hover:bg-slate-200"
            onClick={() => cycleMark(n.key)}
            disabled={disabled}
          >
            {n.label}
            {marks[n.key] ? (
              <span className="absolute right-1 top-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
                {marks[n.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Fléchettes lancées :</label>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`btn-secondary px-4 py-2 ${dartsUsed === n ? "ring-2 ring-brand-500" : ""}`}
            onClick={() => setDartsUsed(n)}
            disabled={disabled}
          >
            {n}
          </button>
        ))}
      </div>

      {totalMarks > dartsUsed * 3 && (
        <p className="text-sm text-red-600">Le nombre de marques dépasse ce qui est possible avec {dartsUsed} fléchette(s).</p>
      )}

      <button type="button" className="btn-primary w-full" onClick={handleSubmit} disabled={disabled || submitting}>
        {submitting ? "Envoi..." : "Valider le tour"}
      </button>
    </div>
  );
}
