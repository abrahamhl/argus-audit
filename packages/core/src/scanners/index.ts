import type { Scanner } from '../contracts';
import { reachabilityScanner } from './reachability';
import { transportSecurityScanner } from './transport-security';
import { securityHeadersScanner } from './security-headers';
import { privacyPagesScanner } from './privacy-pages';
import { brokenLinksScanner } from './broken-links';
import { frontendTechScanner } from './frontend-tech';
import { dnsScanner } from './dns';
import { securityTxtScanner } from './security-txt';

/**
 * Scanner order is part of the methodology: evidence ids and report order are
 * derived from it. Changing the order changes ids — bump METHODOLOGY_VERSION.
 */
export const defaultScanners: Scanner[] = [
  reachabilityScanner,
  transportSecurityScanner,
  securityHeadersScanner,
  privacyPagesScanner,
  brokenLinksScanner,
  frontendTechScanner,
  dnsScanner,
  securityTxtScanner,
];
