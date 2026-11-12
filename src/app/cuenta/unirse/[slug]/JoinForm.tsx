"use client";

import { useState } from "react";
import type { RegistrationForm } from "@prisma/client";
import { I } from "@/components/Icon";
import {
  EMPTY_PROFILE,
  ProfileFields,
  UserTypeToggle,
  profileComplete,
  profilePayload,
  type Profile,
  type UserType,
} from "@/components/ProfileFields";

export function JoinForm({
  slug,
  organizationName,
  form: kind,
  email,
  approval,
  credentials,
}: {
  slug: string;
  organizationName: string;
  form: RegistrationForm;
  email: string;
  approval: boolean;
  credentials: boolean;
}) {
  const academic = kind === "ACADEMIC";
  const [userType, setUserType] = useState<UserType>("STUDENT");
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/account/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationSlug: slug, ...(academic ? profilePayload(userType, profile) : {}) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo enviar la solicitud");
      return;
    }
    window.location.assign(data.home);
  }

  return (
    <>
      <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
        {approval
          ? `La administración de ${organizationName} revisará tu solicitud. Cuando la acepte podrás entrar y registrar tus vehículos.`
          : `Al unirte a ${organizationName} podrás registrar tus vehículos y ver tus accesos.`}{" "}
        Entrarás con tu cuenta <b>{email}</b>.
      </p>

      <form onSubmit={submit} className="col" style={{ gap: 14 }}>
        {academic && (
          <>
            <UserTypeToggle value={userType} onChange={setUserType} />
            <ProfileFields
              userType={userType}
              profile={profile}
              credentials={credentials}
              onChange={(key, value) => setProfile((p) => ({ ...p, [key]: value }))}
            />
          </>
        )}

        {error && (
          <div className="field-err">
            <I name="alert" size={14} /> {error}
          </div>
        )}

        <button
          className="btn primary block"
          type="submit"
          disabled={loading || (academic && !profileComplete(userType, profile))}
        >
          <I name="userCheck" size={18} /> {loading ? "Enviando…" : approval ? "Enviar solicitud" : "Unirme"}
        </button>
      </form>
    </>
  );
}
