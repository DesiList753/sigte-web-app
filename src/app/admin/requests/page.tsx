"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Card, Modal } from "@/components/ui-system";
import { I } from "@/components/Icon";

type Role = "USER" | "GUARD" | "ADMIN";

type JoinRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  userType: "STAFF" | "STUDENT" | null;
  position: string | null;
  department: string | null;
  academicDepartment: string | null;
  career: string | null;
  credentialId: string | null;
  requestedAt: string;
};

type Invitation = { id: string; email: string; role: Role; expiresAt: string; createdAt: string };

const ROLE_LABEL: Record<Role, string> = { USER: "Usuario", GUARD: "Guardia", ADMIN: "Administrador" };

function day(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function profileLine(r: JoinRequest) {
  const parts =
    r.userType === "STUDENT"
      ? ["Alumno", r.career, r.academicDepartment, r.rut]
      : r.userType === "STAFF"
        ? ["Funcionario", r.position, r.department]
        : [];
  return [...parts, r.phone, r.credentialId && `Credencial ${r.credentialId}`].filter(Boolean).join(" · ");
}

function fetchPending(): Promise<[{ requests?: JoinRequest[] }, { invitations?: Invitation[] }]> {
  return Promise.all([
    fetch("/api/join-requests").then((res) => res.json()),
    fetch("/api/invitations").then((res) => res.json()),
  ]);
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "USER" as Role });
  const [link, setLink] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(
    () =>
      fetchPending().then(([r, i]) => {
        setRequests(r.requests ?? []);
        setInvitations(i.invitations ?? []);
        setLoading(false);
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  async function answer(r: JoinRequest, action: "approve" | "reject") {
    if (action === "reject" && !confirm(`¿Rechazar la solicitud de ${r.name}?`)) return;
    const res = await fetch(`/api/join-requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      return toast.error(data.error ?? "No se pudo responder la solicitud");
    }
    toast.success(action === "approve" ? `${r.name} ya puede entrar` : "Solicitud rechazada");
    load();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return toast.error(data.issues?.[0]?.message ?? data.error ?? "No se pudo invitar");
    setLink(data.link);
    setInvite({ email: "", role: "USER" });
    load();
  }

  async function revoke(i: Invitation) {
    if (!confirm(`¿Anular la invitación de ${i.email}?`)) return;
    const res = await fetch(`/api/invitations/${i.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("No se pudo anular la invitación");
    toast.success("Invitación anulada");
    load();
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Enlace copiado");
  }

  function closeInvite() {
    setShowInvite(false);
    setLink(null);
  }

  return (
    <div className="app-page" style={{ display: "grid", gap: 20 }}>
      <div className="row between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Solicitudes</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Personas que piden entrar a la organización e invitaciones enviadas
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowInvite(true)}>
          <I name="plus" size={18} />
          Invitar persona
        </button>
      </div>

      <Card title={`Solicitudes de ingreso (${requests.length})`}>
        {loading ? (
          <p className="muted" style={{ margin: 0 }}>Cargando…</p>
        ) : requests.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No hay solicitudes pendientes.</p>
        ) : (
          <div style={{ display: "grid" }}>
            {requests.map((r, i) => (
              <div
                key={r.id}
                className="row between"
                style={{ gap: 12, flexWrap: "wrap", padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{r.email}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {[profileLine(r), `Pedida el ${day(r.requestedAt)}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="row" style={{ gap: 8 }}>
                  <button className="btn ghost" onClick={() => answer(r, "reject")}>
                    <I name="x" size={16} /> Rechazar
                  </button>
                  <button className="btn primary" onClick={() => answer(r, "approve")}>
                    <I name="check" size={16} /> Aceptar
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Invitaciones enviadas (${invitations.length})`}>
        {loading ? (
          <p className="muted" style={{ margin: 0 }}>Cargando…</p>
        ) : invitations.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No hay invitaciones por aceptar.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((i) => {
                const expired = new Date(i.expiresAt) < new Date();
                return (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{ROLE_LABEL[i.role]}</td>
                    <td>
                      <Badge kind={expired ? "neutral" : "wait"}>
                        {expired ? "Vencida" : `Vence el ${day(i.expiresAt)}`}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn danger icon" title="Anular invitación" onClick={() => revoke(i)}>
                        <I name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showInvite && (
        <Modal title="Invitar persona" onClose={closeInvite} width={480}>
          {link ? (
            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              <p className="muted" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
                Invitación creada. Le enviamos un correo con este enlace; también puedes copiarlo y entregárselo tú.
                Vence en 7 días.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input mono"
                  style={{ textTransform: "none", flex: 1, minWidth: 0 }}
                  readOnly
                  value={link}
                  aria-label="Enlace de invitación"
                />
                <button type="button" className="btn secondary" onClick={copyLink}>
                  Copiar
                </button>
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn primary" onClick={closeInvite}>
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={sendInvite} style={{ display: "grid", gap: 14, marginTop: 14 }}>
              <div className="field">
                <label className="field-lbl" htmlFor="invite-email">Correo</label>
                <input
                  id="invite-email"
                  className="input"
                  type="email"
                  required
                  autoFocus
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                />
                <span className="field-hint">Sirve aunque la persona todavía no tenga cuenta en S.I.G.T.E.</span>
              </div>
              <div className="field">
                <label className="field-lbl" htmlFor="invite-role">Rol</label>
                <select
                  id="invite-role"
                  className="select"
                  value={invite.role}
                  onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}
                >
                  <option value="USER">Usuario</option>
                  <option value="GUARD">Guardia</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn ghost" onClick={closeInvite}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={sending}>
                  {sending ? "Enviando…" : "Enviar invitación"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
