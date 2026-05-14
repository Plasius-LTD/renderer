import { type Vector3, type Group } from "three";
import * as THREE from "three/webgpu";
import {
  Canvas,
  //type ThreeToJSXElements,
  type RootState,
} from "@react-three/fiber";
/*
declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> { 
    
  }
}
*/
// Use the constructor parameter type as our renderer parameters type
type WebGPURendererParameters = ConstructorParameters<
  typeof THREE.WebGPURenderer
>[0];
import { useRef, useEffect, Suspense } from "react";

import { Html, useProgress } from "@react-three/drei";
import { createXrManager } from "@plasius/gpu-xr";
import type { CameraManager } from "@plasius/gpu-camera";

import { BsHeadsetVr } from "react-icons/bs";
import { CgWebsite } from "react-icons/cg";

import { RenderStore } from "./renderStateProvider.js";

import styles from "./styles/renderer.module.css";
import { Scene } from "./scene.js";

import { Player } from "./player/player.js";

import { AdaptiveDPR } from "./adaptivedpr.js";
import {
  bindSessionToRenderer,
  rendererVrSessionInit,
} from "./xr/rendererXrBridge.js";
import {
  createRendererCameraManager,
  ManagedCameraController,
} from "./camera/managedCameraController.js";

interface WebGPURendererWithContext extends THREE.WebGPURenderer {
  getContextAttributes: () => {
    antialias: boolean;
    alpha: boolean;
    stencil: boolean;
    depth: boolean;
    powerPreference: string;
    xrCompatible: boolean;
  };
}

export interface RendererProps {
  cameraPosition: Vector3;
  cameraRotation: Vector3;
  multiview: boolean;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center>{progress} % loaded</Html>;
}

enum Perf {
  Low,
  Medium,
  High,
  Ultra,
}

function Renderer({
  cameraPosition,
  cameraRotation,
  multiview = true,
  children,
}: React.PropsWithChildren<RendererProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Group | null>(null);
  const rendererRef = useRef<WebGPURendererWithContext | null>(null);
  const xrManagerRef = useRef<ReturnType<typeof createXrManager> | null>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);

  const { useVR, cameraRigProfile } = RenderStore.useStore();
  const dispatch = RenderStore.useDispatch();

  if (!cameraManagerRef.current) {
    cameraManagerRef.current = createRendererCameraManager({
      maxParallelViews: multiview ? 2 : 1,
      maxHotCameras: 3,
    });
  }
  const cameraManager = cameraManagerRef.current as CameraManager;

  useEffect(() => {
    return () => {
      cameraManager.clear();
    };
  }, [cameraManager]);

  useEffect(() => {
    const xrManager = createXrManager({
      onSessionStart: (session) => {
        void bindSessionToRenderer(rendererRef.current, session).catch(() => {
          dispatch({ type: "set_vr_mode", payload: false });
        });
      },
      onSessionEnd: () => {
        dispatch({ type: "set_vr_mode", payload: false });
      },
    });

    xrManagerRef.current = xrManager;

    void xrManager.probeSupport(["immersive-vr"]).catch(() => {
      // Ignore probe failures; entering VR will surface actionable errors.
    });

    return () => {
      const current = xrManagerRef.current;
      xrManagerRef.current = null;
      if (current) {
        void current.dispose();
      }
    };
  }, [dispatch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const xrManager = xrManagerRef.current;

    if (!canvas || !xrManager) {
      return;
    }

    const fullscreenChangeHandler = () => {
      if (!document.fullscreenElement) {
        dispatch({ type: "set_vr_mode", payload: false });
      }
    };

    const enterVRHandler = async () => {
      try {
        if (!document.fullscreenElement) {
          await canvas.requestFullscreen();
        }

        canvas.addEventListener("fullscreenchange", fullscreenChangeHandler);
        await xrManager.enterVr(rendererVrSessionInit);
      } catch {
        dispatch({ type: "set_vr_mode", payload: false });
      }
    };

    const exitVRHandler = async () => {
      await xrManager.exitSession();

      if (document.fullscreenElement === canvas) {
        await document.exitFullscreen().catch(() => {});
      }
    };

    if (!useVR) {
      void exitVRHandler();
      return () => {
        canvas.removeEventListener("fullscreenchange", fullscreenChangeHandler);
      };
    }

    void enterVRHandler();

    return () => {
      canvas.removeEventListener("fullscreenchange", fullscreenChangeHandler);
    };
  }, [useVR, dispatch]);

  return (
    <>
      <button
        title={useVR ? "Exit VR" : "Enter VR"}
        onClick={() => dispatch({ type: "set_vr_mode", payload: !useVR })}
        className={styles.vrButton}
      >
        {useVR ? <CgWebsite size={24} /> : <BsHeadsetVr size={24} />}
      </button>

      <Suspense fallback={<div style={{ height: "100%" }} />}>
        <Canvas
          shadows={"soft"}
          tabIndex={0}
          ref={canvasRef}
          className={`${styles.canvas} ${
            !useVR ? styles.fixed : styles.absolute
          }`}
          style={{ width: "100%", height: "100%" }}
          camera={{
            position: cameraPosition.toArray(),
            rotation: cameraRotation.toArray(),
            near: 0.1,
            far: 1000,
            fov: 50,
          }}
          dpr={useVR ? 1 : [1, 4]}
          gl={async (props) => {
            const params = {
              ...props,
              multiview,
            } as WebGPURendererParameters;
            const renderer = new THREE.WebGPURenderer(
              params
            ) as WebGPURendererWithContext;

            await renderer.init();

            if (useVR && "setPixelRatio" in renderer) {
              renderer.setPixelRatio(1);
            }

            if ("setClearColor" in renderer) {
              renderer.setClearColor("lightblue");
            }

            if ("outputColorSpace" in renderer) {
              renderer.outputColorSpace = THREE.SRGBColorSpace;
            }

            if ("xr" in renderer) {
              renderer.xr.enabled = true;
            }

            renderer.getContextAttributes = () => ({
              antialias: props.antialias ?? true,
              alpha: props.alpha ?? true,
              stencil: props.stencil ?? true,
              depth: props.depth ?? true,
              powerPreference: props.powerPreference ?? "high-performance",
              xrCompatible: true,
            });
            return renderer;
          }}
          onCreated={(state: RootState) => {
            // In XR, keep DPR stable to avoid stereo stitching issues
            if (useVR && "setPixelRatio" in state.gl) {
              // Cap DPR to a reasonable value for HMDs; many runtimes manage internal resolution
              state.gl.setPixelRatio(1);
            }

            if ("setClearColor" in state.gl) {
              state.gl.setClearColor("lightblue");
            }

            if ("setSize" in state.gl) {
              state.gl.setSize(state.size.width, state.size.height);
            }

            if ("outputColorSpace" in state.gl) {
              state.gl.outputColorSpace = THREE.SRGBColorSpace;
            }

            rendererRef.current = state.gl as unknown as WebGPURendererWithContext;
          }}
        >
          {!useVR && <AdaptiveDPR />}

          <Suspense fallback={Loader()}>
            {!useVR && (
              <ManagedCameraController
                manager={cameraManager}
                profile={cameraRigProfile}
                cameraId="main"
              />
            )}
            <Scene ref={sceneRef}>
              <Player cameraManager={cameraManager} cameraId="main" />
              {children}
            </Scene>
          </Suspense>
        </Canvas>
      </Suspense>
    </>
  );
}

function WrappedRenderer(props: React.PropsWithChildren<RendererProps>) {
  return (
    <RenderStore.Provider>
      <Renderer {...props} />
    </RenderStore.Provider>
  );
}

export { WrappedRenderer as Renderer };
