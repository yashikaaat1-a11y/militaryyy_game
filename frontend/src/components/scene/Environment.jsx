import React from 'react';
import { useGameStore } from '../../stores/gameStore';

export default function Environment() {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');

  const fogColor = 
    scenarioType === 'DESERT' ? '#c2b280' :
    scenarioType === 'MOUNTAIN' ? '#a0b0c0' :
    scenarioType === 'RIVER' ? '#1a2a3a' : '#1a2332';

  const hemiSky = 
    scenarioType === 'DESERT' ? '#e6d690' :
    scenarioType === 'MOUNTAIN' ? '#cce0ff' : '#87ceeb';
  
  const hemiGround =
    scenarioType === 'DESERT' ? '#c2b280' :
    scenarioType === 'MOUNTAIN' ? '#3d4a3e' : '#2d4a2e';

  return (
    <>
      <ambientLight intensity={0.35} color="#b0c4de" />

      <directionalLight
        position={[10, 15, 5]}
        intensity={1.2}
        color="#ffeedd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      <directionalLight
        position={[-8, 8, -5]}
        intensity={0.4}
        color="#aaccee"
      />

      <hemisphereLight args={[hemiSky, hemiGround, 0.5]} />

      <fog attach="fog" args={[fogColor, 20, 50]} />

      <gridHelper
        args={[40, 40, '#1a3a1a', '#1a3a1a']}
        position={[0, 0.01, 0]}
        material-transparent
        material-opacity={0.15}
      />
    </>
  );
}
