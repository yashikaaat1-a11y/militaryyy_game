/* ── Buildings — per-terrain architecture with lit windows ─── */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { layoutFor, seededRandom } from './layouts';

const STYLE = {
  URBAN: { walls: ['#5d6166', '#6b6f73', '#54595e', '#73716b'], roof: '#3a3d40', kind: 'block', litRatio: 0.45 },
  RIVER: { walls: ['#565b5f', '#62676a', '#4f5458'], roof: '#33373a', kind: 'block', litRatio: 0.35 },
  MOUNTAIN: { walls: ['#5a4634', '#644f3b', '#4f3e2f'], roof: '#2f3236', kind: 'cabin', litRatio: 0.5 },
  DESERT: { walls: ['#b89a6c', '#c4a77a', '#a88b5f'], roof: '#a2865d', kind: 'adobe', litRatio: 0.15 },
};

/** Window quads on all four faces; returns [litGeometries, darkGeometries]. */
function windowQuads(b, ground, rand, litRatio) {
  const [x, z, w, h, d] = b;
  const lit = [];
  const dark = [];
  const floors = Math.max(1, Math.floor((h - 0.25) / 0.55));
  const faces = [
    { len: w, nx: 0, nz: 1, off: d / 2 },
    { len: w, nx: 0, nz: -1, off: d / 2 },
    { len: d, nx: 1, nz: 0, off: w / 2 },
    { len: d, nx: -1, nz: 0, off: w / 2 },
  ];
  for (const f of faces) {
    const cols = Math.max(1, Math.floor(f.len / 0.38));
    for (let fl = 0; fl < floors; fl++) {
      for (let c = 0; c < cols; c++) {
        const along = -f.len / 2 + (c + 0.5) * (f.len / cols);
        const q = new THREE.PlaneGeometry(0.16, 0.2);
        const rotY = Math.atan2(f.nx, f.nz);
        q.rotateY(rotY);
        const px = x + f.nx * (f.off + 0.012) + (f.nz !== 0 ? along : 0);
        const pz = z + f.nz * (f.off + 0.012) + (f.nx !== 0 ? along : 0);
        q.translate(px, ground + 0.4 + fl * 0.55, pz);
        (rand() < litRatio ? lit : dark).push(q);
      }
    }
  }
  return [lit, dark];
}

function Building({ b, type, style, spec }) {
  const [x, z, w, h, d] = b;
  const ground = getTerrainHeight(x, -z, type) - 0.05;
  const { color, roofUnit, dome } = spec;

  return (
    <group position={[x, ground, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>

      {style.kind === 'cabin' ? (
        // Gable roof: a triangular prism laid along the building
        <mesh position={[0, h + 0.28, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.6, 1, 1]} castShadow>
          <cylinderGeometry args={[w * 0.62, w * 0.62, d + 0.2, 3]} />
          <meshStandardMaterial color={style.roof} roughness={0.85} flatShading />
        </mesh>
      ) : (
        <>
          {/* Parapet */}
          {[[0, d / 2], [0, -d / 2], [w / 2, 0], [-w / 2, 0]].map(([px, pz], i) => (
            <mesh key={i} position={[px, h + 0.06, pz]} castShadow>
              <boxGeometry args={[px ? 0.06 : w + 0.06, 0.12, pz ? 0.06 : d + 0.06]} />
              <meshStandardMaterial color={style.roof} roughness={0.9} />
            </mesh>
          ))}
          {roofUnit && !dome && (
            <mesh position={[w * 0.18, h + 0.12, -d * 0.15]} castShadow>
              <boxGeometry args={[w * 0.3, 0.22, d * 0.3]} />
              <meshStandardMaterial color="#7b7e80" roughness={0.6} metalness={0.3} />
            </mesh>
          )}
          {dome && (
            <mesh position={[0, h, 0]} castShadow>
              <sphereGeometry args={[Math.min(w, d) * 0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#d8c39a" roughness={0.9} flatShading />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

export default function Buildings() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const layout = layoutFor(type);
  const style = STYLE[type] || STYLE.URBAN;

  const { windowsLit, windowsDark, specs } = useMemo(() => {
    const rand = seededRandom(`windows-${type}`);
    const lit = [];
    const dark = [];
    for (const b of layout.buildings) {
      const ground = getTerrainHeight(b[0], -b[1], type) - 0.05;
      const [l, dk] = windowQuads(b, ground, rand, style.litRatio);
      lit.push(...l);
      dark.push(...dk);
    }
    // Decide each building's look once so re-renders don't reshuffle it
    const r = seededRandom(`buildings-${type}`);
    return {
      windowsLit: lit.length ? mergeGeometries(lit) : null,
      windowsDark: dark.length ? mergeGeometries(dark) : null,
      specs: layout.buildings.map(() => ({
        color: style.walls[Math.floor(r() * style.walls.length)],
        roofUnit: r() < 0.6,
        dome: style.kind === 'adobe' && r() < 0.4,
      })),
    };
  }, [type, layout, style]);

  return (
    <group>
      {layout.buildings.map((b, i) => (
        <Building key={`${type}-${i}`} b={b} type={type} style={style} spec={specs[i]} />
      ))}
      {windowsLit && (
        <mesh geometry={windowsLit}>
          <meshStandardMaterial color="#ffcf87" emissive="#ffb35c" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
      {windowsDark && (
        <mesh geometry={windowsDark}>
          <meshStandardMaterial color="#1a2026" roughness={0.3} metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}
