// Petit client fetch partagé par les composants admin/staff : centralise la gestion
// d'erreur (message lisible extrait de la réponse API) pour éviter de la dupliquer
// dans chaque formulaire.

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erreur inconnue." }));
    throw new ApiClientError(body.error ?? "Erreur inconnue.", res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
