# ZumiLabs Studio — Test Catalogue

## Overview

This directory contains the complete test specification for ZumiLabs Studio (pic-machina).
Tests are organised into five tiers based on automation feasibility and tooling requirements.

## Tier Definitions

| Tier | Name | Tooling | Automation |
|------|------|---------|------------|
| **1** | Unit Tests | Vitest | Fully automated — CI on every commit |
| **2** | Integration Tests | Vitest + fake-indexeddb | Fully automated — CI on every commit |
| **3** | E2E Smoke Tests | Playwright | Automated — CI on every PR |
| **4** | Golden Image / Visual Regression | Playwright + pixelmatch | Semi-automated — human approves diffs |
| **5** | Manual / Exploratory | Human tester | Manual — run before each release |

## Test File Index

| File | Tier | Count | Domain |
|------|------|-------|--------|
| [T1-unit-utils.md](./T1-unit-utils.md) | 1 | 44 | Pure utility functions (misc, variables, subtitles, color-matcher, nodes, behaviors) |
| [T1-unit-engine.md](./T1-unit-engine.md) | 1 | 21 | Engine core (registry, behaviors, nodes, capabilities, geometry) |
| [T1-unit-sidecar.md](./T1-unit-sidecar.md) | 1 | 28 | Sidecar read/write/migrate |
| [T2-integration-data.md](./T2-integration-data.md) | 2 | 24 | IndexedDB data layer |
| [T2-integration-processor.md](./T2-integration-processor.md) | 2 | 18 | Engine processor pipeline |
| [T3-e2e-smoke.md](./T3-e2e-smoke.md) | 3 | 16 | Critical path E2E smoke tests |
| [T4-golden-image.md](./T4-golden-image.md) | 4 | 14 | Visual regression / AI output |
| [T5-manual.md](./T5-manual.md) | 5 | 38 | Manual / exploratory tests |
| **Transform-specific tests** | | | |
| [T-transforms-geometric.md](./T-transforms-geometric.md) | 1–4 | 42 | All 22 Geometric & Framing transforms |
| [T-transforms-color.md](./T-transforms-color.md) | 1–4 | 61 | All 29 Color & Tone transforms |
| [T-transforms-overlays.md](./T-transforms-overlays.md) | 1–4 | 41 | All 18 Overlay & Typography transforms |
| [T-transforms-metadata.md](./T-transforms-metadata.md) | 1–2 | 20 | All 6 Metadata transforms |
| [T-transforms-flow.md](./T-transforms-flow.md) | 1–5 | 83 | All 36 Flow Control + Video transforms |
| [T-transforms-ai.md](./T-transforms-ai.md) | 1–5 | 54 | All 24 AI & Composition + Audio AI transforms |
| [test-data.md](./test-data.md) | — | — | Fixture data catalogue |

## Reference Number Format

```
{TIER_PREFIX}-{THREE_DIGIT_NUMBER}

UT-001   Unit Test 001
IT-001   Integration Test 001
E2E-001  End-to-End Smoke Test 001
GI-001   Golden Image Test 001
MT-001   Manual Test 001
```

## Quick Summary — Total Tests

| Tier | Count |
|------|-------|
| Tier 1 Unit | 93 |
| Tier 2 Integration | 42 |
| Tier 3 E2E Smoke | 16 |
| Tier 4 Golden Image | 14 |
| Tier 5 Manual | 38 |
| Transform tests (mixed tiers, 130+ transforms) | 301 |
| **Total** | **504** |

## Recommended Execution Order (CI Pipeline)

```
1. npm run test:unit      → Tier 1  (target: <30s)
2. npm run test:integration → Tier 2 (target: <2min)
3. npm run test:e2e       → Tier 3  (target: <5min, headless)
4. npm run test:visual    → Tier 4  (manual approval gate)
5. [Manual checklist]     → Tier 5  (pre-release only)
```

## Toolchain Setup

```bash
# Required packages
npm install -D vitest @vitest/coverage-v8 fake-indexeddb
npm install -D playwright pixelmatch
npx playwright install chromium

# Run tests
npx vitest run              # All unit + integration
npx playwright test         # E2E smoke
npx playwright test --ui    # Visual / golden image
```
