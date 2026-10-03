/* ── CommandCentre — 3D low-poly command post building ─────── */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function CommandCentre({ position = [0, 0, -8] }) {
  const antennaRef = useRef();

  useFrame(({ clock }) => {
    if (antennaRef.current) {
      // Subtle antenna rotation
      antennaRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
    }
  });

  return (
    <group position={position}>
      {/* Main building */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2, 2.5]} />
        <meshStandardMaterial color="#4a5568" flatShading roughness={0.85} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[3.3, 0.3, 2.8]} />
        <meshStandardMaterial color="#3d4452" flatShading roughness={0.9} />
      </mesh>

      {/* Antenna tower */}
      <group ref={antennaRef} position={[1, 2.3, 0]}>
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 2, 6]} />
          <meshStandardMaterial color="#666" flatShading />
        </mesh>
        {/* Antenna dish */}
        <mesh position={[0.15, 1.8, 0]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.25, 0.15, 8, 1, true]} />
          <meshStandardMaterial color="#888" flatShading side={2} />
        </mesh>
        {/* Blinking light */}
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial
            color="#ff0000"
            emissive="#ff0000"
            emissiveIntensity={2}
          />
        </mesh>
      </group>

      {/* Sandbag perimeter */}
      {[[-1.8, 0, 1.5], [1.8, 0, 1.5], [-1.8, 0, -1.5], [1.8, 0, -1.5]].map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.4]} />
          <meshStandardMaterial color="#8B7355" flatShading roughness={1} />
        </mesh>
      ))}

      {/* Flag */}
      <mesh position={[-1.2, 2.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
        <meshStandardMaterial color="#555" flatShading />
      </mesh>
      <mesh position={[-1.0, 2.6, 0]}>
        <boxGeometry args={[0.4, 0.25, 0.02]} />
        <meshStandardMaterial color="#1a237e" flatShading />
      </mesh>
    </group>
  );
}
