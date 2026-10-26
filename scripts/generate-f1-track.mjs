import * as fs from 'fs';
import * as path from 'path';

// Polyfill FileReader for Node.js environment
class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
}
globalThis.FileReader = FileReader;

import * as THREE from '../node_modules/three/build/three.module.js';
import { GLTFExporter } from '../node_modules/three/examples/jsm/exporters/GLTFExporter.js';

console.log('Generating 3D Professional Formula 1 Grand Prix Circuit...');

const root = new THREE.Group();
root.name = 'F1_Grand_Prix_Circuit';

// ==========================================
// 1. Materials
// ==========================================
const materials = {
  asphaltTrack: new THREE.MeshStandardMaterial({
    name: 'F1_Asphalt_Surface',
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.08,
  }),
  asphaltRunoff: new THREE.MeshStandardMaterial({
    name: 'F1_Runoff_Tarmac',
    color: 0x333842,
    roughness: 0.88,
    metalness: 0.1,
  }),
  curbRed: new THREE.MeshStandardMaterial({
    name: 'F1_Rumble_Curb_Red',
    color: 0xd91e2e,
    roughness: 0.65,
    metalness: 0.15,
  }),
  curbWhite: new THREE.MeshStandardMaterial({
    name: 'F1_Rumble_Curb_White',
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.15,
  }),
  tireRed: new THREE.MeshStandardMaterial({
    name: 'Tire_Barrier_Red',
    color: 0xcc1829,
    roughness: 0.85,
    metalness: 0.1,
  }),
  tireWhite: new THREE.MeshStandardMaterial({
    name: 'Tire_Barrier_White',
    color: 0xededed,
    roughness: 0.85,
    metalness: 0.1,
  }),
  tireBlack: new THREE.MeshStandardMaterial({
    name: 'Tire_Barrier_Black',
    color: 0x181a1d,
    roughness: 0.9,
    metalness: 0.08,
  }),
  tireYellow: new THREE.MeshStandardMaterial({
    name: 'Tire_Barrier_Yellow',
    color: 0xf59e0b,
    roughness: 0.85,
    metalness: 0.1,
  }),
  armcoSteel: new THREE.MeshStandardMaterial({
    name: 'Armco_Guardrail_Steel',
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.25,
  }),
  gantryTruss: new THREE.MeshStandardMaterial({
    name: 'F1_Gantry_Truss',
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.3,
  }),
  gantryBoard: new THREE.MeshStandardMaterial({
    name: 'F1_Gantry_Display',
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.4,
  }),
  neonRedLight: new THREE.MeshStandardMaterial({
    name: 'F1_Start_Light_Red',
    color: 0xff0022,
    emissive: 0xff0022,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  }),
  paintWhite: new THREE.MeshStandardMaterial({
    name: 'Track_Paint_White',
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.1,
  }),
  paintYellow: new THREE.MeshStandardMaterial({
    name: 'Track_Paint_Yellow',
    color: 0xfacc15,
    roughness: 0.5,
    metalness: 0.1,
  }),
  pitWallConcrete: new THREE.MeshStandardMaterial({
    name: 'Pit_Wall_Concrete',
    color: 0x64748b,
    roughness: 0.8,
    metalness: 0.2,
  }),
};

// ==========================================
// 2. F1 Track Spline Definition (Clockwise Circuit)
// Length ~ 588 meters, perfectly proportioned for 500x500 map
// ==========================================
const waypoints = [
  // Sector 1: Main Pit Straight
  new THREE.Vector3(-45, 0,  70),  // Pole position / Start grid
  new THREE.Vector3(-45, 0,  10),  // Mid pit straight
  new THREE.Vector3(-45, 0, -50),  // End of pit straight (brake zone)

  // Sector 1: Turn 1 & 2 (Right-hand chicane)
  new THREE.Vector3(-35, 0, -85),  // Turn 1 entry
  new THREE.Vector3(-10, 0, -105), // Turn 1 apex
  new THREE.Vector3( 15, 0, -100), // Turn 2 exit

  // Sector 2: Esses / High Speed Sweeper
  new THREE.Vector3( 45, 0, -80),  // Turn 3
  new THREE.Vector3( 70, 0, -65),  // Turn 4 entry
  new THREE.Vector3( 85, 0, -40),  // Onto Back DRS Straight

  // Sector 2: Back DRS Straight
  new THREE.Vector3( 85, 0,   0),  // Mid DRS straight
  new THREE.Vector3( 85, 0,  45),  // Hairpin brake zone

  // Sector 3: The Grand Prix Hairpin
  new THREE.Vector3( 75, 0,  85),  // Hairpin entry
  new THREE.Vector3( 50, 0, 105),  // Hairpin apex
  new THREE.Vector3( 20, 0,  95),  // Hairpin exit

  // Sector 3: Final Complex into Pit Straight
  new THREE.Vector3(  0, 0,  75),  // Chicane entry
  new THREE.Vector3(-20, 0,  78),  // Chicane apex
  new THREE.Vector3(-38, 0,  85),  // Final corner onto main straight
];

const circuitCurve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal', 0.5);

// ==========================================
// 3. Generate Asphalt Road Surface with Realistic Vertex-Colored Tarmac
// ==========================================
const numSamples = 280;
const roadHalfWidth = 7.5; // 15m wide track
const roadY = 0.04; // Sits clean above 0 floor

const roadPositions = [];
const roadNormals = [];
const roadColors = [];
const roadIndices = [];

// Arrays to store edge boundary coordinates for tire barriers
const outerEdgePoints = [];
const innerEdgePoints = [];
const trackSamples = [];

for (let i = 0; i < numSamples; i++) {
  const t = i / numSamples;
  const pt = circuitCurve.getPointAt(t);
  const tangent = circuitCurve.getTangentAt(t).normalize();

  // Horizontal normal vector perpendicular to tangent (points right)
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  trackSamples.push({ pt, tangent, right, t });

  // 4 lateral vertices across the road width (left curb edge, left groove, right groove, right curb edge)
  // This allows modeling the dark rubbered-in racing groove in the asphalt!
  const leftPos = new THREE.Vector3().copy(pt).addScaledVector(right, -roadHalfWidth);
  const leftGroove = new THREE.Vector3().copy(pt).addScaledVector(right, -roadHalfWidth * 0.4);
  const rightGroove = new THREE.Vector3().copy(pt).addScaledVector(right, roadHalfWidth * 0.4);
  const rightPos = new THREE.Vector3().copy(pt).addScaledVector(right, roadHalfWidth);

  // Store perimeter coordinates for tire barriers
  innerEdgePoints.push(leftPos.clone());
  outerEdgePoints.push(rightPos.clone());

  // Vertices for this ring
  [leftPos, leftGroove, rightGroove, rightPos].forEach((v, vIndex) => {
    roadPositions.push(v.x, roadY, v.z);
    roadNormals.push(0, 1, 0);

    // Realistic asphalt color grading:
    // vIndex 1 and 2 are in the racing line (darker rubbered-in asphalt #1c1f24)
    // vIndex 0 and 3 are track edges (medium-dark tarmac #2c3038) with random gravel noise
    const noise = (Math.random() - 0.5) * 0.03;
    const isRacingLine = vIndex === 1 || vIndex === 2;
    const baseR = isRacingLine ? 0.12 : 0.17;
    const baseG = isRacingLine ? 0.13 : 0.18;
    const baseB = isRacingLine ? 0.15 : 0.21;

    roadColors.push(
      Math.max(0, baseR + noise),
      Math.max(0, baseG + noise),
      Math.max(0, baseB + noise)
    );
  });
}

// Generate quad indices connecting consecutive road rings
for (let i = 0; i < numSamples; i++) {
  const next = (i + 1) % numSamples;
  const r1 = i * 4;
  const r2 = next * 4;

  for (let c = 0; c < 3; c++) {
    const a = r1 + c;
    const b = r1 + c + 1;
    const d = r2 + c;
    const e = r2 + c + 1;

    roadIndices.push(a, d, b);
    roadIndices.push(b, d, e);
  }
}

const roadGeo = new THREE.BufferGeometry();
roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
roadGeo.setAttribute('color', new THREE.Float32BufferAttribute(roadColors, 3));
roadGeo.setIndex(roadIndices);

const roadMesh = new THREE.Mesh(roadGeo, materials.asphaltTrack);
roadMesh.receiveShadow = true;
root.add(roadMesh);

// ==========================================
// 4. Red-and-White FIA Rumble Strips (Corner Curbs)
// Sawtooth 3D profile that provides physical rumble feedback
// ==========================================
const curbGroup = new THREE.Group();
curbGroup.name = 'Rumble_Strips';
root.add(curbGroup);

// Identify corners by measuring tangent angular delta between adjacent samples
const curbSegments = [];
for (let i = 0; i < numSamples; i++) {
  const prev = (i - 1 + numSamples) % numSamples;
  const next = (i + 1) % numSamples;

  const tPrev = trackSamples[prev].tangent;
  const tNext = trackSamples[next].tangent;
  const angleDelta = tPrev.angleTo(tNext); // curvature

  // If track is curving (angleDelta > 0.02)
  if (angleDelta > 0.022) {
    const crossY = tPrev.x * tNext.z - tPrev.z * tNext.x;
    // crossY > 0 -> turning left (inner is left); crossY < 0 -> turning right (inner is right)
    const isTurningRight = crossY < 0;
    curbSegments.push({ i, isTurningRight });
  }
}

// Generate 3D curb blocks along detected curves
const curbBlockWidth = 1.3;
const curbHeight = 0.08;

curbSegments.forEach(({ i, isTurningRight }, idx) => {
  const s = trackSamples[i];
  const side = isTurningRight ? 1 : -1; // place curb on the apex / exit side
  const basePos = new THREE.Vector3().copy(s.pt).addScaledVector(s.right, side * roadHalfWidth);

  const isRed = Math.floor(idx / 2) % 2 === 0;
  const curbMat = isRed ? materials.curbRed : materials.curbWhite;

  const blockGeo = new THREE.BoxGeometry(curbBlockWidth, curbHeight, 2.4);
  const block = new THREE.Mesh(blockGeo, curbMat);

  // Position and orient parallel to track tangent
  block.position.set(basePos.x + s.right.x * (side * curbBlockWidth * 0.5), roadY + curbHeight * 0.5, basePos.z + s.right.z * (side * curbBlockWidth * 0.5));
  block.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
  block.receiveShadow = true;
  curbGroup.add(block);
});

// ==========================================
// 5. Continuous Tire Barriers & Armco Crash Walls Along Edges
// Height = 1.8m, Depth = 1.2m
// Wraps BOTH edges of the entire track so the car cannot escape!
// ==========================================
const barrierGroup = new THREE.Group();
barrierGroup.name = 'Tire_Barriers_And_Armco';
root.add(barrierGroup);

const barrierHeight = 1.8;
const barrierThickness = 1.2;

function buildContinuousBarrier(edgePoints, isOuter) {
  const count = edgePoints.length;
  // Step every 2 samples (~4.2 meters)
  for (let i = 0; i < count; i += 2) {
    const p1 = edgePoints[i];
    const nextIdx = (i + 2) % count;
    const p2 = edgePoints[nextIdx];

    const dir = new THREE.Vector3().subVectors(p2, p1);
    const segLen = dir.length();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const angle = Math.atan2(dir.x, dir.z);

    // Offset slightly outside the track tarmac so it sits right against the curb
    const s = trackSamples[i];
    const offsetSide = isOuter ? 1 : -1;
    const barrierCenter = mid.clone().addScaledVector(s.right, offsetSide * (barrierThickness * 0.5 + 0.15));

    // 1. Armco Steel Backing Barrier (High structural stiffness)
    const armcoGeo = new THREE.BoxGeometry(0.2, barrierHeight, segLen * 1.05);
    const armco = new THREE.Mesh(armcoGeo, materials.armcoSteel);
    armco.position.set(
      barrierCenter.x + s.right.x * (offsetSide * (barrierThickness * 0.45)),
      roadY + barrierHeight * 0.5,
      barrierCenter.z + s.right.z * (offsetSide * (barrierThickness * 0.45))
    );
    armco.rotation.y = angle;
    armco.castShadow = true;
    barrierGroup.add(armco);

    // 2. Multi-Tier High-Impact Tire Barrier Stacks (Fronting the wall)
    // Alternate colors: Red, White, Yellow, Black (official F1 FIA tire stack colorway)
    const colorCycle = Math.floor(i / 2) % 4;
    const tireMat =
      colorCycle === 0 ? materials.tireRed :
      colorCycle === 1 ? materials.tireWhite :
      colorCycle === 2 ? materials.tireYellow : materials.tireBlack;

    // Solid collision barrier block representing bundled tire stacks
    const tireBlockGeo = new THREE.BoxGeometry(barrierThickness, barrierHeight * 0.9, segLen * 1.02);
    const tireBlock = new THREE.Mesh(tireBlockGeo, tireMat);
    tireBlock.position.set(barrierCenter.x, roadY + (barrierHeight * 0.9) * 0.5, barrierCenter.z);
    tireBlock.rotation.y = angle;
    tireBlock.castShadow = true;
    barrierGroup.add(tireBlock);

    // Visual circular tire stacks embossed on the front face facing the track
    const numTires = Math.max(2, Math.floor(segLen / 1.3));
    for (let t = 0; t < numTires; t++) {
      const frac = (t + 0.5) / numTires;
      const tPos = new THREE.Vector3().lerpVectors(p1, p2, frac);

      // 3 vertical stacked tires
      for (let tier = 0; tier < 3; tier++) {
        const tireMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.38, 16),
          tireMat
        );
        tireMesh.rotation.z = Math.PI / 2;
        tireMesh.rotation.y = angle;
        tireMesh.position.set(
          tPos.x + s.right.x * (offsetSide * 0.5),
          roadY + 0.22 + tier * 0.44,
          tPos.z + s.right.z * (offsetSide * 0.5)
        );
        barrierGroup.add(tireMesh);
      }
    }
  }
}

// Build barrier along outer perimeter
buildContinuousBarrier(outerEdgePoints, true);
// Build barrier along inner perimeter
buildContinuousBarrier(innerEdgePoints, false);

// ==========================================
// 6. F1 Starting Grid, Pit Wall & Gantry Arch (Sector 1)
// ==========================================
const f1Features = new THREE.Group();
f1Features.name = 'F1_Grand_Prix_Features';
root.add(f1Features);

// 1. Start / Finish Checkered Line (at Z = 50, X = -45)
for (let x = -45 - roadHalfWidth; x <= -45 + roadHalfWidth; x += 1.0) {
  for (let z = 49; z <= 51; z += 0.5) {
    const isWhite = (Math.round(x) + Math.round(z * 2)) % 2 === 0;
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.01, 0.5),
      isWhite ? materials.paintWhite : materials.tireBlack
    );
    tile.position.set(x, roadY + 0.005, z);
    f1Features.add(tile);
  }
}

// 2. 10 Staggered F1 Starting Grid Slots (P1 to P10)
for (let slot = 0; slot < 10; slot++) {
  const isRightSide = slot % 2 === 0; // P1 is on the right/racing line
  const slotX = -45 + (isRightSide ? 2.5 : -2.5);
  const slotZ = 56 + slot * 6.5; // Staggered every 6.5m behind the start line (Z = 50)

  // Yellow Pole Position Marker for P1
  const boxMat = slot === 0 ? materials.paintYellow : materials.paintWhite;

  // Staggered grid box front line (car faces -Z, so front line is at slotZ - 2.1)
  const frontLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.15), boxMat);
  frontLine.position.set(slotX, roadY + 0.005, slotZ - 2.1);
  f1Features.add(frontLine);

  // Grid box side lines
  [-1.2, 1.2].forEach((offset) => {
    const sideLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 4.2), boxMat);
    sideLine.position.set(slotX + offset, roadY + 0.005, slotZ);
    f1Features.add(sideLine);
  });
}

// 3. FIA Overhead Starting Lights Gantry (at Z = 50, X = -45)
const gantryG = new THREE.Group();
gantryG.position.set(-45, 0, 50);

// Left & Right Support Truss Towers
[-roadHalfWidth - 1.2, roadHalfWidth + 1.2].forEach((xOffset) => {
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.5, 1.2), materials.gantryTruss);
  tower.position.set(xOffset, 4.25, 0);
  tower.castShadow = true;
  gantryG.add(tower);
});

// Overhead Horizontal Truss Beam
const trussBeam = new THREE.Mesh(new THREE.BoxGeometry(roadHalfWidth * 2 + 3.5, 1.4, 1.4), materials.gantryTruss);
trussBeam.position.set(0, 8.2, 0);
trussBeam.castShadow = true;
gantryG.add(trussBeam);

// 5 FIA Red Starting Light Pods (The iconic "Lights Out and Away We Go!")
for (let light = -2; light <= 2; light++) {
  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), materials.gantryBoard);
  pod.position.set(light * 1.5, 7.8, 0.85);
  gantryG.add(pod);

  for (let lamp = -1; lamp <= 1; lamp++) {
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), materials.neonRedLight);
    bulb.position.set(light * 1.5, 7.8 + lamp * 0.45, 1.11);
    gantryG.add(bulb);
  }
}
f1Features.add(gantryG);

// 4. Concrete Pit Wall with Timing Stands (along right side of Main Straight: X = -36.5, Z = 80 to -40)
const pitWallGeo = new THREE.BoxGeometry(1.2, 1.4, 120);
const pitWall = new THREE.Mesh(pitWallGeo, materials.pitWallConcrete);
pitWall.position.set(-36.2, roadY + 0.7, 20);
pitWall.castShadow = true;
f1Features.add(pitWall);

// Team Pit Perches & Screens along Pit Wall
for (let z = 60; z >= -20; z -= 18) {
  const perch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 3.8), materials.gantryTruss);
  perch.position.set(-34.5, roadY + 1.1, z);
  perch.castShadow = true;
  f1Features.add(perch);

  // Monitor screens facing pit wall
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 2.4), materials.gantryBoard);
  screen.position.set(-35.2, roadY + 1.8, z);
  f1Features.add(screen);
}

// 5. Brake Distance Marker Boards (150m, 100m, 50m) approaching Turn 1
const brakeMarkers = [
  { z: -15, label: '150' },
  { z: -30, label: '100' },
  { z: -45, label: '50' },
];
brakeMarkers.forEach(({ z }) => {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 12), materials.gantryTruss);
  post.position.set(-45 - roadHalfWidth - 1.8, 1.6, z);
  f1Features.add(post);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.2), materials.paintWhite);
  board.position.set(-45 - roadHalfWidth - 1.8, 2.6, z);
  f1Features.add(board);
});

// 6. DRS Zone Gantry on Back Straight (at X = 85, Z = -35)
const drsGantry = new THREE.Group();
drsGantry.position.set(85, 0, -35);

[-roadHalfWidth - 1.2, roadHalfWidth + 1.2].forEach((xOffset) => {
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 8.0, 1.0), materials.gantryTruss);
  p.position.set(xOffset, 4.0, 0);
  drsGantry.add(p);
});

const drsBeam = new THREE.Mesh(new THREE.BoxGeometry(roadHalfWidth * 2 + 3.2, 1.6, 0.8), materials.gantryBoard);
drsBeam.position.set(0, 7.5, 0);
drsGantry.add(drsBeam);

// Glowing green DRS neon accent
const drsSign = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.8, 0.85), new THREE.MeshStandardMaterial({
  color: 0x10b981,
  emissive: 0x10b981,
  emissiveIntensity: 1.8,
}));
drsSign.position.set(0, 7.5, 0.05);
drsGantry.add(drsSign);
f1Features.add(drsGantry);

// ==========================================
// 6.5. Generate Simplified Physics Collision Mesh
// A seamless continuous manifold ribbon for the road surface + vertical perimeter barrier walls.
// Eliminates all internal step edges, jagged tire facets, and decal box snags!
// ==========================================
const colPositions = [];
const colIndices = [];

const colRoadHalfWidth = roadHalfWidth + 1.3; // 8.8m (covers road + curbs)
const colBarrierHeight = 2.2; // 2.2m tall containment walls

for (let i = 0; i < numSamples; i++) {
  const s = trackSamples[i];
  const left = new THREE.Vector3().copy(s.pt).addScaledVector(s.right, -colRoadHalfWidth);
  const right = new THREE.Vector3().copy(s.pt).addScaledVector(s.right, colRoadHalfWidth);

  // 0: Road Left at Y = roadY
  colPositions.push(left.x, roadY, left.z);
  // 1: Road Right at Y = roadY
  colPositions.push(right.x, roadY, right.z);
  // 2: Outer Wall Top (above right)
  colPositions.push(right.x, colBarrierHeight, right.z);
  // 3: Inner Wall Top (above left)
  colPositions.push(left.x, colBarrierHeight, left.z);
}

for (let i = 0; i < numSamples; i++) {
  const next = (i + 1) % numSamples;
  const b1 = i * 4;
  const b2 = next * 4;

  const L1 = b1 + 0, R1 = b1 + 1, W_R1 = b1 + 2, W_L1 = b1 + 3;
  const L2 = b2 + 0, R2 = b2 + 1, W_R2 = b2 + 2, W_L2 = b2 + 3;

  // 1. Smooth Road Surface Ribbon (Normal UP)
  colIndices.push(L1, L2, R1);
  colIndices.push(R1, L2, R2);

  // 2. Continuous Outer Barrier Wall (Double-sided for robust collision)
  colIndices.push(R1, W_R1, R2);
  colIndices.push(R2, W_R1, W_R2);
  colIndices.push(R2, W_R1, R1);
  colIndices.push(W_R2, W_R1, R2);

  // 3. Continuous Inner Barrier Wall (Double-sided for robust collision)
  colIndices.push(L1, L2, W_L1);
  colIndices.push(L2, W_L2, W_L1);
  colIndices.push(W_L1, L2, L1);
  colIndices.push(W_L1, W_L2, L2);
}

const colGeo = new THREE.BufferGeometry();
colGeo.setAttribute('position', new THREE.Float32BufferAttribute(colPositions, 3));
colGeo.setIndex(colIndices);
colGeo.computeVertexNormals();

const collisionMesh = new THREE.Mesh(
  colGeo,
  new THREE.MeshBasicMaterial({ name: 'Collision_Material', visible: false })
);
collisionMesh.name = 'Simplified_Collision_Mesh';
root.add(collisionMesh);

// ==========================================
// 7. EXPORT F1 TRACK TO BINARY GLTF (.glb)
// ==========================================
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (glbArrayBuffer) => {
    const buffer = Buffer.from(glbArrayBuffer);

    const targetPath1 = path.resolve('./src/assets/models/track.glb');
    fs.writeFileSync(targetPath1, buffer);
    console.log(`Saved F1 Circuit model to ${targetPath1} (${buffer.length} bytes)`);

    const targetPath2 = path.resolve('./public/models/track.glb');
    fs.writeFileSync(targetPath2, buffer);
    console.log(`Saved F1 Circuit model to ${targetPath2} (${buffer.length} bytes)`);
  },
  (error) => {
    console.error('F1 Track GLTF Export failed:', error);
    process.exit(1);
  },
  { binary: true }
);
