import { describe, expect, it } from "vitest";
import { Scene } from "../src/scene.js";
import { LandscapeShaderMaterial } from "../src/shaders/landscapeShader.js";

describe("scene composition requirements", () => {
  it("builds the lighting, physics, landscape, and child hierarchy", () => {
    const ref = { current: null };
    const element = (Scene as unknown as {
      render(
        props: { children: unknown[] },
        ref: { current: unknown }
      ): { props: { children: unknown[] } };
    }).render({ children: ["avatar"] }, ref);

    expect(element.type).toBe("group");
    expect(element.props.ref).toBe(ref);
    expect(element.props.children).toHaveLength(4);
    const physics = element.props.children[3] as {
      props: { gravity: number[]; children: unknown[] };
    };
    expect(physics.props.gravity).toEqual([0, -9.81, 0]);
    expect(physics.props.children[1]).toEqual(["avatar"]);
  });

  it("constructs the registered landscape node material", () => {
    const material = new LandscapeShaderMaterial();
    expect(material.color.r).toBeCloseTo(0.4);
    expect(material.color.g).toBeCloseTo(0.7);
    expect(material.color.b).toBeCloseTo(0.2);
    material.dispose();
  });
});
