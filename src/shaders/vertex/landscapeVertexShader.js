import * as TSL from "three/tsl";

// Vertex shader
export const landscapeVertexShader = TSL.Fn((shader) => {
  const position = shader.input.vec3("position");
  const uv = shader.input.vec2("uv");
  const time = shader.uniforms.float("time");

  let vHeight = shader.output.float("vHeight");
  const clipPosition = output.vec4("gl_Position");

  const waveZ = TSL.mul(
    TSL.sin(TSL.add(TSL.mul(position.x, 0.5), TSL.mul(time, 1.0))),
    1.0
  );

  const newPos = TSL.vec3(position.x, position.y, TSL.add(position.z, waveZ));

  TSL.assign(vHeight, newPos.z);
  TSL.assign(clipPosition, TSL.vec4(newPos, 1.0));
});
/*


// Vertex shader
export const landscapeVertexShader = TSL.Fn((shader) => {
  const position = shader.input.vec3("position");
  const uv = shader.input.vec2("uv");

  const time = shader.uniforms.float("time");
  const seed = shader.uniforms.float("seed");

  let vUv = shader.output.vec2("vUv");
  let vHeight = shader.output.float("vHeight");
  let vPos = shader.output.vec3("vPos");

  const clipPosition = output.vec4("gl_Position");

  const random = (st) =>
    fract(
      mul(
        sin(dot(st, vec2(add(12.9898, seed), add(78.233, seed)))),
        43758.5453123
      )
    );

  assign(vUv, uv);
  assign(vPos, position);

  const rnd = random(position.xy);
  const waveZ = add(
    mul(
      add(
        sin(add(mul(position.x, 0.2), time)),
        cos(add(mul(position.y, 0.2), time))
      ),
      0.75
    ),
    sub(mul(rnd, 2.0), 1.0)
  );

  const newPos = vec3(position.x, position.y, add(position.z, waveZ));

  assign(vHeight, newPos.z);
  assign(clipPosition, vec4(newPos, 1.0));
});
*/