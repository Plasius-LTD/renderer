import { describe, expect, it } from "vitest";
import {
  axialToWorld,
  buildLandscapeGeometry,
  deformHexInterior,
  generateHexDepthMap,
  generateHexTile,
  seededNoise,
} from "../src/landscape.js";

describe("landscape geometry requirements", () => {
  it("generates a closed deterministic hex triangle fan", () => {
    const geometry = generateHexTile(2);
    const positions = geometry.getAttribute("position");

    expect(positions.count).toBe(32);
    expect(geometry.getIndex()?.count).toBe(90);
    expect(positions.getX(0)).toBe(0);
    expect(positions.getZ(0)).toBe(0);
    expect(positions.getX(1)).toBeCloseTo(2);
    expect(positions.getX(31)).toBeCloseTo(2);
    geometry.dispose();
  });

  it("maps axial coordinates and seeded samples deterministically", () => {
    expect(axialToWorld(2, -1, 10)).toEqual([30, 0]);
    const sample = seededNoise(4, 7, 99);
    expect(sample).toBe(seededNoise(4, 7, 99));
    expect(sample).toBeGreaterThanOrEqual(-1);
    expect(sample).toBeLessThanOrEqual(1);

    const map = generateHexDepthMap(2, 3, 7);
    expect(map).toHaveLength(2);
    expect(map[0]).toHaveLength(3);
    expect(map[1][2]).toBe(
      Math.sin((1 + 7) * 0.3) * Math.cos((2 + 7) * 0.3)
    );
  });

  it("deforms interior vertices while preserving the shared edge", () => {
    const geometry = generateHexTile(4);
    const positions = geometry.getAttribute("position");
    const originalEdge = positions.getY(1);

    deformHexInterior(geometry, 4, 123);

    expect(positions.getY(0)).not.toBe(0);
    expect(positions.getY(1)).toBe(originalEdge);
    geometry.dispose();
  });

  it("builds one stitched geometry with normals for the shipped landscape", () => {
    const geometry = buildLandscapeGeometry();

    expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(geometry.getAttribute("normal").count).toBe(
      geometry.getAttribute("position").count
    );
    expect(geometry.getIndex()?.count ?? 0).toBeGreaterThan(100);
    geometry.dispose();
  });
});
