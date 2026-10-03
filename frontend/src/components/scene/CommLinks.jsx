/* ── Communication Links — visual lines between Command and units ── */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const LINK_STYLES = {
  NORMAL: { color: '#4caf50', dashSize: 0, opacity: 0.8, width: 2 },
  DELAYED: { color: '#ffeb3b', dashSize: 0.3, opacity: 0.6, width: 2 },
  DEGRADED: { color: '#ff9800', dashSize: 0.2, opacity: 0.5, width: 1.5 },
  LOST: { color: '#f44336', dashSize: 0.15, opacity: 0.25, width: 1 },
};

function CommLink({ from, to, status }) {
  const lineRef = useRef();
  const style = LINK_STYLES[status] || LINK_STYLES.NORMAL;
  const isDashed = style.dashSize > 0;

  const points = useMemo(() => {
    return [
      new THREE.Vector3(from[0], 0.8, from[2]),
      new THREE.Vector3(
        (from[0] + to[0]) / 2,
        1.5 + (status === 'LOST' ? 0.3 : 0.8),
        (from[2] + to[2]) / 2
      ),
      new THREE.Vector3(to[0], 0.8, to[2]),
    ];
  }, [from, to, status]);

  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
  }, [points]);

  const linePoints = useMemo(() => {
    return curve.getPoints(30);
  }, [curve]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    // Dashed materials need per-vertex line distances, otherwise they render solid
    const dist = [0];
    for (let i = 1; i < linePoints.length; i++) {
      dist.push(dist[i - 1] + linePoints[i].distanceTo(linePoints[i - 1]));
    }
    geo.setAttribute('lineDistance', new THREE.Float32BufferAttribute(dist, 1));
    return geo;
  }, [linePoints]);

  useFrame(({ clock }) => {
    if (lineRef.current && isDashed) {
      lineRef.current.material.dashOffset = -clock.getElapsedTime() * 2;
    }
    if (lineRef.current && status === 'LOST') {
      lineRef.current.material.opacity = 0.1 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry}>
      {isDashed ? (
        <lineDashedMaterial
          color={style.color}
          transparent
          opacity={style.opacity}
          dashSize={style.dashSize}
          gapSize={style.dashSize}
          linewidth={style.width}
        />
      ) : (
        <lineBasicMaterial
          color={style.color}
          transparent
          opacity={style.opacity}
          linewidth={style.width}
        />
      )}
    </line>
  );
}

export default function CommLinks({ units }) {
  const command = units.find((u) => u.unit_type === 'COMMAND');
  if (!command) return null;

  const subordinates = units.filter(
    (u) => u.faction === 'FRIENDLY' && u.unit_type !== 'COMMAND'
  );

  return (
    <group>
      {subordinates.map((unit) => (
        <CommLink
          key={unit.id}
          from={[command.position.x, 0, command.position.z]}
          to={[unit.position.x, 0, unit.position.z]}
          status={unit.comm_status}
        />
      ))}
    </group>
  );
}
