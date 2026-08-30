# Legacy renderer retirement record

## Decision

`@plasius/renderer` is retired rather than migrated. The default branch contains
no package runtime, manifest, lockfile, export, test, demo, build configuration,
or publish workflow. No runtime tombstone or compatibility shim will be released.

Three.js, its subpaths, TSL, React Three Fiber packages, `@types/three`,
`three-mesh-bvh`, `three-gpu-pathtracer`, `three-stdlib`, and any dependency graph
reaching them are permanently prohibited. This invariant is architecture and
non-functional policy, not a feature flag, and cannot be rolled back.

## Consumer and surface audit

- Organisation code search found no active manifest consumer of
  `@plasius/renderer`; the canonical Product Studio path already uses
  `@plasius/gpu-shared` and `@plasius/gpu-renderer`.
- The legacy renderer was the only identified consumer of the retired shadow
  package.
- Renderer execution, frame scheduling, WebGPU wavefront transport, and mesh-BVH
  traversal are owned by `@plasius/gpu-renderer`.
- Lighting, shadow policy, HDRI, and transport integration are owned by
  `@plasius/gpu-lighting`.
- Device and render-budget policy is owned by `@plasius/gpu-performance`.
- Camera, physics, and XR stay in `@plasius/gpu-camera`,
  `@plasius/gpu-physics`, and `@plasius/gpu-xr`.
- Legacy React components, Three-specific helpers, TSL shaders, and public
  package exports were discarded rather than adapted.
- The unused `shadowQuality` heuristic was discarded. A future live budget
  requirement must be designed independently in `@plasius/gpu-performance`;
  this repository cannot be restored to provide it.

## Registry evidence

- Final immutable version: `@plasius/renderer@1.0.2`.
- Deprecation notice: `Retired permanently. Migrate to @plasius/gpu-renderer;
  Three.js is prohibited and is not a fallback.`
- Approved production administration run:
  <https://github.com/Plasius-LTD/renderer/actions/runs/33329339894>
- Published versions were deprecated, not unpublished.

## History and migration

Historical commits and superseded ADRs remain available through Git for audit,
but they are not active implementation guidance. Current consumers must use the
GPU-native repositories linked from the [retirement README](../README.md) and
the canonical site
[ADR 0168](https://github.com/Plasius-LTD/plasius-ltd-site/blob/main/docs/adrs/adr-0168-three-js-is-prohibited-from-gpu-native-rendering.md).
