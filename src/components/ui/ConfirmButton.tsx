"use client";

import { useState } from "react";

interface ConfirmButtonProps {
  label: string;
  confirmMessage: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}

// Bouton de confirmation générique pour toute action destructive ou irréversible
// (annulation, suppression, correction de score déjà saisi...) — cf. exigence produit
// "confirmation sur actions destructives".
export function ConfirmButton({ label, confirmMessage, onConfirm, className, disabled }: ConfirmButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className={className ?? "btn-danger"} onClick={handleClick} disabled={disabled || pending}>
      {pending ? "..." : label}
    </button>
  );
}
