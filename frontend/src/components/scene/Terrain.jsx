/* ── Terrain — the sand-table diorama the exercise is played on ── */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { layoutFor, MAP_SIZE, MAP_HALF, GRID_STEP, TABLE_BASE, seededRandom } from './layouts';

const SEGMENTS = 110;

/** Smooth value noise for small surface detail and colour mottling. */
function makeNoise(seed) {
  const rand = seededRandom(seed);
  const perm = Array.from({ length: 256 }, () => rand());
  const at = (ix, iz) => perm[((ix * 73856093) ^ (iz * 19349663)) & 255];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fz = smooth(z - iz);
    const a = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * fx;
    const b = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * fx;
    return a + (b - a) * fz; // 0..1
  };
}

const DETAIL = { URBAN: 0.08, MOUNTAIN: 0.18, RIVER: 0.07, DESERT: 0.1 };

/** Terrain surface height in world coordinates (matches what markers use, plus fine detail). */
export function surfaceHeight(x, z, type, noise) {
  const base = getTerrainHeight(x, -z, type);
  return base + (noise(x * 0.9, z * 0.9) - 0.5) * DETAIL[type];
}

/** Shader patch: draw the 3×3 map grid directly on the terrain so it follows the ground. */
function addGridOverlay(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGridPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 gc = (vGridPos.xz + 15.0) / ${GRID_STEP.toFixed(1)};
        vec2 gd = abs(fract(gc - 0.5) - 0.5) / fwidth(gc);
        float gl = 1.0 - min(min(gd.x, gd.y), 1.0);
        float inside = step(abs(vGridPos.x), 15.02) * step(abs(vGridPos.z), 15.02);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.025, 0.02), gl * 0.42 * inside);`);
  };
  material.customProgramCacheKey = () => 'terrain-grid';
}

function buildTerrain(type, noise) {
  const L = layoutFor(type);
  const pal = Object.fromEntries(Object.entries(L.palette).map(([k, v]) => [k, new THREE.Color(v)]));
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2); // work directly in world space: y up
  const pos = geo.attributes.position;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const h = surfaceHeight(pos.getX(i), pos.getZ(i), type, noise);
    pos.setY(i, h);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  geo.computeVertexNormals();

  const normals = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = (pos.getY(i) - min) / Math.max(max - min, 0.001);
    if (t < 0.45) c.copy(pal.low).lerp(pal.mid, t / 0.45);
    else if (t < 0.78) c.copy(pal.mid).lerp(pal.high, (t - 0.45) / 0.33);
    else c.copy(pal.high).lerp(pal.peak, Math.min(1, (t - 0.78) / 0.14));
    // Steep ground shows bare rock
    const slope = 1 - normals.getY(i);
    if (slope > 0.12) c.lerp(pal.rock, Math.min(1, (slope - 0.12) * 3));
    // Mottling so the ground isn't a flat fill
    const m = 0.88 + noise(x * 0.45 + 40, z * 0.45 - 17) * 0.24;
    c.multiplyScalar(m);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return { geo, min };
}

/** Earth walls around the block, so the map reads as a physical sand table. */
function buildSkirt(type, noise, soil) {
  const verts = [];
  const cols = [];
  const top = new THREE.Color(soil);
  const bottom = new THREE.Color(soil).multiplyScalar(0.35);
  const n = SEGMENTS;
  const edges = [
    (t) => [-MAP_HALF + t * MAP_SIZE, MAP_HALF],
    (t) => [MAP_HALF, MAP_HALF - t * MAP_SIZE],
    (t) => [MAP_HALF - t * MAP_SIZE, -MAP_HALF],
    (t) => [-MAP_HALF, -MAP_HALF + t * MAP_SIZE],
  ];
  for (const edge of edges) {
    for (let i = 0; i < n; i++) {
      const [x0, z0] = edge(i / n);
      const [x1, z1] = edge((i + 1) / n);
      const h0 = surfaceHeight(x0, z0, type, noise);
      const h1 = surfaceHeight(x1, z1, type, noise);
      verts.push(x0, h0, z0, x0, TABLE_BASE, z0, x1, h1, z1, x1, h1, z1, x0, TABLE_BASE, z0, x1, TABLE_BASE, z1);
      cols.push(...top.toArray(), ...bottom.toArray(), ...top.toArray(), ...top.toArray(), ...bottom.toArray(), ...bottom.toArray());
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

function rippleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const rand = seededRandom('ripples');
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + rand() * 0.35})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    const y = rand() * size;
    const x = rand() * size;
    const len = 20 + rand() * 60;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y + 3, x + len, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

function Water({ water }) {
  const tex = useMemo(rippleTexture, []);
  useFrame((_, dt) => {
    tex.offset.y -= dt * 0.05;
  });
  return (
    <group position={[water.x, water.level, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[water.width + 0.4, MAP_SIZE - 0.02]} />
        <meshStandardMaterial color="#1d4f5c" roughness={0.12} metalness={0.35} transparent opacity={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[water.width + 0.4, MAP_SIZE - 0.02]} />
        <meshBasicMaterial color="#9fd3dc" alphaMap={tex} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Water face visible through the cut sides of the table */}
      {[MAP_HALF, -MAP_HALF].map((z) => (
        <mesh key={z} position={[0, (TABLE_BASE - water.level) / 2 + 0.02, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[water.width + 0.4, water.level - TABLE_BASE]} />
          <meshStandardMaterial color="#163c46" roughness={0.3} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 40px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232, 163, 61, 0.9)';
  ctx.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A–J / 0–9 grid references drawn as sprites along two edges of the table. */
function GridLabels() {
  const labels = useMemo(() => {
    const cells = Array.from({ length: 10 }, (_, i) => -15 + GRID_STEP / 2 + i * GRID_STEP);
    return [
      ...cells.map((x, i) => ({ key: `c${i}`, pos: [x, TABLE_BASE + 0.5, MAP_HALF + 1.0], tex: labelTexture(String.fromCharCode(65 + i)) })),
      ...cells.map((z, j) => ({ key: `r${j}`, pos: [-MAP_HALF - 1.0, TABLE_BASE + 0.5, z], tex: labelTexture(String(j)) })),
    ];
  }, []);
  return (
    <group>
      {labels.map((l) => (
        <sprite key={l.key} position={l.pos} scale={[0.9, 0.9, 1]}>
          <spriteMaterial map={l.tex} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

export default function Terrain() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const layout = layoutFor(type);
  const noise = useMemo(() => makeNoise(`terrain-${type}`), [type]);
  const { geo } = useMemo(() => buildTerrain(type, noise), [type, noise]);
  const skirt = useMemo(() => buildSkirt(type, noise, layout.palette.soil), [type, noise, layout.palette.soil]);
  const matRef = useRef();
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    addGridOverlay(m);
    return m;
  }, []);

  return (
    <group>
      <mesh geometry={geo} material={material} ref={matRef} receiveShadow castShadow />
      <mesh geometry={skirt} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* Plinth and table */}
      <mesh position={[0, TABLE_BASE - 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[MAP_SIZE + 0.9, 0.36, MAP_SIZE + 0.9]} />
        <meshStandardMaterial color="#1a1d20" roughness={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[0, TABLE_BASE - 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#0d0f11" roughness={0.85} metalness={0.1} />
      </mesh>

      {layout.water && <Water water={layout.water} />}
      <GridLabels />
    </group>
  );
}
