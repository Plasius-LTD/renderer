import * as TSL from "three/tsl";

// Fragment shader
export const landscapeFragmentShader = TSL.Fn((shader) => {
  const vHeight = shader.input.float("vHeight");
  const fragColor = shader.uniforms.vec4("fragColor");

  const lowColor = TSL.vec3(0.5, 0.8, 0.3); // Grass
  const highColor = TSL.vec3(1.0, 1.0, 1.0); // Snow

  const mixFactor = TSL.smoothstep(0.0, 2.0, vHeight);
  const baseColor = TSL.mix(lowColor, highColor, mixFactor);

  TSL.assign(fragColor, TSL.vec4(baseColor, 1.0));
});

/*import * as TSL from "three/tsl";

// Fragment shader
export const landscapeFragmentShader = TSL.Fn((shader) => {
  const vUv = shader.input.vec2("vUv");
  const vHeight = shader.input.float("vHeight");
  const vPos = shader.input.vec3("vPos");

  const time = shader.uniforms.float("time");
  const fragColor = shader.uniforms.vec4("fragColor");

  const applyWind = (normal, pos) => {
    const windDir = TSL.vec2(
      TSL.sin(TSL.add(TSL.mul(pos.x, 0.1), TSL.mul(time, 0.3))),
      TSL.cos(TSL.add(TSL.mul(pos.y, 0.1), TSL.mul(time, 0.3)))
    );
    const strength = TSL.add(
      0.2,
      TSL.mul(
        0.1,
        TSL.sin(TSL.add(TSL.dot(pos, TSL.vec2(0.3, 0.7)), TSL.mul(time, 0.5)))
      )
    );
    const wind = TSL.mul(
      TSL.normalize(TSL.vec3(windDir.x, windDir.y, 0.0)),
      strength
    );
    return TSL.normalize(TSL.add(normal, TSL.mul(wind, 0.4)));
  };

  const calculateNormal = (height, uv, pos) => {
    const eps = 0.01;
    const hL = TSL.smoothstep(-2.0, 4.5, TSL.sub(height, eps));
    const hR = TSL.smoothstep(-2.0, 4.5, TSL.add(height, eps));
    const hD = TSL.smoothstep(-2.0, 4.5, TSL.sub(height, eps));
    const hU = TSL.smoothstep(-2.0, 4.5, TSL.add(height, eps));
    const normal = TSL.normalize(
      TSL.vec3(TSL.sub(hL, hR), TSL.sub(hD, hU), 2.0)
    );
    return applyWind(normal, pos.xz);
  };

  const grassWave = (uv, height) => {
    const baseFreq = 40.0;
    const speed = 0.5;
    const wave1 = TSL.sin(
      TSL.mul(TSL.add(TSL.add(uv.x, uv.y), TSL.mul(time, speed)), baseFreq)
    );
    const wave2 = TSL.cos(
      TSL.mul(
        TSL.add(TSL.sub(uv.x, uv.y), TSL.mul(time, TSL.mul(speed, 1.2))),
        TSL.mul(baseFreq, 0.8)
      )
    );
    const pattern = TSL.mul(TSL.add(wave1, wave2), 0.03);
    const density = TSL.smoothstep(0.3, 0.7, height);
    return TSL.mul(pattern, density);
  };

  const grassDensityFactor = (coords) =>
    TSL.smoothstep(
      0.4,
      0.9,
      TSL.fract(
        TSL.mul(
          TSL.sin(TSL.dot(TSL.mul(coords, 0.2), TSL.vec2(12.9898, 78.233))),
          43758.5453
        )
      )
    );

  const sand = TSL.vec3(0.76, 0.7, 0.5);
  const grass = TSL.vec3(0.4, 0.8, 0.2);
  const stone = TSL.vec3(0.5, 0.5, 0.5);
  const snow = TSL.vec3(0.95, 0.95, 0.95);

  const low = TSL.smoothstep(-2.0, 0.0, vHeight);
  const high = TSL.smoothstep(1.0, 3.0, vHeight);

  let base = TSL.mix(sand, grass, low);
  base = TSL.mix(base, stone, high);
  base = TSL.mix(base, snow, TSL.smoothstep(2.5, 4.5, vHeight));

  const normal = calculateNormal(vHeight, vUv, vPos);
  const slope = TSL.dot(TSL.vec3(0.0, 0.0, 1.0), normal);
  const snowBlend = TSL.smoothstep(0.8, 1.0, slope);
  base = TSL.mix(
    base,
    snow,
    TSL.mul(snowBlend, TSL.smoothstep(1.5, 4.5, vHeight))
  );

  const tintNoise = TSL.fract(
    TSL.mul(TSL.sin(TSL.dot(vPos.xz, TSL.vec2(91.91, 47.47))), 43758.5453)
  );
  const tint = TSL.mix(
    TSL.vec3(-0.05, 0.05, -0.02),
    TSL.vec3(0.05, -0.03, 0.02),
    tintNoise
  );
  base = TSL.add(base, tint);

  const density = grassDensityFactor(vPos.xz);
  base = TSL.mix(base, TSL.vec3(0.25, 0.4, 0.15), TSL.sub(1.0, density));

  const lightDir = TSL.normalize(TSL.vec3(0.3, 0.5, 1.0));
  let lighting = TSL.clamp(TSL.dot(lightDir, normal), 0.3, 1.0);
  lighting = TSL.mul(lighting, TSL.add(0.8, TSL.mul(0.4, density)));

  const grassMotion = TSL.mul(grassWave(vUv, vHeight), density);
  const animatedGrass = TSL.vec3(0.0, TSL.mul(grassMotion, 0.4), 0.0);

  const fresnel = TSL.pow(
    TSL.sub(1.0, TSL.dot(TSL.normalize(TSL.vec3(0.0, 0.0, 1.0)), normal)),
    3.0
  );
  const fresnelColor = TSL.mul(TSL.vec3(0.2, 0.5, 0.1), fresnel);

  const finalColor = TSL.mul(
    TSL.add(TSL.add(base, animatedGrass), fresnelColor),
    lighting
  );
  TSL.assign(fragColor, TSL.vec4(finalColor, 1.0));
});
*/
