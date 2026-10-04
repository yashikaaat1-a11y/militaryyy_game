/* ── Contact Markers — reported (unknown) contacts and revealed hostiles ── */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { useGameStore } from '../../stores/gameStore';
import { NatoSymbol } from './NatoSymbol';

const AMBER = '#ffb340';
const RED = '#ff4d3d';

function Beam({ color, height, opacity }) {
  return (
    <mesh position={[0, height / 2, 0]}>
      <cylinderGeometry args={[0.035, 0.12, height, 8, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function HostileVehicle() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.55, 0.2, 0.9]} />
        <meshStandardMaterial color="#5a2b25" roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, 0.37, 0.05]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.15, 7]} />
        <meshStandardMaterial color="#4a221d" roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, 0.39, -0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.55, 6]} />
        <meshStandardMaterial color="#2d1512" />
      </mesh>
    </group>
  );
}

export default function ContactMarker({ position, confidence, label, isGroundTruth }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const ring = useRef();
  const gem = useRef();
  const y = getTerrainHeight(position.x, -position.z, scenarioType);
  const uncertainty = 0.45 + (1 - confidence) * 1.5;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring.current) ring.current.rotation.z = t * (0.3 + (1 - confidence));
    if (gem.current) {
      gem.current.rotation.y = t * 1.2;
      // Less certain contacts flicker more
      gem.current.material.opacity = 0.55 + Math.sin(t * (2 + (1 - confidence) * 6)) * 0.3;
    }
  });

  if (isGroundTruth) {
    return (
      <group position={[position.x, y, position.z]}>
        <HostileVehicle />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[0.62, 0.72, 4]} />
          <meshBasicMaterial color={RED} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <Beam color={RED} height={3.2} opacity={0.45} />
        <Html position={[0, 1.6, 0]} center distanceFactor={14} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
          <div className="unit-label hostile">
            <NatoSymbol affiliation="hostile" type="ARMOR" />
            <div className="unit-label-text">
              <span className="unit-label-call">ACTUAL</span>
              <span className="unit-label-status">{label}</span>
            </div>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <group position={[position.x, y, position.z]}>
      {/* Uncertainty ring: wider = less sure */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[uncertainty - 0.05, uncertainty, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.25 + confidence * 0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}>
        <circleGeometry args={[uncertainty, 48]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Beam color={AMBER} height={1.8} opacity={0.12 + confidence * 0.22} />
      <mesh ref={gem} position={[0, 1.0, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={AMBER} transparent wireframe toneMapped={false} />
      </mesh>
      <Html position={[0, 1.55, 0]} center distanceFactor={14} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div className="unit-label contact">
          <NatoSymbol affiliation="unknown" size={24} />
          <div className="unit-label-text">
            <span className="unit-label-call">{Math.round(confidence * 100)}%</span>
            <span className="unit-label-status">{label}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}
