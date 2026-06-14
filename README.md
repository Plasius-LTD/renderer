# @plasius/renderer

[![npm version](https://img.shields.io/npm/v/@plasius/renderer.svg)](https://www.npmjs.com/package/@plasius/renderer)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/renderer/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/renderer/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/renderer)](https://codecov.io/gh/Plasius-LTD/renderer)
[![License](https://img.shields.io/github/license/Plasius-LTD/renderer)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

3D renderer components for Plasius projects with XR session integration hooks.
Camera controls are implemented through `@plasius/gpu-camera` (no
`camera-controls` dependency).

Apache-2.0. ESM build output. TypeScript types included.

## Installation

```bash
npm install @plasius/renderer
```

## Usage

```ts
import {
  Renderer,
  composeWorldSpaceSurfaces,
} from "@plasius/renderer";

const { surfaces, collisions } = composeWorldSpaceSurfaces([
  { id: "focus-pane", slot: "reticle", layer: "screen" },
  { id: "mission-alert", slot: "reticle", layer: "alert" },
]);
```

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
```

## Governance

- ADRs: [docs/adrs](./docs/adrs)
- TDRs: [docs/tdrs](./docs/tdrs)
- Design notes: [docs/design](./docs/design)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)

## World-Space UI Helpers

- `composeWorldSpaceSurfaces(...)` resolves deterministic render ordering for
  world-space `screen`, `overlay`, and `alert` surfaces.
- `resolveWorldSpaceOcclusionPolicy(...)` provides material-safe defaults for
  depth-aware panels, overlay-biased prompts, and always-visible alerts.
- Collision reporting flags slots that should only host one focused screen at a
  time so host runtimes can arbitrate before rendering.

## Build outputs

- ESM: `dist/`
- Types: `dist/*.d.ts`

## License

Apache-2.0
