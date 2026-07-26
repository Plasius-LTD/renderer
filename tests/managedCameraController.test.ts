import { describe, expect, it, vi } from "vitest";
import {
  buildCameraDefinitionFromThreeCamera,
  createRendererCameraManager,
  derivePanDeltaFromCameraState,
  resolveCameraAspect,
  syncThreeCameraFromManagedState,
} from "../src/camera/managedCameraController.js";

function camera(overrides: Record<string, unknown> = {}) {
  return {
    position: { x: 1, y: 2, z: 3, set: vi.fn() },
    up: { x: 0, y: 1, z: 0, set: vi.fn() },
    lookAt: vi.fn(),
    getWorldDirection: vi.fn((target) => target.set(0, 0, -1)),
    updateProjectionMatrix: vi.fn(),
    ...overrides,
  };
}

describe("managed camera adapter requirements", () => {
  it("resolves stable finite aspects for valid and invalid surfaces", () => {
    expect(resolveCameraAspect(1920, 1080)).toBeCloseTo(16 / 9);
    expect(resolveCameraAspect(-10, 100)).toBe(1 / 4096);
    expect(resolveCameraAspect(100, 0)).toBe(1);
    expect(resolveCameraAspect(Number.NaN, 100)).toBe(1);
    expect(resolveCameraAspect(100, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("creates managers with defaults and explicit capacity controls", () => {
    const defaults = createRendererCameraManager();
    const explicit = createRendererCameraManager({
      maxParallelViews: 1,
      maxHotCameras: 2,
    });

    expect(defaults).toMatchObject({
      registerCamera: expect.any(Function),
      activateCamera: expect.any(Function),
    });
    expect(explicit).toMatchObject({
      registerCamera: expect.any(Function),
      activateCamera: expect.any(Function),
    });
  });

  it("derives camera-relative pan deltas and remains finite for degenerate rigs", () => {
    expect(
      derivePanDeltaFromCameraState(
        {
          transform: {
            position: [0, 0, 10],
            target: [0, 0, 0],
            up: [0, 1, 0],
          },
          projection: {
            kind: "perspective",
            fovY: 50,
            near: 0.1,
            far: 100,
            aspect: 1,
          },
        } as never,
        10,
        5,
        0.01
      )
    ).toEqual([-1, 0.5, 0]);

    const degenerate = derivePanDeltaFromCameraState(
      {
        transform: {
          position: [1, 1, 1],
          target: [1, 1, 1],
          up: [0, 0, 0],
        },
        projection: {
          kind: "perspective",
          fovY: 50,
          near: 0.1,
          far: 100,
          aspect: 1,
        },
      } as never,
      1,
      1,
      0
    );
    expect(degenerate.every(Number.isFinite)).toBe(true);
  });

  it("builds perspective definitions with world direction and safe defaults", () => {
    const source = camera({
      isPerspectiveCamera: true,
      fov: 65,
      near: 0.25,
      far: 500,
    });

    expect(buildCameraDefinitionFromThreeCamera(source as never, 1.5)).toEqual({
      transform: {
        position: [1, 2, 3],
        target: [1, 2, 2],
        up: [0, 1, 0],
      },
      projection: {
        kind: "perspective",
        fovY: 65,
        near: 0.25,
        far: 500,
        aspect: 1.5,
      },
    });

    const defaults = camera({ getWorldDirection: undefined });
    expect(
      buildCameraDefinitionFromThreeCamera(defaults as never, 1).projection
    ).toMatchObject({
      kind: "perspective",
      fovY: 50,
      near: 0.1,
      far: 2000,
    });
  });

  it("builds orthographic definitions with explicit and default bounds", () => {
    const source = camera({
      isOrthographicCamera: true,
      left: -4,
      right: 4,
      top: 3,
      bottom: -3,
      near: 0.5,
      far: 300,
    });
    expect(
      buildCameraDefinitionFromThreeCamera(source as never, 2).projection
    ).toEqual({
      kind: "orthographic",
      left: -4,
      right: 4,
      top: 3,
      bottom: -3,
      near: 0.5,
      far: 300,
      aspect: 2,
    });

    expect(
      buildCameraDefinitionFromThreeCamera(
        camera({ isOrthographicCamera: true }) as never,
        1
      ).projection
    ).toMatchObject({
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
      near: 0.1,
      far: 2000,
    });
  });

  it("synchronizes perspective transforms and projection fields", () => {
    const target = camera({ isPerspectiveCamera: true });
    syncThreeCameraFromManagedState(
      target as never,
      {
        transform: {
          position: [4, 5, 6],
          target: [0, 1, 2],
        },
        projection: {
          kind: "perspective",
          fovY: 70,
          near: 0.2,
          far: 900,
          aspect: 1,
        },
      } as never,
      1.75
    );

    expect(target.position.set).toHaveBeenCalledWith(4, 5, 6);
    expect(target.up.set).toHaveBeenCalledWith(0, 1, 0);
    expect(target.lookAt).toHaveBeenCalledWith(0, 1, 2);
    expect(target).toMatchObject({
      fov: 70,
      near: 0.2,
      far: 900,
      aspect: 1.75,
    });
    expect(target.updateProjectionMatrix).toHaveBeenCalledOnce();
  });

  it("scales orthographic horizontal bounds and ignores projection mismatches", () => {
    const target = camera({ isOrthographicCamera: true });
    syncThreeCameraFromManagedState(
      target as never,
      {
        transform: {
          position: [1, 2, 3],
          target: [0, 0, 0],
          up: [0, 0, 1],
        },
        projection: {
          kind: "orthographic",
          left: -2,
          right: 2,
          top: 3,
          bottom: -3,
          near: 0.3,
          far: 400,
          aspect: 2,
        },
      } as never,
      1
    );
    expect(target).toMatchObject({
      left: -1,
      right: 1,
      top: 3,
      bottom: -3,
      near: 0.3,
      far: 400,
    });

    const zeroAspect = camera({ isOrthographicCamera: true });
    syncThreeCameraFromManagedState(
      zeroAspect as never,
      {
        transform: { position: [0, 0, 0], target: [0, 0, -1] },
        projection: {
          kind: "orthographic",
          left: -2,
          right: 2,
          top: 1,
          bottom: -1,
          near: 0.1,
          far: 10,
          aspect: 0,
        },
      } as never,
      3
    );
    expect(zeroAspect.left).toBe(-6);
    expect(zeroAspect.right).toBe(6);

    const mismatch = camera({ isPerspectiveCamera: true });
    syncThreeCameraFromManagedState(
      mismatch as never,
      {
        transform: { position: [0, 0, 0], target: [0, 0, -1] },
        projection: {
          kind: "orthographic",
          left: -1,
          right: 1,
          top: 1,
          bottom: -1,
          near: 0.1,
          far: 10,
          aspect: 1,
        },
      } as never,
      1
    );
    expect(mismatch.updateProjectionMatrix).not.toHaveBeenCalled();
  });
});
