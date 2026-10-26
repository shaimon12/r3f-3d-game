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

console.log('Generating 3D Stylized Race Track with Seamless Smooth Ramp...');

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
// Road top surface is flush with ground: Y = 0.02
// ==========================================
const rampGroup = new THREE.Group();
rampGroup.name = 'Stunt_Ramp_System';
root.add(rampGroup);

const roadWidth = 14;
const roadSurfaceY = 0.02;

// Approach Road before ramp: Z = 75 to Z = 12 (length = 63, center = 43.5)
const approachGeo = new THREE.BoxGeometry(roadWidth, 0.08, 63);
const approach = new THREE.Mesh(approachGeo, materials.asphalt);
approach.position.set(0, roadSurfaceY - 0.04, 43.5);
approach.receiveShadow = true;
rampGroup.add(approach);

// White lane stripes on approach
for (let z = 65; z >= 18; z -= 8) {
  const stripeGeo = new THREE.BoxGeometry(0.35, 0.01, 4);
  const stripe = new THREE.Mesh(stripeGeo, materials.roadLineWhite);
  stripe.position.set(0, roadSurfaceY + 0.005, z);
  rampGroup.add(stripe);
}

// Glowing speed boost chevron arrows on ramp approach (Z = 34, 25, 16)
[34, 25, 16].forEach((zPos) => {
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
  chevron.position.set(0, roadSurfaceY + 0.01, zPos);
  rampGroup.add(chevron);
});

// ------------------------------------------
// THE LAUNCH RAMP
// Length: 22m (Z = 12 to Z = -10)
// Starts seamlessly at Z = 12, Y = 0.02, rises to Y = 4.5m
// ------------------------------------------
const rampWidth = 12;
const rampLength = 22;
const rampHeight = 4.5;
const startZ = 12;
const endZ = -10;

// High resolution ramp profile with tangent-continuous entry
const segments = 24;
const rampVerts = [];
const rampIndices = [];
const hw = rampWidth / 2;

// Add subterranean entry lip at Z = 13 (Y = -0.04) so there is absolute zero step!
rampVerts.push(-hw, -0.04, 13);
rampVerts.push(hw, -0.04, 13);

for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  // Smooth cubic ease-in at the foot of the ramp so the angle increases gradually!
  const curveT = t * t * (3 - 2 * t) * 0.4 + Math.pow(t, 2) * 0.6;
  const z = startZ - t * rampLength;
  const y = roadSurfaceY + curveT * (rampHeight - roadSurfaceY);

  rampVerts.push(-hw, y, z);
  rampVerts.push(hw, y, z);
}

// Build indices including entry lip
for (let i = 0; i <= segments; i++) {
  const r1 = i * 2;
  const r2 = (i + 1) * 2;
  rampIndices.push(r1, r1 + 1, r2);
  rampIndices.push(r1 + 1, r2 + 1, r2);
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
const sideWallShape = new THREE.Shape();
sideWallShape.moveTo(13, -0.04);
for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  const z = startZ - t * rampLength;
  const curveT = t * t * (3 - 2 * t) * 0.4 + Math.pow(t, 2) * 0.6;
  const y = roadSurfaceY + curveT * (rampHeight - roadSurfaceY);
  sideWallShape.lineTo(z, y);
}
sideWallShape.lineTo(endZ, -0.1);
sideWallShape.lineTo(13, -0.1);
sideWallShape.closePath();

const sideExtrude = 0.4;
const sideWallGeo = new THREE.ExtrudeGeometry(sideWallShape, {
  depth: sideExtrude,
  bevelEnabled: false,
});

const leftWall = new THREE.Mesh(sideWallGeo, materials.hazardYellow);
leftWall.rotation.y = -Math.PI / 2;
leftWall.position.set(-hw, 0, 0);
leftWall.castShadow = true;
rampGroup.add(leftWall);

const rightWall = new THREE.Mesh(sideWallGeo, materials.hazardYellow);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(hw - sideExtrude, 0, 0);
rightWall.castShadow = true;
rampGroup.add(rightWall);

// Hazard stripes along the ramp launch lip
const lipGeo = new THREE.BoxGeometry(rampWidth, 0.35, 0.5);
const lip = new THREE.Mesh(lipGeo, materials.hazardBlack);
lip.position.set(0, rampHeight - 0.1, endZ + 0.25);
rampGroup.add(lip);

// ------------------------------------------
// THE LANDING RAMP
// Gap: from Z = -10 to Z = -24
// Landing Ramp: Z = -24 (height 3.8m) to Z = -52 (height 0.02m)
// ------------------------------------------
const landStartZ = -24;
const landEndZ = -52;
const landStartHeight = 3.8;
const landLength = Math.abs(landEndZ - landStartZ);

const landVerts = [];
const landIndices = [];
const lhw = (rampWidth + 3) / 2; // wider landing zone

for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  // Ease smoothly into roadSurfaceY at t = 1
  const easeY = (1 - t) * (1 - t);
  const z = landStartZ - t * landLength;
  const y = roadSurfaceY + easeY * (landStartHeight - roadSurfaceY);

  landVerts.push(-lhw, y, z);
  landVerts.push(lhw, y, z);
}

// Subterranean exit lip at Z = -53 (Y = -0.04)
landVerts.push(-lhw, -0.04, -53);
landVerts.push(lhw, -0.04, -53);

for (let i = 0; i <= segments; i++) {
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
landSideShape.moveTo(landStartZ, -0.1);
for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  const z = landStartZ - t * landLength;
  const y = roadSurfaceY + (1 - t) * (1 - t) * (landStartHeight - roadSurfaceY);
  landSideShape.lineTo(z, y);
}
landSideShape.lineTo(-53, -0.1);
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

// Runout road after landing: Z = -52 to Z = -110 (length = 58, center = -81)
const runoutGeo = new THREE.BoxGeometry(roadWidth, 0.08, 58);
const runout = new THREE.Mesh(runoutGeo, materials.asphalt);
runout.position.set(0, roadSurfaceY - 0.04, -81);
runout.receiveShadow = true;
rampGroup.add(runout);

// Ground Bypass Road around the ramp
const bypassLeftGeo = new THREE.BoxGeometry(10, 0.08, 75);
const bypassLeft = new THREE.Mesh(bypassLeftGeo, materials.asphalt);
bypassLeft.position.set(-13, roadSurfaceY - 0.04, -18);
bypassLeft.receiveShadow = true;
rampGroup.add(bypassLeft);

// ==========================================
// 2. CIRCUIT LOOP ROADS
// ==========================================
const trackGroup = new THREE.Group();
trackGroup.name = 'Circuit_Roads';
root.add(trackGroup);

function createCurvedRoad(centerX, centerZ, innerR, outerR, startAngle, endAngle, numSegs = 32) {
  const verts = [];
  const indices = [];

  for (let i = 0; i <= numSegs; i++) {
    const t = i / numSegs;
    const a = startAngle + t * (endAngle - startAngle);
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    verts.push(centerX + cos * innerR, roadSurfaceY, centerZ + sin * innerR);
    verts.push(centerX + cos * outerR, roadSurfaceY, centerZ + sin * outerR);
  }

  for (let i = 0; i < numSegs; i++) {
    const r1 = i * 2;
    const r2 = (i + 1) * 2;
    indices.push(r1, r2, r1 + 1);
    indices.push(r1 + 1, r2, r2 + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// North Turn (180 deg bend)
const northCurveGeo = createCurvedRoad(35, -110, 28, 42, Math.PI, 0, 36);
const northCurve = new THREE.Mesh(northCurveGeo, materials.asphalt);
northCurve.receiveShadow = true;
trackGroup.add(northCurve);

// East Back-Straight Road
const backStraightGeo = new THREE.BoxGeometry(14, 0.08, 185);
const backStraight = new THREE.Mesh(backStraightGeo, materials.asphalt);
backStraight.position.set(70, roadSurfaceY - 0.04, -17.5);
backStraight.receiveShadow = true;
trackGroup.add(backStraight);

// Center yellow divider stripe on back straight
for (let z = -100; z <= 65; z += 10) {
  const yStripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.01, 5), materials.roadLineYellow);
  yStripe.position.set(70, roadSurfaceY + 0.005, z);
  trackGroup.add(yStripe);
}

// South Turn (180 deg bend)
const southCurveGeo = createCurvedRoad(35, 75, 28, 42, 0, Math.PI, 36);
const southCurve = new THREE.Mesh(southCurveGeo, materials.asphalt);
southCurve.receiveShadow = true;
trackGroup.add(southCurve);

// ==========================================
// 3. APEX CURBS & TRACKSIDE BARRIERS
// ==========================================
function createCurb(x, z, length, rotY) {
  const curbG = new THREE.Group();
  curbG.position.set(x, roadSurfaceY + 0.04, z);
  curbG.rotation.y = rotY;

  const count = Math.floor(length / 2);
  for (let i = 0; i < count; i++) {
    const mat = i % 2 === 0 ? materials.curbRed : materials.curbWhite;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 2.0), mat);
    block.position.z = (i - count / 2) * 2.0;
    curbG.add(block);
  }
  return curbG;
}

trackGroup.add(createCurb(0, -110, 16, 0));
trackGroup.add(createCurb(70, -110, 16, 0));
trackGroup.add(createCurb(70, 75, 16, 0));
trackGroup.add(createCurb(0, 75, 16, 0));

// Trackside Concrete Barriers along outer North Bend
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
// ==========================================
const gantryGroup = new THREE.Group();
gantryGroup.position.set(0, 0, 56);
root.add(gantryGroup);

const pillarGeo = new THREE.BoxGeometry(1.2, 7.5, 1.2);
const leftPillar = new THREE.Mesh(pillarGeo, materials.gantryTruss);
leftPillar.position.set(-8.5, 3.75, 0);
leftPillar.castShadow = true;
gantryGroup.add(leftPillar);

const rightPillar = new THREE.Mesh(pillarGeo, materials.gantryTruss);
rightPillar.position.set(8.5, 3.75, 0);
rightPillar.castShadow = true;
gantryGroup.add(rightPillar);

const beamGeo = new THREE.BoxGeometry(18.5, 1.4, 1.4);
const crossBeam = new THREE.Mesh(beamGeo, materials.gantryTruss);
crossBeam.position.set(0, 7.2, 0);
crossBeam.castShadow = true;
gantryGroup.add(crossBeam);

const signGeo = new THREE.BoxGeometry(12, 1.8, 0.4);
const signBoard = new THREE.Mesh(signGeo, materials.gantryBoard);
signBoard.position.set(0, 7.2, 0.8);
gantryGroup.add(signBoard);

const bannerAccentGeo = new THREE.BoxGeometry(11.5, 0.2, 0.45);
const bannerAccent = new THREE.Mesh(bannerAccentGeo, materials.neonCyan);
bannerAccent.position.set(0, 6.4, 0.85);
gantryGroup.add(bannerAccent);

// Start / Finish Checkered Line on Ground (Z = 56)
for (let x = -6.5; x <= 6.5; x += 1.0) {
  for (let z = -0.5; z <= 0.5; z += 0.5) {
    const isWhite = (Math.round(x) + Math.round(z * 2)) % 2 === 0;
    const tileGeo = new THREE.BoxGeometry(1.0, 0.01, 0.5);
    const tile = new THREE.Mesh(tileGeo, isWhite ? materials.curbWhite : materials.asphalt);
    tile.position.set(x, roadSurfaceY + 0.005, z);
    gantryGroup.add(tile);
  }
}

// Distance Signboards ("100m", "50m", "RAMP AHEAD")
const signs = [
  { z: 44, label: 'RAMP AHEAD' },
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

    const targetPath1 = path.resolve('./src/assets/models/track.glb');
    fs.writeFileSync(targetPath1, buffer);
    console.log(`Saved updated 3D Track model to ${targetPath1} (${buffer.length} bytes)`);

    const targetPath2 = path.resolve('./public/models/track.glb');
    fs.writeFileSync(targetPath2, buffer);
    console.log(`Saved updated 3D Track model to ${targetPath2} (${buffer.length} bytes)`);
  },
  (error) => {
    console.error('Track GLTF Export failed:', error);
    process.exit(1);
  },
  { binary: true }
);
