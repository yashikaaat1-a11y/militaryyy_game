import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';

function Building({ position, width = 1.2, height = 2, depth = 1.2, color = '#5a6275' }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const [x, y, z] = position;
  const terrainY = getTerrainHeight(x, -z, scenarioType);

  return (
    <group position={[x, terrainY, z]}>
      {/* Main structure */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} flatShading roughness={0.85} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, height + 0.3, 0]} castShadow>
        <coneGeometry args={[width * 0.8, 0.6, 4]} />
        <meshStandardMaterial color="#4a3f35" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

function LargeBuilding({ position, color = '#4f5668' }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const [x, y, z] = position;
  const terrainY = getTerrainHeight(x, -z, scenarioType);

  return (
    <group position={[x, terrainY, z]}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 3, 2]} />
        <meshStandardMaterial color={color} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.2, 0]} castShadow>
        <boxGeometry args={[2.8, 0.4, 2.3]} />
        <meshStandardMaterial color="#3d4452" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

export default function Buildings() {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');

  if (scenarioType === 'DESERT') {
    return (
      <group>
        {/* Scattered small outposts and barriers */}
        <LargeBuilding position={[0.5, 0, -11]} color="#b5a682" />
        <Building position={[-3, 0, 3]} height={1.2} color="#a89a74" />
        <Building position={[4, 0, 5]} height={1.0} color="#b5a682" />
        <Building position={[-5, 0, -2]} height={1.5} color="#9e916b" />
      </group>
    );
  }

  if (scenarioType === 'RIVER') {
    return (
      <group>
        {/* River outposts and docks */}
        <LargeBuilding position={[-7, 0, -2]} color="#4a5568" />
        <Building position={[-1, 0, 6]} height={1.5} color="#5e6a7d" />
        <Building position={[3, 0, -5]} height={1.2} color="#636b7e" />
      </group>
    );
  }

  if (scenarioType === 'MOUNTAIN') {
    return (
      <group>
        {/* High altitude outposts */}
        <LargeBuilding position={[0, 0, -9]} color="#3e4a42" />
        <Building position={[3, 1, 8]} height={1.5} color="#45544a" />
        <Building position={[-5, 2, 5]} height={2.0} color="#38453c" />
      </group>
    );
  }

  // URBAN (Default)
  return (
    <group>
      {/* Urban cluster */}
      <Building position={[-3, 0, 3]} height={1.8} />
      <Building position={[-1.5, 0, 4]} height={2.2} color="#636b7e" />
      <Building position={[-2.5, 0, 5]} height={1.5} />
      <Building position={[0, 0, 3.5]} height={2.5} color="#525d6e" />
      <Building position={[1.5, 0, 4.5]} height={1.8} />

      {/* Command area buildings */}
      <LargeBuilding position={[0.5, 0, -7]} />
      <Building position={[-2, 0, -6.5]} height={1.5} color="#6b7588" />

      {/* Scattered structures */}
      <Building position={[6, 0, 3]} height={1.2} />
      <Building position={[7, 0, 5]} height={1.8} />
      <Building position={[-5, 0, 7]} height={1.5} color="#5e6a7d" />
    </group>
  );
}
