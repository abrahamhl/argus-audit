# ÍNDICE — Argus Audit (V0)

**Fecha:** 2026-09-22
**Ruta local:** tu checkout de `argus-audit`
**Remoto:** https://github.com/abrahamhl/argus-audit
**Rama de trabajo:** `build/v0-evidence-audit` (draft PR hacia `main`)

---

## Qué es

Producto hermano de `eye-of-argus`. Auditoría pasiva, evidence-first, de la
superficie pública de UNA web. Tres informes: SIMPLE / ENGINEER / CLIENT.
Pipeline: scanner → EvidenceRecord → regla determinista → Finding → informe.
IA opcional, nunca fuente de verdad.

**No es** un escáner de vulnerabilidades ni un pentest. Solo checks pasivos.

---

## Cómo arrancarlo

```powershell
cd argus-audit
pnpm install

# Demo offline (sin red, datos de fixtures) — dos terminales:
pnpm dev:worker:fixture     # API en http://127.0.0.1:8787
pnpm dev:web                # UI en http://127.0.0.1:5173

# Modo live (red real, con guardas SSRF):
pnpm dev:worker

# Verificación completa:
pnpm verify                 # typecheck + tests + build + dry-run
```

## Mapa de carpetas

| Ruta | Contenido |
|---|---|
| `packages/core/src` | Motor: contrato de evidencia, guardas URL, transportes, 8 escáneres (incluye DNS/DoH y security.txt), 22 reglas, 3 informes |
| `packages/core/src/audit.ts` | Orquestador `runAudit` |
| `apps/worker` | Cloudflare Worker: API, límites, Turnstile, modo fixture |
| `apps/web` | UI React+Vite con Evidence Trace y paneles de informe |
| `fixtures/` | 3 fixtures deterministas (healthy / missing-headers / messy) |
| `config/infra-costs.json` | Registro machine-readable de costes free-tier (verificado 2026-09-22) |
| `config/product-gates.json` | Las 3 puertas XYZ (PRODUCT TRUTH / USER VALUE / COMMERCIAL SIGNAL: BLOCKED) |
| `docs/CONSOLIDATION_MATRIX.md` | Matriz de consolidación: donantes, tests reproducidos, veredictos KEEP/PORT/REDESIGN/RETIRE |
| `docs/LEGACY_MIGRATION.md` | Qué hacer con web-exposure-scan, argus-bice, gh-pages y argus (solo recomendaciones) |
| `docs/STATE.md` | Estado canónico: live URL, version IDs, ledger de verificaciones y session log |
| `docs/DECISIONS.md` | Decisiones con fecha, motivo y disparador de revisión |
| `docs/OPEN_LOOPS.md` | Bucles abiertos, bloqueos del owner y próximos PRs |
| `docs/THREAT_MODEL.md` | Modelo de amenazas + checklist pre-despliegue |

## Superficies de la consola

- `/` producto · `/audit` auditor live · `/lab` simulador etiquetado ·
  `/method` metodología generada por el runtime · `/architecture` arquitectura
| `docs/EVIDENCE_CONTRACT.md` | Contrato de evidencia y estados |
| `docs/ARCHITECTURE.md` | Arquitectura y modos de ejecución |
| `docs/PRODUCT_GATES.md` | Explicación de las puertas y cómo cerrarlas |
| `docs/00_CHANGELOG.md` | Qué se hizo, por qué, y qué falta |

## Comandos rápidos

```powershell
pnpm -r test                                   # tests deterministas (offline)
pnpm test:live                                 # red real: LIVE_AUDIT_TARGET=https://...
pnpm build                                     # web producción
pnpm --filter @argus-audit/worker dry-run      # valida bundle del Worker
pnpm --filter @argus-audit/worker deploy       # SOLO con wrangler logueado
```

## Fuera de V0 (a propósito)

- Sin descubrimiento por ubicación/radio (V0.2)
- Sin cuentas ni guardado de auditorías (V0.4)
- Sin pagos (V1)
- Sin escaneo batch (V0.3)
- Sin Cesium ni orquestación IA compleja

## Frontera público/privado

Este repo es público: no contiene precios, fundraising, notas de clientes ni
estrategia de competidores. Ese material vive fuera del repositorio.
