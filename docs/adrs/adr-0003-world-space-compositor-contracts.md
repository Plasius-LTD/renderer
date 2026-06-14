# ADR-0003: World-Space Compositor Contracts

- Date: 2026-06-14
- Status: Accepted

## Context

`@plasius/renderer` exposes the base canvas and XR runtime but does not yet
offer a reusable public API for ordering world-space screens, choosing
overlay-safe occlusion behavior, or detecting collisions between mutually
exclusive HUD slots.

The Player System and Party System backlog needs those behaviors next, but the
renderer package should stay reusable for other world-space UI surfaces.

## Decision

Add a pure composition module that:

- defines public layer presets for `screen`, `overlay`, and `alert` surfaces;
- normalizes occlusion policies for world-anchored, overlay-safe, and
  always-visible surfaces;
- resolves deterministic render order from slot, layer, and priority;
- reports exclusive-slot collisions without binding the API to Player
  System-specific types.

## Consequences

- Downstream packages can compose world-space panes and alerts without
  duplicating render-order rules.
- The renderer package stays contract-first and does not require host runtime
  wiring until a consumer task needs it.
- Future tasks can extend this module with material adapters or scene bindings
  without changing the ordering model.
