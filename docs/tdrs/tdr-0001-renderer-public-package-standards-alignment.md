# TDR-0001: Public package standards alignment

- Status: Accepted
- Date: 2026-05-14

## Decision

Bring `@plasius/renderer` up to the same public package governance baseline used by the Schema-derived package repositories, while preserving its renderer-specific runtime and build choices.

## Scope

- align repository governance files
- align contributor and CLA documentation
- add missing TDR and design documentation scaffolding
- keep renderer-specific runtime, XR, and React Three Fiber concerns inside the package boundary

## Notes

This TDR standardizes package hygiene and governance, not the renderer API surface itself.
