/* ── Unit Marker — low-poly unit models with NATO-style labels ── */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { useGameStore } from '../../stores/gameStore';
import { NatoSymbol } from './NatoSymbol';

const COMM_COLORS = {
  NORMAL: '#5fd068',
  DELAYED: '#e8d24a',
  DEGRADED: '#f08a2e',
  LOST: '#e5483f',
};
const COMM_TEXT = { NORMAL: 'LINK OK', DELAYED: 'DELAYED', DEGRADED: 'DEGRADED', LOST: 'NO COMMS' };
const DRAB = '#56603f';
const DRAB_DARK = '#3b4230';

function Mat({ color, ghost }) {
  return <meshStandardMaterial color={color} roughness={0.8} flatShading transparent={ghost} opacity={ghost ? 0.35 : 1} />;
}

function Tank({ ghost }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.58, 0.2, 0.95]} /><Mat color={DRAB} ghost={ghost} /></mesh>
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} position={[x, 0.13, 0]} castShadow><boxGeometry args={[0.13, 0.22, 1.0]} /><Mat color="#2b2e26" ghost={ghost} /></mesh>
      ))}
      <mesh position={[0, 0.38, -0.05]} castShadow><cylinderGeometry args={[0.2, 0.24, 0.16, 7]} /><Mat color={DRAB} ghost={ghost} /></mesh>
      <mesh position={[0, 0.4, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.03, 0.035, 0.62, 6]} /><Mat color={DRAB_DARK} ghost={ghost} /></mesh>
      <mesh position={[0.07, 0.49, -0.1]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.05, 6]} /><Mat color={DRAB_DARK} ghost={ghost} /></mesh>
    </group>
  );
}

function Soldier({ position, ghost }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow><capsuleGeometry args={[0.055, 0.15, 2, 6]} /><Mat color={DRAB} ghost={ghost} /></mesh>
      <mesh position={[0, 0.33, 0]} castShadow><sphereGeometry args={[0.05, 6, 5]} /><Mat color="#3a3f2e" ghost={ghost} /></mesh>
    </group>
  );
}

function Squad({ ghost }) {
  return (
    <group>
      {[[0, 0.22], [-0.2, 0], [0.2, 0], [0, -0.22]].map(([x, z], i) => <Soldier key={i} position={[x, 0, z]} ghost={ghost} />)}
    </group>
  );
}

function ReconVehicle({ ghost }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.42, 0.18, 0.78]} /><Mat color={DRAB} ghost={ghost} /></mesh>
      <mesh position={[0, 0.35, -0.08]} castShadow><boxGeometry args={[0.38, 0.14, 0.36]} /><Mat color={DRAB_DARK} ghost={ghost} /></mesh>
      {[[-0.22, 0.25], [0.22, 0.25], [-0.22, -0.25], [0.22, -0.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 8]} /><Mat color="#232521" ghost={ghost} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.7, -0.2]} castShadow><cylinderGeometry args={[0.008, 0.012, 0.75, 4]} /><Mat color="#9a9d9f" ghost={ghost} /></mesh>
    </group>
  );
}

export default function UnitMarker({ unit, isSelected, onClick }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const groupRef = useRef();
  const modelRef = useRef();
  const beaconRef = useRef();
  const ringRef = useRef();
  const isCommand = unit.unit_type === 'COMMAND';
  const isLost = unit.comm_status === 'LOST';
  const commColor = COMM_COLORS[unit.comm_status] || '#888';

  const target = useMemo(() => new THREE.Vector3(
    unit.position.x,
    getTerrainHeight(unit.position.x, -unit.position.z, scenarioType),
    unit.position.z,
  ), [unit.position.x, unit.position.z, scenarioType]);
  const placed = useRef(false);

  useFrame(({ clock }, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (!placed.current) {
      g.position.copy(target);
      placed.current = true;
    }
    // Glide to new positions and face the direction of travel
    const dx = target.x - g.position.x;
    const dz = target.z - g.position.z;
    const moving = Math.hypot(dx, dz) > 0.02;
    g.position.lerp(target, Math.min(1, dt * 1.6));
    if (modelRef.current) {
      if (moving) {
        const cur = modelRef.current.rotation.y;
        // Shortest way round, so a turn never spins through 360°
        const diff = Math.atan2(Math.sin(Math.atan2(dx, dz) - cur), Math.cos(Math.atan2(dx, dz) - cur));
        modelRef.current.rotation.y = cur + diff * Math.min(1, dt * 4);
      }
    }
    const t = clock.getElapsedTime();
    if (beaconRef.current) {
      const blink = isLost ? (Math.sin(t * 6) > 0 ? 3 : 0.1) : 1.6 + Math.sin(t * 2) * 0.6;
      beaconRef.current.material.emissiveIntensity = blink;
    }
    if (ringRef.current) ringRef.current.rotation.z = t * 0.4;
  });

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick?.(unit); }}>
      {!isCommand && (
        <>
          {/* Faction ground ring */}
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
            <ringGeometry args={[0.62, 0.7, 6]} />
            <meshBasicMaterial color={isSelected ? '#ffffff' : '#4aa3ff'} transparent opacity={isLost ? 0.35 : 0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <circleGeometry args={[0.62, 6]} />
            <meshBasicMaterial color="#4aa3ff" transparent opacity={0.08} side={THREE.DoubleSide} />
          </mesh>

          <group ref={modelRef} scale={1.35}>
            {unit.unit_type === 'ARMOR' && <Tank ghost={isLost} />}
            {unit.unit_type === 'INFANTRY' && <Squad ghost={isLost} />}
            {unit.unit_type === 'RECON' && <ReconVehicle ghost={isLost} />}
          </group>

          {/* Comm status beacon */}
          <mesh ref={beaconRef} position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={commColor} emissive={commColor} emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        </>
      )}

      <Html position={[0, isCommand ? 3.6 : 1.55, 0]} center distanceFactor={14} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`unit-label ${isLost ? 'lost' : ''}`}>
          <NatoSymbol affiliation="friendly" type={unit.unit_type} />
          <div className="unit-label-text">
            <span className="unit-label-call">{unit.callsign}</span>
            <span className="unit-label-status" style={{ color: commColor }}>
              {isCommand ? 'HQ' : COMM_TEXT[unit.comm_status]}
              {unit.health < 100 && !isCommand ? ` · STR ${Math.round(unit.health)}%` : ''}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}
