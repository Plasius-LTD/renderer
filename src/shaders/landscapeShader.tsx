import * as THREE from "three/webgpu";
import { extend, ThreeElements } from "@react-three/fiber";
import { landscapeVertexShader } from "./vertex/landscapeVertexShader.js";
import { landscapeFragmentShader } from "./fragment/landscapeFragmentShader.js";
import { add } from "three/tsl";

// ✅ Define a class that extends the material
class LandscapeShaderMaterial extends THREE.MeshStandardNodeMaterial {
  constructor() {
    super({ color: new THREE.Color(0.4, 0.7, 0.2) });
/*
    // Append your vertex shader to the existing position pipeline
    if (this.positionNode)
      this.positionNode = shader(() =>
        add(this.positionNode!, landscapeVertexShader)
      );
    else this.positionNode = landscapeVertexShader;
    // Append your fragment shader to the existing color pipeline
    if (this.colorNode)
      this.colorNode = shader(() =>
        add(this.colorNode!, landscapeFragmentShader)
      );
    else this.colorNode = landscapeFragmentShader;
    */
  }
}

// ✅ Register the class with R3F so you can use it as a JSX tag
extend({ LandscapeShaderMaterial });

export { LandscapeShaderMaterial };

declare module "@react-three/fiber" {
  interface ThreeElements {
    landscapeShaderMaterial: ThreeElements["meshStandardMaterial"] & {
      ref?: React.Ref<THREE.MeshStandardNodeMaterial>;
    };
  }
}
