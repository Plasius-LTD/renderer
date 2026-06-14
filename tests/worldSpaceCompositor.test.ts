import { describe, expect, it } from "vitest";
import * as rendererExports from "../src/index.js";
import {
  composeWorldSpaceSurfaces,
  resolveWorldSpaceOcclusionPolicy,
  resolveWorldSpaceRenderOrder,
} from "../src/worldSpaceCompositor.js";

describe("world-space compositor", () => {
  it("re-exports compositor helpers from the package entrypoint", () => {
    expect(rendererExports.composeWorldSpaceSurfaces).toBe(
      composeWorldSpaceSurfaces
    );
    expect(rendererExports.resolveWorldSpaceOcclusionPolicy).toBe(
      resolveWorldSpaceOcclusionPolicy
    );
  });

  it("resolves overlay and alert occlusion policies", () => {
    expect(resolveWorldSpaceOcclusionPolicy("overlay")).toMatchObject({
      mode: "overlay",
      depthTest: true,
      depthWrite: false,
      fadeWhenOccluded: true,
      renderOrderOffset: 10,
    });

    expect(resolveWorldSpaceOcclusionPolicy("always-visible")).toMatchObject({
      mode: "always-visible",
      depthTest: false,
      depthWrite: false,
      fadeWhenOccluded: false,
      renderOrderOffset: 20,
    });
  });

  it("assigns deterministic render order by slot, layer, and priority", () => {
    const slotOrder = ["reticle", "target"];
    const screenOrder = resolveWorldSpaceRenderOrder(
      {
        id: "focus-pane",
        slot: "reticle",
        layer: "screen",
        priority: 0,
      },
      {
        slotOrder,
        slotIndex: 0,
      }
    );
    const overlayOrder = resolveWorldSpaceRenderOrder(
      {
        id: "mana-ring",
        slot: "reticle",
        layer: "overlay",
        priority: 1,
      },
      {
        slotOrder,
        slotIndex: 0,
      }
    );
    const alertOrder = resolveWorldSpaceRenderOrder(
      {
        id: "threat-warning",
        slot: "target",
        layer: "alert",
      },
      {
        slotOrder,
        slotIndex: 1,
      }
    );

    expect(screenOrder).toBe(1100);
    expect(overlayOrder).toBe(1220);
    expect(alertOrder).toBe(2320);
  });

  it("derives slot order for direct render-order callers", () => {
    const slotOrder = ["reticle", "target"];
    const targetOrder = resolveWorldSpaceRenderOrder(
      {
        id: "target-overlay",
        slot: "target",
        layer: "overlay",
      },
      {
        slotOrder,
      }
    );

    expect(targetOrder).toBe(2210);
  });

  it("sorts surfaces and reports exclusive screen-slot collisions", () => {
    const { surfaces, collisions } = composeWorldSpaceSurfaces(
      [
        {
          id: "mission-summary",
          slot: "reticle",
          layer: "screen",
        },
        {
          id: "party-ledger",
          slot: "reticle",
          layer: "screen",
        },
        {
          id: "near-death-alert",
          slot: "reticle",
          layer: "alert",
        },
        {
          id: "poi-prompt",
          slot: "target",
          layer: "overlay",
          priority: 2,
        },
      ],
      {
        slotOrder: ["reticle", "target"],
      }
    );

    expect(surfaces.map((surface) => surface.id)).toEqual([
      "mission-summary",
      "party-ledger",
      "near-death-alert",
      "poi-prompt",
    ]);
    expect(collisions).toEqual([
      {
        slot: "reticle",
        surfaceIds: ["mission-summary", "party-ledger"],
        reason: "exclusive-slot-conflict",
      },
    ]);
  });

  it("inherits non-exclusive defaults for overlays and default occlusion by layer", () => {
    const { surfaces, collisions } = composeWorldSpaceSurfaces([
      {
        id: "party-tracker",
        slot: "peripheral",
        layer: "overlay",
      },
      {
        id: "mana-warning",
        slot: "peripheral",
        layer: "alert",
      },
    ]);

    expect(collisions).toEqual([]);
    expect(surfaces).toMatchObject([
      {
        id: "party-tracker",
        exclusiveSlot: false,
        occlusionMode: "overlay",
      },
      {
        id: "mana-warning",
        exclusiveSlot: false,
        occlusionMode: "always-visible",
      },
    ]);
  });
});
