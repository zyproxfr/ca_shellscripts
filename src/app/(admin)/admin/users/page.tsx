"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
}

const fetcher = (url: string) => apiFetch<StaffUser[]>(url);

const ROLE_LABELS: Record<StaffUser["role"], string> = {
  ADMIN: "Administrateur",
  STAFF: "Staff",
};

export default function UsersPage() {
  const { data: users, error, isLoading, mutate } = useSWR("/api/users", fetcher);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffUser["role"]>("STAFF");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<StaffUser["role"]>("STAFF");
  const [editPassword, setEditPassword] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name, password, role }),
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("STAFF");
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(user: StaffUser) {
    setEditingId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPassword("");
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPassword("");
    setFormError(null);
  }

  async function handleUpdate(userId: string) {
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { name: editName, role: editRole };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }
      await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      cancelEdit();
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    setFormError(null);
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comptes administrateur et staff pour la gestion des tournois au comptoir.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card space-y-4">
        <h2 className="text-lg font-semibold">Créer un compte</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Rôle</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as StaffUser["role"])}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
        </div>
        {formError && !editingId && <p className="text-sm text-red-600">{formError}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting && !editingId ? "Création..." : "Créer le compte"}
        </button>
      </form>

      {isLoading && <p>Chargement...</p>}
      {error && <p className="text-red-600">Impossible de charger les utilisateurs.</p>}

      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold">Comptes existants</h2>
        {formError && editingId && <p className="mb-4 text-sm text-red-600">{formError}</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-2 pr-4 font-medium">Nom</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Rôle</th>
              <th className="py-2 pr-4 font-medium">Statut</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                {editingId === user.id ? (
                  <>
                    <td className="py-3 pr-4">
                      <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{user.email}</td>
                    <td className="py-3 pr-4">
                      <select
                        className="input"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as StaffUser["role"])}
                      >
                        <option value="STAFF">Staff</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={user.isActive ? "text-green-700" : "text-slate-400"}>
                        {user.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          className="input"
                          type="password"
                          placeholder="Nouveau mot de passe (optionnel)"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          minLength={8}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={submitting}
                            onClick={() => handleUpdate(user.id)}
                          >
                            Enregistrer
                          </button>
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 pr-4 font-medium">{user.name}</td>
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">{ROLE_LABELS[user.role]}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {user.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button type="button" className="btn-secondary" onClick={() => startEdit(user)}>
                          Modifier
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => toggleActive(user)}>
                          {user.isActive ? "Désactiver" : "Réactiver"}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-400">
                  Aucun compte staff pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
