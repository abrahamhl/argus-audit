import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import { getHomepageHtml } from './shared';
import { extractPageSignals, findPatternExcerpt } from '../util/html';
import { TECH_SIGNATURES } from '../signatures';

export const TECH_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'frontend.tech';

export const frontendTechScanner: Scanner = {
  id: SCANNER_ID,
  version: TECH_SCANNER_VERSION,
  description:
    'Public-frontend technology indicators from delivered HTML and response headers, plus basic accessibility signals. All technology matches are INFERRED, never truth.',
  async run(ctx: ScanContext): Promise<void> {
    const home = await getHomepageHtml(ctx);
    const provenance = provenanceFromExchange(home.exchange);

    if (home.html === null) {
      const state = home.reason === 'error' ? 'ERROR' : 'NOT_CHECKED';
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: TECH_SCANNER_VERSION,
        checkId: CHECK_IDS.techSummary,
        kind: 'tech.indicator',
        state,
        subject: home.exchange.finalUrl,
        method: 'html-scan',
        data: { reason: home.reason, detected: [] },
        provenance,
        limitations: ['The homepage HTML could not be scanned, so no technology indicators were evaluated.'],
      });
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: TECH_SCANNER_VERSION,
        checkId: CHECK_IDS.a11ySignals,
        kind: 'a11y.signal',
        state,
        subject: home.exchange.finalUrl,
        method: 'html-scan',
        data: { reason: home.reason },
        provenance,
        limitations: ['The homepage HTML could not be scanned, so no accessibility signals were evaluated.'],
      });
      return;
    }

    const signals = extractPageSignals(home.html, home.exchange.finalUrl);
    const detected: string[] = [];

    for (const signature of TECH_SIGNATURES) {
      if (signature.where === 'html') {
        if (!signature.pattern.test(home.html)) continue;
        detected.push(signature.label);
        ctx.evidence.add({
          scannerId: SCANNER_ID,
          scannerVersion: TECH_SCANNER_VERSION,
          checkId: CHECK_IDS.techIndicator,
          kind: 'tech.indicator',
          state: 'INFERRED',
          subject: signature.id,
          method: 'html-scan',
          data: {
            technology: signature.label,
            where: 'html',
            excerpt: findPatternExcerpt(home.html, signature.pattern),
          },
          provenance,
          limitations: ['Indicator-based identification from delivered markup; it can be wrong or outdated.'],
        });
      } else {
        const headerName = signature.header ?? '';
        const headerValue = home.exchange.headers[headerName] ?? null;
        if (headerValue === null || !signature.pattern.test(headerValue)) continue;
        detected.push(signature.label);
        ctx.evidence.add({
          scannerId: SCANNER_ID,
          scannerVersion: TECH_SCANNER_VERSION,
          checkId: CHECK_IDS.techIndicator,
          kind: 'tech.indicator',
          state: 'INFERRED',
          subject: signature.id,
          method: 'header-scan',
          data: {
            technology: signature.label,
            where: `header:${headerName}`,
            excerpt: headerValue,
          },
          provenance,
          limitations: ['Indicator-based identification from a response header; it can be wrong or outdated.'],
        });
      }
    }

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TECH_SCANNER_VERSION,
      checkId: CHECK_IDS.techSummary,
      kind: 'tech.indicator',
      state: 'INFERRED',
      subject: home.exchange.finalUrl,
      method: 'html+header-scan',
      data: {
        detected,
        generator: signals.generator,
        inlineScriptBytes: signals.inlineScriptBytes,
        scriptCount: signals.scriptSrcs.length,
      },
      provenance,
      limitations: [
        'Technology identification is an interpretation of public indicators, not a verified inventory.',
      ],
    });

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TECH_SCANNER_VERSION,
      checkId: CHECK_IDS.a11ySignals,
      kind: 'a11y.signal',
      state: 'OBSERVED',
      subject: home.exchange.finalUrl,
      method: 'html-scan',
      data: {
        htmlLang: signals.htmlLang,
        viewportPresent: signals.viewport !== null,
        imagesTotal: signals.imagesTotal,
        imagesMissingAlt: signals.imagesMissingAlt,
      },
      provenance,
      limitations: [
        'These are three mechanical signals from delivered HTML. They are not an accessibility audit and not a WCAG assessment.',
      ],
    });
  },
};
