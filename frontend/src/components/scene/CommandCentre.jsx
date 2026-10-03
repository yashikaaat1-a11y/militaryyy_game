/* ── CommandCentre — the HQ the comm links run back to ─────── */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { layoutFor } from './layouts';

const METAL = { color: '#8b8f92', metalness: 0.6, roughness: 0.45 };

/** Lattice mast made of thin struts. */
function Mast({ height = 3.2 }) {
  const struts = useMemo(() => {
    const out = [];
    const r = 0.16;
    const legs = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2);
    legs.forEach((a) => out.push({ pos: [Math.cos(a) * r, height / 2, Math.sin(a) * r], rot: [0, 0, 0], len: height }));
    for (let y = 0.3; y < height; y += 0.45) {
      legs.forEach((a, i) => {
        const b = legs[(i + 1) % 3];
        const mx = (Math.cos(a) + Math.cos(b)) / 2 * r;
        const mz = (Math.sin(a) + Math.sin(b)) / 2 * r;
        out.push({ pos: [mx, y, mz], rot: [Math.PI / 2, 0, -Math.atan2(mz, mx)], len: r * 1.7 });
      });
    }
    return out;
  }, [height]);
  return (
    <group>
      {struts.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot} castShadow>
          <cylinderGeometry args={[0.012, 0.012, s.len, 4]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
    </group>
  );
}

export default function CommandCentre() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const [hx, hz] = layoutFor(type).hq;
  const ground = getTerrainHeight(hx, -hz, type) - 0.05;
  const radar = useRef();
  const beacon = useRef();

  useFrame(({ clock }, dt) => {
    if (radar.current) radar.current.rotation.y += dt * 0.9;
    if (beacon.current) beacon.current.material.emissiveIntensity = Math.sin(clock.getElapsedTime() * 3) > 0.6 ? 6 : 0.3;
  });

  const sandbags = useMemo(() => {
    const out = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      if (a > 1.2 && a < 1.9) continue; // entrance gap facing the field
      out.push([Math.cos(a) * 2.6, Math.sin(a) * 2.2, a]);
    }
    return out;
  }, []);

  return (
    <group position={[hx, ground, hz]}>
      {/* Bunker */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.1, 1.9]} />
        <meshStandardMaterial color="#4b4f45" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[2.9, 0.16, 2.2]} />
        <meshStandardMaterial color="#3a3d36" roughness={0.95} />
      </mesh>
      {/* Lit vision slit */}
      <mesh position={[0, 0.72, 0.955]}>
        <planeGeometry args={[1.6, 0.12]} />
        <meshStandardMaterial color="#ffc978" emissive="#ffa53d" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* Camo net */}
      <mesh position={[0, 1.5, 0]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[3.6, 3.0, 6, 6]} />
        <meshStandardMaterial color="#5a5e3e" transparent opacity={0.55} side={THREE.DoubleSide} roughness={1} wireframe />
      </mesh>

      {/* Sandbag berm */}
      {sandbags.map(([x, z, a], i) => (
        <mesh key={i} position={[x, 0.16, z]} rotation={[0, -a, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.3, 0.58]} />
          <meshStandardMaterial color="#8a7a5a" roughness={1} flatShading />
        </mesh>
      ))}

      {/* Comms mast with beacon */}
      <group position={[-1.0, 1.2, -0.5]}>
        <Mast height={3.0} />
        <mesh ref={beacon} position={[0, 3.1, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1} toneMapped={false} />
        </mesh>
      </group>

      {/* Rotating radar */}
      <group position={[0.8, 1.25, -0.3]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 0.5, 6]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <group ref={radar} position={[0, 0.55, 0]}>
          <mesh rotation={[0, 0, 0.25]} castShadow>
            <boxGeometry args={[0.9, 0.22, 0.04]} />
            <meshStandardMaterial color="#c9ccce" metalness={0.5} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* Satellite dish */}
      <group position={[0.9, 1.26, 0.55]} rotation={[-0.6, 0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2]} />
          <meshStandardMaterial color="#d6d8d9" metalness={0.3} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Vehicles parked by the HQ */}
      {[[-1.9, 1.5], [1.9, 1.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i ? -0.3 : 0.4, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.5, 0.26, 0.9]} />
            <meshStandardMaterial color="#4e5440" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0.4, -0.12]} castShadow>
            <boxGeometry args={[0.44, 0.18, 0.4]} />
            <meshStandardMaterial color="#454b38" roughness={0.8} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
