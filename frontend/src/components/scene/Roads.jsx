import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';

function Road({ points, width = 0.6 }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');

  const path = useMemo(() => {
    // If only 2 points, add a midpoint to make the curve work well
    let pts = points;
    if (points.length === 2) {
      const p0 = points[0];
      const p1 = points[1];
      pts = [
        p0,
        [(p0[0] + p1[0])/2, 0, (p0[2] + p1[2])/2],
        p1
      ];
    }
    
    const v3points = pts.map((p) => {
      const terrainY = getTerrainHeight(p[0], -p[2], scenarioType) + 0.05;
      return new THREE.Vector3(p[0], terrainY, p[2]);
    });
    return new THREE.CatmullRomCurve3(v3points, false, 'catmullrom', 0.1);
  }, [points, scenarioType]);

  return (
    <mesh castShadow receiveShadow>
      <tubeGeometry args={[path, Math.max(20, points.length * 10), width / 2, 8, false]} />
      <meshStandardMaterial color="#3a3a3a" roughness={0.95} flatShading />
    </mesh>
  );
}

export default function Roads() {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');

  if (scenarioType === 'DESERT') {
    return (
      <group>
        {/* Straight desert tracks */}
        <Road points={[[-15, 0, -2], [15, 0, -2]]} width={0.8} />
        <Road points={[[0, 0, -15], [0, 0, 15]]} width={0.6} />
      </group>
    );
  }

  if (scenarioType === 'RIVER') {
    return (
      <group>
        {/* River paths / small bridge */}
        <Road points={[[-10, 0, 5], [10, 0, 5]]} width={0.5} />
      </group>
    );
  }

  if (scenarioType === 'MOUNTAIN') {
    return (
      <group>
        {/* Mountain trails */}
        <Road points={[[-5, 0, -15], [-2, 0, -8], [0, 0, 0], [4, 0, 6], [8, 0, 10]]} width={0.4} />
      </group>
    );
  }

  // URBAN (Default)
  return (
    <group>
      {/* Main road north-south */}
      <Road points={[
        [0, 0, -15],
        [0, 0, -5],
        [1, 0, 0],
        [1, 0, 8],
        [0, 0, 15],
      ]} />
      {/* Cross road east-west */}
      <Road points={[
        [-15, 0, 0],
        [-5, 0, 0],
        [0, 0, 0],
        [5, 0, 0],
        [15, 0, 0],
      ]} />
      {/* Side road */}
      <Road points={[
        [-5, 0, -5],
        [-3, 0, -3],
        [-1, 0, 0],
      ]} width={0.4} />
    </group>
  );
}
