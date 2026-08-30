# Changelog

## Unreleased

### Changed

- Permanently retired the repository and directed all consumers to the
  GPU-native package boundaries documented in `docs/RETIREMENT.md`.
- Deprecated every immutable `@plasius/renderer` version in npm while preserving
  registry history; no version was unpublished and no shim was published.

### Removed

- Removed all package source, exports, manifests, locks, dependencies, tests,
  demos, build configuration, package verification, and publish automation.
- Removed active React/Three components, shader guidance, and legacy migration
  material from the default branch.

### Security

- Recorded Three.js and every dependency graph reaching it as permanently
  prohibited, without a compatibility path, waiver, rollback, or fallback.

## 1.0.2 — historical final package version

The immutable package remains available only as deprecated registry history.
Its implementation history is available through Git and is not active guidance.
