import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  frame: undefined as undefined | (() => void),
  three: undefined as
    | {
        camera: Record<string, unknown>;
        gl: { domElement?: EventTargetHarness };
        size: { width: number; height: number };
      }
    | undefined,
}));

class EventTargetHarness {
  listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  setPointerCapture = vi.fn();
  releasePointerCapture = vi.fn();

  addEventListener(
    type: string,
    listener: (event: Record<string, unknown>) => void
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: (event: Record<string, unknown>) => void
  ) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Record<string, unknown>) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === "function") hooks.cleanups.push(cleanup);
    },
    useRef: <T,>(value: T) => ({ current: value }),
  };
});

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: () => void) => {
    hooks.frame = callback;
  },
  useThree: () => hooks.three,
}));

import { ManagedCameraController } from "../src/camera/managedCameraController.js";
import { VIEW_PROFILE } from "../src/camera/cameraRigProfile.js";

function threeCamera() {
  return {
    position: { x: 0, y: 1, z: 5, set: vi.fn() },
    up: { x: 0, y: 1, z: 0, set: vi.fn() },
    lookAt: vi.fn(),
    getWorldDirection: vi.fn((target) => target.set(0, 0, -1)),
    isPerspectiveCamera: true,
    updateProjectionMatrix: vi.fn(),
  };
}

function perspectiveState() {
  return {
    transform: {
      position: [0, 1, 5],
      target: [0, 1, 0],
      up: [0, 1, 0],
    },
    projection: {
      kind: "perspective",
      fovY: 50,
      near: 0.1,
      far: 1000,
      aspect: 1,
    },
  };
}

describe("managed camera controller interaction requirements", () => {
  let element: EventTargetHarness;
  let windowTarget: EventTargetHarness;

  beforeEach(() => {
    hooks.cleanups = [];
    hooks.frame = undefined;
    element = new EventTargetHarness();
    windowTarget = new EventTargetHarness();
    hooks.three = {
      camera: threeCamera(),
      gl: { domElement: element },
      size: { width: 1600, height: 900 },
    };
    vi.stubGlobal("window", windowTarget);
  });

  afterEach(() => {
    for (const cleanup of hooks.cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
  });

  it("registers, activates, resizes, and synchronizes a new managed camera", () => {
    const state = perspectiveState();
    const manager = {
      hasCamera: vi.fn().mockReturnValue(false),
      registerCamera: vi.fn(),
      updateCamera: vi.fn(),
      activateCamera: vi.fn(),
      getCamera: vi.fn().mockReturnValue(state),
      applyControl: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue({ activeCameraId: "main" }),
    };

    expect(
      ManagedCameraController({
        manager: manager as never,
        profile: VIEW_PROFILE,
      })
    ).toBeNull();
    expect(manager.registerCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "main",
        priority: 100,
        projection: expect.objectContaining({ kind: "perspective" }),
      })
    );
    expect(manager.activateCamera).toHaveBeenCalledWith("main");
    expect(manager.updateCamera).toHaveBeenCalledWith("main", {
      projection: expect.objectContaining({ aspect: 1600 / 900 }),
    });

    hooks.frame?.();
    expect(hooks.three?.camera.position.set).toHaveBeenCalledWith(0, 1, 5);
  });

  it("updates existing orthographic cameras and tolerates missing registrations", () => {
    const orthographic = {
      ...perspectiveState(),
      projection: {
        kind: "orthographic",
        left: -1,
        right: 1,
        top: 1,
        bottom: -1,
        near: 0.1,
        far: 100,
        aspect: 1,
      },
    };
    const manager = {
      hasCamera: vi.fn().mockReturnValue(true),
      registerCamera: vi.fn(),
      updateCamera: vi.fn(),
      activateCamera: vi.fn(),
      getCamera: vi
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValue(orthographic),
      applyControl: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue({ activeCameraId: null }),
    };

    ManagedCameraController({
      manager: manager as never,
      profile: VIEW_PROFILE,
      cameraId: "edit",
    });
    expect(manager.registerCamera).not.toHaveBeenCalled();
    expect(manager.updateCamera).toHaveBeenCalledWith(
      "edit",
      expect.objectContaining({ projection: expect.any(Object) })
    );

    hooks.frame?.();
    manager.getCamera.mockReturnValueOnce(undefined);
    hooks.frame?.();
  });

  it("maps orbit, pan, dolly, capture, and context-menu input", () => {
    const state = perspectiveState();
    const manager = {
      hasCamera: vi.fn().mockReturnValue(false),
      registerCamera: vi.fn(),
      updateCamera: vi.fn(),
      activateCamera: vi.fn(),
      getCamera: vi.fn().mockReturnValue(state),
      applyControl: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue({ activeCameraId: "main" }),
    };
    ManagedCameraController({
      manager: manager as never,
      profile: VIEW_PROFILE,
    });

    windowTarget.emit("pointermove", { clientX: 1, clientY: 1 });
    element.emit("pointerdown", {
      button: 9,
      shiftKey: false,
      clientX: 10,
      clientY: 20,
      pointerId: 1,
    });
    element.emit("pointerdown", {
      button: 0,
      shiftKey: false,
      clientX: 10,
      clientY: 20,
      pointerId: 2,
    });
    windowTarget.emit("pointermove", { clientX: 15, clientY: 25 });
    expect(manager.applyControl).toHaveBeenCalledWith(
      "main",
      expect.objectContaining({ type: "orbit" }),
      expect.objectContaining({ makeActive: true })
    );

    windowTarget.emit("pointerup", { pointerId: 2 });
    element.emit("pointerdown", {
      button: 2,
      shiftKey: false,
      clientX: 20,
      clientY: 20,
      pointerId: 3,
    });
    manager.getCamera.mockReturnValueOnce(undefined);
    windowTarget.emit("pointermove", { clientX: 22, clientY: 24 });
    windowTarget.emit("pointermove", { clientX: 25, clientY: 26 });
    expect(manager.applyControl).toHaveBeenCalledWith(
      "main",
      expect.objectContaining({ type: "pan" }),
      { makeActive: true }
    );

    const preventWheel = vi.fn();
    manager.getCamera.mockReturnValueOnce(undefined);
    element.emit("wheel", { deltaY: 10, preventDefault: preventWheel });
    element.emit("wheel", { deltaY: -10, preventDefault: preventWheel });
    expect(preventWheel).toHaveBeenCalledTimes(2);
    expect(manager.applyControl).toHaveBeenCalledWith(
      "main",
      expect.objectContaining({ type: "dolly" }),
      expect.objectContaining({ makeActive: true })
    );

    const preventContext = vi.fn();
    element.emit("contextmenu", { preventDefault: preventContext });
    expect(preventContext).toHaveBeenCalledOnce();
    expect(element.setPointerCapture).toHaveBeenCalled();
    expect(element.releasePointerCapture).toHaveBeenCalledWith(2);
  });

  it("disables input cleanly and tolerates renderers without a DOM element", () => {
    const manager = {
      hasCamera: vi.fn().mockReturnValue(false),
      registerCamera: vi.fn(),
      updateCamera: vi.fn(),
      activateCamera: vi.fn(),
      getCamera: vi.fn().mockReturnValue(undefined),
      applyControl: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue({}),
    };
    ManagedCameraController({
      manager: manager as never,
      profile: VIEW_PROFILE,
      enabled: false,
    });

    hooks.three = {
      camera: threeCamera(),
      gl: {},
      size: { width: 100, height: 100 },
    };
    ManagedCameraController({
      manager: manager as never,
      profile: VIEW_PROFILE,
    });
    expect(manager.applyControl).not.toHaveBeenCalled();
  });
});
