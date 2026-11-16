import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LEGAL_DOCS, SUPPORT_EMAIL, type Lang } from "./legalContent";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Legal pages (/privacy, /terms) — DRAFT, not lawyer-reviewed (D-025, run 12).
 * Bilingual EN + AR (browser language picks the default; quiet toggle switches).
 * No data queries; no first-paint animation (L0 lesson); anti-slop styling.
 */
export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  // Language: explicit ?lang= URL param (linkable, QA-friendly) → browser language → en.
  const [lang, setLang] = useState<Lang>(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "ar" || q === "en") return q;
    return (navigator.language || "").toLowerCase().startsWith("ar")
      ? "ar"
      : "en";
  });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const t = LEGAL_DOCS[kind][lang];
  const isAr = lang === "ar";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? "rtl" : "ltr";
    document.title = "Momentum — " + t.title;
    return () => {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
      document.title = "Momentum - Collaborative Task & Habit Tracker";
    };
  }, [lang, isAr, t.title]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className={isMobile ? "px-4 pt-6 pb-16" : "px-6 pt-10 pb-20"}>
        <div className={isMobile ? "w-full" : "max-w-2xl mx-auto"}>
          {/* Top bar: back + draft tag + language toggle (quiet controls) */}
          <div className="flex items-center justify-between gap-2 mb-8">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors min-h-[44px] min-w-[44px] px-2 -mx-2"
              aria-label={t.backLabel}
            >
              <ArrowLeft
                className="w-4 h-4"
                style={isAr ? { transform: "scaleX(-1)" } : undefined}
              />
              {t.backLabel}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/80 border border-border rounded px-1.5 py-0.5">
                {t.draftTag}
              </span>
              <button
                type="button"
                onClick={() => setLang(isAr ? "en" : "ar")}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors min-h-[44px] px-2"
              >
                {t.langToggle}
              </button>
            </div>
          </div>

          {/* DRAFT banner */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-8">
            <p className="text-sm text-muted-foreground">{t.draftBanner}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t.footerNote}</p>
          </div>

          <h1 className="text-3xl font-black tracking-tight mb-1">{t.title}</h1>
          <p className="text-muted-foreground mb-1">{t.subtitle}</p>
          <p className="text-xs text-muted-foreground/70 mb-8">{t.updated}</p>

          {t.sections.map((s, i) => (
            <section key={i} className="mb-6">
              <h2 className="text-lg font-bold mb-1">{s.h}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.p}</p>
            </section>
          ))}

          <section className="mb-10">
            <h2 className="text-lg font-bold mb-1">{t.contactHeading}</h2>
            <p className="text-sm text-muted-foreground">
              {t.contactLine}{" "}
              <a
                href={"mailto:" + SUPPORT_EMAIL}
                className="underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>

          <hr className="border-border mb-4" />
          <p className="text-xs text-muted-foreground/70">{t.footerNote}</p>
        </div>
      </div>
    </div>
  );
}
