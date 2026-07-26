import { describe, expect, it } from "vitest";
import { EDIT_PROFILE } from "../src/camera/cameraRigProfile.js";
import {
  RenderProvider,
  initialRenderState,
  reduceRenderState,
} from "../src/renderStateProvider.js";

describe("renderer state requirements", () => {
  it("applies every renderer state transition and reset", () => {
    let current = initialRenderState;
    current = reduceRenderState(current, { type: "update" });
    expect(current).not.toBe(initialRenderState);
    current = reduceRenderState(current, {
      type: "set_frame_rate",
      payload: 72,
    });
    current = reduceRenderState(current, {
      type: "increment_accumulated_frames",
    });
    current = reduceRenderState(current, {
      type: "set_performance_tier",
      payload: "ultra",
    });
    current = reduceRenderState(current, {
      type: "set_is_animating",
      payload: false,
    });
    current = reduceRenderState(current, {
      type: "set_pause_render",
      payload: true,
    });
    current = reduceRenderState(current, {
      type: "set_scene_hash",
      payload: "scene-v2",
    });
    current = reduceRenderState(current, {
      type: "set_camera_profile",
      payload: EDIT_PROFILE,
    });
    current = reduceRenderState(current, { type: "set_frame", payload: 8 });
    current = reduceRenderState(current, {
      type: "set_last_render_time",
      payload: 125,
    });
    current = reduceRenderState(current, {
      type: "set_vr_mode",
      payload: true,
    });

    expect(current).toMatchObject({
      frame: 8,
      frameRate: 72,
      accumulatedFrames: 1,
      performanceTier: "ultra",
      isAnimating: false,
      pauseRender: true,
      sceneHash: "scene-v2",
      cameraRigProfile: EDIT_PROFILE,
      lastRenderTime: 125,
      useVR: true,
    });

    expect(reduceRenderState(current, { type: "reset" })).toBe(
      initialRenderState
    );
    expect(
      reduceRenderState(current, {
        type: "unknown",
      } as never)
    ).toBe(current);
  });

  it("wraps children with the scoped provider", () => {
    const child = { type: "test-child" };
    const element = RenderProvider({ children: child as never });

    expect(element.props.children).toBe(child);
  });
});
