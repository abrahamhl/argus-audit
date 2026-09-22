import type { ExplanationProvider, ExplanationRequest } from '@argus-audit/core';

interface WorkersAiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

/**
 * Optional Workers AI explainer. It may ONLY rephrase the deterministic
 * finding text for a non-technical reader. It cannot add claims, severities,
 * numbers or legal statements. Any failure falls back to the deterministic
 * text (handled by the audit orchestrator).
 */
export function createWorkersAiExplainer(
  ai: WorkersAiBinding,
  model: string = DEFAULT_AI_MODEL,
): ExplanationProvider {
  return {
    id: `workers-ai:${model}`,
    enabled: true,
    async explain({ finding, evidence }: ExplanationRequest) {
      const response = await ai.run(model, {
        messages: [
          {
            role: 'system',
            content: [
              'You rewrite a technical website finding for a non-technical business owner.',
              'Rules: use only the facts in the input; never claim legal non-compliance;',
              'never mention fines, lawsuits or urgency; never invent severity or numbers;',
              'no fear marketing; 2-3 short sentences; plain language.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: finding.title,
              severity: finding.severity,
              observation: finding.summary,
              whyItMatters: finding.whyItMatters,
              remedy: finding.howToFix,
              currentText: finding.clientExplanation,
              evidenceChecks: evidence.map((record) => record.checkId),
            }),
          },
        ],
        max_tokens: 220,
        temperature: 0.2,
      });

      const text = extractText(response);
      if (text === null || text.trim().length < 20) return null;
      return { clientExplanation: text.trim() };
    },
  };
}

function extractText(response: unknown): string | null {
  if (typeof response === 'string') return response;
  if (response !== null && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    if (typeof record['response'] === 'string') return record['response'];
    const choices = record['choices'];
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown> | undefined;
      const message = first?.['message'] as Record<string, unknown> | undefined;
      if (typeof message?.['content'] === 'string') return message['content'];
    }
  }
  return null;
}
