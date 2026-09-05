"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { getUser, setUser as persistUser, subscribe } from "@/lib/scores";

type NavSection = "inicio" | "biblioteca" | "salon" | "acerca-de" | "auth";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const user = useSyncExternalStore(subscribe, getUser, () => null);

  const isActive = (section: NavSection) => {
    if (section === "inicio") return pathname === "/";
    if (section === "biblioteca") return pathname === "/juego" || pathname.startsWith("/juego/");
    if (section === "salon") return pathname === "/salon";
    if (section === "acerca-de") return pathname === "/acerca-de";
    return pathname === "/auth";
  };

  const close = () => setOpen(false);

  const handleSignOut = () => {
    persistUser(null);
    close();
    router.push("/");
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("inicio") ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/juego" className={isActive("biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/acerca-de" className={isActive("acerca-de") ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close} />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isActive("inicio") ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link href="/juego" className={isActive("biblioteca") ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon" className={isActive("salon") ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/acerca-de" className={isActive("acerca-de") ? "active" : ""} onClick={close}>
          Acerca de
        </Link>
        <Link href="/auth" className={isActive("auth") ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
