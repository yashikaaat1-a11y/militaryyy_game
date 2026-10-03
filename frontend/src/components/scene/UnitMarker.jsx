/* ── Unit Marker — low-poly 3D representation of a tactical unit ── */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import { getTerrainHeight } from '../../utils/terrainUtils';
import { useGameStore } from '../../stores/gameStore';

const FACTION_COLORS = {
  FRIENDLY: '#2196f3',
  UNKNOWN: '#ff9800',
  HOSTILE: '#f44336',
};

const TYPE_SHAPES = {
  COMMAND: 'octahedron',
  INFANTRY: 'box',
  ARMOR: 'box',
  RECON: 'cone',
};

const COMM_STATUS_COLORS = {
  NORMAL: '#4caf50',
  DELAYED: '#ffeb3b',
  DEGRADED: '#ff9800',
  LOST: '#f44336',
};

export default function UnitMarker({ unit, isSelected, onClick }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const groupRef = useRef();
  const glowRef = useRef();
  const factionColor = FACTION_COLORS[unit.faction] || '#888';
  const commColor = COMM_STATUS_COLORS[unit.comm_status] || '#888';
  const isLost = unit.comm_status === 'LOST';

  const terrainY = getTerrainHeight(unit.position.x, -unit.position.z, scenarioType);
  const pos = [unit.position.x, terrainY, unit.position.z];

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle hover animation
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 2) * 0.05 + 0.6;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.1);
      if (isLost) {
        glowRef.current.material.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 5) * 0.3;
      }
    }
  });

  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onClick?.(unit); }}>
      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Unit body */}
      <group ref={groupRef}>
        {unit.unit_type === 'COMMAND' ? (
          <mesh castShadow>
            <octahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial
              color={factionColor}
              flatShading
              emissive={factionColor}
              emissiveIntensity={0.3}
              transparent={isLost}
              opacity={isLost ? 0.4 : 1}
            />
          </mesh>
        ) : unit.unit_type === 'RECON' ? (
          <mesh castShadow>
            <coneGeometry args={[0.35, 0.7, 4]} />
            <meshStandardMaterial
              color={factionColor}
              flatShading
              emissive={factionColor}
              emissiveIntensity={0.2}
              transparent={isLost}
              opacity={isLost ? 0.4 : 1}
            />
          </mesh>
        ) : unit.unit_type === 'ARMOR' ? (
          <group>
            <mesh castShadow>
              <boxGeometry args={[0.7, 0.35, 0.5]} />
              <meshStandardMaterial
                color={factionColor}
                flatShading
                emissive={factionColor}
                emissiveIntensity={0.2}
                transparent={isLost}
                opacity={isLost ? 0.4 : 1}
              />
            </mesh>
            {/* Turret */}
            <mesh position={[0.1, 0.25, 0]} castShadow>
              <boxGeometry args={[0.35, 0.2, 0.3]} />
              <meshStandardMaterial color={factionColor} flatShading transparent={isLost} opacity={isLost ? 0.4 : 1} />
            </mesh>
            {/* Barrel */}
            <mesh position={[0.4, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
              <meshStandardMaterial color="#333" flatShading />
            </mesh>
          </group>
        ) : (
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.6, 0.5]} />
            <meshStandardMaterial
              color={factionColor}
              flatShading
              emissive={factionColor}
              emissiveIntensity={0.2}
              transparent={isLost}
              opacity={isLost ? 0.4 : 1}
            />
          </mesh>
        )}

        {/* Comm status indicator (small sphere on top) */}
        <mesh position={[0, 0.55, 0]} ref={glowRef}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color={commColor}
            emissive={commColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      </group>

      {/* Label */}
      <Html position={[0, 1.5, 0]} center distanceFactor={15} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
          border: `1px solid ${commColor}`,
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: 'bold', color: factionColor }}>{unit.callsign}</div>
          <div style={{ fontSize: '9px', color: commColor }}>{unit.comm_status}</div>
        </div>
      </Html>
    </group>
  );
}
