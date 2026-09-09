import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const chapters: Record<string, { eyebrow: string; title: string }> = {
  home: {
    eyebrow: "SPECIALTY CLINICAL INTELLIGENCE & EXECUTION",
    title: "From clinical decision to completed care.",
  },
  product: { eyebrow: "SOVEREIGN PRODUCT", title: "Clinical intelligence meets care execution." },
  platform: { eyebrow: "SOVEREIGN PLATFORM", title: "The specialty care execution layer." },
  rheumatology: { eyebrow: "SOVEREIGN RHEUMATOLOGY", title: "Built first for rheumatology." },
  security: {
    eyebrow: "CONTROLLED CLINICAL INTELLIGENCE",
    title: "Human authority remains in control.",
  },
  about: { eyebrow: "SOVEREIGN HEALTH AI LLC", title: "Building completed-care infrastructure." },
  access: { eyebrow: "RHEUMATOLOGY EARLY ACCESS", title: "Help shape Sovereign Rheumatology." },
  contact: { eyebrow: "CONTACT SOVEREIGN", title: "Build the next chapter with us." },
  privacy: { eyebrow: "SOVEREIGN HEALTH AI LLC", title: "Privacy, stated plainly." },
  terms: { eyebrow: "SOVEREIGN HEALTH AI LLC", title: "Terms for the public website." },
};

export function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("chapter") || "home";
  const chapter = chapters[key] || chapters.home;
  return new ImageResponse(
    <div
      style={{
        background: "#06182a",
        color: "white",
        display: "flex",
        height: "100%",
        width: "100%",
        padding: "74px 84px",
        position: "relative",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background:
            "radial-gradient(circle, rgba(65,216,232,.34), rgba(49,118,255,.12) 38%, transparent 68%)",
          border: "1px solid rgba(92,224,236,.22)",
          borderRadius: "50%",
          height: "540px",
          position: "absolute",
          right: "-20px",
          top: "-80px",
          width: "540px",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: "30px",
            fontWeight: 700,
          }}
        >
          <img
            alt=""
            height="64"
            src={`${request.nextUrl.origin}/brand/sovereign-mark.webp`}
            style={{ objectFit: "contain", width: "62px" }}
            width="62"
          />
          Sovereign
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "850px" }}>
          <div
            style={{ color: "#63dce7", fontSize: "19px", fontWeight: 700, letterSpacing: "4px" }}
          >
            {chapter.eyebrow}
          </div>
          <div
            style={{
              fontSize: "66px",
              fontWeight: 500,
              letterSpacing: "-3px",
              lineHeight: 1.03,
              marginTop: "24px",
            }}
          >
            {chapter.title}
          </div>
        </div>
        <div style={{ color: "#a8c1cf", display: "flex", fontSize: "20px" }}>
          The clinician decides. Sovereign makes the decision executable.
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
