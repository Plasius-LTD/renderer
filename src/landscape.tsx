import * as THREE from "three";
import { useMemo } from "react";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RigidBody } from "@react-three/rapier";

const HEX_RADIUS = 66;
//const TILE_RESOLUTION = 2048;
const AREA_WIDTH = 2000;
const AREA_HEIGHT = 2000;

// Generate a single high-resolution hexagon as BufferGeometry
function generateHexTile(radius: number): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  const segments = 30; // More segments for smoother curve
  const angleStep = (Math.PI * 2) / segments;

  // Center point
  vertices.push(0, 0, 0);

  // Outer ring vertices
  for (let i = 0; i <= segments; i++) {
    const angle = angleStep * i;
    const x = radius * Math.cos(angle);
    const z = -radius * Math.sin(angle); // flip Z axis for pointy top upward
    vertices.push(x, 0, z);
  }

  // Create triangle fan indices
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// Axial to world coordinates (pointy-topped hex)
function axialToWorld(q: number, r: number, radius: number): [number, number] {
  const x = ((radius * 3) / 2) * q;
  const z = radius * Math.sqrt(3) * (r + q / 2);
  return [x, z];
}

// Simple seeded noise for per-tile deformation
function seededNoise(x: number, z: number, seed = 42): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

// Deform only the interior (non-edge) vertices of a hex tile
function deformHexInterior(
  geom: THREE.BufferGeometry,
  radius: number,
  seed = 42
): void {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const vertexCount = pos.count;

  for (let i = 0; i < vertexCount; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);

    // Only deform vertices inside the hex edge (leave edge vertices flat)
    if (r < radius * 0.98) {
      // Blend multiple nearby noise samples for smoother curvature
      const n = (dx: number, dz: number) => seededNoise(x + dx, z + dz, seed);
      const smoothY =
        (n(0, 0) * 4 +
          n(-1, 0) +
          n(1, 0) +
          n(0, -1) +
          n(0, 1) +
          n(-1, -1) +
          n(1, 1) +
          n(-1, 1) +
          n(1, -1)) /
        12;
      pos.setY(i, smoothY);
    }
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

function generateHexDepthMap(
  cols: number,
  rows: number,
  seed = 42
): number[][] {
  const map: number[][] = [];
  for (let q = 0; q < cols; q++) {
    const row: number[] = [];
    for (let r = 0; r < rows; r++) {
      const value = Math.sin((q + seed) * 0.3) * Math.cos((r + seed) * 0.3);
      row.push(value);
    }
    map.push(row);
  }
  return map;
}

export function Landscape() {
  const geometry = useMemo(() => {
    const radius = HEX_RADIUS;
    const tiles: THREE.BufferGeometry[] = [];

    const spacingX = (3 / 2) * radius;
    const spacingZ = Math.sqrt(3) * radius;
    const cols = Math.ceil(AREA_WIDTH / spacingX);
    const rows = Math.ceil(AREA_HEIGHT / spacingZ);

    const offset = Math.floor(cols / 2);
    const depthMap = generateHexDepthMap(cols, rows);
    const elevationScale = 20;

    const baseHex = generateHexTile(radius);

    for (let q = -Math.floor(cols / 2); q < Math.ceil(cols / 2); q++) {
      for (let r = -Math.floor(rows / 2); r < Math.ceil(rows / 2); r++) {
        const hex = baseHex.clone();

        const dq = q + offset;
        const dr = r + offset;
        const elevation = depthMap?.[dq]?.[dr] ?? 0;

        deformHexInterior(
          hex,
          radius,
          42 + q * 1000 + r + Math.floor(elevation * 100)
        );

        const [x, z] = axialToWorld(q, r, radius);
        hex.translate(x, elevation * elevationScale, z);

        tiles.push(hex);
      }
    }

    const merged = BufferGeometryUtils.mergeGeometries(tiles, false);
    // Remove normals before merging vertices to ensure proper welding
    if (merged.attributes.normal) {
      merged.deleteAttribute("normal");
    }
    const stitched = BufferGeometryUtils.mergeVertices(merged, 1e-2);
    stitched.computeVertexNormals();
    return stitched;
  }, []);

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh geometry={geometry} castShadow receiveShadow>
        <landscapeShaderMaterial color="#77aa66" />
      </mesh>
    </RigidBody>
  );
}

/*

import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import { Mesh } from "three";

import "./shaders/landscapeShader.js";

// Deterministic, coherent angle function for seamless tile rotation
function coherentAngle(x: number, y: number, scale: number = 0.2) {
  const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const noise = seed - Math.floor(seed);
  return (noise - 0.5) * scale;
}

function generateHexTile(
  edgeLength: number,
  resolution: number
): THREE.BufferGeometry {
  const radius = edgeLength;
  const height = Math.sqrt(3) * radius;
  const width = 2 * radius;

  const geom = new THREE.PlaneGeometry(width, height, resolution, resolution);

  // Mask out corners beyond hexagon bounds
  const pos = geom.attributes.position;
  const indicesToKeep = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // plane lies flat, so this is along Z in world
    const px = Math.abs(x);
    const py = Math.abs(y);
    const angle = Math.atan2(py, px);

    const maxX = radius;
    const maxY = Math.tan(Math.PI / 6) * (maxX - px);
    if (py < height / 2 && py < maxY + 1e-2) {
      indicesToKeep.push(i);
    }
  }

  // Build new geometry with only the allowed vertices
  const indexAttr = [];
  for (let i = 0; i < geom.index!.count; i += 3) {
    const a = geom.index!.getX(i);
    const b = geom.index!.getX(i + 1);
    const c = geom.index!.getX(i + 2);
    if (
      indicesToKeep.includes(a) &&
      indicesToKeep.includes(b) &&
      indicesToKeep.includes(c)
    ) {
      indexAttr.push(a, b, c);
    }
  }

  const trimmed = geom.clone();
  trimmed.setIndex(indexAttr);
  trimmed.computeVertexNormals();
  return trimmed;
}

let persistedGeometry: THREE.BufferGeometry | undefined = undefined;

interface LandscapeProps {
  width?: number;
  height?: number;
  resolution?: number;
  children?: React.ReactNode;
}

export function Landscape({
  width = 100,
  height = 100,
  resolution = 64,
  children,
}: LandscapeProps) {
  const ref = useRef<Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  const radius = 6.6;
  const hexWidth = 2 * radius;
  const hexHeight = Math.sqrt(3) * radius;

  const spacingX = (3 / 2) * radius;
  const spacingZ = hexHeight;

  const cols = Math.ceil(width / spacingX);
  const rows = Math.ceil(height / spacingZ);

  const geometry = useMemo(() => {
    if (persistedGeometry !== undefined) return persistedGeometry;

    const geometries: THREE.BufferGeometry[] = [];

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const overlap = 0.1;
        // Hex grid layout: pointy-top
        const hexHeight = Math.sqrt(3) * radius;
        const q = x;
        const r = y;
        const posX = radius * 1.5 * q;
        const posZ = Math.sqrt(3) * radius * (r + q / 2);

        const dx = x - cols / 2 + 0.5;
        const dy = y - rows / 2 + 0.5;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angleFactor = distance / Math.max(cols, rows);

        const rotX = coherentAngle(x, y) * angleFactor;
        const rotY = coherentAngle(y, x) * angleFactor;

        const baseGeom = generateHexTile(radius, resolution);
        baseGeom.rotateX(-Math.PI / 2); // flat base
        baseGeom.rotateX(rotX);
        baseGeom.rotateZ(rotY);
        baseGeom.translate(posX - width / 2, 0, posZ - height / 2);

        geometries.push(baseGeom);
      }
    }

    persistedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);

    // Post-process: stitch vertices along tile edges to ensure seamless normals
    if (persistedGeometry) {
      const tolerance = 1e-3; // merge close vertices
      const merged = BufferGeometryUtils.mergeVertices(
        persistedGeometry,
        tolerance
      );
      persistedGeometry.dispose(); // clean up old geometry
      persistedGeometry = merged;
    }

    return persistedGeometry;
  }, [cols, rows, radius, width, height, resolution]);

  //<landscapeShaderMaterial ref={materialRef} />
  return (
    <mesh ref={ref} geometry={geometry} receiveShadow>
      {children}
    </mesh>
  );
}
*/
