import { describe, it, expect } from 'vitest';
import { LEGAL_DOCS, SUPPORT_EMAIL, type Lang } from '@/features/pages/legalContent';

// D-056 contract: the lawyer draft must carry the REAL support address, name
// the service processors, and never call the address a placeholder. EN and AR
// must stay structurally identical.

const LANGS: Lang[] = ['en', 'ar'];

describe('legal content (D-056)', () => {
  it('uses the real support inbox, not the placeholder', () => {
    expect(SUPPORT_EMAIL).toBe('momentum.pwa@gmail.com');
    expect(SUPPORT_EMAIL).not.toContain('placeholder');
  });

  it.each(LANGS)('privacy (%s) names the processors and the honest AI-training claim', (lang) => {
    const doc = LEGAL_DOCS.privacy[lang];
    const all = doc.sections.map((s) => `${s.h}\n${s.p}`).join('\n');
    for (const processor of ['Cloudflare', 'OpenRouter', 'Mailjet', 'OneSignal', 'Sentry']) {
      expect(all).toContain(processor);
    }
    // Softened, verified claim: WE do not train on content; provider policies
    // are explicitly NOT claimed as verified.
    expect(all).not.toMatch(/We do not use your content to train AI models\./);
  });

  it.each(LANGS)('privacy (%s) discloses storage location, lookupability, and localStorage', (lang) => {
    const all = LEGAL_DOCS.privacy[lang].sections.map((s) => `${s.h}\n${s.p}`).join('\n');
    if (lang === 'en') {
      expect(all.toLowerCase()).toContain('riyadh');
      expect(all.toLowerCase()).toContain('local storage');
    } else {
      expect(all).toContain('الرياض');
      expect(all).toContain('التخزين المحلي');
    }
  });

  it.each(LANGS)('keeps the DRAFT banner and contact line honest (%s)', (lang) => {
    for (const key of ['privacy', 'terms'] as const) {
      const doc = LEGAL_DOCS[key][lang];
      expect(doc.draftBanner.length).toBeGreaterThan(0);
      expect(doc.contactLine.toLowerCase()).not.toContain('placeholder');
      expect(doc.contactLine).not.toContain('مؤقت');
    }
  });

  it('EN and AR stay structurally identical (leaf-key parity)', () => {
    for (const key of ['privacy', 'terms'] as const) {
      for (const lang of LANGS) {
        const doc = LEGAL_DOCS[key][lang];
        const other: Lang = lang === 'en' ? 'ar' : 'en';
        const mirror = LEGAL_DOCS[key][other];
        expect(doc.sections.length).toBe(mirror.sections.length);
        doc.sections.forEach((s, i) => {
          expect(s.h.length).toBeGreaterThan(0);
          expect(s.p.length).toBeGreaterThan(0);
          expect(mirror.sections[i].p.length).toBeGreaterThan(0);
        });
        expect(Object.keys(doc).sort()).toEqual(Object.keys(mirror).sort());
      }
    }
  });
});
