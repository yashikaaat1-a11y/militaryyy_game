/* ── Scatter — instanced trees and rocks, kept clear of roads, buildings and units ── */
import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { layoutFor, seededRandom, distToPolyline } from './layouts';

/** Merge parts into one geometry with baked vertex colours (one draw call per prop type). */
function coloured(parts) {
  return mergeGeometries(parts.map(([geo, color]) => {
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo.index ? geo.toNonIndexed() : geo;
  }));
}

const PROPS = {
  broadleaf: () => coloured([
    [new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5).translate(0, 0.25, 0), '#4a3828'],
    [new THREE.IcosahedronGeometry(0.42, 0).translate(0, 0.78, 0), '#3f6b34'],
    [new THREE.IcosahedronGeometry(0.3, 0).translate(0.15, 1.05, 0.05), '#4d7a3b'],
  ]),
  pine: () => coloured([
    [new THREE.CylinderGeometry(0.04, 0.07, 0.4, 5).translate(0, 0.2, 0), '#45342a'],
    [new THREE.ConeGeometry(0.45, 0.8, 6).translate(0, 0.7, 0), '#2f4f37'],
    [new THREE.ConeGeometry(0.33, 0.65, 6).translate(0, 1.1, 0), '#36583d'],
    [new THREE.ConeGeometry(0.2, 0.45, 6).translate(0, 1.45, 0), '#3d6244'],
  ]),
  palm: () => coloured([
    [new THREE.CylinderGeometry(0.04, 0.07, 1.3, 5).translate(0, 0.65, 0), '#7a6040'],
    [new THREE.ConeGeometry(0.6, 0.25, 7).translate(0, 1.35, 0), '#5f7a3a'],
  ]),
  rock: () => coloured([[new THREE.DodecahedronGeometry(0.3, 0), '#ffffff']]),
};

function useInstances(count, makeGeo, place, colorize, deps) {
  const ref = useRef();
  const geo = useMemo(() => makeGeo(), [makeGeo]);
  const items = useMemo(place, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(it.tilt, it.rot, it.tilt * 0.5));
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sx));
      mesh.setMatrixAt(i, m);
      if (colorize) mesh.setColorAt(i, colorize(it, c));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, colorize]);

  return { ref, geo, max: count };
}

function placeProps(type, kind, count, tag) {
  const L = layoutFor(type);
  const rand = seededRandom(`${tag}-${type}`);
  const out = [];
  let tries = 0;
  while (out.length < count && tries < count * 40) {
    tries += 1;
    const x = (rand() * 2 - 1) * 15.3;
    const z = (rand() * 2 - 1) * 15.3;
    if (L.roads.some((r) => distToPolyline(x, z, r.points) < r.width / 2 + 0.7)) continue;
    if (L.buildings.some(([bx, bz, w, , d]) => Math.abs(x - bx) < w / 2 + 0.6 && Math.abs(z - bz) < d / 2 + 0.6)) continue;
    if (Math.hypot(x - L.hq[0], z - L.hq[1]) < 3.4) continue;
    if (L.clear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.7)) continue;
    if (L.water && Math.abs(x - L.water.x) < L.water.width / 2 + 0.6) continue;
    const y = getTerrainHeight(x, -z, type);
    if (kind !== 'rock' && type === 'MOUNTAIN' && y > 4.2) continue; // tree line
    const s = kind === 'rock' ? 0.5 + rand() * 1.1 : 0.75 + rand() * 0.6;
    out.push({
      x, z, y: y - 0.04,
      rot: rand() * Math.PI * 2,
      tilt: kind === 'rock' ? rand() * 0.6 : (rand() - 0.5) * 0.12,
      sx: s * (kind === 'rock' ? 1 + rand() * 0.5 : 1),
      sy: s * (kind === 'rock' ? 0.6 + rand() * 0.5 : 0.85 + rand() * 0.35),
      shade: rand(),
    });
  }
  return out;
}

export default function Scatter() {
  const type = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const L = layoutFor(type);
  const rockTint = useMemo(() => {
    const base = new THREE.Color(L.palette.rock);
    return (it, c) => c.copy(base).multiplyScalar(0.75 + it.shade * 0.5);
  }, [L.palette.rock]);
  const treeTint = useMemo(() => (it, c) => c.setScalar(0.8 + it.shade * 0.35), []);

  const trees = useInstances(140, PROPS[L.treeKind], () => placeProps(type, L.treeKind, L.trees, 'trees'), treeTint, [type]);
  const rocks = useInstances(60, PROPS.rock, () => placeProps(type, 'rock', L.rocks, 'rocks'), rockTint, [type]);

  return (
    <group>
      <instancedMesh key={`t-${type}`} ref={trees.ref} args={[trees.geo, undefined, trees.max]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`r-${type}`} ref={rocks.ref} args={[rocks.geo, undefined, rocks.max]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}
