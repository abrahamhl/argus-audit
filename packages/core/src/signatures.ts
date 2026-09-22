export interface TechSignature {
  id: string;
  label: string;
  where: 'html' | 'header';
  header?: string;
  pattern: RegExp;
}

/** Conservative, documented indicator patterns. Interpretation only, never truth. */
export const TECH_SIGNATURES: TechSignature[] = [
  { id: 'wordpress', label: 'WordPress', where: 'html', pattern: /wp-content|wp-includes|wp-json/i },
  { id: 'nextjs', label: 'Next.js', where: 'html', pattern: /__NEXT_DATA__|_next\/static/i },
  { id: 'nuxt', label: 'Nuxt', where: 'html', pattern: /__NUXT__|\/_nuxt\//i },
  { id: 'react', label: 'React', where: 'html', pattern: /react(?:-dom)?(?:\.production)?(?:\.min)?\.js|data-reactroot/i },
  { id: 'vue', label: 'Vue.js', where: 'html', pattern: /vue(?:\.runtime)?(?:\.min)?\.js|data-v-app|__VUE__/i },
  { id: 'angular', label: 'Angular', where: 'html', pattern: /ng-version|angular(?:\.min)?\.js|_ngcontent/i },
  { id: 'jquery', label: 'jQuery', where: 'html', pattern: /jquery(?:-\d[\d.]*)?(?:\.min|\.slim)?\.js/i },
  { id: 'bootstrap', label: 'Bootstrap', where: 'html', pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.(?:js|css)/i },
  { id: 'google-analytics', label: 'Google Analytics / gtag', where: 'html', pattern: /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i },
  { id: 'google-tag-manager', label: 'Google Tag Manager', where: 'html', pattern: /googletagmanager\.com\/gtm\.js/i },
  { id: 'meta-pixel', label: 'Meta Pixel', where: 'html', pattern: /connect\.facebook\.net|fbq\(/i },
  { id: 'hotjar', label: 'Hotjar', where: 'html', pattern: /static\.hotjar\.com|hj\(/i },
  { id: 'shopify', label: 'Shopify', where: 'html', pattern: /cdn\.shopify\.com|shopify\.theme/i },
  { id: 'wix', label: 'Wix', where: 'html', pattern: /static\.parastorage\.com|wix\.com\//i },
  { id: 'squarespace', label: 'Squarespace', where: 'html', pattern: /static1\.squarespace\.com/i },
  { id: 'cloudflare', label: 'Cloudflare (edge)', where: 'header', header: 'server', pattern: /cloudflare/i },
  { id: 'nginx', label: 'nginx', where: 'header', header: 'server', pattern: /nginx/i },
  { id: 'apache', label: 'Apache', where: 'header', header: 'server', pattern: /apache/i },
  { id: 'iis', label: 'Microsoft IIS', where: 'header', header: 'server', pattern: /microsoft-iis/i },
  { id: 'express', label: 'Express', where: 'header', header: 'x-powered-by', pattern: /express/i },
  { id: 'php', label: 'PHP', where: 'header', header: 'x-powered-by', pattern: /php/i },
];

export interface ConsentSignature {
  id: string;
  label: string;
  pattern: RegExp;
}

/** Common consent-management indicators found in delivered HTML. */
export const CONSENT_SIGNATURES: ConsentSignature[] = [
  { id: 'cookiebot', label: 'Cookiebot', pattern: /cookiebot/i },
  { id: 'onetrust', label: 'OneTrust', pattern: /onetrust|optanon/i },
  { id: 'klaro', label: 'Klaro', pattern: /klaro/i },
  { id: 'tarteaucitron', label: 'tarteaucitron', pattern: /tarteaucitron/i },
  { id: 'osano', label: 'Osano', pattern: /osano/i },
  { id: 'iubenda', label: 'Iubenda', pattern: /iubenda/i },
  { id: 'consentmanager', label: 'consentmanager', pattern: /consentmanager/i },
  { id: 'cookieyes', label: 'CookieYes', pattern: /cookieyes/i },
  { id: 'quantcast', label: 'Quantcast', pattern: /quantcast/i },
  { id: 'usercentrics', label: 'Usercentrics', pattern: /usercentrics/i },
];
