import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';

export default function Terrain() {
  const meshRef = useRef();
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(40, 40, 40, 40);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let height = getTerrainHeight(x, y, scenarioType);
      
      if (scenarioType === 'URBAN') {
        height += (Math.random() * 0.08 - 0.04);
      }
      
      pos.setZ(i, height);
    }
    geo.computeVertexNormals();
    return geo;
  }, [scenarioType]);

  const color = 
    scenarioType === 'MOUNTAIN' ? '#3d4a3e' :
    scenarioType === 'DESERT' ? '#c2b280' :
    scenarioType === 'RIVER' ? '#2d4a2e' : '#2d4a2e';

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color={color}
          flatShading
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
      {scenarioType === 'RIVER' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, -0.8, 0]}>
          <planeGeometry args={[6, 40]} />
          <meshStandardMaterial color="#4a90e2" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
