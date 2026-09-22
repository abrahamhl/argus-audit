# CHANGELOG — Argus Audit

Lo más reciente arriba. Qué se rompió, por qué y cómo se arregló. Números, no
adjetivos.

---

## 2026-09-22 — PR-03: portes donantes (DNS/SPF/DMARC, security.txt)

### DONE

- **DNS-over-HTTPS adapter** (`packages/core/src/dns/`): `DohResolver` (RFC 8484
  JSON sobre `fetch`, timeout 5 s) y `FixtureDnsResolver` offline. Workers no
  puede hacer DNS UDP; el DoH es la única vía pasiva y es la implementada.
- **Scanner `dns.records`**: A, AAAA, MX, TXT (SPF), CAA y `_dmarc` TXT; cada
  respuesta es una evidencia con estado propio (NXDOMAIN/SERVFAIL/ERROR no se
  convierten en "ausencia" salvo que el propio estado sea la observación).
- **Reglas de email**: SPF ausente, SPF débil (`~all/+all/?all`), DMARC ausente,
  DMARC `p=none`, CAA ausente (RFC 7208/7489/8659). Sin afirmaciones legales.
- **security.txt (RFC 9116)**: scanner con dos rutas estándar y parser de
  Contact/Expires; reglas de ausente y expirado. Los contactos NO se guardan
  (solo contadores y expiración).
- **Worker**: resuelve con DoH en modo live y con fixtures en modo demo/lab.
- Fixtures ampliadas con DNS para los tres escenarios y security.txt válido en
  `healthy-site`.

### VERIFIED

- **81 tests deterministas, 0 fallos** (67 core + 14 worker).
- Verificación live en producción tras el deploy: `example.com` →
  SPF presente `-all`, DMARC presente `p=reject` (sin findings de email, correcto),
  CAA ausente y security.txt ausente como informativos; 6 consultas DNS + resumen
  como evidencia OBSERVED. Metodología live **0.3.0**.
- Smoke live: 9/9 contra Version ID `c7c75d67`.

---

## 2026-09-22 — PR-02: consola de operador

### DONE

- Router propio (sin dependencias) y cinco superficies: `/`, `/audit`, `/lab`,
  `/method`, `/architecture`; navegación con `aria-current` y badge LIVE/DEMO.
- `ProcessViz`: visualización truthful del pipeline TARGET → OBSERVE → PROVE →
  DECIDE → REPORT (+ FIX/VERIFY marcados "not implemented"). Con resultado
  muestra números **reales** por etapa; en ejecución declara que no hay telemetría
  en vivo (sin animación falsa).
- `/lab` como **simulador etiquetado**: replay de fixtures, banner claro, nunca
  contacta sitios. `/method` se genera desde `/api/methodology` (misma fuente que
  el runtime). `/architecture` documenta límites y fronteras de adaptador.
- `FixtureTransport` calcula ahora el SHA-256 del cuerpo también en modo demo
  (PROVE real en el lab).
- Verificado en navegador real a 1440 px y 375 px en local y en producción:
  0 errores de consola; trace con JSON en bruto; 15 reglas listadas entonces.

---

## 2026-09-22 — Consolidación, fase 0 + PR-01 (production hardening)

### DONE

- **Phase 0 truth-before-code:** donantes a worktrees aislados y tests
  reproducidos: `argus@48b554e` **178/178** (requiere `pnpm build` antes; sin
  build da 0 y su `pnpm verify` está desactivado), `web-exposure-scan@4f5a865`
  **8/8**. Matrix completa en `docs/CONSOLIDATION_MATRIX.md`.
- **Núcleo:** hash canónico SHA-256 de evidencia (`evidenceHash`) en cada
  auditoría y en el informe ENGINEER; guarda 4xx/WAF (una raíz 403 ya no genera
  findings de cabeceras ausentes ni de privacidad: estado `blocked` →
  `NOT_CHECKED`); validador de claims prohibidos aplicado también a la salida de
  IA (si la IA introduce "violates GDPR" se rechaza y queda el texto
  determinista). Metodología **0.2.0**.
- **Worker:** anti-abuso con Durable Object (ventana 5/min/IP + **tope diario
  global de 500 auditorías**, configurable), fallback en memoria; política de
  origen explícita (mismo host o `ALLOWED_ORIGIN` de desarrollo); campo
  obligatorio `acknowledged`; endpoints `/api/methodology`, `/api/lab/fixtures`,
  `/api/lab/audit`; site key de Turnstile en `/api/health` (runtime).
- **Web:** checkbox de autorización obligatorio; site key de Turnstile leída en
  runtime (sin rebuild); hash canónico visible en la pestaña Engineer.
- **CI/verificación:** higiene de `dist` (sin source maps, sin cadenas tipo
  secreto); `scripts/smoke-live.mjs` + workflow manual `deploy-smoke.yml`;
  `pnpm smoke:live`.
- **Desplegado:** Version ID `f3544168-c7fa-4c03-b0e0-8aba2e8f0fdc` en
  https://argus-audit.argus-lab.workers.dev/ desde
  `consolidation/argus-master-v1` (aún sin merge a main).

### VERIFIED

- Tests: **62 core + 14 worker, 0 fallos**; typecheck, build web y dry-run del
  Worker verdes.
- Smoke live: **9/9** (health v0.2.0, 6 cabeceras de seguridad, validaciones,
  metodología 6 scanners/15 reglas, 3 fixtures, sin source maps servidos).
- UI live con navegador real (Playwright): auditoría de `example.com` →
  9 findings, traza de evidencia con JSON en bruto, 0 errores de consola en
  1440 px y 375 px.
- DO verificado en local: la ventana cuenta entre rutas y persiste (3+3=5
  permitidas, resto 429), acknowledgment 400 sin consumo de scan.

### Roto y arreglado

- El primer `pnpm smoke:live` dio 8/9: el check de source maps esperaba 404,
  pero el fallback SPA devuelve 200 HTML para rutas inexistentes. No había mapa
  expuesto; el script ahora valida el **contenido** (no debe haber
  `"version":3`/`"sources"`), no el código de estado.

### DECISIONES nuevas

- D03–D11 en `docs/DECISIONS.md` (TLS como frontera de adaptador, DNS vía DoH,
  sin precios públicos, Turnstile runtime, DO anti-abuso, IA con validador,
  licencia donante ambigua, simulador gh-pages retirado).

### PENDIENTE en este PR

- Activar Turnstile (acción del owner: crear widget + `wrangler secret put`).
- Merge a `main` (no automático) tras re-ejecutar aceptación.

---

## 2026-09-22 — Primer PR: V0 evidence audit

### Creado

- Monorepo pnpm (`packages/core`, `apps/worker`, `apps/web`), Node 22.
- `@argus-audit/core` con **cero dependencias de runtime**:
  - Contrato de evidencia (`EvidenceRecord`) y de finding, 5 estados explícitos.
  - Guarda URL/SSRF fail-closed + validación de cada salto de redirección.
  - `LiveTransport`, `FixtureTransport`, `MemoTransport` y `HttpClient` con
    límite de redirecciones, presupuesto de peticiones y tope de cuerpo 512 KB.
  - 6 escáneres: reachability, transport-security (HSTS/upgrade; certificado
    explícitamente `NOT_CHECKED`), security-headers (incluye flags de cookies
    sin nombres ni valores), privacy-pages (privacidad/legal/términos/contacto/
    accesibilidad + indicadores de consentimiento), broken-links (muestra
    límite 10, HEAD→GET, 429 = no concluyente), frontend-tech (tech `INFERRED`
    + señales a11y).
  - 15 reglas deterministas; ninguna afirmación legal.
  - Renderizadores SIMPLE / ENGINEER / CLIENT.
  - Adaptador de explicación IA opcional (contrato + fallback determinista).
- 3 fixtures deterministas con resultado esperado documentado:
  healthy (1 info), missing-headers (3 review + 4 info), messy (6 review + 7 info).
- Worker: `/api/health`, `/api/audit`, cabeceras de seguridad, CORS opcional,
  rate limit por isolate (5/min/IP), tope de concurrencia, Turnstile opcional,
  Workers AI opcional (`AI_EXPLANATIONS=off` por defecto), modo fixture.
- UI React: landing, progreso honesto (sin animación falsa), resumen con
  contadores y frescura, lista de findings, detalle con 6 secciones,
  **Evidence Trace** (Finding→Rule→Observation→Raw evidence) accesible por
  teclado, pestañas de informe, copiar/descargar/imprimir, tema claro/oscuro.
- CI (typecheck + tests + build + dry-run + escaneo básico de secretos) y
  workflow live manual separado.
- Documentación: README, contrato de evidencia, arquitectura, modelo de
  amenazas, puertas XYZ, política de seguridad, índice.

### Verificado (números reales de esta sesión)

- `tsc --noEmit` verde en core, worker y web (TypeScript 7).
- Tests deterministas: **59 core + 8 worker, 0 fallos**.
- Build web: 268.86 kB JS (82.78 kB gzip), 14.61 kB CSS.
- `wrangler deploy --dry-run`: bundle 124.14 KiB, assets leídos correctamente.
- Smoke test real: worker en modo fixture servido por HTTP; `/api/health` OK;
  auditorías de `healthy-site.test` (1 finding) y `messy-site.test` (13).

### Roto y arreglado

- **CI run #1 (push): falló el paso "Secret scan".** El grep encontraba su
  propio comando dentro de `.github/workflows/ci.yml` y se marcaba como
  referencia a secreto. Arreglo: `--exclude-dir=.github` (además de `.git`,
  `node_modules`, `dist`). La funcionalidad nunca estuvo afectada; solo el
  detector.
- **UI verificada en navegador real (Playwright, headless Chromium):** flujo
  completo a 375 px y 1440 px — auditoría de `messy-site.test`, clic en finding,
  los 4 pasos del Evidence Trace, pestañas Simple/Engineer/Client. **0 errores
  de consola** en ambos tamaños. Capturas en
  `%TEMP%\argus-ui\argus-{mobile,desktop}-{summary,trace,engineer,client}.png`.
- Pulido tras la revisión visual: el informe CLIENT usa etiquetas humanas
  ("Browser-level protections") en lugar del id técnico de categoría.

### Decisiones tomadas (y por qué)

- **Reset por severidad de `x-frame-options`**: si existe CSP con
  `frame-ancestors`, no se emite finding de clickjacking.
- **Enlaces legales fuera de la muestra de enlaces roto**: la página de
  privacidad ya se comprueba aparte; `contact`/`accessibility` sí entran.
- **Modelo IA por defecto cambiado** a `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
  tras verificar precios: el llama-3.1-8b normal consumiría más que la
  asignación diaria gratuita de 10.000 Neuronas con un solo finding.
- **Sin D1/R2/pagos/cuentas en V0** (alcance del primer PR).

### Pendiente / bloqueado

- Piloto live reproducido por una segunda persona → cierra PRODUCT TRUTH.
- Estudio de tarea baseline vs Argus → cierra USER VALUE.
- Datos reales de piloto → desbloquea COMMERCIAL SIGNAL (sigue BLOCKED).
- Despliegue real en Cloudflare: configurado y validado en seco; no ejecutado
  en esta sesión (requiere `wrangler login` interactivo).
