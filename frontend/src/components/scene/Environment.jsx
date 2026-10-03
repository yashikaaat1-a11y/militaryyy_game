/* ── Environment — lighting and atmosphere per terrain ─────── */
import React from 'react';
import { Sparkles } from '@react-three/drei';
import { useGameStore } from '../../stores/gameStore';
import { layoutFor } from './layouts';

export default function Environment() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const { sky } = layoutFor(type);

  return (
    <>
      <color attach="background" args={[sky.bg]} />
      <fog attach="fog" args={[sky.fog, 42, 95]} />

      <hemisphereLight args={[sky.hemiSky, sky.hemiGround, 0.55]} />
      <ambientLight intensity={0.12} />

      {/* Key light: low sun for long shadows across the table */}
      <directionalLight
        position={sky.keyPos}
        intensity={2.4 * sky.exposure}
        color={sky.key}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* Cool fill from the opposite side, and a rim light to separate the block from the table */}
      <directionalLight position={[-sky.keyPos[0], 9, -sky.keyPos[2]]} intensity={0.45} color={sky.fill} />
      <directionalLight position={[0, 6, -24]} intensity={0.35} color="#9fb7d1" />

      {/* Dust drifting in the light */}
      <Sparkles count={70} scale={[30, 5, 30]} position={[0, 2.5, 0]} size={1.6} speed={0.25} opacity={0.35} color={sky.key} />
    </>
  );
}
