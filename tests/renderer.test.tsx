import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";

const harness = vi.hoisted(() => ({
  bindSession: vi.fn(),
  cameraManager: {
    clear: vi.fn(),
  },
  cameraManagerFactory: vi.fn(),
  canvas: null as null | {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    requestFullscreen: ReturnType<typeof vi.fn>;
  },
  cleanups: [] as Array<() => void>,
  dispatch: vi.fn(),
  refCall: 0,
  store: {
    useVR: false,
    cameraRigProfile: {
      orbitSpeed: 0.1,
      panSpeed: 0.1,
      dollySpeed: 0.1,
      minDistance: 1,
      maxDistance: 10,
      minPolarAngle: 0,
      maxPolarAngle: 1,
    },
  },
  webGpuInstances: [] as Array<Record<string, unknown>>,
  xrCallbacks: undefined as
    | {
        onSessionStart(session: unknown): void;
        onSessionEnd(): void;
      }
    | undefined,
  xrManager: {
    dispose: vi.fn(),
    enterVr: vi.fn(),
    exitSession: vi.fn(),
    probeSupport: vi.fn(),
  },
  xrManagerFactory: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === "function") harness.cleanups.push(cleanup);
    },
    useRef: <T,>(value: T) => {
      const call = harness.refCall;
      harness.refCall += 1;
      return { current: call === 0 ? harness.canvas : value };
    },
  };
});

vi.mock("@react-three/fiber", () => ({
  Canvas: function Canvas() {
    return null;
  },
}));

vi.mock("@react-three/drei", () => ({
  Html: function Html() {
    return null;
  },
  useProgress: () => ({ progress: 37 }),
}));

vi.mock("@plasius/gpu-xr", () => ({
  createXrManager: (callbacks: {
    onSessionStart(session: unknown): void;
    onSessionEnd(): void;
  }) => {
    harness.xrCallbacks = callbacks;
    harness.xrManagerFactory(callbacks);
    return harness.xrManager;
  },
}));

vi.mock("three/webgpu", () => {
  class WebGPURenderer {
    init = vi.fn().mockResolvedValue(undefined);
    setPixelRatio = vi.fn();
    setClearColor = vi.fn();
    outputColorSpace = "";
    xr = { enabled: false };

    constructor(public parameters: Record<string, unknown>) {
      harness.webGpuInstances.push(this as unknown as Record<string, unknown>);
    }
  }
  return {
    SRGBColorSpace: "srgb",
    WebGPURenderer,
  };
});

vi.mock("../src/renderStateProvider.js", () => ({
  RenderStore: {
    Provider: function Provider(props: { children?: unknown }) {
      return props.children;
    },
    useDispatch: () => harness.dispatch,
    useStore: () => harness.store,
  },
}));

vi.mock("../src/scene.js", () => ({
  Scene: function Scene() {
    return null;
  },
}));

vi.mock("../src/player/player.js", () => ({
  Player: function Player() {
    return null;
  },
}));

vi.mock("../src/adaptivedpr.js", () => ({
  AdaptiveDPR: function AdaptiveDPR() {
    return null;
  },
}));

vi.mock("../src/xr/rendererXrBridge.js", () => ({
  bindSessionToRenderer: (...args: unknown[]) => harness.bindSession(...args),
  rendererVrSessionInit: { requiredFeatures: ["local-floor"] },
}));

vi.mock("../src/camera/managedCameraController.js", () => ({
  createRendererCameraManager: (options: unknown) => {
    harness.cameraManagerFactory(options);
    return harness.cameraManager;
  },
  ManagedCameraController: function ManagedCameraController() {
    return null;
  },
}));

import {
  Loader,
  Renderer,
  RendererContent,
} from "../src/renderer.js";

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function canvasElement(tree: ReturnType<typeof RendererContent>) {
  return tree.props.children[1].props.children;
}

describe("renderer lifecycle requirements", () => {
  let documentHarness: {
    exitFullscreen: ReturnType<typeof vi.fn>;
    fullscreenElement: unknown;
  };
  let fullscreenListener: (() => void) | undefined;

  beforeEach(() => {
    harness.refCall = 0;
    harness.cleanups = [];
    harness.dispatch.mockReset();
    harness.cameraManager.clear.mockReset();
    harness.cameraManagerFactory.mockReset();
    harness.webGpuInstances = [];
    harness.bindSession.mockReset().mockResolvedValue(true);
    harness.xrCallbacks = undefined;
    harness.xrManager.dispose.mockReset().mockResolvedValue(undefined);
    harness.xrManager.enterVr.mockReset().mockResolvedValue(undefined);
    harness.xrManager.exitSession.mockReset().mockResolvedValue(undefined);
    harness.xrManager.probeSupport.mockReset().mockResolvedValue(true);
    harness.xrManagerFactory.mockReset();
    harness.store.useVR = false;
    fullscreenListener = undefined;
    harness.canvas = {
      addEventListener: vi.fn(
        (_type: string, listener: () => void) => {
          fullscreenListener = listener;
        }
      ),
      removeEventListener: vi.fn(),
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    };
    documentHarness = {
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      fullscreenElement: null,
    };
    vi.stubGlobal("document", documentHarness);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
  });

  it("exits XR in desktop mode, configures the canvas, and disposes managers", async () => {
    documentHarness.fullscreenElement = harness.canvas;
    const tree = RendererContent({
      cameraPosition: new Vector3(1, 2, 3),
      cameraRotation: new Vector3(0.1, 0.2, 0.3),
      multiview: false,
      children: "world",
    });
    await flushPromises();

    expect(harness.cameraManagerFactory).toHaveBeenCalledWith({
      maxParallelViews: 1,
      maxHotCameras: 3,
    });
    expect(harness.xrManager.probeSupport).toHaveBeenCalledWith([
      "immersive-vr",
    ]);
    expect(harness.xrManager.exitSession).toHaveBeenCalled();
    expect(documentHarness.exitFullscreen).toHaveBeenCalled();

    const button = tree.props.children[0];
    expect(button.props.title).toBe("Enter VR");
    button.props.onClick();
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: "set_vr_mode",
      payload: true,
    });

    const canvas = canvasElement(tree);
    expect(canvas.props.camera).toMatchObject({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
    });
    expect(canvas.props.dpr).toEqual([1, 4]);

    const renderer = await canvas.props.gl({
      antialias: false,
      alpha: false,
      stencil: false,
      depth: false,
      powerPreference: "low-power",
    });
    expect(renderer.parameters.multiview).toBe(false);
    expect(renderer.setClearColor).toHaveBeenCalledWith("lightblue");
    expect(renderer.outputColorSpace).toBe("srgb");
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.getContextAttributes()).toEqual({
      antialias: false,
      alpha: false,
      stencil: false,
      depth: false,
      powerPreference: "low-power",
      xrCompatible: true,
    });

    const stateRenderer = {
      outputColorSpace: "",
      setClearColor: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    };
    canvas.props.onCreated({
      gl: stateRenderer,
      size: { width: 800, height: 600 },
    });
    expect(stateRenderer.setClearColor).toHaveBeenCalledWith("lightblue");
    expect(stateRenderer.setSize).toHaveBeenCalledWith(800, 600);
    expect(stateRenderer.outputColorSpace).toBe("srgb");

    harness.xrCallbacks?.onSessionStart({ id: "session" });
    harness.xrCallbacks?.onSessionEnd();
    await flushPromises();
    expect(harness.bindSession).toHaveBeenCalledWith(
      stateRenderer,
      { id: "session" }
    );
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: "set_vr_mode",
      payload: false,
    });

    for (const cleanup of harness.cleanups.splice(0)) cleanup();
    expect(harness.cameraManager.clear).toHaveBeenCalled();
    expect(harness.xrManager.dispose).toHaveBeenCalled();
  });

  it("enters XR, fixes HMD DPR, and fails closed on fullscreen or binding errors", async () => {
    harness.store.useVR = true;
    const tree = RendererContent({
      cameraPosition: new Vector3(),
      cameraRotation: new Vector3(),
      multiview: true,
    });
    await flushPromises();

    expect(harness.cameraManagerFactory).toHaveBeenCalledWith({
      maxParallelViews: 2,
      maxHotCameras: 3,
    });
    expect(harness.canvas?.requestFullscreen).toHaveBeenCalled();
    expect(harness.xrManager.enterVr).toHaveBeenCalledWith({
      requiredFeatures: ["local-floor"],
    });

    const button = tree.props.children[0];
    expect(button.props.title).toBe("Exit VR");
    const canvas = canvasElement(tree);
    expect(canvas.props.dpr).toBe(1);
    const renderer = await canvas.props.gl({});
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.getContextAttributes()).toMatchObject({
      antialias: true,
      alpha: true,
      stencil: true,
      depth: true,
      powerPreference: "high-performance",
    });

    const stateRenderer = {
      outputColorSpace: "",
      setClearColor: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    };
    canvas.props.onCreated({
      gl: stateRenderer,
      size: { width: 1024, height: 768 },
    });
    expect(stateRenderer.setPixelRatio).toHaveBeenCalledWith(1);

    documentHarness.fullscreenElement = null;
    fullscreenListener?.();
    harness.bindSession.mockRejectedValueOnce(new Error("bind failed"));
    harness.xrCallbacks?.onSessionStart({});
    await flushPromises();
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: "set_vr_mode",
      payload: false,
    });
  });

  it("handles missing canvas and rejected support/fullscreen operations", async () => {
    harness.xrManager.probeSupport.mockRejectedValueOnce(
      new Error("probe failed")
    );
    harness.store.useVR = true;
    harness.canvas = null;
    expect(() =>
      RendererContent({
        cameraPosition: new Vector3(),
        cameraRotation: new Vector3(),
        multiview: true,
      })
    ).not.toThrow();
    await flushPromises();

    harness.refCall = 0;
    harness.canvas = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestFullscreen: vi.fn().mockRejectedValue(new Error("denied")),
    };
    RendererContent({
      cameraPosition: new Vector3(),
      cameraRotation: new Vector3(),
      multiview: true,
    });
    await flushPromises();
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: "set_vr_mode",
      payload: false,
    });
  });

  it("renders loader progress and wraps public renderer content in the store", () => {
    const loader = Loader();
    expect(loader.props.children).toEqual([37, " % loaded"]);

    const wrapped = Renderer({
      cameraPosition: new Vector3(),
      cameraRotation: new Vector3(),
      multiview: true,
    });
    expect(wrapped.props.children.type).toBe(RendererContent);
  });
});
