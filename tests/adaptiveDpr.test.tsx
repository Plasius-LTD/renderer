import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
  dispatch: vi.fn(),
  gl: { setPixelRatio: vi.fn() },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      hooks.cleanup = effect() ?? undefined;
    },
  };
});

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ gl: hooks.gl }),
}));

vi.mock("@react-three/drei", () => ({
  Stats: function Stats() {
    return null;
  },
}));

vi.mock("../src/renderStateProvider.js", () => ({
  RenderStore: {
    useDispatch: () => hooks.dispatch,
  },
}));

import { AdaptiveDPR } from "../src/adaptivedpr.js";

describe("adaptive DPR requirements", () => {
  let clock = 0;
  let animationCallback: (() => void) | undefined;
  let animationId = 0;
  const cancelAnimationFrame = vi.fn();

  function runFrames(count: number, deltaMs: number): void {
    for (let index = 0; index < count; index += 1) {
      clock += deltaMs;
      const callback = animationCallback;
      expect(callback).toBeTypeOf("function");
      callback?.();
    }
  }

  beforeEach(() => {
    clock = 0;
    animationCallback = undefined;
    animationId = 0;
    hooks.cleanup = undefined;
    hooks.dispatch.mockReset();
    hooks.gl.setPixelRatio.mockReset();
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: () => void) => {
        animationCallback = callback;
        animationId += 1;
        return animationId;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    cancelAnimationFrame.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("drops DPR for sustained low frame rates and resets telemetry on cleanup", () => {
    const element = AdaptiveDPR();
    runFrames(20, 50);

    expect(element.props.className).toBe("performanceContainer");
    expect(hooks.dispatch).toHaveBeenCalledWith({
      type: "set_performance_tier",
      payload: "low",
    });
    expect(hooks.gl.setPixelRatio).toHaveBeenCalledWith(1);

    hooks.cleanup?.();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(animationId);
    expect(hooks.dispatch).toHaveBeenCalledWith({
      type: "set_frame_rate",
      payload: 0,
    });
  });

  it("recovers from low to medium after a stable history", () => {
    AdaptiveDPR();
    runFrames(20, 50);
    runFrames(200, 20);

    expect(hooks.dispatch).toHaveBeenCalledWith({
      type: "set_performance_tier",
      payload: "medium",
    });
    expect(hooks.gl.setPixelRatio).toHaveBeenCalledWith(2);
  });

  it("selects high once and does not oscillate at 70–79 FPS", () => {
    AdaptiveDPR();
    runFrames(150, 1000 / 75);

    const tierPayloads = hooks.dispatch.mock.calls
      .filter(([action]) => action.type === "set_performance_tier")
      .map(([action]) => action.payload);
    expect(tierPayloads).toEqual(["high"]);
    expect(hooks.gl.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(hooks.gl.setPixelRatio).toHaveBeenCalledWith(3);
  });

  it("selects ultra DPR for sustained 120 FPS or higher", () => {
    AdaptiveDPR();
    runFrames(120, 1000 / 120);

    expect(hooks.dispatch).toHaveBeenCalledWith({
      type: "set_performance_tier",
      payload: "ultra",
    });
    expect(hooks.gl.setPixelRatio).toHaveBeenCalledWith(4);
  });
});
