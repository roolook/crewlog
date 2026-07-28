import { c, f } from "@/lib/theme";

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}) {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 20px 80px" }}>
      <h1
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: "clamp(32px, 5vw, 46px)",
          margin: "0 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          letterSpacing: "0.08em",
          color: c.muted,
          marginBottom: 40,
        }}
      >
        LAST UPDATED {updated.toUpperCase()}
      </div>

      {sections.map((s) => (
        <section key={s.h} style={{ marginBottom: 34 }}>
          <h2
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 18,
              margin: "0 0 10px",
            }}
          >
            {s.h}
          </h2>
          {s.p.map((text, i) => (
            <p
              key={i}
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                color: c.body,
                margin: "0 0 12px",
                textWrap: "pretty",
              }}
            >
              {text}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
