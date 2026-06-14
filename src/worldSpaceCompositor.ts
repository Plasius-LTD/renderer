export const WORLD_SPACE_SURFACE_LAYERS = [
  "screen",
  "overlay",
  "alert",
] as const;

export type WorldSpaceSurfaceLayer =
  (typeof WORLD_SPACE_SURFACE_LAYERS)[number];

export const WORLD_SPACE_OCCLUSION_MODES = [
  "world",
  "overlay",
  "always-visible",
] as const;

export type WorldSpaceOcclusionMode =
  (typeof WORLD_SPACE_OCCLUSION_MODES)[number];

export interface WorldSpaceOcclusionPolicy {
  mode: WorldSpaceOcclusionMode;
  depthTest: boolean;
  depthWrite: boolean;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  renderOrderOffset: number;
  fadeWhenOccluded: boolean;
}

export interface WorldSpaceSurfaceInput {
  id: string;
  slot: string;
  layer: WorldSpaceSurfaceLayer;
  priority?: number;
  occlusionMode?: WorldSpaceOcclusionMode;
  exclusiveSlot?: boolean;
}

export interface ComposedWorldSpaceSurface extends WorldSpaceSurfaceInput {
  exclusiveSlot: boolean;
  occlusionMode: WorldSpaceOcclusionMode;
  occlusionPolicy: WorldSpaceOcclusionPolicy;
  renderOrder: number;
  slotIndex: number;
}

export interface WorldSpaceCompositionCollision {
  slot: string;
  surfaceIds: string[];
  reason: "exclusive-slot-conflict";
}

export interface WorldSpaceCompositionResult {
  surfaces: ComposedWorldSpaceSurface[];
  collisions: WorldSpaceCompositionCollision[];
}

export interface WorldSpaceCompositionOptions {
  slotOrder?: string[];
  startingRenderOrder?: number;
  slotStep?: number;
  priorityStep?: number;
}

const DEFAULT_LAYER_CONFIG: Record<
  WorldSpaceSurfaceLayer,
  {
    baseRenderOrder: number;
    defaultOcclusionMode: WorldSpaceOcclusionMode;
    exclusiveSlot: boolean;
  }
> = {
  screen: {
    baseRenderOrder: 100,
    defaultOcclusionMode: "world",
    exclusiveSlot: true,
  },
  overlay: {
    baseRenderOrder: 200,
    defaultOcclusionMode: "overlay",
    exclusiveSlot: false,
  },
  alert: {
    baseRenderOrder: 300,
    defaultOcclusionMode: "always-visible",
    exclusiveSlot: false,
  },
};

const OCCLUSION_POLICIES: Record<
  WorldSpaceOcclusionMode,
  WorldSpaceOcclusionPolicy
> = {
  world: {
    mode: "world",
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    renderOrderOffset: 0,
    fadeWhenOccluded: false,
  },
  overlay: {
    mode: "overlay",
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    renderOrderOffset: 10,
    fadeWhenOccluded: true,
  },
  "always-visible": {
    mode: "always-visible",
    depthTest: false,
    depthWrite: false,
    polygonOffset: false,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
    renderOrderOffset: 20,
    fadeWhenOccluded: false,
  },
};

function normalizePriority(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.trunc(value as number);
}

function resolveSlotIndex(
  slot: string,
  options: WorldSpaceCompositionOptions & { slotIndex?: number }
): number {
  if (typeof options.slotIndex === "number") {
    return options.slotIndex;
  }

  const preferredSlotOrder = options.slotOrder ?? [];
  const preferredIndex = preferredSlotOrder.indexOf(slot);

  if (preferredIndex >= 0) {
    return preferredIndex;
  }

  return 0;
}

function buildSlotIndexMap(
  surfaces: readonly WorldSpaceSurfaceInput[],
  preferredSlotOrder: readonly string[]
): Map<string, number> {
  const slotIndexes = new Map<string, number>();
  let nextIndex = 0;

  for (const slot of preferredSlotOrder) {
    if (!slotIndexes.has(slot)) {
      slotIndexes.set(slot, nextIndex);
      nextIndex += 1;
    }
  }

  for (const surface of surfaces) {
    if (!slotIndexes.has(surface.slot)) {
      slotIndexes.set(surface.slot, nextIndex);
      nextIndex += 1;
    }
  }

  return slotIndexes;
}

export function resolveWorldSpaceOcclusionPolicy(
  mode: WorldSpaceOcclusionMode
): WorldSpaceOcclusionPolicy {
  return { ...OCCLUSION_POLICIES[mode] };
}

export function resolveWorldSpaceRenderOrder(
  surface: WorldSpaceSurfaceInput,
  options: WorldSpaceCompositionOptions & { slotIndex?: number } = {}
): number {
  const layerConfig = DEFAULT_LAYER_CONFIG[surface.layer];
  const occlusionMode =
    surface.occlusionMode ?? layerConfig.defaultOcclusionMode;
  const policy = OCCLUSION_POLICIES[occlusionMode];
  const slotIndex = resolveSlotIndex(surface.slot, options);
  const startingRenderOrder = options.startingRenderOrder ?? 1000;
  const slotStep = options.slotStep ?? 1000;
  const priorityStep = options.priorityStep ?? 10;

  return (
    startingRenderOrder +
    slotIndex * slotStep +
    layerConfig.baseRenderOrder +
    normalizePriority(surface.priority) * priorityStep +
    policy.renderOrderOffset
  );
}

export function composeWorldSpaceSurfaces(
  surfaces: readonly WorldSpaceSurfaceInput[],
  options: WorldSpaceCompositionOptions = {}
): WorldSpaceCompositionResult {
  const slotIndexes = buildSlotIndexMap(surfaces, options.slotOrder ?? []);

  const composedSurfaces = surfaces
    .map<ComposedWorldSpaceSurface>((surface) => {
      const layerConfig = DEFAULT_LAYER_CONFIG[surface.layer];
      const occlusionMode =
        surface.occlusionMode ?? layerConfig.defaultOcclusionMode;
      const slotIndex = slotIndexes.get(surface.slot) ?? 0;

      return {
        ...surface,
        exclusiveSlot: surface.exclusiveSlot ?? layerConfig.exclusiveSlot,
        occlusionMode,
        occlusionPolicy: resolveWorldSpaceOcclusionPolicy(occlusionMode),
        renderOrder: resolveWorldSpaceRenderOrder(surface, {
          ...options,
          slotIndex,
        }),
        slotIndex,
      };
    })
    .sort((left, right) => {
      if (left.renderOrder !== right.renderOrder) {
        return left.renderOrder - right.renderOrder;
      }

      return left.id.localeCompare(right.id);
    });

  const exclusiveSurfaceIdsBySlot = new Map<string, string[]>();

  for (const surface of composedSurfaces) {
    if (!surface.exclusiveSlot) {
      continue;
    }

    const slotEntries = exclusiveSurfaceIdsBySlot.get(surface.slot) ?? [];
    slotEntries.push(surface.id);
    exclusiveSurfaceIdsBySlot.set(surface.slot, slotEntries);
  }

  const collisions: WorldSpaceCompositionCollision[] = [];

  for (const [slot, surfaceIds] of exclusiveSurfaceIdsBySlot) {
    if (surfaceIds.length > 1) {
      collisions.push({
        slot,
        surfaceIds,
        reason: "exclusive-slot-conflict",
      });
    }
  }

  return {
    surfaces: composedSurfaces,
    collisions,
  };
}
