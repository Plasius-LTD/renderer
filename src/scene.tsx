import { forwardRef, type ReactNode } from "react";
import { Physics } from "@react-three/rapier";
import { Environment } from "@react-three/drei";
import { Landscape } from "./landscape.js";
import { Vector3, Group } from "three";

export interface SceneProps {
  children?: ReactNode[];
}

// Use forwardRef to make ref work
export const Scene = forwardRef<Group, SceneProps>(function Scene(props, ref) {
  return (
    <group ref={ref}>
      <Environment
        preset={"dawn"}
        background={false}
        environmentIntensity={0.5}
      />
      <ambientLight color={0xe1e1e1} intensity={0.3} />
      <directionalLight
        color={0xf0f0f0}
        intensity={1.0}
        position={new Vector3(5, 10, -10)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
      />
      <Physics gravity={[0, -9.81, 0]}>
        <Landscape />
        {props.children}
      </Physics>
    </group>
  );
});
