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

console.log('Generating 3D Stylized Race Track with Ramp...');

const root = new THREE.Group();
root.name = 'Stylized_Race_Track';

// ==========================================
// Materials
// ==========================================
const materials = {
  asphalt: new THREE.MeshStandardMaterial({
    name: 'Track_Asphalt',
    color: 0x22262d,
    roughness: 0.85,
    metalness: 0.1,
  }),
  asphaltHighlight: new THREE.MeshStandardMaterial({
    name: 'Track_Asphalt_Smooth',
    color: 0x2b3039,
    roughness: 0.75,
    metalness: 0.15,
  }),
  roadLineWhite: new THREE.MeshStandardMaterial({
    name: 'Road_Line_White',
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.1,
  }),
  roadLineYellow: new THREE.MeshStandardMaterial({
    name: 'Road_Line_Yellow',
    color: 0xf59e0b,
    roughness: 0.4,
    metalness: 0.1,
  }),
  curbRed: new THREE.MeshStandardMaterial({
    name: 'Curb_Red',
    color: 0xdc2626,
    roughness: 0.6,
    metalness: 0.15,
  }),
  curbWhite: new THREE.MeshStandardMaterial({
    name: 'Curb_White',
    color: 0xf8fafc,
    roughness: 0.6,
    metalness: 0.15,
  }),
  rampSteel: new THREE.MeshStandardMaterial({
    name: 'Ramp_Steel_Plates',
    color: 0x3b4252,
    roughness: 0.35,
    metalness: 0.8,
  }),
  hazardYellow: new THREE.MeshStandardMaterial({
    name: 'Hazard_Yellow',
    color: 0xfacc15,
    roughness: 0.5,
    metalness: 0.2,
  }),
  hazardBlack: new THREE.MeshStandardMaterial({
    name: 'Hazard_Black',
    color: 0x111827,
    roughness: 0.7,
    metalness: 0.2,
  }),
  neonCyan: new THREE.MeshStandardMaterial({
    name: 'Neon_Cyan_Chevron',
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5,
  }),
  barrierRed: new THREE.MeshStandardMaterial({
    name: 'Barrier_Red',
    color: 0xef4444,
    roughness: 0.5,
    metalness: 0.1,
  }),
  barrierWhite: new THREE.MeshStandardMaterial({
    name: 'Barrier_White',
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.1,
  }),
  gantryTruss: new THREE.MeshStandardMaterial({
    name: 'Gantry_Truss_Metal',
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.25,
  }),
  gantryBoard: new THREE.MeshStandardMaterial({
    name: 'Gantry_Sign_Board',
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.3,
  }),
};

// ==========================================
// 1. STUNT STRAIGHT & MEGA LAUNCH RAMP
// Positioned along X = 0 (Road width = 14m)
// ==========================================
const rampGroup = new THREE.Group();
rampGroup.name = 'Stunt_Ramp_System';
root.add(rampGroup);

const roadWidth = 14;

// Approach Road before ramp: Z = 60 to Z = 15
const approachGeo = new THREE.BoxGeometry(roadWidth, 0.2, 45);
const approach = new THREE.Mesh(approachGeo, materials.asphalt);
approach.position.set(0, 0.1, 37.5);
approach.receiveShadow = true;
rampGroup.add(approach);

// White lane stripes on approach
for (let z = 55; z >= 20; z -= 8) {
  const stripeGeo = new THREE.BoxGeometry(0.35, 0.02, 4);
  const stripe = new THREE.Mesh(stripeGeo, materials.roadLineWhite);
  stripe.position.set(0, 0.21, z);
  rampGroup.add(stripe);
}

// Glowing speed boost chevron arrows on ramp approach (Z = 32, 24, 16)
[32, 24, 16].forEach((zPos) => {
  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(-3, -1.5);
  chevronShape.lineTo(0, 1.5);
  chevronShape.lineTo(3, -1.5);
  chevronShape.lineTo(1.8, -1.5);
  chevronShape.lineTo(0, 0.2);
  chevronShape.lineTo(-1.8, -1.5);
  chevronShape.closePath();

  const chevronGeo = new THREE.ShapeGeometry(chevronShape);
  const chevron = new THREE.Mesh(chevronGeo, materials.neonCyan);
  chevron.rotation.x = -Math.PI / 2;
  chevron.position.set(0, 0.22, zPos);
  rampGroup.add(chevron);
});

// ------------------------------------------
// THE LAUNCH RAMP
// Length: 22m (Z = 12 to Z = -10)
// Height: 0m to 4.5m
// Width: 12m
// ------------------------------------------
const rampWidth = 12;
const rampLength = 22;
const rampHeight = 4.5;
const startZ = 12;
const endZ = -10;

// Curved launch ramp surface using segmented strip
const segments = 16;
const rampVerts = [];
const rampIndices = [];
const hw = rampWidth / 2;

for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  // Subtle exponential curve giving extra upward kick at the lip
  const curveT = Math.pow(t, 1.3);
  const z = startZ - t * rampLength;
  const y = curveT * rampHeight;

  // Left vertex, Right vertex
  rampVerts.push(-hw, y, z);
  rampVerts.push(hw, y, z);
}

for (let i = 0; i < segments; i++) {
  const row1 = i * 2;
  const row2 = (i + 1) * 2;

  // Triangle 1
  rampIndices.push(row1, row1 + 1, row2);
  // Triangle 2
  rampIndices.push(row1 + 1, row2 + 1, row2);
}

const rampSurfaceGeo = new THREE.BufferGeometry();
rampSurfaceGeo.setAttribute('position', new THREE.Float32BufferAttribute(rampVerts, 3));
rampSurfaceGeo.setIndex(rampIndices);
rampSurfaceGeo.computeVertexNormals();

const rampMesh = new THREE.Mesh(rampSurfaceGeo, materials.rampSteel);
rampMesh.castShadow = true;
rampMesh.receiveShadow = true;
rampGroup.add(rampMesh);

// Solid side walls under the launch ramp
const sideWallLeftShape = new THREE.Shape();
sideWallLeftShape.moveTo(startZ, 0);
for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  const z = startZ - t * rampLength;
  const y = Math.pow(t, 1.3) * rampHeight;
  sideWallLeftShape.lineTo(z, y);
}
sideWallLeftShape.lineTo(endZ, 0);
sideWallLeftShape.closePath();

const sideExtrude = 0.4;
const sideWallGeo = new THREE.ExtrudeGeometry(sideWallLeftShape, {
  depth: sideExtrude,
  bevelEnabled: false,
});

// Left Side Wall (with hazard yellow)
const leftWall = new THREE.Mesh(sideWallGeo, materials.hazardYellow);
leftWall.rotation.y = -Math.PI / 2;
leftWall.position.set(-hw, 0, 0);
leftWall.castShadow = true;
rampGroup.add(leftWall);

// Right Side Wall
const rightWall = new THREE.Mesh(sideWallGeo, materials.hazardYellow);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(hw - sideExtrude, 0, 0);
rightWall.castShadow = true;
rampGroup.add(rightWall);

// Hazard stripes along the ramp launch lip
const lipGeo = new THREE.BoxGeometry(rampWidth, 0.4, 0.6);
const lip = new THREE.Mesh(lipGeo, materials.hazardBlack);
lip.position.set(0, rampHeight - 0.1, endZ + 0.3);
rampGroup.add(lip);

// ------------------------------------------
// THE LANDING RAMP
// Gap: from Z = -10 to Z = -24 (14 meter airborne flight gap!)
// Landing Ramp: Z = -24 (height 3.8m) to Z = -52 (height 0m)
// ------------------------------------------
const landStartZ = -24;
const landEndZ = -52;
const landStartHeight = 3.8;
const landLength = Math.abs(landEndZ - landStartZ);

const landVerts = [];
const landIndices = [];
const lhw = (rampWidth + 3) / 2; // slightly wider landing zone

for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  // Smooth transition curve easing into flat ground
  const easeY = (1 - t) * (1 - t);
  const z = landStartZ - t * landLength;
  const y = easeY * landStartHeight;

  landVerts.push(-lhw, y, z);
  landVerts.push(lhw, y, z);
}

for (let i = 0; i < segments; i++) {
  const r1 = i * 2;
  const r2 = (i + 1) * 2;
  landIndices.push(r1, r1 + 1, r2);
  landIndices.push(r1 + 1, r2 + 1, r2);
}

const landGeo = new THREE.BufferGeometry();
landGeo.setAttribute('position', new THREE.Float32BufferAttribute(landVerts, 3));
landGeo.setIndex(landIndices);
landGeo.computeVertexNormals();

const landMesh = new THREE.Mesh(landGeo, materials.asphaltHighlight);
landMesh.receiveShadow = true;
rampGroup.add(landMesh);

// Landing ramp side retaining walls
const landSideShape = new THREE.Shape();
landSideShape.moveTo(landStartZ, 0);
for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  const z = landStartZ - t * landLength;
  const y = (1 - t) * (1 - t) * landStartHeight;
  landSideShape.lineTo(z, y);
}
landSideShape.lineTo(landEndZ, 0);
landSideShape.closePath();

const landSideGeo = new THREE.ExtrudeGeometry(landSideShape, {
  depth: 0.4,
  bevelEnabled: false,
});

const landWallLeft = new THREE.Mesh(landSideGeo, materials.curbRed);
landWallLeft.rotation.y = -Math.PI / 2;
landWallLeft.position.set(-lhw, 0, 0);
rampGroup.add(landWallLeft);

const landWallRight = new THREE.Mesh(landSideGeo, materials.curbRed);
landWallRight.rotation.y = -Math.PI / 2;
landWallRight.position.set(lhw - 0.4, 0, 0);
rampGroup.add(landWallRight);

// Flat Runout road after landing: Z = -52 to Z = -110
const runoutGeo = new THREE.BoxGeometry(roadWidth, 0.2, 58);
const runout = new THREE.Mesh(runoutGeo, materials.asphalt);
runout.position.set(0, 0.1, -81);
runout.receiveShadow = true;
rampGroup.add(runout);

// Ground Bypass Road around the ramp (for players who want to drive beside the jump)
const bypassLeftGeo = new THREE.BoxGeometry(10, 0.15, 75);
const bypassLeft = new THREE.Mesh(bypassLeftGeo, materials.asphalt);
bypassLeft.position.set(-13, 0.08, -18);
bypassLeft.receiveShadow = true;
rampGroup.add(bypassLeft);

// ==========================================
// 2. FULL RACE TRACK CIRCUIT (Loop Road)
// High-Speed Arena Layout with Banked Turns
// ==========================================
const trackGroup = new THREE.Group();
trackGroup.name = 'Circuit_Roads';
root.add(trackGroup);

// North Sweeping Curve: connects (0, -110) to (60, -110) via large semi-circle
function createCurvedRoad(centerX, centerZ, innerR, outerR, startAngle, endAngle, numSegs = 24) {
  const verts = [];
  const indices = [];

  for (let i = 0; i <= numSegs; i++) {
    const t = i / numSegs;
    const a = startAngle + t * (endAngle - startAngle);
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // Inner vertex
    verts.push(centerX + cos * innerR, 0.1, centerZ + sin * innerR);
    // Outer vertex
    verts.push(centerX + cos * outerR, 0.1, centerZ + sin * outerR);
  }

  for (let i = 0; i < numSegs; i++) {
    const r1 = i * 2;
    const r2 = (i + 1) * 2;
    verts.length; // dummy
    indices.push(r1, r2, r1 + 1);
    indices.push(r1 + 1, r2, r2 + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// North Turn (180 degree bend)
const northCurveGeo = createCurvedRoad(35, -110, 28, 42, Math.PI, 0, 32);
const northCurve = new THREE.Mesh(northCurveGeo, materials.asphalt);
northCurve.receiveShadow = true;
trackGroup.add(northCurve);

// East Back-Straight Road (runs from Z = -110 to Z = 75 at X = 70)
const backStraightGeo = new THREE.BoxGeometry(14, 0.2, 185);
const backStraight = new THREE.Mesh(backStraightGeo, materials.asphalt);
backStraight.position.set(70, 0.1, -17.5);
backStraight.receiveShadow = true;
trackGroup.add(backStraight);

// Center yellow divider stripe on back straight
for (let z = -100; z <= 65; z += 10) {
  const yStripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 5), materials.roadLineYellow);
  yStripe.position.set(70, 0.21, z);
  trackGroup.add(yStripe);
}

// South Turn (180 degree bend connecting X = 70, Z = 75 back to X = 0, Z = 75)
const southCurveGeo = createCurvedRoad(35, 75, 28, 42, 0, Math.PI, 32);
const southCurve = new THREE.Mesh(southCurveGeo, materials.asphalt);
southCurve.receiveShadow = true;
trackGroup.add(southCurve);

// Road segment connecting South Curve to Approach Straight (Z = 75 down to Z = 60 at X = 0)
const southConnectorGeo = new THREE.BoxGeometry(14, 0.2, 25);
const southConnector = new THREE.Mesh(southConnectorGeo, materials.asphalt);
southConnector.position.set(0, 0.1, 72.5);
southConnector.receiveShadow = true;
trackGroup.add(southConnector);

// ==========================================
// 3. APEX CURBS & TRACKSIDE BARRIERS
// Red & White Racing Curbs
// ==========================================
function createCurb(x, z, length, rotY) {
  const curbG = new THREE.Group();
  curbG.position.set(x, 0.15, z);
  curbG.rotation.y = rotY;

  const count = Math.floor(length / 2);
  for (let i = 0; i < count; i++) {
    const mat = i % 2 === 0 ? materials.curbRed : materials.curbWhite;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 2.0), mat);
    block.position.z = (i - count / 2) * 2.0;
    curbG.add(block);
  }
  return curbG;
}

// Curbs on North Turn
trackGroup.add(createCurb(0, -110, 16, 0));
trackGroup.add(createCurb(70, -110, 16, 0));

// Curbs on South Turn
trackGroup.add(createCurb(70, 75, 16, 0));
trackGroup.add(createCurb(0, 75, 16, 0));

// Trackside Concrete Barriers along outer North Bend (stops car from flying out)
for (let a = Math.PI; a >= 0; a -= Math.PI / 16) {
  const x = 35 + Math.cos(a) * 44;
  const z = -110 + Math.sin(a) * 44;
  const barrierMat = Math.sin(a * 4) > 0 ? materials.barrierRed : materials.barrierWhite;
  const bMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 4.2), barrierMat);
  bMesh.position.set(x, 0.7, z);
  bMesh.rotation.y = -a + Math.PI / 2;
  bMesh.castShadow = true;
  trackGroup.add(bMesh);
}

// Trackside Concrete Barriers along outer South Bend
for (let a = 0; a <= Math.PI; a += Math.PI / 16) {
  const x = 35 + Math.cos(a) * 44;
  const z = 75 + Math.sin(a) * 44;
  const barrierMat = Math.sin(a * 4) > 0 ? materials.barrierRed : materials.barrierWhite;
  const bMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 4.2), barrierMat);
  bMesh.position.set(x, 0.7, z);
  bMesh.rotation.y = -a + Math.PI / 2;
  bMesh.castShadow = true;
  trackGroup.add(bMesh);
}

// ==========================================
// 4. START / FINISH OVERHEAD GANTRY ARCH
// Positioned at Z = 50, X = 0 (before the ramp straight)
// ==========================================
const gantryGroup = new THREE.Group();
gantryGroup.position.set(0, 0, 52);
root.add(gantryGroup);

// Left Pillar Truss
const pillarGeo = new THREE.BoxGeometry(1.2, 7.5, 1.2);
const leftPillar = new THREE.Mesh(pillarGeo, materials.gantryTruss);
leftPillar.position.set(-8.5, 3.75, 0);
leftPillar.castShadow = true;
gantryGroup.add(leftPillar);

// Right Pillar Truss
const rightPillar = new THREE.Mesh(pillarGeo, materials.gantryTruss);
rightPillar.position.set(8.5, 3.75, 0);
rightPillar.castShadow = true;
gantryGroup.add(rightPillar);

// Cross Truss Beam
const beamGeo = new THREE.BoxGeometry(18.5, 1.4, 1.4);
const crossBeam = new THREE.Mesh(beamGeo, materials.gantryTruss);
crossBeam.position.set(0, 7.2, 0);
crossBeam.castShadow = true;
gantryGroup.add(crossBeam);

// Overhead Banner Sign Board
const signGeo = new THREE.BoxGeometry(12, 1.8, 0.4);
const signBoard = new THREE.Mesh(signGeo, materials.gantryBoard);
signBoard.position.set(0, 7.2, 0.8);
gantryGroup.add(signBoard);

// Neon Accent Banner on Sign
const bannerAccentGeo = new THREE.BoxGeometry(11.5, 0.2, 0.45);
const bannerAccent = new THREE.Mesh(bannerAccentGeo, materials.neonCyan);
bannerAccent.position.set(0, 6.4, 0.85);
gantryGroup.add(bannerAccent);

// Start / Finish Checkered Line on Ground (Z = 52)
for (let x = -6.5; x <= 6.5; x += 1.0) {
  for (let z = -0.5; z <= 0.5; z += 0.5) {
    const isWhite = (Math.round(x) + Math.round(z * 2)) % 2 === 0;
    const tileGeo = new THREE.BoxGeometry(1.0, 0.02, 0.5);
    const tile = new THREE.Mesh(tileGeo, isWhite ? materials.curbWhite : materials.asphalt);
    tile.position.set(x, 0.21, z);
    gantryGroup.add(tile);
  }
}

// Distance Signboards ("100m", "50m", "RAMP AHEAD")
const signs = [
  { z: 42, label: 'RAMP AHEAD' },
  { z: 30, label: '50m' },
];
signs.forEach(({ z }) => {
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.0, 12), materials.gantryTruss);
  signPost.position.set(-8.2, 1.5, z);
  root.add(signPost);

  const signPlate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.1), materials.hazardYellow);
  signPlate.position.set(-8.2, 2.5, z);
  signPlate.rotation.y = Math.PI / 12;
  root.add(signPlate);
});

// ==========================================
// 5. EXPORT TRACK TO BINARY GLTF (.glb)
// ==========================================
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (glbArrayBuffer) => {
    const buffer = Buffer.from(glbArrayBuffer);

    // Save to /src/assets/models/track.glb
    const targetPath1 = path.resolve('./src/assets/models/track.glb');
    fs.writeFileSync(targetPath1, buffer);
    console.log(`Saved 3D Track model to ${targetPath1} (${buffer.length} bytes)`);

    // Also copy to /public/models/track.glb
    const targetPath2 = path.resolve('./public/models/track.glb');
    fs.writeFileSync(targetPath2, buffer);
    console.log(`Saved 3D Track model to ${targetPath2} (${buffer.length} bytes)`);
  },
  (error) => {
    console.error('Track GLTF Export failed:', error);
    process.exit(1);
  },
  { binary: true }
);
