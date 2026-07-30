"use client";

import { useState } from "react";

const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 95, 100, 121, 140, 180];

interface ScoreKeypadProps {
  remaining: number;
  outMode: "STRAIGHT" | "DOUBLE" | "MASTER";
  disabled?: boolean;
  onSubmit: (input: { scoreValue: number; dartsUsed: number; lastDartWasDouble?: boolean; lastDartWasTriple?: boolean }) => Promise<void>;
}

// Clavier de saisie rapide pensé pour un usage tactile au bar : boutons larges,
// valeurs fréquentes en un tap, peu de friction (exigence UX terrain).
export function ScoreKeypad({ remaining, outMode, disabled, onSubmit }: ScoreKeypadProps) {
  const [scoreValue, setScoreValue] = useState<number | null>(null);
  const [dartsUsed, setDartsUsed] = useState(3);
  const [lastDartWasDouble, setLastDartWasDouble] = useState(false);
  const [lastDartWasTriple, setLastDartWasTriple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const potentialCheckout = scoreValue !== null && remaining - scoreValue === 0;
  const needsDoubleOrTriple = potentialCheckout && outMode !== "STRAIGHT";

  async function handleSubmit() {
    if (scoreValue === null) return;
    if (needsDoubleOrTriple && !lastDartWasDouble && !lastDartWasTriple) {
      const confirmed = window.confirm(
        "Aucune double/triple cochée pour ce checkout : le tour sera compté comme un bust (score annulé). Confirmer ?",
      );
      if (!confirmed) return;
    } else if (potentialCheckout) {
      const confirmed = window.confirm(`Confirmer la fin de leg avec ${scoreValue} points ?`);
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ scoreValue, dartsUsed, lastDartWasDouble, lastDartWasTriple });
      setScoreValue(null);
      setDartsUsed(3);
      setLastDartWasDouble(false);
      setLastDartWasTriple(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {QUICK_SCORES.map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-xl py-4 text-lg font-semibold ${
              scoreValue === value ? "bg-brand-600 text-white" : "bg-slate-100 hover:bg-slate-200"
            }`}
            onClick={() => setScoreValue(value)}
            disabled={disabled}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="otherScore" className="text-sm font-medium">
          Autre score :
        </label>
        <input
          id="otherScore"
          type="number"
          min={0}
          max={180}
          className="input w-28"
          value={scoreValue ?? ""}
          onChange={(e) => setScoreValue(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
        />
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

      {needsDoubleOrTriple && (
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-800">
            Sortie en {outMode === "DOUBLE" ? "double" : "double ou triple"} requise — dernière fléchette :
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn-secondary ${lastDartWasDouble ? "ring-2 ring-brand-500" : ""}`}
              onClick={() => {
                setLastDartWasDouble(!lastDartWasDouble);
                setLastDartWasTriple(false);
              }}
            >
              Double
            </button>
            {outMode === "MASTER" && (
              <button
                type="button"
                className={`btn-secondary ${lastDartWasTriple ? "ring-2 ring-brand-500" : ""}`}
                onClick={() => {
                  setLastDartWasTriple(!lastDartWasTriple);
                  setLastDartWasDouble(false);
                }}
              >
                Triple
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        onClick={handleSubmit}
        disabled={disabled || submitting || scoreValue === null}
      >
        {submitting ? "Envoi..." : "Valider le tour"}
      </button>
    </div>
  );
}
