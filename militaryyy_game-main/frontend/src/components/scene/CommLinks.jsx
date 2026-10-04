/* ── Communication Links — arcs from units back to HQ, with traffic ── */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { useGameStore } from '../../stores/gameStore';

const LINK_STYLES = {
  NORMAL: { color: '#5fd068', dash: 0, opacity: 0.75, packets: 3, speed: 0.45 },
  DELAYED: { color: '#e8d24a', dash: 0.35, opacity: 0.6, packets: 2, speed: 0.12 },
  DEGRADED: { color: '#f08a2e', dash: 0.18, opacity: 0.5, packets: 2, speed: 0.22 },
  LOST: { color: '#e5483f', dash: 0.08, opacity: 0.22, packets: 0, speed: 0 },
};

function Packet({ curve, offset, style, degraded }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * style.speed + offset) % 1;
    ref.current.position.copy(curve.getPointAt(t));
    // Degraded links drop packets intermittently
    ref.current.visible = !degraded || Math.sin(clock.getElapsedTime() * 9 + offset * 20) > -0.2;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshBasicMaterial color={style.color} toneMapped={false} />
    </mesh>
  );
}

function CommLink({ from, to, status, type }) {
  const lineRef = useRef();
  const style = LINK_STYLES[status] || LINK_STYLES.NORMAL;

  const curve = useMemo(() => {
    const y0 = getTerrainHeight(from[0], -from[1], type) + 3.3;
    const y1 = getTerrainHeight(to[0], -to[1], type) + 0.95;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const mid = new THREE.Vector3((from[0] + to[0]) / 2, Math.max(y0, y1) + 1 + dist * 0.12, (from[1] + to[1]) / 2);
    // Packets travel unit → HQ (reports flowing up)
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(to[0], y1, to[1]), mid, new THREE.Vector3(from[0], y0, from[1]));
  }, [from, to, type]);

  const geometry = useMemo(() => {
    const pts = curve.getPoints(48);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    // Dashed materials need per-vertex line distances, otherwise they render solid
    const dist = [0];
    for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + pts[i].distanceTo(pts[i - 1]));
    geo.setAttribute('lineDistance', new THREE.Float32BufferAttribute(dist, 1));
    return geo;
  }, [curve]);

  useFrame(({ clock }) => {
    const m = lineRef.current?.material;
    if (!m) return;
    if (style.dash) m.dashOffset = -clock.getElapsedTime() * 0.6;
    if (status === 'LOST') m.opacity = 0.12 + Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 0.2;
  });

  return (
    <group>
      <line ref={lineRef} geometry={geometry}>
        {style.dash ? (
          <lineDashedMaterial color={style.color} transparent opacity={style.opacity} dashSize={style.dash} gapSize={style.dash * 0.9} toneMapped={false} />
        ) : (
          <lineBasicMaterial color={style.color} transparent opacity={style.opacity} toneMapped={false} />
        )}
      </line>
      {Array.from({ length: style.packets }, (_, i) => (
        <Packet key={i} curve={curve} offset={i / style.packets} style={style} degraded={status === 'DEGRADED'} />
      ))}
    </group>
  );
}

export default function CommLinks({ units }) {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const command = units.find((u) => u.unit_type === 'COMMAND');
  if (!command) return null;

  const subordinates = units.filter((u) => u.faction === 'FRIENDLY' && u.unit_type !== 'COMMAND');
  const from = [command.position.x, command.position.z];

  return (
    <group>
      {subordinates.map((unit) => (
        <CommLink
          key={unit.id}
          from={from}
          to={[unit.position.x, unit.position.z]}
          status={unit.comm_status}
          type={type}
        />
      ))}
    </group>
  );
}
