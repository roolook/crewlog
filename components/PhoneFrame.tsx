import { c, f, shadow } from "@/lib/theme";

/** iOS status bar: clock, signal bars, battery. Drawn, not an image. */
export function StatusBar() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 26px 6px",
        position: "relative",
        background: c.paper,
      }}
    >
      <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700 }}>
        9:41
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: 10,
          width: 86,
          height: 24,
          background: c.ink,
          borderRadius: 999,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[4, 6, 8, 11].map((h) => (
            <div
              key={h}
              style={{
                width: 3,
                height: h,
                background: c.ink,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <div
          style={{
            width: 23,
            height: 12,
            border: "1.5px solid rgba(23,24,27,0.45)",
            borderRadius: 4,
            padding: 1.5,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "72%",
              height: "100%",
              background: c.ink,
              borderRadius: 1.5,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function HomeIndicator() {
  return (
    <div style={{ height: 12, background: c.ink, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: "50%",
          transform: "translateX(-50%)",
          width: 104,
          height: 4,
          borderRadius: 2,
          background: "rgba(251,250,247,0.55)",
        }}
      />
    </div>
  );
}

/** Black bezel + rounded screen. Children render inside the glass. */
export function PhoneFrame({
  width = 322,
  children,
  statusBar = true,
  homeIndicator = true,
}: {
  width?: number;
  children: React.ReactNode;
  statusBar?: boolean;
  homeIndicator?: boolean;
}) {
  const radius = Math.round(width * 0.168);
  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        background: c.ink,
        borderRadius: radius,
        padding: 11,
        boxShadow: shadow.phoneLg,
      }}
    >
      <div
        style={{
          background: c.paper,
          borderRadius: radius - 10,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {statusBar && <StatusBar />}
        {children}
        {homeIndicator && <HomeIndicator />}
      </div>
    </div>
  );
}
