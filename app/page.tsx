export default function Home() {
  return (
    <div className="fade-in">
      <nav className="av-nav">
        <div className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          000
        </div>
      </nav>

      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
        <div className="detail-actions" style={{ justifyContent: "center", marginTop: 32 }}>
          <button className="btn pulse">JUGAR AHORA</button>
          <button className="btn magenta">CREAR CUENTA</button>
          <button className="btn ghost">SALÓN DE LA FAMA</button>
        </div>
      </section>
    </div>
  );
}
