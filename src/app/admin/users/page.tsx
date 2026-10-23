"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Badge, Modal } from "@/components/ui-system";
import { I } from "@/components/Icon";

type User = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "GUARD" | "ADMIN";
  credentialId: string | null;
  active: boolean;
  _count: { vehicles: number };
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as User["role"],
    credentialId: "",
  });

  async function load() {
    setLoading(true);
    const r = await fetch("/api/users").then((r) => r.json());
    setUsers(r.users ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success("Usuario creado");
    setShowNew(false);
    setNewUser({ name: "", email: "", password: "", role: "USER", credentialId: "" });
    load();
  }

  async function patchUser(id: string, patch: Partial<User>) {
    const r = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const e = await r.json();
      return toast.error(e.error ?? "Error");
    }
    toast.success("Usuario actualizado");
    load();
  }

  async function remove(u: User) {
    if (!confirm(`¿Quitar a ${u.name} de la organización? Su cuenta de S.I.G.T.E no se borra.`)) return;
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) {
      const e = await r.json();
      return toast.error(e.error ?? "Error");
    }
    toast.success("Usuario quitado de la organización");
    load();
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Usuarios</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Gestión de perfiles y roles del sistema
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowNew(true)}>
          <I name="plus" size={18} />
          Nuevo usuario
        </button>
      </div>

      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Credencial</th>
              <th>Rol</th>
              <th style={{ textAlign: "center" }}>Autos</th>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Cargando…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Sin usuarios
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="row" style={{ gap: 10 }}>
                      <span className="avatar sm">{initials(u.name)}</span>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </span>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {u.credentialId ?? "—"}
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ minWidth: 130 }}
                      value={u.role}
                      aria-label={`Cambiar rol de ${u.name}`}
                      onChange={(e) => patchUser(u.id, { role: e.target.value as User["role"] })}
                    >
                      <option value="USER">Usuario</option>
                      <option value="GUARD">Guardia</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }} className="mono">
                    {u._count.vehicles}
                  </td>
                  <td>
                    <Badge kind={u.active ? "go" : "neutral"}>
                      {u.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td>
                    <span className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button
                        className="btn ghost icon"
                        title={u.active ? "Desactivar" : "Activar"}
                        onClick={() => patchUser(u.id, { active: !u.active })}
                      >
                        <I name={u.active ? "x" : "check"} size={16} />
                      </button>
                      <button
                        className="btn danger icon"
                        title="Quitar de la organización"
                        onClick={() => remove(u)}
                      >
                        <I name="trash" size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {showNew && (
        <Modal title="Crear usuario" onClose={() => setShowNew(false)} width={520}>
          <form onSubmit={create} style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                className="input"
                required
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="pw">
                Contraseña
              </label>
              <input
                id="pw"
                className="input"
                type="password"
                required
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="uid">
                Credencial
              </label>
              <input
                id="uid"
                className="input"
                value={newUser.credentialId}
                onChange={(e) => setNewUser({ ...newUser, credentialId: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="new-user-role">Rol</label>
              <select
                id="new-user-role"
                className="select"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User["role"] })}
              >
                <option value="USER">Usuario</option>
                <option value="GUARD">Guardia</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn ghost" onClick={() => setShowNew(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                Crear usuario
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
