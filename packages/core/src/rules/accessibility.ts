import type { Rule } from './types';
import { buildFinding, numOf, strOf } from './types';
import { CHECK_IDS } from '../contracts';

const VERSION = '1.0.0';

export const missingHtmlLangRule: Rule = {
  id: 'a11y.html-lang-not-observed',
  version: VERSION,
  title: 'The page did not declare a language',
  category: 'accessibility',
  severity: 'informational',
  standards: ['WCAG 2.2 — 3.1.1 Language of Page (Level A)'],
  evaluate(index, ctx) {
    const signals = index.first(CHECK_IDS.a11ySignals);
    if (signals === undefined || signals.state !== 'OBSERVED') return null;
    if (strOf(signals, 'htmlLang') !== null) return null;
    return buildFinding({
      rule: missingHtmlLangRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `The delivered homepage HTML from ${ctx.targetUrl} does not declare a lang attribute on the html element.`,
      whyItMatters:
        'Screen readers use the page language to choose pronunciation and braille rules. Declaring it is a one-line fix that measurably improves assistive-technology behaviour.',
      howToReproduce: [
        `Fetch the page: curl -s ${ctx.targetUrl}`,
        'Inspect the opening <html> tag and check whether it includes a lang attribute.',
      ],
      howToFix: 'Set the primary language on the html element, for example <html lang="en">.',
      clientExplanation:
        'One small accessibility improvement: the page does not state which language it is in. Adding a language attribute helps screen readers read the site correctly.',
      evidenceIds: [signals.evidenceId],
      limitations: ['Single home-page sample; other pages may declare their language.'],
    });
  },
};

export const imagesMissingAltRule: Rule = {
  id: 'a11y.images-missing-alt',
  version: VERSION,
  title: 'Images without alt text were observed in the homepage HTML',
  category: 'accessibility',
  severity: 'informational',
  standards: ['WCAG 2.2 — 1.1.1 Non-text Content (Level A)'],
  evaluate(index, ctx) {
    const signals = index.first(CHECK_IDS.a11ySignals);
    if (signals === undefined || signals.state !== 'OBSERVED') return null;
    const total = numOf(signals, 'imagesTotal') ?? 0;
    const missing = numOf(signals, 'imagesMissingAlt') ?? 0;
    if (total === 0 || missing === 0) return null;
    return buildFinding({
      rule: imagesMissingAltRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `${missing} of ${total} images in the delivered homepage HTML at ${ctx.targetUrl} have no alt attribute.`,
      whyItMatters:
        'Alternative text describes images to visitors who cannot see them. Decorative images should carry an empty alt attribute, which this check counts as intentional and valid.',
      howToReproduce: [
        `Fetch the page: curl -s ${ctx.targetUrl}`,
        'Count <img> elements and compare with the number of img elements that include an alt attribute.',
      ],
      howToFix:
        'Add descriptive alt text to informative images and alt="" to purely decorative images.',
      clientExplanation:
        'Some images on the home page have no description text for visitors who use screen readers. Adding short descriptions (or empty markers for decorative images) is a straightforward content task.',
      evidenceIds: [signals.evidenceId],
      limitations: ['Mechanical attribute count on one page; it does not judge whether existing alt text is meaningful.'],
    });
  },
};

export const accessibilityRules: Rule[] = [missingHtmlLangRule, imagesMissingAltRule];
