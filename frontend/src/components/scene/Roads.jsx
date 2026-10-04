/* ── Roads — flat ribbons draped over the terrain, with lane markings ── */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { layoutFor } from './layouts';

const SURFACE = {
  URBAN: '#2b2d2f',
  RIVER: '#3a3631',
  MOUNTAIN: '#5e5140',
  DESERT: '#8f7553',
};

// Height above the ground; mountain terrain has more surface detail to clear
const LIFT = { URBAN: 0.07, RIVER: 0.07, MOUNTAIN: 0.14, DESERT: 0.08 };

/** Sample a smooth centreline and build a strip `width` wide, lifted just above the ground. */
function ribbon(points, width, type, extra = 0, dash = 0) {
  const lift = LIFT[type] + extra;
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.2);
  const len = curve.getLength();
  const steps = Math.max(12, Math.ceil(len * 3));
  const verts = [];
  const index = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    for (const side of [-1, 1]) {
      const x = p.x + nx * side * width / 2;
      const z = p.z + nz * side * width / 2;
      verts.push(x, getTerrainHeight(x, -z, type) + lift, z);
    }
    if (i < steps) {
      const visible = !dash || Math.floor((t * len) / dash) % 2 === 0;
      if (visible) {
        const a = i * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function Road({ road, type }) {
  const surface = useMemo(() => ribbon(road.points, road.width, type), [road, type]);
  const shoulder = useMemo(() => ribbon(road.points, road.width + 0.35, type, -0.015), [road, type]);
  const lanes = useMemo(() => (road.lanes ? ribbon(road.points, 0.06, type, 0.015, 0.35) : null), [road, type]);
  return (
    <group>
      <mesh geometry={shoulder} receiveShadow>
        <meshStandardMaterial color="#3f3a33" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial color={SURFACE[type]} roughness={0.92} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {lanes && (
        <mesh geometry={lanes}>
          <meshStandardMaterial color="#c9b46a" roughness={0.6} emissive="#3a3018" polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      )}
    </group>
  );
}

function Bridge({ bridge, type }) {
  const x0 = bridge.x - bridge.length / 2;
  const x1 = bridge.x + bridge.length / 2;
  const deck = Math.max(getTerrainHeight(x0, -bridge.z, type), getTerrainHeight(x1, -bridge.z, type)) + 0.12;
  return (
    <group position={[bridge.x, deck, bridge.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[bridge.length, 0.18, bridge.width]} />
        <meshStandardMaterial color="#4a4b4d" roughness={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.22, (s * bridge.width) / 2]} castShadow>
          <boxGeometry args={[bridge.length, 0.08, 0.06]} />
          <meshStandardMaterial color="#6e7173" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {[-1.2, 1.2].map((dx) => (
        <mesh key={dx} position={[dx, -0.8, 0]} castShadow>
          <boxGeometry args={[0.35, 1.5, bridge.width * 0.8]} />
          <meshStandardMaterial color="#3c3e40" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function Roads() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const layout = layoutFor(type);
  return (
    <group>
      {layout.roads.map((r, i) => <Road key={`${type}-${i}`} road={r} type={type} />)}
      {layout.bridge && <Bridge bridge={layout.bridge} type={type} />}
    </group>
  );
}
