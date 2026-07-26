import { describe, expect, it } from "vitest";
import {
  PlayerActions,
  defaultState,
  reducePlayerState,
  selectEffectiveAttributes,
  type PlayerAction,
  type PlayerState,
} from "../src/player/playerstore.js";

function state(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    ...structuredClone(defaultState),
    ...overrides,
  };
}

describe("player state requirements", () => {
  it("updates transform and clamps resources to their resulting bounds", () => {
    let current = state();
    current = reducePlayerState(
      current,
      PlayerActions.setPosition({ x: 1, y: 2, z: 3 })
    );
    current = reducePlayerState(
      current,
      PlayerActions.setLookAt({ x: 4, y: 5, z: 6 })
    );
    current = reducePlayerState(
      current,
      PlayerActions.setVelocity({ x: -1, y: 0, z: 1 })
    );
    current = reducePlayerState(
      current,
      PlayerActions.setResource({
        health: 999,
        healthMax: 80,
        energy: -10,
        energyMax: 50,
      })
    );

    expect(current.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(current.lookAt).toEqual({ x: 4, y: 5, z: 6 });
    expect(current.velocity).toEqual({ x: -1, y: 0, z: 1 });
    expect(current.resources).toEqual({
      health: 80,
      healthMax: 80,
      energy: 0,
      energyMax: 50,
    });
  });

  it("clamps every base attribute and accumulates gear and effect layers", () => {
    const previous = state();
    let current = reducePlayerState(
      previous,
      PlayerActions.setAttributesBase({
        strength: 100,
        dexterity: 0,
        endurance: 12.4,
        intellect: 48.6,
        willpower: 20.2,
        creativity: 30.8,
        spirit: 22.2,
        wisdom: 33.3,
        charisma: 44.4,
      })
    );
    current = reducePlayerState(
      current,
      PlayerActions.setAttributesGear({ strength: 3, wisdom: -2 })
    );
    current = reducePlayerState(
      current,
      PlayerActions.setAttributesEffects({ strength: -1, wisdom: 4 })
    );

    expect(current.attributesBase).toEqual({
      physical: { strength: 49, dexterity: 1, endurance: 12 },
      mental: { intellect: 49, willpower: 20, creativity: 31 },
      spiritual: { spirit: 22, wisdom: 33, charisma: 44 },
    });
    expect(current.attributesGear.strength).toBe(3);
    expect(current.attributesGear.wisdom).toBe(-2);
    expect(current.attributesEffects.strength).toBe(-1);
    expect(current.attributesEffects.wisdom).toBe(4);
    expect(previous.attributesBase).toEqual(defaultState.attributesBase);
  });

  it("fills stacks first, respects capacity, and removes quantities deterministically", () => {
    const potion = {
      id: "potion",
      name: "Potion",
      kind: "consumable" as const,
      stackable: true,
      maxStack: 5,
    };
    const sword = {
      id: "sword",
      name: "Sword",
      kind: "weapon" as const,
    };

    let current = state({ inventoryCapacity: 4 });
    current = reducePlayerState(current, PlayerActions.registerItem(potion));
    current = reducePlayerState(current, PlayerActions.registerItem(sword));
    current = reducePlayerState(current, PlayerActions.addItem("potion", 7));
    current = reducePlayerState(current, PlayerActions.addItem("potion", 4));
    current = reducePlayerState(current, PlayerActions.addItem("sword", 2));
    current = reducePlayerState(current, PlayerActions.addItem("unknown", 3));

    expect(current.inventory).toEqual([
      { itemId: "potion", qty: 5 },
      { itemId: "potion", qty: 5 },
      { itemId: "potion", qty: 1 },
      { itemId: "sword", qty: 1 },
    ]);

    const unchanged = reducePlayerState(
      current,
      PlayerActions.addItem("potion", 0)
    );
    expect(unchanged).toBe(current);

    current = reducePlayerState(current, PlayerActions.removeItem("potion", 6));
    expect(current.inventory).toEqual([
      { itemId: "potion", qty: 4 },
      { itemId: "potion", qty: 1 },
      { itemId: "sword", qty: 1 },
    ]);
    current = reducePlayerState(current, PlayerActions.removeItem("potion", 1));
    expect(current.inventory).toEqual([
      { itemId: "potion", qty: 3 },
      { itemId: "potion", qty: 1 },
      { itemId: "sword", qty: 1 },
    ]);
    expect(
      reducePlayerState(current, PlayerActions.removeItem("potion", 0))
    ).toBe(current);
  });

  it("requires registered equipment and supports skill and effect lifecycles", () => {
    const item = {
      id: "ring",
      name: "Ring",
      kind: "trinket" as const,
      modifiers: { wisdom: 2 },
    };
    const skill = {
      id: "shadowstep",
      name: "Shadowstep",
      level: 20,
      active: false,
    };
    const effect = {
      id: "blessing",
      name: "Blessing",
      appliedAt: 100,
      durationMs: 1000,
      modifiers: { attributes: { spirit: 3 } },
    };

    let current = state();
    expect(
      reducePlayerState(current, PlayerActions.equip("ring1", "missing"))
    ).toBe(current);
    current = reducePlayerState(current, PlayerActions.registerItem(item));
    current = reducePlayerState(current, PlayerActions.equip("ring1", "ring"));
    expect(current.equipment.ring1).toBe("ring");
    current = reducePlayerState(current, PlayerActions.unequip("ring1"));
    expect(current.equipment.ring1).toBeUndefined();

    expect(
      reducePlayerState(
        current,
        PlayerActions.setSkillActive("missing", true)
      )
    ).toBe(current);
    expect(
      reducePlayerState(current, PlayerActions.setSkillLevel("missing", 50))
    ).toBe(current);

    current = reducePlayerState(current, PlayerActions.learnSkill(skill));
    current = reducePlayerState(
      current,
      PlayerActions.setSkillActive("shadowstep", true)
    );
    current = reducePlayerState(
      current,
      PlayerActions.setSkillLevel("shadowstep", 150)
    );
    expect(current.skills.shadowstep).toMatchObject({
      active: true,
      level: 100,
    });
    current = reducePlayerState(
      current,
      PlayerActions.setSkillLevel("shadowstep", -20)
    );
    expect(current.skills.shadowstep.level).toBe(0);
    current = reducePlayerState(current, PlayerActions.forgetSkill("shadowstep"));
    expect(current.skills.shadowstep).toBeUndefined();

    current = reducePlayerState(current, PlayerActions.applyEffect(effect));
    expect(current.effects.blessing).toEqual(effect);
    current = reducePlayerState(current, PlayerActions.removeEffect("blessing"));
    expect(current.effects.blessing).toBeUndefined();
  });

  it("normalizes base triangles and composes gear, equipment, effects, and active skills", () => {
    const current = state({
      attributesBase: {
        physical: { strength: 49, dexterity: 49, endurance: 49 },
        mental: { intellect: 1, willpower: 1, creativity: 1 },
        spiritual: { spirit: 33, wisdom: 33, charisma: 33 },
      },
      attributesGear: {
        ...structuredClone(defaultState.attributesGear),
        strength: 2,
      },
      attributesEffects: {
        ...structuredClone(defaultState.attributesEffects),
        dexterity: 3,
      },
      items: {
        helm: {
          id: "helm",
          name: "Helm",
          kind: "armor",
          modifiers: { endurance: 4 },
        },
      },
      equipment: { head: "helm", feet: "missing" },
      effects: {
        aura: {
          id: "aura",
          name: "Aura",
          appliedAt: 0,
          durationMs: 0,
          modifiers: { attributes: { intellect: 5 } },
        },
        cosmetic: {
          id: "cosmetic",
          name: "Cosmetic",
          appliedAt: 0,
          durationMs: 0,
        },
      },
      skills: {
        shadowstep: {
          id: "ShadowStep",
          name: "Shadowstep",
          level: 100,
          active: true,
        },
        unknown: {
          id: "unknown",
          name: "Unknown",
          level: 20,
          active: true,
        },
        inactive: {
          id: "dreamwalking",
          name: "Dreamwalking",
          level: 20,
          active: false,
        },
        zero: {
          id: "telepathy",
          name: "Telepathy",
          level: 0,
          active: true,
        },
      },
    });

    const effective = selectEffectiveAttributes(current);
    expect(
      effective.strength + effective.dexterity + effective.endurance
    ).toBe(108);
    expect(effective.intellect).toBe(38);
    expect(effective.charisma).toBeLessThan(33);
  });

  it("creates all convenience actions and preserves state for unknown actions", () => {
    expect(PlayerActions.setPosition({ x: 1, y: 2, z: 3 }).type).toBe(
      "set_position"
    );
    expect(PlayerActions.setLookAt({ x: 1, y: 2, z: 3 }).type).toBe(
      "set_look_at"
    );
    expect(PlayerActions.setVelocity({ x: 1, y: 2, z: 3 }).type).toBe(
      "set_velocity"
    );
    expect(PlayerActions.setResource({ health: 1 }).type).toBe("set_resource");
    expect(PlayerActions.setAttributesBase({ spirit: 3 }).type).toBe(
      "set_attributes_base"
    );
    expect(PlayerActions.setAttributesGear({ spirit: 3 }).type).toBe(
      "set_attributes_gear"
    );
    expect(PlayerActions.setAttributesEffects({ spirit: 3 }).type).toBe(
      "set_attributes_effects"
    );
    expect(
      PlayerActions.registerItem({
        id: "x",
        name: "X",
        kind: "misc",
      }).type
    ).toBe("register_item");
    expect(PlayerActions.addItem("x", 1).type).toBe("add_item");
    expect(PlayerActions.removeItem("x", 1).type).toBe("remove_item");
    expect(PlayerActions.equip("head", "x").type).toBe("equip");
    expect(PlayerActions.unequip("head").type).toBe("unequip");
    expect(
      PlayerActions.learnSkill({ id: "x", name: "X", level: 1 }).type
    ).toBe("learn_skill");
    expect(PlayerActions.setSkillActive("x", true).type).toBe(
      "set_skill_active"
    );
    expect(PlayerActions.setSkillLevel("x", 2).type).toBe("set_skill_level");
    expect(PlayerActions.forgetSkill("x").type).toBe("forget_skill");
    expect(
      PlayerActions.applyEffect({
        id: "x",
        name: "X",
        appliedAt: 0,
        durationMs: 0,
      }).type
    ).toBe("apply_effect");
    expect(PlayerActions.removeEffect("x").type).toBe("remove_effect");

    const current = state();
    expect(
      reducePlayerState(current, { type: "unknown" } as unknown as PlayerAction)
    ).toBe(current);
  });
});
