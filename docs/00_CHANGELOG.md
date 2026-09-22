# CHANGELOG — Argus Audit

Lo más reciente arriba. Qué se rompió, por qué y cómo se arregló. Números, no
adjetivos.

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
