import { Brand } from "@/components/Brand";
import { c, f } from "@/lib/theme";
import { StartForm } from "./StartForm";

export const metadata = {
  title: "CrewLog - hand it over",
  description:
    "Attach the spreadsheet you run on and tell us where to send the app. Free preview in 48 hours.",
};

export default function StartPage() {
  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${c.lineSoft}`,
        }}
      >
        <Brand />
        <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
          under 60 seconds
        </div>
      </header>
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "52px 20px 80px" }}>
        <StartForm />
      </main>
    </>
  );
}
