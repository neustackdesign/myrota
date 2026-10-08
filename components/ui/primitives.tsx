"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { RotaMarker, type MarkerName } from "@/components/brand/RotaMarker";
import { apiErrorMessage } from "@/lib/api/repository";
import { DEMO_MODE, useRuntime } from "@/lib/client/runtime";
import { DEMO_SCENARIOS } from "@/lib/demo/demo-repository";

// ---------------------------------------------------------------- Button
type Variant = "primary" | "secondary" | "rescue" | "text" | "text-muted" | "quiet";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "lg" | "md";
  block?: boolean;
  busy?: boolean;
  icon?: MarkerName;
  iconMode?: "mono" | "colour";
}

export function Button({ variant = "secondary", size = "lg", block = true, busy, icon, iconMode, className, children, disabled, ...rest }: ButtonProps) {
  const cls = [
    "btn",
    variant === "primary" && "btn--primary",
    variant === "rescue" && "btn--rescue",
    variant === "quiet" && "btn--quiet",
    (variant === "text" || variant === "text-muted") && "btn--text",
    variant === "text-muted" && "btn--text-muted",
    size === "lg" && variant !== "text" && variant !== "text-muted" && "btn--lg",
    block && variant !== "text" && variant !== "text-muted" && "btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} disabled={disabled || busy} aria-busy={busy || undefined} data-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : icon ? <RotaMarker icon={icon} size={22} mode={iconMode} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", children, block = true, icon }: { href: string; variant?: Variant; children: ReactNode; block?: boolean; icon?: MarkerName }) {
  const cls = ["btn", variant === "primary" && "btn--primary", variant === "rescue" && "btn--rescue", (variant === "text" || variant === "text-muted") && "btn--text", variant !== "text" && variant !== "text-muted" && "btn--lg", block && variant !== "text" && "btn--block"]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} className={cls}>
      {icon ? <RotaMarker icon={icon} size={22} /> : null}
      {children}
    </Link>
  );
}

export function BackButton({ fallback = "/", label = "Back", onDark }: { fallback?: string; label?: string; onDark?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`icon-btn ${onDark ? "on-dark" : ""}`}
      aria-label={label}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      ‹
    </button>
  );
}

// ---------------------------------------------------------------- Sheet
export function Sheet({ open, onClose, labelledBy, children, dismissible = true }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; dismissible?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restore.current?.focus?.();
    };
  }, [open, onClose, dismissible]);
  if (!open) return null;
  return (
    <div className="sheet-root">
      <div className="sheet-scrim" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        <div className="sheet__handle" aria-hidden />
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Toast
const ToastContext = createContext<(text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: string) => {
    setText(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 2400);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">{text ?? ""}</div>
      {text ? (
        <div className="toast" aria-hidden>
          <RotaMarker icon="done" size={22} mode="colour" ink="#FBFAF6" paper="#2A1911" accent="#9ED8CF" />
          <span>{text}</span>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------- TabBar
const TABS: { href: string; label: string; icon: MarkerName; accent: string }[] = [
  { href: "/today", label: "Today", icon: "rota", accent: "#EE6F3E" },
  { href: "/shelf", label: "Shelf", icon: "shelf", accent: "#9ED8CF" },
  { href: "/friends", label: "Friends", icon: "friends", accent: "#DDBB9C" },
];
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = path?.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className="tab" aria-current={active ? "page" : undefined}>
            <RotaMarker icon={t.icon} size={28} mode={active ? "colour" : "mono"} ink={active ? "#2A1911" : "#845535"} accent={t.icon === "rota" ? "#FBFAF6" : t.accent} accent2="#EE6F3E" />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- Avatar
/** Initials only, from a user-typed display name. No name → profile icon; never an invented name. */
export function initialsOf(name: string | null | undefined) {
  if (!name?.trim()) return null;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
export function Avatar({ name, size = "md", variant = "self", onClick, label }: { name: string | null; size?: "sm" | "md" | "lg"; variant?: "self" | "friend" | "friend-2"; onClick?: () => void; label?: string }) {
  const initials = initialsOf(name);
  const cls = `avatar ${size === "sm" ? "avatar--sm" : size === "lg" ? "avatar--lg" : ""} ${variant === "friend" ? "avatar--friend" : variant === "friend-2" ? "avatar--friend-2" : ""}`;
  const content = initials ?? <RotaMarker icon="profile" size={size === "lg" ? 32 : 26} />;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label ?? "Profile"}>
        {content}
      </button>
    );
  }
  return (
    <span className={cls} aria-hidden={!label} aria-label={label} role={label ? "img" : undefined}>
      {content}
    </span>
  );
}

// ---------------------------------------------------------------- State blocks
export function LoadingBlock({ label = "Loading", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className="stack" role="status" aria-live="polite" style={{ ["--gap" as string]: "10px" }}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 120 : 56 }} />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, onRetry, title = "We couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state-block state-block--error" role="alert">
      <div className="t-strong" style={{ fontSize: 15 }}>{title}</div>
      <p className="t-note t-muted">{apiErrorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="md" block={false} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="note note--sienna" style={{ margin: 0 }}>
      {apiErrorMessage(error)}
    </p>
  );
}

// ---------------------------------------------------------------- Demo bar
export function DemoBar() {
  const { demoScenario } = useRuntime();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!DEMO_MODE || !mounted) return null;
  return (
    <div className="demo-bar" role="region" aria-label="Demo mode">
      <b>DEMO DATA</b>
      <span>Nothing is saved. Scan, invites and sign-in are simulated or disabled.</span>
      <label className="row" style={{ ["--gap" as string]: "6px" }}>
        <span className="sr-only">Demo scenario</span>
        <select
          value={demoScenario ?? "fresh"}
          onChange={(e) => {
            const start = e.target.value === "fresh" ? "/" : e.target.value === "flagged-shelf" ? "/shelf" : e.target.value === "friend-joined" ? "/friends" : e.target.value.startsWith("week-") ? "/week/complete" : "/today";
            window.location.href = `${start}?demo=${e.target.value}`;
          }}
        >
          {DEMO_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
