"use client";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { I } from "./Icon";
import { ESTADO_LABEL, type Acceso, type Estado, type Lot } from "@/lib/design-data";

export function Plate({ children, size }: { children: ReactNode; size?: "sm" | "lg" | "xl" }) {
  return <span className={"plate" + (size ? " " + size : "")}>{children}</span>;
}

export function Badge({ kind, children }: { kind: Estado | "info"; children?: ReactNode }) {
  return (
    <span className={"badge " + kind}>
      <span className="dot" />
      {children || ESTADO_LABEL[kind]}
    </span>
  );
}

export function ProductBrand({ light }: { light?: boolean }) {
  return (
    <div className="brand" style={{ color: light ? "#fff" : "var(--accent)" }}>
      <span
        className="crest"
        style={{
          background: light ? "#fff" : "var(--accent)",
          color: light ? "var(--accent)" : "#fff",
          border: "none",
          opacity: 1,
        }}
      >
        <I name="barrier" size={22} stroke={2} />
      </span>
      <span className="sep" />
      <div style={{ textAlign: "left" }}>
        <div className="sigla">S.I.G.T.E</div>
        <div className="tag">Tránsito y estacionamiento</div>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter((word) => /^[\p{L}\d]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function OrgBrand({
  name,
  legalName,
  logoUrl,
  light,
}: {
  name: string;
  legalName?: string;
  logoUrl: string | null;
  light?: boolean;
}) {
  return (
    <div className="brand" style={{ color: light ? "#fff" : "var(--accent)", minWidth: 0 }}>
      <span
        className="crest"
        style={{
          background: logoUrl || light ? "#fff" : "var(--accent)",
          color: light ? "var(--accent)" : "#fff",
          border: logoUrl && !light ? "1px solid var(--line)" : "none",
          padding: logoUrl ? 3 : 0,
          opacity: 1,
          overflow: "hidden",
          fontFamily: "var(--ff-display)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: ".02em",
        }}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          initialsOf(name)
        )}
      </span>
      <span className="sep" />
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div className="sigla org-name clamp">{name}</div>
        <div className="tag clamp">{legalName && legalName !== name ? legalName : "S.I.G.T.E"}</div>
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  style,
  pad,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  pad?: "sm";
}) {
  return (
    <div className={"card" + (pad === "sm" ? " pad-sm" : "")} style={style}>
      {(title || action) && (
        <div className="card-head">
          <div className="card-title">{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Metric({
  label,
  icon,
  value,
  sub,
  delta,
}: {
  label: string;
  icon?: string;
  value: ReactNode;
  sub?: string;
  delta?: { dir: "up" | "down"; text: string };
}) {
  return (
    <div className="metric">
      <div className="lbl">
        {icon && <I name={icon} size={16} />}
        {label}
      </div>
      <div className="val">{value}</div>
      {sub && <div className="sub">{sub}</div>}
      {delta && (
        <div className={"sub delta " + delta.dir} style={{ fontWeight: 600 }}>
          {delta.text}
        </div>
      )}
    </div>
  );
}

/* Grilla de estacionamientos — semáforo aplicado al espacio */
export function LotGrid({ lots, cols = 3, compact }: { lots: Lot[]; cols?: number; compact?: boolean }) {
  return (
    <div className="lots" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
      {lots.map((l) => (
        <div key={l.id} className={"lot " + l.level}>
          <div className="bn">{compact ? l.id : l.nombre}</div>
          <div className="bc">
            {l.ocup}/{l.cap}
          </div>
          <div className="bp">{l.estado}</div>
          <div className="meter">
            <i style={{ width: Math.min(100, l.pct) + "%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Etiqueta de dirección — la bitácora diaria distingue entrada y salida */
export function DirTag({ direccion }: { direccion?: "in" | "out" }) {
  if (!direccion) return null;
  const inn = direccion === "in";
  return (
    <span
      style={{
        fontFamily: "var(--ff-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".05em",
        color: inn ? "var(--ok-700)" : "var(--accent-700)",
        background: inn ? "var(--ok-050)" : "var(--accent-050)",
        padding: "2px 7px",
        borderRadius: 5,
        whiteSpace: "nowrap",
      }}
    >
      {inn ? "↦ ENTRADA" : "↤ SALIDA"}
    </span>
  );
}

/* Stream de accesos en vivo */
export function AccessStream({ rows, live = true, max }: { rows: Acceso[]; live?: boolean; max?: number }) {
  const data = max ? rows.slice(0, max) : rows;
  return (
    <div>
      {data.map((a, i) => (
        <div key={i} className="access-row" style={i === 0 && live ? { background: "var(--accent-050)" } : undefined}>
          <span className="t">{a.t}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Plate size="sm">{a.patente}</Plate>
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-700)", display: "flex", alignItems: "center", gap: 8 }}>
            <DirTag direccion={a.direccion} />
            <span>
              {a.titular} <span style={{ color: "var(--ink-500)" }}>· {a.rol}</span>
            </span>
          </span>
          <Badge kind={a.estado}>{a.estado === "wait" ? "Manual" : ESTADO_LABEL[a.estado]}</Badge>
          <span style={{ fontSize: 12, color: "var(--ink-500)", display: "flex", alignItems: "center", gap: 5 }}>
            <I name="pin" size={13} />
            {a.acceso} · {a.via}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Modal simple del sistema */
export function Modal({
  title,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(14,26,36,.45)" }} />
      <div className="card" style={{ position: "relative", width, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto" }}>
        <div className="card-head">
          <div className="card-title">{title}</div>
          <button className="btn ghost icon" onClick={onClose}>
            <I name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
