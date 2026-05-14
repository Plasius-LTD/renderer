import React, { useEffect, useRef, type PropsWithChildren } from "react";
import type { CameraManager, Vec3 } from "@plasius/gpu-camera";
import { PlayerStore } from "./playerstore.js";

function length3(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize3(value: Vec3, fallback: Vec3): Vec3 {
  const len = length3(value);
  if (len <= Number.EPSILON) {
    return [...fallback];
  }
  return [value[0] / len, value[1] / len, value[2] / len];
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function Player({
  cameraManager,
  cameraId,
  children,
}: PropsWithChildren<{ cameraManager: CameraManager; cameraId: string }>) {
  // Local refs for movement-relevant stats (used by the rAF ticker)
  const strRef = useRef(1);
  const dexRef = useRef(1);
  const endRef = useRef(1);
  const movingKeys = useRef<Set<string>>(new Set());
  const movingRef = useRef(false);
  const runLoadRef = useRef(0); // seconds of continuous run load
  const lastTickRef = useRef(performance.now());

  // Subscribe via inline selector (useSyncExternalStore under the hood)
  const physEff = PlayerStore.useSelector((s) => {
    const phys = s?.attributesBase?.physical ?? {
      strength: 1,
      dexterity: 1,
      endurance: 1,
    };
    const g = s?.attributesGear ?? {};
    const e = s?.attributesEffects ?? {};

    let strength =
      (phys.strength ?? 1) + (g.strength ?? 0) + (e.strength ?? 0);
    let dexterity =
      (phys.dexterity ?? 1) + (g.dexterity ?? 0) + (e.dexterity ?? 0);
    let endurance =
      (phys.endurance ?? 1) + (g.endurance ?? 0) + (e.endurance ?? 0);

    // Add equipped item modifiers
    if (s?.equipment && s?.items) {
      for (const slot of Object.keys(s.equipment)) {
        const itemId = (s.equipment as any)[slot];
        const item = s.items[itemId];
        const m = item?.modifiers as
          | Partial<Record<"strength" | "dexterity" | "endurance", number>>
          | undefined;
        if (m) {
          strength += m.strength ?? 0;
          dexterity += m.dexterity ?? 0;
          endurance += m.endurance ?? 0;
        }
      }
    }

    // Add status effect attribute modifiers
    if (s?.effects) {
      for (const eff of Object.values(s.effects) as any[]) {
        const mods = eff?.modifiers?.attributes as
          | Partial<Record<"strength" | "dexterity" | "endurance", number>>
          | undefined;
        if (mods) {
          strength += mods.strength ?? 0;
          dexterity += mods.dexterity ?? 0;
          endurance += mods.endurance ?? 0;
        }
      }
    }

    return { strength, dexterity, endurance };
  });

  // Keep refs in sync for rAF without causing extra renders
  useEffect(() => {
    strRef.current = physEff.strength;
    dexRef.current = physEff.dexterity;
    endRef.current = physEff.endurance;
  }, [physEff.strength, physEff.dexterity, physEff.endurance]);

  useEffect(() => {
    window.focus();
  }, []);

  // Fatigue/exhaustion ticker
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const ln = (x: number) => Math.log(1 + Math.max(0, x) / 25);
      const endurance = endRef.current;
      const recovery = 1.5 + ln(endurance); // recover faster with Endurance

      if (movingRef.current) {
        runLoadRef.current = Math.max(0, runLoadRef.current + dt);
      } else {
        runLoadRef.current = Math.max(0, runLoadRef.current - dt * recovery);
      }

      raf = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Movement handlers
  useEffect(() => {
    const ln = (x: number) => Math.log(1 + Math.max(0, x) / 25);

    const baseSpeed = () => {
      const dex = dexRef.current;
      const str = strRef.current;
      const dexBoost = 0.25 * ln(dex);
      const strBoost = 0.1 * ln(str);
      return 1 + dexBoost + strBoost;
    };

    const currentSpeed = () => {
      const endurance = endRef.current;
      const cap = 4 + 2 * ln(endurance);
      const load = runLoadRef.current;
      if (load <= cap) return baseSpeed();
      const over = Math.min(1, (load - cap) / cap);
      const fatigue = 1 - 0.5 * over; // down to 50%
      return baseSpeed() * fatigue;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const cameraState = cameraManager.getCamera(cameraId);
      if (!cameraState) return;

      const position = [...cameraState.transform.position] as Vec3;
      const target = [...cameraState.transform.target] as Vec3;
      const up = normalize3(cameraState.transform.up ?? [0, 1, 0], [0, 1, 0]);

      const forward = normalize3(sub3(target, position), [0, 0, -1]);
      const forwardY = forward[1];
      const planarForward = normalize3([forward[0], 0, forward[2]], [0, 0, -1]);
      const right = normalize3(cross3(planarForward, up), [1, 0, 0]);

      const moveKeys = new Set(["w", "a", "s", "d", "q", "e"]);
      if (moveKeys.has(event.key)) {
        movingKeys.current.add(event.key);
        movingRef.current = true;
      }

      switch (event.key) {
        case "w":
          position[0] += planarForward[0] * currentSpeed();
          position[1] += planarForward[1] * currentSpeed();
          position[2] += planarForward[2] * currentSpeed();
          break;
        case "s":
          position[0] -= planarForward[0] * currentSpeed();
          position[1] -= planarForward[1] * currentSpeed();
          position[2] -= planarForward[2] * currentSpeed();
          break;
        case "a":
          position[0] -= right[0] * currentSpeed();
          position[1] -= right[1] * currentSpeed();
          position[2] -= right[2] * currentSpeed();
          break;
        case "d":
          position[0] += right[0] * currentSpeed();
          position[1] += right[1] * currentSpeed();
          position[2] += right[2] * currentSpeed();
          break;
        case "q":
          position[1] += currentSpeed();
          break;
        case "e":
          position[1] -= currentSpeed();
          break;
        default:
          break;
      }

      const nextTarget = add3(position, [
        planarForward[0],
        forwardY,
        planarForward[2],
      ]);

      cameraManager.applyControl(
        cameraId,
        {
          type: "set-look-at",
          position,
          target: nextTarget,
          up,
        },
        { makeActive: true }
      );
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const moveKeys = new Set(["w", "a", "s", "d", "q", "e"]);
      if (moveKeys.has(event.key)) {
        movingKeys.current.delete(event.key);
        if (movingKeys.current.size === 0) movingRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [cameraManager, cameraId]);

  return <>{children}</>;
}

function WrappedPlayer({
  cameraManager,
  cameraId,
  children,
}: PropsWithChildren<{ cameraManager: CameraManager; cameraId: string }>) {
  return (
    <PlayerStore.Provider>
      <Player cameraManager={cameraManager} cameraId={cameraId}>
        {children}
      </Player>
    </PlayerStore.Provider>
  );
}

export { WrappedPlayer as Player };
