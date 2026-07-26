import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  selected: undefined as
    | { strength: number; dexterity: number; endurance: number }
    | undefined,
  storeState: {} as Record<string, unknown>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    default: actual,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === "function") {
        harness.cleanups.push(cleanup);
      }
    },
    useRef: <T,>(value: T) => ({ current: value }),
  };
});

vi.mock("../src/player/playerstore.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/player/playerstore.js")>();
  return {
    ...actual,
    PlayerStore: {
      Provider: function Provider(props: { children?: unknown }) {
        return props.children;
      },
      useSelector: (
        selector: (state: Record<string, unknown>) => {
          strength: number;
          dexterity: number;
          endurance: number;
        }
      ) => {
        harness.selected = selector(harness.storeState);
        return harness.selected;
      },
    },
  };
});

import { Player, PlayerContent } from "../src/player/player.js";

type Listener = (event: { key: string }) => void;

describe("player movement requirements", () => {
  let clock = 0;
  let rafCallback: (() => void) | undefined;
  let rafId = 0;
  let listeners: Map<string, Set<Listener>>;
  const cancelAnimationFrame = vi.fn();
  const focus = vi.fn();

  function dispatch(type: string, key: string): void {
    for (const listener of listeners.get(type) ?? []) {
      listener({ key });
    }
  }

  beforeEach(() => {
    clock = 0;
    rafCallback = undefined;
    rafId = 0;
    listeners = new Map();
    harness.cleanups = [];
    harness.selected = undefined;
    harness.storeState = {};
    focus.mockReset();
    cancelAnimationFrame.mockReset();
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      rafCallback = callback;
      rafId += 1;
      return rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    vi.stubGlobal("window", {
      focus,
      addEventListener(type: string, listener: Listener) {
        const entries = listeners.get(type) ?? new Set();
        entries.add(listener);
        listeners.set(type, entries);
      },
      removeEventListener(type: string, listener: Listener) {
        listeners.get(type)?.delete(listener);
      },
    });
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups.splice(0)) {
      cleanup();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("derives physical attributes from base, gear, equipment, and effects", () => {
    harness.storeState = {
      attributesBase: {
        physical: { strength: 10, dexterity: 20, endurance: 30 },
      },
      attributesGear: { strength: 1, dexterity: 2, endurance: 3 },
      attributesEffects: { strength: -1, dexterity: -2, endurance: -3 },
      equipment: { head: "helm", feet: "missing" },
      items: {
        helm: {
          modifiers: { strength: 4, dexterity: 5, endurance: 6 },
        },
      },
      effects: {
        blessing: {
          modifiers: {
            attributes: { strength: 7, dexterity: 8, endurance: 9 },
          },
        },
        cosmetic: {},
      },
    };
    const manager = {
      getCamera: vi.fn().mockReturnValue(undefined),
      applyControl: vi.fn(),
    };

    const element = PlayerContent({
      cameraManager: manager as never,
      cameraId: "main",
      children: "avatar",
    });

    expect(harness.selected).toEqual({
      strength: 21,
      dexterity: 33,
      endurance: 45,
    });
    expect(element.props.children).toBe("avatar");
    expect(focus).toHaveBeenCalledOnce();
  });

  it("moves relative to camera orientation and reduces speed after sustained load", () => {
    harness.storeState = {};
    const cameraState = {
      transform: {
        position: [0, 0, 0],
        target: [0, 0, -1],
        up: [0, 1, 0],
      },
    };
    const manager = {
      getCamera: vi.fn().mockReturnValue(cameraState),
      applyControl: vi.fn(),
    };
    PlayerContent({
      cameraManager: manager as never,
      cameraId: "main",
    });

    manager.getCamera.mockReturnValueOnce(undefined);
    dispatch("keydown", "w");
    expect(manager.applyControl).not.toHaveBeenCalled();

    dispatch("keydown", "w");
    const firstForward = manager.applyControl.mock.calls.at(-1)?.[1];
    expect(firstForward).toMatchObject({
      type: "set-look-at",
    });
    expect(firstForward.position[0]).toBe(0);
    expect(firstForward.position[1]).toBe(0);
    expect(firstForward.position[2]).toBeLessThan(-1);

    clock = 5000;
    rafCallback?.();
    dispatch("keydown", "w");
    const fatiguedForward = manager.applyControl.mock.calls.at(-1)?.[1];
    expect(Math.abs(fatiguedForward.position[2])).toBeLessThan(
      Math.abs(firstForward.position[2])
    );

    for (const key of ["s", "a", "d", "q", "e", "x"]) {
      dispatch("keydown", key);
    }
    expect(
      manager.applyControl.mock.calls.map(([, control]) => control.type)
    ).toEqual(
      expect.arrayContaining([
        "set-look-at",
      ])
    );
    expect(manager.applyControl).toHaveBeenCalledWith(
      "main",
      expect.objectContaining({
        position: expect.arrayContaining([expect.any(Number)]),
      }),
      { makeActive: true }
    );

    for (const key of ["w", "s", "a", "d", "q", "e", "x"]) {
      dispatch("keyup", key);
    }
    clock = 10_000;
    rafCallback?.();
  });

  it("uses stable fallback vectors for degenerate camera transforms", () => {
    const manager = {
      getCamera: vi.fn().mockReturnValue({
        transform: {
          position: [1, 1, 1],
          target: [1, 1, 1],
          up: [0, 0, 0],
        },
      }),
      applyControl: vi.fn(),
    };
    PlayerContent({
      cameraManager: manager as never,
      cameraId: "fallback",
    });
    dispatch("keydown", "d");

    const control = manager.applyControl.mock.calls[0][1];
    expect(control.position.every(Number.isFinite)).toBe(true);
    expect(control.target.every(Number.isFinite)).toBe(true);
  });

  it("wraps player content in its scoped provider and removes listeners on cleanup", () => {
    const manager = {
      getCamera: vi.fn(),
      applyControl: vi.fn(),
    };
    const wrapped = Player({
      cameraManager: manager as never,
      cameraId: "main",
      children: "child",
    });

    expect(wrapped.props.children.type).toBe(PlayerContent);
    PlayerContent({
      cameraManager: manager as never,
      cameraId: "main",
    });
    expect(listeners.get("keydown")?.size).toBe(1);
    for (const cleanup of harness.cleanups.splice(0)) {
      cleanup();
    }
    expect(listeners.get("keydown")?.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
