import { describe, expect, it, vi } from "vitest";
import {
  bindSessionToRenderer,
  rendererVrSessionInit,
} from "../src/xr/rendererXrBridge.js";

describe("renderer XR bridge", () => {
  it("builds a merged VR session init with required features", () => {
    expect(rendererVrSessionInit.requiredFeatures).toContain("local-floor");
    expect(rendererVrSessionInit.optionalFeatures).toEqual(
      expect.arrayContaining([
        "depth-sensing",
        "hit-test",
        "hand-tracking",
        "layers",
      ])
    );
  });

  it("binds an XR session to renderer.xr and enables XR", async () => {
    const setReferenceSpaceType = vi.fn();
    const setSession = vi.fn().mockResolvedValue(undefined);
    const renderer = {
      xr: {
        enabled: false,
        setReferenceSpaceType,
        setSession,
      },
    };

    const bound = await bindSessionToRenderer(
      renderer as never,
      {} as never,
      "local-floor"
    );

    expect(bound).toBe(true);
    expect(renderer.xr.enabled).toBe(true);
    expect(setReferenceSpaceType).toHaveBeenCalledWith("local-floor");
    expect(setSession).toHaveBeenCalledTimes(1);
  });

  it("returns false when renderer has no xr runtime", async () => {
    const bound = await bindSessionToRenderer(null, {} as never);
    expect(bound).toBe(false);
  });
});
