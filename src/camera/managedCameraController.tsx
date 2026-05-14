import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  createCameraManager,
  type CameraDefinition,
  type CameraManager,
  type CameraState,
  type Vec3,
} from "@plasius/gpu-camera";
import { Vector3 } from "three";
import type { CameraRigProfile } from "./cameraRigProfile.js";

type ProjectionCamera = {
  fov?: number;
  near?: number;
  far?: number;
  aspect?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
  updateProjectionMatrix?: () => void;
};

type ManagedThreeCamera = ProjectionCamera & {
  position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  up: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  lookAt: (x: number, y: number, z: number) => void;
  getWorldDirection?: (target: Vector3) => Vector3;
};

type PointerMode = "orbit" | "pan" | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function length3(value: Vec3) {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize3(value: Vec3, fallback: Vec3): Vec3 {
  const len = length3(value);
  if (len <= Number.EPSILON) {
    return [...fallback];
  }
  return [value[0] / len, value[1] / len, value[2] / len];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(value: Vec3, scalar: number): Vec3 {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function resolveCameraAspect(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return 1;
  }
  return Math.max(1 / 4096, width / height);
}

export function createRendererCameraManager(options?: {
  maxParallelViews?: number;
  maxHotCameras?: number;
}): CameraManager {
  return createCameraManager({
    maxParallelViews: options?.maxParallelViews ?? 2,
    maxHotCameras: options?.maxHotCameras ?? 3,
  });
}

export function derivePanDeltaFromCameraState(
  cameraState: CameraState,
  deltaX: number,
  deltaY: number,
  panSpeed: number
): Vec3 {
  const position = cameraState.transform.position;
  const target = cameraState.transform.target;
  const up = normalize3(cameraState.transform.up ?? [0, 1, 0], [0, 1, 0]);

  const forward = normalize3(sub3(target, position), [0, 0, -1]);
  const right = normalize3(cross3(forward, up), [1, 0, 0]);
  const radius = Math.max(0.01, length3(sub3(position, target)));
  const scale = Math.max(0.00001, panSpeed * radius);

  const horizontal = scale3(right, -deltaX * scale);
  const vertical = scale3(up, deltaY * scale);
  return add3(horizontal, vertical);
}

export function buildCameraDefinitionFromThreeCamera(
  camera: ManagedThreeCamera,
  aspect: number
): CameraDefinition {
  const position: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
  const up: Vec3 = [camera.up.x, camera.up.y, camera.up.z];
  const worldDirection = new Vector3(0, 0, -1);
  camera.getWorldDirection?.(worldDirection);
  const target: Vec3 = [
    position[0] + worldDirection.x,
    position[1] + worldDirection.y,
    position[2] + worldDirection.z,
  ];

  if (camera.isOrthographicCamera) {
    return {
      transform: { position, target, up },
      projection: {
        kind: "orthographic",
        left: camera.left ?? -1,
        right: camera.right ?? 1,
        top: camera.top ?? 1,
        bottom: camera.bottom ?? -1,
        near: camera.near ?? 0.1,
        far: camera.far ?? 2000,
        aspect,
      },
    };
  }

  return {
    transform: { position, target, up },
    projection: {
      kind: "perspective",
      fovY: camera.fov ?? 50,
      near: camera.near ?? 0.1,
      far: camera.far ?? 2000,
      aspect,
    },
  };
}

export function syncThreeCameraFromManagedState(
  camera: ManagedThreeCamera,
  cameraState: CameraState,
  aspect: number
) {
  const transform = cameraState.transform;
  const up = transform.up ?? [0, 1, 0];
  camera.position.set(
    transform.position[0],
    transform.position[1],
    transform.position[2]
  );
  camera.up.set(up[0], up[1], up[2]);
  camera.lookAt(
    transform.target[0],
    transform.target[1],
    transform.target[2]
  );

  const projection = cameraState.projection;
  if (projection.kind === "perspective" && camera.isPerspectiveCamera) {
    camera.fov = projection.fovY;
    camera.near = projection.near;
    camera.far = projection.far;
    camera.aspect = aspect;
    camera.updateProjectionMatrix?.();
    return;
  }

  if (projection.kind === "orthographic" && camera.isOrthographicCamera) {
    const sourceAspect = projection.aspect || 1;
    const aspectScale = sourceAspect > 0 ? aspect / sourceAspect : 1;
    camera.left = projection.left * aspectScale;
    camera.right = projection.right * aspectScale;
    camera.top = projection.top;
    camera.bottom = projection.bottom;
    camera.near = projection.near;
    camera.far = projection.far;
    camera.updateProjectionMatrix?.();
  }
}

export interface ManagedCameraControllerProps {
  manager: CameraManager;
  profile: CameraRigProfile;
  cameraId?: string;
  enabled?: boolean;
}

export function ManagedCameraController({
  manager,
  profile,
  cameraId = "main",
  enabled = true,
}: ManagedCameraControllerProps) {
  const { camera, gl, size } = useThree();
  const pointerRef = useRef<{
    active: boolean;
    mode: PointerMode;
    x: number;
    y: number;
  }>({
    active: false,
    mode: null,
    x: 0,
    y: 0,
  });

  const managedThreeCamera = camera as unknown as ManagedThreeCamera;
  const aspect = resolveCameraAspect(size.width, size.height);

  useEffect(() => {
    const cameraDefinition = buildCameraDefinitionFromThreeCamera(
      managedThreeCamera,
      aspect
    );

    if (manager.hasCamera(cameraId)) {
      manager.updateCamera(cameraId, cameraDefinition);
    } else {
      manager.registerCamera({
        id: cameraId,
        priority: 100,
        ...cameraDefinition,
      });
    }

    manager.activateCamera(cameraId);
  }, [manager, cameraId, managedThreeCamera, aspect]);

  useEffect(() => {
    const registered = manager.getCamera(cameraId);
    if (!registered) {
      return;
    }
    if (registered.projection.kind === "perspective") {
      manager.updateCamera(cameraId, {
        projection: {
          ...registered.projection,
          aspect,
        },
      });
      return;
    }
    manager.updateCamera(cameraId, {
      projection: {
        ...registered.projection,
        aspect,
      },
    });
  }, [manager, cameraId, aspect]);

  useEffect(() => {
    if (!enabled) {
      pointerRef.current.active = false;
      pointerRef.current.mode = null;
      return;
    }

    const element = gl.domElement;
    if (!element) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && !event.shiftKey) {
        pointerRef.current.mode = "orbit";
      } else if (event.button === 2 || event.button === 1 || event.shiftKey) {
        pointerRef.current.mode = "pan";
      } else {
        pointerRef.current.mode = null;
      }

      if (!pointerRef.current.mode) {
        return;
      }

      pointerRef.current.active = true;
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      element.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerRef.current.active || !pointerRef.current.mode) {
        return;
      }

      const deltaX = event.clientX - pointerRef.current.x;
      const deltaY = event.clientY - pointerRef.current.y;
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;

      if (pointerRef.current.mode === "orbit") {
        manager.applyControl(
          cameraId,
          {
            type: "orbit",
            deltaAzimuth: -deltaX * profile.orbitSpeed,
            deltaPolar: -deltaY * profile.orbitSpeed,
          },
          {
            minDistance: profile.minDistance,
            maxDistance: profile.maxDistance,
            minPolarAngle: profile.minPolarAngle,
            maxPolarAngle: profile.maxPolarAngle,
            makeActive: true,
          }
        );
        return;
      }

      const activeCamera = manager.getCamera(cameraId);
      if (!activeCamera) {
        return;
      }
      const delta = derivePanDeltaFromCameraState(
        activeCamera,
        deltaX,
        deltaY,
        profile.panSpeed
      );
      manager.applyControl(
        cameraId,
        {
          type: "pan",
          delta,
        },
        { makeActive: true }
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      pointerRef.current.active = false;
      pointerRef.current.mode = null;
      element.releasePointerCapture?.(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const activeCamera = manager.getCamera(cameraId);
      if (!activeCamera) {
        return;
      }
      const distanceToTarget = Math.max(
        0.01,
        length3(sub3(activeCamera.transform.position, activeCamera.transform.target))
      );
      const step = -event.deltaY * profile.dollySpeed * Math.max(0.05, distanceToTarget * 0.2);
      manager.applyControl(
        cameraId,
        { type: "dolly", distance: step },
        {
          minDistance: profile.minDistance,
          maxDistance: profile.maxDistance,
          makeActive: true,
        }
      );
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("contextmenu", onContextMenu);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("contextmenu", onContextMenu);
    };
  }, [manager, cameraId, profile, gl, enabled]);

  useFrame(() => {
    const snapshot = manager.getSnapshot();
    const activeId = snapshot.activeCameraId ?? cameraId;
    const activeCamera = manager.getCamera(activeId);
    if (!activeCamera) {
      return;
    }
    syncThreeCameraFromManagedState(managedThreeCamera, activeCamera, aspect);
  });

  return null;
}
