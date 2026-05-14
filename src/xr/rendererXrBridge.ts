import {
  defaultVrSessionInit,
  mergeXrSessionInit,
} from "@plasius/gpu-xr";

type XrReferenceSpaceType =
  | "viewer"
  | "local"
  | "local-floor"
  | "bounded-floor"
  | "unbounded";

export interface XrEnabledRenderer {
  xr?: {
    enabled: boolean;
    setReferenceSpaceType?: (type: XrReferenceSpaceType) => void;
    setSession?: (session: XRSession) => Promise<void> | void;
  };
}

export const rendererVrSessionInit = mergeXrSessionInit(defaultVrSessionInit, {
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["depth-sensing", "hit-test", "hand-tracking", "layers"],
});

export async function bindSessionToRenderer(
  renderer: XrEnabledRenderer | null,
  session: XRSession,
  referenceSpaceType: XrReferenceSpaceType = "local-floor"
): Promise<boolean> {
  const xr = renderer?.xr;
  if (!xr) {
    return false;
  }

  xr.enabled = true;
  xr.setReferenceSpaceType?.(referenceSpaceType);

  if (typeof xr.setSession === "function") {
    await xr.setSession(session);
  }

  return true;
}
