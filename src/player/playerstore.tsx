import React from "react";
import { createScopedStoreContext } from "@plasius/react-state";

/**
 * PlayerStore — React Scoped Store for player state (position, stats, inventory, equipment, skills, effects)
 * No external deps. Strongly typed. Designed to be colocated with the renderer/game.
 */

// ====== Basic Types ======
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type AttributeKey =
  // Physical
  | "strength"
  | "dexterity"
  | "endurance"
  // Mental
  | "intellect"
  | "willpower"
  | "creativity"
  // Spiritual
  | "spirit"
  | "wisdom"
  | "charisma";

// Triangular domain types
export interface PhysicalAttributes {
  strength: number;
  dexterity: number;
  endurance: number;
}
export interface MentalAttributes {
  intellect: number;
  willpower: number;
  creativity: number;
}
export interface SpiritualAttributes {
  spirit: number;
  wisdom: number;
  charisma: number;
}

// Base layer (earned): each triangle must sum to 99, each attr in [1,49]
export interface AttributesBase {
  physical: PhysicalAttributes;
  mental: MentalAttributes;
  spiritual: SpiritualAttributes;
}

// Optional additive layers (gear/effects): same shape as flat; values can be +/-
export interface AttributesFlat {
  strength: number;
  dexterity: number;
  endurance: number;
  intellect: number;
  willpower: number;
  creativity: number;
  spirit: number;
  wisdom: number;
  charisma: number;
}

export interface Resources {
  health: number; // current
  healthMax: number;
  energy: number; // e.g., stamina/energy/mana — name-agnostic, customize later
  energyMax: number;
}

export interface Item {
  id: string; // stable id (instance or template id depending on your pipeline)
  name: string;
  kind:
    | "consumable"
    | "weapon"
    | "armor"
    | "trinket"
    | "material"
    | "quest"
    | "misc";
  weight?: number; // carry weight contribution
  stackable?: boolean; // can the same id stack?
  maxStack?: number; // upper bound if stackable (default 99)
  tags?: string[]; // arbitrary tags for filtering/rules
  // Attribute modifiers applied when equipped (or when consumed if consumable)
  modifiers?: Partial<Record<AttributeKey, number>>;
}

export interface InventorySlot {
  itemId: string; // references Item.id
  qty: number;
}

export type EquipmentSlot =
  | "head"
  | "chest"
  | "legs"
  | "hands"
  | "feet"
  | "weapon"
  | "offhand"
  | "back"
  | "ring1"
  | "ring2"
  | "amulet";

export type Equipment = Partial<Record<EquipmentSlot, string /* itemId */>>;

export interface Skill {
  id: string;
  name: string;
  level: number; // proficiency 0–100 (used by ln scaling)
  active?: boolean; // whether the skill is currently active (toggles penalties/bonuses)
  source?: "innate" | "taught" | "researched"; // acquisition path (optional)
  tags?: string[]; // e.g., ["rare", "forbidden", "movement"]
  cooldownMs?: number;
  resourceCost?: number; // cost from energy/mana etc.
}

export interface StatusEffectModifier {
  attributes?: Partial<Record<AttributeKey, number>>; // additive modifiers
  resources?: Partial<Pick<Resources, "healthMax" | "energyMax">>;
  moveSpeedMult?: number; // multiplicative e.g. 0.9 = -10%
  damageMult?: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  appliedAt: number; // epoch ms
  durationMs: number; // 0 = infinite
  modifiers?: StatusEffectModifier;
}

// ====== Player State ======
export interface PlayerState {
  // Transform
  position: Vec3;
  lookAt: Vec3;
  velocity: Vec3;

  // Core
  attributesBase: AttributesBase; // earned, triangle-constrained
  attributesGear: AttributesFlat; // from equipment totals (additive)
  attributesEffects: AttributesFlat; // from active effects (additive)
  resources: Resources;
  lastActiveAt?: number; // epoch ms for decay logic

  // Equipment/Inventory
  items: Record<string, Item>; // item registry (by id). Up to the game to hydrate
  inventory: InventorySlot[]; // backpack list
  inventoryCapacity: number; // max slots
  equipment: Equipment; // slot -> itemId

  // Skills/Effects
  skills: Record<string, Skill>;
  effects: Record<string, StatusEffect>;
}

export const defaultAttributesBase: AttributesBase = {
  physical: { strength: 33, dexterity: 33, endurance: 33 },
  mental: { intellect: 33, willpower: 33, creativity: 33 },
  spiritual: { spirit: 33, wisdom: 33, charisma: 33 },
};

export const zeroFlat: AttributesFlat = {
  strength: 0,
  dexterity: 0,
  endurance: 0,
  intellect: 0,
  willpower: 0,
  creativity: 0,
  spirit: 0,
  wisdom: 0,
  charisma: 0,
};

export const defaultState: PlayerState = {
  position: { x: 0, y: 1.6, z: 0 },
  lookAt: { x: 0, y: 1.6, z: -1 },
  velocity: { x: 0, y: 0, z: 0 },
  attributesBase: { ...defaultAttributesBase },
  attributesGear: { ...zeroFlat },
  attributesEffects: { ...zeroFlat },
  resources: { health: 100, healthMax: 100, energy: 100, energyMax: 100 },
  items: {},
  inventory: [],
  inventoryCapacity: 24,
  equipment: {},
  skills: {},
  effects: {},
  lastActiveAt: undefined,
};

// ====== Actions ======
export type PlayerAction =
  | { type: "set_position"; payload: Vec3 }
  | { type: "set_look_at"; payload: Vec3 }
  | { type: "set_velocity"; payload: Vec3 }
  | { type: "learn_skill"; payload: Skill }
  | { type: "set_skill_active"; payload: { id: string; active: boolean } }
  | { type: "set_skill_level"; payload: { id: string; level: number } }
  | { type: "forget_skill"; payload: { id: string } }
  | { type: "apply_effect"; payload: StatusEffect }
  | { type: "remove_effect"; payload: { id: string } }
  | { type: "register_item"; payload: Item }
  | { type: "add_item"; payload: { itemId: string; qty: number } }
  | { type: "remove_item"; payload: { itemId: string; qty: number } }
  | { type: "equip"; payload: { slot: EquipmentSlot; itemId: string } }
  | { type: "unequip"; payload: { slot: EquipmentSlot } }
  | { type: "set_resource"; payload: Partial<Resources> }
  | {
      type: "set_attributes_base";
      payload: Partial<Record<AttributeKey, number>>;
    }
  | {
      type: "set_attributes_gear";
      payload: Partial<Record<AttributeKey, number>>;
    }
  | {
      type: "set_attributes_effects";
      payload: Partial<Record<AttributeKey, number>>;
    };

// ====== Helpers ======
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function stackableCount(item: Item | undefined): number {
  if (!item) return 1;
  if (!item.stackable) return 1;
  return item.maxStack ?? 99;
}

function addToInventory(
  state: PlayerState,
  itemId: string,
  qty: number
): PlayerState {
  if (qty <= 0) return state;
  const item = state.items[itemId];
  const maxStack = stackableCount(item);
  let remaining = qty;

  // Fill existing stacks first
  const inv = state.inventory.map((slot) => {
    if (remaining === 0) return slot;
    if (slot.itemId !== itemId) return slot;
    const space = maxStack - slot.qty;
    if (space <= 0) return slot;
    const add = Math.min(space, remaining);
    remaining -= add;
    return { ...slot, qty: slot.qty + add };
  });

  // Create new stacks while capacity allows
  const result = [...inv];
  while (remaining > 0 && result.length < state.inventoryCapacity) {
    const add = Math.min(remaining, maxStack);
    result.push({ itemId, qty: add });
    remaining -= add;
  }

  return { ...state, inventory: result };
}

function removeFromInventory(
  state: PlayerState,
  itemId: string,
  qty: number
): PlayerState {
  if (qty <= 0) return state;
  let remaining = qty;
  const result: InventorySlot[] = [];
  for (const slot of state.inventory) {
    if (slot.itemId !== itemId) {
      result.push(slot);
      continue;
    }
    if (remaining === 0) {
      result.push(slot);
      continue;
    }
    if (slot.qty > remaining) {
      result.push({ itemId, qty: slot.qty - remaining });
      remaining = 0;
    } else {
      remaining -= slot.qty; // drop this slot
    }
  }
  return { ...state, inventory: result };
}

function clampAttr(n: number) {
  return Math.max(1, Math.min(49, Math.round(n)));
}
function sum3(a: number, b: number, c: number) {
  return a + b + c;
}
function normalizeTriangle(a: number, b: number, c: number) {
  // Ensure sum=99 and each in [1,49]
  let x = clampAttr(a),
    y = clampAttr(b),
    z = clampAttr(c);
  let total = x + y + z;
  if (total === 99) return [x, y, z] as const;
  // Scale to 99, then clamp again, then adjust leftovers greedily
  const scale = 99 / total;
  x = clampAttr(x * scale);
  y = clampAttr(y * scale);
  z = clampAttr(z * scale);
  total = x + y + z;
  // Distribute deficit/excess (typed tuples + stable resorting)
  let order: Array<["x" | "y" | "z", number]> = [
    ["x", x] as ["x", number],
    ["y", y] as ["y", number],
    ["z", z] as ["z", number],
  ];
  const sortDesc = () => {
    order.sort((a, b) => b[1] - a[1]);
  };
  sortDesc();

  while (total !== 99) {
    if (total > 99) {
      // reduce the largest above 1
      for (const [k, v] of order) {
        if (v > 1) {
          if (k === "x") x--;
          else if (k === "y") y--;
          else z--;
          total--;
          // update order values and resort
          if (k === "x") order[0][1] = x;
          else if (k === "y") order[1][1] = y;
          else order[2][1] = z;
          sortDesc();
          break;
        }
      }
    } else {
      // increase the smallest below 49
      for (const [k, v] of [...order].reverse()) {
        if (v < 49) {
          if (k === "x") x++;
          else if (k === "y") y++;
          else z++;
          total++;
          // update order values and resort
          if (k === "x") order[0][1] = x;
          else if (k === "y") order[1][1] = y;
          else order[2][1] = z;
          sortDesc();
          break;
        }
      }
    }
  }
  return [x, y, z] as const;
}

function flattenBase(base: AttributesBase): AttributesFlat {
  const [S, D, E] = normalizeTriangle(
    base.physical.strength,
    base.physical.dexterity,
    base.physical.endurance
  );
  const [I, W, C] = normalizeTriangle(
    base.mental.intellect,
    base.mental.willpower,
    base.mental.creativity
  );
  const [Sp, Wi, Ch] = normalizeTriangle(
    base.spiritual.spirit,
    base.spiritual.wisdom,
    base.spiritual.charisma
  );
  return {
    strength: S,
    dexterity: D,
    endurance: E,
    intellect: I,
    willpower: W,
    creativity: C,
    spirit: Sp,
    wisdom: Wi,
    charisma: Ch,
  };
}

// === Skill-side cross-triangle modifiers ===
function lnContribution(x: number, s = 25) {
  return Math.log(1 + Math.max(0, x) / s); // safe-guard
}

function emptyFlat(): AttributesFlat {
  return {
    strength: 0,
    dexterity: 0,
    endurance: 0,
    intellect: 0,
    willpower: 0,
    creativity: 0,
    spirit: 0,
    wisdom: 0,
    charisma: 0,
  };
}

// Map rare/hidden skills to cross-triangle penalties (and potential future bonuses) using ln scaling
// Data-driven skill → attribute modifier map (multiplier per ln unit)
const SKILL_ATTR_MODS: Record<string, Partial<Record<AttributeKey, number>>> = {
  shadowstep: { charisma: -2.0 },
  dreamwalking: { wisdom: -1.0, charisma: -1.0 },
  soulbinding: { creativity: -1.5, endurance: -1.5 },
  chronomancy: { endurance: -1.5, spirit: -0.5 },
  astral_projection: { strength: -1.0, endurance: -1.0 },
  bloodcraft: { charisma: -2.0, spirit: -2.0 },
  telepathy: { charisma: -0.5, wisdom: -0.5 },
  telekinesis: { endurance: -0.5 },
  possession: { spirit: -2.5, charisma: -2.5 },
};

function addFlatInto(dst: AttributesFlat, src: AttributesFlat) {
  dst.strength += src.strength;
  dst.dexterity += src.dexterity;
  dst.endurance += src.endurance;
  dst.intellect += src.intellect;
  dst.willpower += src.willpower;
  dst.creativity += src.creativity;
  dst.spirit += src.spirit;
  dst.wisdom += src.wisdom;
  dst.charisma += src.charisma;
}

function skillAttributeModifiers(state: PlayerState): AttributesFlat {
  const out = emptyFlat();
  for (const s of Object.values(state.skills)) {
    if (!s || !(s.active ?? false) || (s.level ?? 0) <= 0) continue;
    const lnP = lnContribution(s.level ?? 0, 25);
    const mods = SKILL_ATTR_MODS[s.id.toLowerCase()];
    if (!mods) continue;
    for (const [k, mult] of Object.entries(mods)) {
      const key = k as AttributeKey;
      const delta = Math.trunc((mult as number) * lnP);
      (out as any)[key] = ((out as any)[key] ?? 0) + delta;
    }
  }
  return out;
}

function effectiveAttributes(state: PlayerState): AttributesFlat {
  // Start with normalized base
  const base = flattenBase(state.attributesBase);
  // Add gear/effects layers
  const eff: AttributesFlat = { ...base };
  const addFlat = (src: AttributesFlat) => {
    eff.strength += src.strength;
    eff.dexterity += src.dexterity;
    eff.endurance += src.endurance;
    eff.intellect += src.intellect;
    eff.willpower += src.willpower;
    eff.creativity += src.creativity;
    eff.spirit += src.spirit;
    eff.wisdom += src.wisdom;
    eff.charisma += src.charisma;
  };
  addFlat(state.attributesGear);
  addFlat(state.attributesEffects);

  // Add equipment modifiers
  for (const slot of Object.keys(state.equipment) as EquipmentSlot[]) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const item = state.items[itemId];
    if (item?.modifiers) {
      for (const [k, v] of Object.entries(item.modifiers)) {
        const key = k as AttributeKey;
        const val = v ?? 0;
        (eff as any)[key] = ((eff as any)[key] ?? 0) + val;
      }
    }
  }
  // Add status effects
  for (const effx of Object.values(state.effects)) {
    const mods = effx.modifiers?.attributes;
    if (!mods) continue;
    for (const [k, v] of Object.entries(mods)) {
      const key = k as AttributeKey;
      const val = v ?? 0;
      (eff as any)[key] = ((eff as any)[key] ?? 0) + val;
    }
  }
  // Apply cross-triangle penalties/bonuses derived from active skills (rare/hidden)
  const skillMods = skillAttributeModifiers(state);
  addFlatInto(eff, skillMods);
  return eff;
}

// ====== Reducer ======
function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "set_position":
      return { ...state, position: { ...action.payload } };
    case "set_look_at":
      return { ...state, lookAt: { ...action.payload } };
    case "set_velocity":
      return { ...state, velocity: { ...action.payload } };

    case "set_resource": {
      const next: Resources = { ...state.resources, ...action.payload };
      next.health = clamp(next.health, 0, next.healthMax);
      next.energy = clamp(next.energy, 0, next.energyMax);
      return { ...state, resources: next };
    }
    case "set_attributes_base": {
      const next = { ...state.attributesBase };
      const apply = (k: AttributeKey, v: number) => {
        switch (k) {
          case "strength":
            next.physical.strength = v;
            break;
          case "dexterity":
            next.physical.dexterity = v;
            break;
          case "endurance":
            next.physical.endurance = v;
            break;
          case "intellect":
            next.mental.intellect = v;
            break;
          case "willpower":
            next.mental.willpower = v;
            break;
          case "creativity":
            next.mental.creativity = v;
            break;
          case "spirit":
            next.spiritual.spirit = v;
            break;
          case "wisdom":
            next.spiritual.wisdom = v;
            break;
          case "charisma":
            next.spiritual.charisma = v;
            break;
        }
      };
      for (const [k, v] of Object.entries(action.payload))
        apply(k as AttributeKey, clampAttr(v as number));
      return { ...state, attributesBase: next };
    }
    case "set_attributes_gear": {
      const next: AttributesFlat = {
        ...state.attributesGear,
      } as AttributesFlat;
      for (const [k, v] of Object.entries(action.payload))
        (next as any)[k] = ((next as any)[k] ?? 0) + (v as number);
      return { ...state, attributesGear: next };
    }
    case "set_attributes_effects": {
      const next: AttributesFlat = {
        ...state.attributesEffects,
      } as AttributesFlat;
      for (const [k, v] of Object.entries(action.payload))
        (next as any)[k] = ((next as any)[k] ?? 0) + (v as number);
      return { ...state, attributesEffects: next };
    }

    case "register_item": {
      const it = action.payload;
      return { ...state, items: { ...state.items, [it.id]: it } };
    }
    case "add_item":
      return addToInventory(state, action.payload.itemId, action.payload.qty);
    case "remove_item":
      return removeFromInventory(
        state,
        action.payload.itemId,
        action.payload.qty
      );

    case "equip": {
      const { slot, itemId } = action.payload;
      // Ensure we have the item and it exists in inventory or is otherwise obtainable
      if (!state.items[itemId]) return state;
      return { ...state, equipment: { ...state.equipment, [slot]: itemId } };
    }
    case "unequip": {
      const { slot } = action.payload;
      const eq = { ...state.equipment };
      delete eq[slot];
      return { ...state, equipment: eq };
    }

    case "learn_skill": {
      const s = action.payload;
      return { ...state, skills: { ...state.skills, [s.id]: s } };
    }

    case "set_skill_active": {
      const { id, active } = action.payload;
      const prev = state.skills[id];
      if (!prev) return state;
      return {
        ...state,
        skills: { ...state.skills, [id]: { ...prev, active } },
      };
    }

    case "set_skill_level": {
      const { id, level } = action.payload;
      const prev = state.skills[id];
      if (!prev) return state;
      return {
        ...state,
        skills: {
          ...state.skills,
          [id]: {
            ...prev,
            level: Math.max(0, Math.min(100, Math.round(level))),
          },
        },
      };
    }

    case "forget_skill": {
      const { id } = action.payload;
      const next = { ...state.skills };
      delete next[id];
      return { ...state, skills: next };
    }

    case "apply_effect": {
      const e = action.payload;
      return { ...state, effects: { ...state.effects, [e.id]: e } };
    }
    case "remove_effect": {
      const { id } = action.payload;
      const next = { ...state.effects };
      delete next[id];
      return { ...state, effects: next };
    }

    default:
      return state;
  }
}

// ====== Scoped Store Wiring (using shared react-state) ======
export type PlayerStoreContext = ReturnType<
  typeof createScopedStoreContext<PlayerState, PlayerAction>
>;

export const PlayerStore: PlayerStoreContext =
  createScopedStoreContext<PlayerState, PlayerAction>(reducer, defaultState);

// Convenience re-exports for common actions (keeps call sites tidy)
export const PlayerActions = {
  setPosition: (payload: Vec3): PlayerAction => ({
    type: "set_position",
    payload,
  }),
  setLookAt: (payload: Vec3): PlayerAction => ({
    type: "set_look_at",
    payload,
  }),
  setVelocity: (payload: Vec3): PlayerAction => ({
    type: "set_velocity",
    payload,
  }),
  setResource: (payload: Partial<Resources>): PlayerAction => ({
    type: "set_resource",
    payload,
  }),
  setAttributesBase: (
    payload: Partial<Record<AttributeKey, number>>
  ): PlayerAction => ({ type: "set_attributes_base", payload }),
  setAttributesGear: (
    payload: Partial<Record<AttributeKey, number>>
  ): PlayerAction => ({ type: "set_attributes_gear", payload }),
  setAttributesEffects: (
    payload: Partial<Record<AttributeKey, number>>
  ): PlayerAction => ({ type: "set_attributes_effects", payload }),
  registerItem: (payload: Item): PlayerAction => ({
    type: "register_item",
    payload,
  }),
  addItem: (itemId: string, qty: number): PlayerAction => ({
    type: "add_item",
    payload: { itemId, qty },
  }),
  removeItem: (itemId: string, qty: number): PlayerAction => ({
    type: "remove_item",
    payload: { itemId, qty },
  }),
  equip: (slot: EquipmentSlot, itemId: string): PlayerAction => ({
    type: "equip",
    payload: { slot, itemId },
  }),
  unequip: (slot: EquipmentSlot): PlayerAction => ({
    type: "unequip",
    payload: { slot },
  }),
  learnSkill: (payload: Skill): PlayerAction => ({
    type: "learn_skill",
    payload,
  }),
  setSkillActive: (id: string, active: boolean): PlayerAction => ({
    type: "set_skill_active",
    payload: { id, active },
  }),
  setSkillLevel: (id: string, level: number): PlayerAction => ({
    type: "set_skill_level",
    payload: { id, level },
  }),
  forgetSkill: (id: string): PlayerAction => ({
    type: "forget_skill",
    payload: { id },
  }),
  applyEffect: (payload: StatusEffect): PlayerAction => ({
    type: "apply_effect",
    payload,
  }),
  removeEffect: (id: string): PlayerAction => ({
    type: "remove_effect",
    payload: { id },
  }),
} as const;
