import { createScopedStoreContext } from "@plasius/react-state";
import type { IState } from "@plasius/react-state";
import type { CameraRigProfile } from "./camera/cameraRigProfile.js";
import { VIEW_PROFILE } from "./camera/cameraRigProfile.js";

type RenderAction =
  | {
      type: "set_camera_profile";
      payload: CameraRigProfile;
    }
  | {
      type: "set_frame";
      payload: number;
    }
  | {
      type: "set_last_render_time";
      payload: number;
    }
  | {
      type: "update";
    }
  | {
      type: "reset";
    }
  | {
      type: "set_frame_rate";
      payload: number;
    }
  | {
      type: "increment_accumulated_frames";
    }
  | {
      type: "set_performance_tier";
      payload: "low" | "medium" | "high" | "ultra";
    }
  | {
      type: "set_is_animating";
      payload: boolean;
    }
  | {
      type: "set_pause_render";
      payload: boolean;
    }
  | {
      type: "set_scene_hash";
      payload: string;
    }
  | {
      type: "set_vr_mode";
      payload: boolean;
    };

interface RenderState extends IState {
  frame: number;
  lastRenderTime: number;
  debugEnabled: boolean;
  frameRate: number;
  accumulatedFrames: number;
  performanceTier: "low" | "medium" | "high" | "ultra";
  isAnimating: boolean;
  pauseRender: boolean;
  sceneHash: string;
  cameraRigProfile: CameraRigProfile;
  useVR: boolean;
}

const initialState: RenderState = {
  frame: 0,
  lastRenderTime: 0,
  debugEnabled: false,
  frameRate: 0,
  accumulatedFrames: 0,
  performanceTier: "high",
  isAnimating: true,
  pauseRender: false,
  sceneHash: "",
  cameraRigProfile: VIEW_PROFILE,
  useVR: false,
};

const reducer = (state: RenderState, action: RenderAction): RenderState => {
  switch (action.type) {
    case "update":
      return { ...state };
    case "reset":
      return initialState;
    case "set_frame_rate":
      return { ...state, frameRate: action.payload };
    case "increment_accumulated_frames":
      return { ...state, accumulatedFrames: state.accumulatedFrames + 1 };
    case "set_performance_tier":
      return { ...state, performanceTier: action.payload };
    case "set_is_animating":
      return { ...state, isAnimating: action.payload };
    case "set_pause_render":
      return { ...state, pauseRender: action.payload };
    case "set_scene_hash":
      return { ...state, sceneHash: action.payload };
    case "set_camera_profile":
      return { ...state, cameraRigProfile: action.payload };
    case "set_frame":
      return { ...state, frame: action.payload };
    case "set_last_render_time":
      return { ...state, lastRenderTime: action.payload };
    case "set_vr_mode":
      return { ...state, useVR: action.payload };
    default:
      return state;
  }
};

export type RenderStoreContext = ReturnType<
  typeof createScopedStoreContext<RenderState, RenderAction>
>;

export const RenderStore: RenderStoreContext =
  createScopedStoreContext<RenderState, RenderAction>(reducer, initialState);

export const RenderProvider = ({ children }: { children: React.ReactNode }) => {
  return <RenderStore.Provider>{children}</RenderStore.Provider>;
};
