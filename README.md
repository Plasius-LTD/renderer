# `@plasius/renderer` — permanently retired

This repository and npm package were retired on 30 August 2026. Do not install,
depend on, copy, or revive this package. No compatibility shim or tombstone
runtime package will be published.

Every immutable npm version is retained only as registry history and is marked
deprecated. Historical source remains available through Git history for audit;
it is not active implementation guidance.

## Permanent architecture invariant

Three.js, its subpaths, TSL, React Three Fiber, related helpers, and any package
whose dependency graph reaches Three.js are prohibited throughout the Plasius
GPU-native renderer architecture. There is no fallback, compatibility mode,
waiver, feature flag, rollback, or migration path that permits them.

The canonical decision is
[ADR 0168](https://github.com/Plasius-LTD/plasius-ltd-site/blob/main/docs/adrs/adr-0168-three-js-is-prohibited-from-gpu-native-rendering.md).

## GPU-native migration map

- Renderer execution, frame scheduling, WebGPU wavefront transport, and mesh-BVH
  traversal: [`@plasius/gpu-renderer`](https://github.com/Plasius-LTD/gpu-renderer)
- Lighting, shadow policy, HDRI, and transport integration:
  [`@plasius/gpu-lighting`](https://github.com/Plasius-LTD/gpu-lighting)
- Device budgets and adaptive quality policy:
  [`@plasius/gpu-performance`](https://github.com/Plasius-LTD/gpu-performance)
- Camera behavior: [`@plasius/gpu-camera`](https://github.com/Plasius-LTD/gpu-camera)
- Physics: [`@plasius/gpu-physics`](https://github.com/Plasius-LTD/gpu-physics)
- XR: [`@plasius/gpu-xr`](https://github.com/Plasius-LTD/gpu-xr)

See [the retirement record](./docs/RETIREMENT.md) for the consumer audit,
discarded surfaces, registry evidence, and boundary decisions.
