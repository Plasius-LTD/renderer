# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.1] - 2026-06-22

- **Added**
  - Standalone public package scaffold at repository root with independent CI/CD, ADRs, and legal governance assets.
  - Framework-agnostic camera runtime integration using `@plasius/gpu-camera`.
  - CONTRIBUTING guidance plus TDR and design scaffolding to match the schema-derived package baseline.
  - World-space compositor helpers for ordering focused screens, overlays, and localized alerts with reusable occlusion policy presets.

- **Changed**
  - Add standalone ESM build outputs with `exports` entries for public npm distribution.
  - Replaced `camera-controls` usage with managed orbit/pan/dolly controls driven by `@plasius/gpu-camera`.
  - Aligned repository governance, lint configuration, and package licensing with the public package baseline used across new Plasius package repositories.
  - Documented the contract-first renderer API for future Player/Party System composition work.

- **Fixed**
  - Removed monorepo-relative TypeScript configuration coupling for standalone builds.
  - Removed legacy `camera-controls` build artifacts from published output.
  - Removed the unused unpublished `@plasius/shadow` dependency so clean standalone installs no longer rely on a missing registry package or local-link lockfile entries.

- **Security**
  - Added baseline public package governance and CLA documentation.

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user-visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/renderer/compare/v1.0.1...HEAD

## [1.0.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.0.1]: https://github.com/Plasius-LTD/renderer/releases/tag/v1.0.1
