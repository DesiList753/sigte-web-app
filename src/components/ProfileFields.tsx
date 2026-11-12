"use client";

import { I } from "@/components/Icon";
import { formatRut, isValidRut } from "@/lib/rut";

export type UserType = "STAFF" | "STUDENT";

export const EMPTY_PROFILE = {
  credentialId: "",
  position: "",
  department: "",
  rut: "",
  academicDepartment: "",
  career: "",
};

export type Profile = typeof EMPTY_PROFILE;

export function profileComplete(userType: UserType, profile: Profile) {
  return userType === "STAFF"
    ? profile.position.trim() !== "" && profile.department.trim() !== ""
    : isValidRut(profile.rut) && profile.academicDepartment.trim() !== "" && profile.career.trim() !== "";
}

export function profilePayload(userType: UserType, profile: Profile) {
  const credentialId = profile.credentialId || undefined;
  return userType === "STAFF"
    ? { userType, credentialId, position: profile.position, department: profile.department }
    : {
        userType,
        credentialId,
        rut: formatRut(profile.rut),
        academicDepartment: profile.academicDepartment,
        career: profile.career,
      };
}

export function UserTypeToggle({ value, onChange }: { value: UserType; onChange: (value: UserType) => void }) {
  return (
    <div className="field">
      <span className="field-lbl">Tipo de usuario</span>
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className={"btn block " + (value === "STUDENT" ? "primary" : "ghost")}
          aria-pressed={value === "STUDENT"}
          onClick={() => onChange("STUDENT")}
        >
          Alumno
        </button>
        <button
          type="button"
          className={"btn block " + (value === "STAFF" ? "primary" : "ghost")}
          aria-pressed={value === "STAFF"}
          onClick={() => onChange("STAFF")}
        >
          Funcionario o docente
        </button>
      </div>
    </div>
  );
}

export function ProfileFields({
  userType,
  profile,
  credentials,
  onChange,
}: {
  userType: UserType;
  profile: Profile;
  credentials: boolean;
  onChange: (key: keyof Profile, value: string) => void;
}) {
  const rutOk = profile.rut === "" || isValidRut(profile.rut);
  return (
    <>
      {userType === "STUDENT" ? (
        <>
          <div className="field">
            <label className="field-lbl" htmlFor="rut">RUT</label>
            <input
              id="rut"
              className="input"
              required
              placeholder="12.345.678-9"
              value={profile.rut}
              onChange={(e) => onChange("rut", e.target.value)}
              onBlur={(e) => e.target.value && isValidRut(e.target.value) && onChange("rut", formatRut(e.target.value))}
            />
            {!rutOk && (
              <span className="field-err" style={{ marginTop: 4 }}>
                <I name="alert" size={13} /> RUT inválido
              </span>
            )}
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="academicDepartment">Departamento Académico</label>
            <input
              id="academicDepartment"
              className="input"
              required
              placeholder="Depto. de Informática"
              value={profile.academicDepartment}
              onChange={(e) => onChange("academicDepartment", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="career">Carrera</label>
            <input
              id="career"
              className="input"
              required
              placeholder="Ingeniería Civil Informática"
              value={profile.career}
              onChange={(e) => onChange("career", e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-lbl" htmlFor="position">Cargo</label>
            <input
              id="position"
              className="input"
              required
              placeholder="Docente, Secretaria, Técnico…"
              value={profile.position}
              onChange={(e) => onChange("position", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="department">Departamento o Unidad</label>
            <input
              id="department"
              className="input"
              required
              placeholder="Depto. de Informática, Bienestar…"
              value={profile.department}
              onChange={(e) => onChange("department", e.target.value)}
            />
          </div>
        </>
      )}
      {credentials && (
        <div className="field">
          <label className="field-lbl" htmlFor="credentialId">
            Credencial <span className="muted">(opcional)</span>
          </label>
          <input
            id="credentialId"
            className="input"
            placeholder="USR-2026-123"
            value={profile.credentialId}
            onChange={(e) => onChange("credentialId", e.target.value)}
          />
        </div>
      )}
    </>
  );
}
