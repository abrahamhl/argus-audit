import type { ReportInput, ReportMode } from './summary';
import { renderSimpleReport } from './simple';
import { renderEngineerReport } from './engineer';
import { renderClientReport } from './client';

export type { ReportInput, ReportMode, AuditSummary, DataFreshness } from './summary';
export { computeSummary, computeFreshness } from './summary';

export const REPORT_MODES: ReportMode[] = ['simple', 'engineer', 'client'];

export function renderReports(input: ReportInput): Record<ReportMode, string> {
  return {
    simple: renderSimpleReport(input),
    engineer: renderEngineerReport(input),
    client: renderClientReport(input),
  };
}
