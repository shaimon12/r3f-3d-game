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

console.log('Generating 3D Sleek Aerodynamic Sports Car GLB...');

const root = new THREE.Group();
root.name = 'Apex_GT_Hypercar';

// ==========================================
// Materials
// ==========================================
const materials = {
  paintRed: new THREE.MeshStandardMaterial({
    name: 'Sports_Car_Paint_Rosso',
    color: 0xdf1638,
    metalness: 0.78,
    roughness: 0.18,
  }),
  carbonFiber: new THREE.MeshStandardMaterial({
    name: 'Exposed_Carbon_Fiber',
    color: 0x1a1d22,
    metalness: 0.35,
    roughness: 0.38,
  }),
  satinBlack: new THREE.MeshStandardMaterial({
    name: 'Satin_Black_Aero',
    color: 0x111316,
    metalness: 0.2,
    roughness: 0.65,
  }),
  glassCanopy: new THREE.MeshStandardMaterial({
    name: 'Tinted_Cockpit_Canopy',
    color: 0x0f172a,
    metalness: 0.3,
    roughness: 0.05,
    transparent: true,
    opacity: 0.72,
  }),
  ledDrl: new THREE.MeshStandardMaterial({
    name: 'LED_Headlight_DRL',
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  }),
  taillightBar: new THREE.MeshStandardMaterial({
    name: 'Taillight_LED_Bar',
    color: 0xff1e38,
    emissive: 0xff002b,
    emissiveIntensity: 1.8,
    roughness: 0.1,
  }),
  titanium: new THREE.MeshStandardMaterial({
    name: 'Titanium_Exhaust',
    color: 0x94a3b8,
    metalness: 0.95,
    roughness: 0.12,
  }),
  rimAlloy: new THREE.MeshStandardMaterial({
    name: 'Forged_Sports_Alloy',
    color: 0xc4c7cc,
    metalness: 0.9,
    roughness: 0.2,
  }),
  brakeDisc: new THREE.MeshStandardMaterial({
    name: 'Carbon_Ceramic_Rotor',
    color: 0x525866,
    metalness: 0.85,
    roughness: 0.35,
  }),
  caliperYellow: new THREE.MeshStandardMaterial({
    name: 'Brembo_Yellow_Caliper',
    color: 0xfacc15,
    metalness: 0.3,
    roughness: 0.3,
  }),
  tireRubber: new THREE.MeshStandardMaterial({
    name: 'Racing_Slick_Rubber',
    color: 0x1e2024,
    roughness: 0.85,
    metalness: 0.08,
  }),
  mirrorGlass: new THREE.MeshStandardMaterial({
    name: 'Aero_Mirror_Glass',
    color: 0xe2e8f0,
    metalness: 0.98,
    roughness: 0.05,
  }),
  interiorDark: new THREE.MeshStandardMaterial({
    name: 'Alcantara_Racing_Interior',
    color: 0x1e2229,
    roughness: 0.9,
    metalness: 0.05,
  }),
};

// ==========================================
// Chassis / Main Body Group
// (Coordinates: Front = -Z, Rear = +Z, Right = +X, Left = -X, Up = +Y)
// Total Length: 4.65m, Width: 2.04m, Height: 1.18m
// ==========================================
const chassis = new THREE.Group();
chassis.name = 'Chassis';
root.add(chassis);

// 1. Lower Main Hull (Chassis Tub)
const tubGeo = new THREE.BoxGeometry(1.88, 0.30, 4.4);
const tub = new THREE.Mesh(tubGeo, materials.paintRed);
tub.position.set(0, 0.35, 0);
tub.castShadow = true;
tub.receiveShadow = true;
chassis.add(tub);

// Flat Underbody Undertray (Carbon Fiber Ground Effect Floor)
const underFloorGeo = new THREE.BoxGeometry(1.92, 0.04, 4.5);
const underFloor = new THREE.Mesh(underFloorGeo, materials.carbonFiber);
underFloor.position.set(0, 0.20, 0);
chassis.add(underFloor);

// 2. Front Aerodynamic Splitter & Nose
// Front Splitter blade
const splitterGeo = new THREE.BoxGeometry(1.98, 0.04, 0.65);
const splitter = new THREE.Mesh(splitterGeo, materials.carbonFiber);
splitter.position.set(0, 0.20, -2.15);
splitter.castShadow = true;
chassis.add(splitter);

// Splitter Endplate Winglets (Left & Right)
[-1, 1].forEach((side) => {
  const wingletGeo = new THREE.BoxGeometry(0.04, 0.16, 0.45);
  const winglet = new THREE.Mesh(wingletGeo, materials.carbonFiber);
  winglet.position.set(side * 0.98, 0.26, -2.15);
  chassis.add(winglet);
});

// Front Bumper / Sculpted Nose with Large Aerodynamic Air Dams
const noseGeo = new THREE.BoxGeometry(1.84, 0.28, 0.60);
const nose = new THREE.Mesh(noseGeo, materials.paintRed);
nose.position.set(0, 0.34, -2.05);
nose.castShadow = true;
chassis.add(nose);

// Twin Front Air Intakes (Dark Mesh)
[-0.48, 0.48].forEach((xPos) => {
  const intakeGeo = new THREE.BoxGeometry(0.52, 0.16, 0.10);
  const intake = new THREE.Mesh(intakeGeo, materials.satinBlack);
  intake.position.set(xPos, 0.30, -2.36);
  chassis.add(intake);
});

// 3. Sculpted Hood with Aerodynamic Radiator Extraction Vents
// Slopes smoothly from cowl (Z = -0.75, Y = 0.75) down to nose (Z = -2.25, Y = 0.45)
const hoodGeo = new THREE.BufferGeometry();
const hwCowl = 0.88;
const hwNose = 0.72;
const hoodVerts = new Float32Array([
  // Center main deck
  -hwCowl, 0.75, -0.75,   hwCowl, 0.75, -0.75,   hwNose, 0.46, -2.15,
  -hwCowl, 0.75, -0.75,   hwNose, 0.46, -2.15,  -hwNose, 0.46, -2.15,
  // Left sculpted fender slope
  -0.98, 0.58, -0.75,   -hwCowl, 0.75, -0.75,   -hwNose, 0.46, -2.15,
  -0.98, 0.58, -0.75,   -hwNose, 0.46, -2.15,   -0.92, 0.42, -2.15,
  // Right sculpted fender slope
   hwCowl, 0.75, -0.75,   0.98, 0.58, -0.75,     hwNose, 0.46, -2.15,
   0.98, 0.58, -0.75,     0.92, 0.42, -2.15,     hwNose, 0.46, -2.15,
]);
hoodGeo.setAttribute('position', new THREE.BufferAttribute(hoodVerts, 3));
hoodGeo.computeVertexNormals();
const hoodMesh = new THREE.Mesh(hoodGeo, materials.paintRed);
hoodMesh.castShadow = true;
hoodMesh.receiveShadow = true;
chassis.add(hoodMesh);

// Twin Carbon Fiber Hood Vents
[-0.32, 0.32].forEach((xPos) => {
  const ventGeo = new THREE.BoxGeometry(0.24, 0.02, 0.55);
  const vent = new THREE.Mesh(ventGeo, materials.carbonFiber);
  vent.position.set(xPos, 0.62, -1.35);
  vent.rotation.x = -0.18;
  chassis.add(vent);
});

// 4. Ultra-Sleek LED Headlights (Horizontal Laser/Blade Aesthetic)
[-1, 1].forEach((side) => {
  const x = side * 0.72;
  const hlGroup = new THREE.Group();
  hlGroup.position.set(x, 0.52, -2.12);

  // Black backing recess
  const backingGeo = new THREE.BoxGeometry(0.38, 0.07, 0.12);
  const backing = new THREE.Mesh(backingGeo, materials.satinBlack);
  backing.rotation.y = side * 0.22;
  hlGroup.add(backing);

  // Glowing High-Intensity DRL LED Blade
  const drlGeo = new THREE.BoxGeometry(0.36, 0.035, 0.04);
  const drl = new THREE.Mesh(drlGeo, materials.ledDrl);
  drl.position.set(0, 0, -0.05);
  drl.rotation.y = side * 0.22;
  hlGroup.add(drl);

  chassis.add(hlGroup);
});

// 5. Teardrop Cockpit Canopy & Cabin
// Aerodynamic teardrop canopy curving from Z = -0.70 to Z = 0.95
const canopyGeo = new THREE.BufferGeometry();
const roofTopY = 1.18;
const cowlY = 0.75;
const rearDeckY = 0.82;

// Front Windshield (curved raked glass)
const windshieldGroup = new THREE.Group();
windshieldGroup.position.set(0, 0.96, -0.32);
windshieldGroup.rotation.x = 0.68; // aggressive 38 degree low-profile rake
const wsGeo = new THREE.BoxGeometry(1.32, 0.78, 0.04);
const wsMesh = new THREE.Mesh(wsGeo, materials.glassCanopy);
windshieldGroup.add(wsMesh);
chassis.add(windshieldGroup);

// Carbon Fiber Roof Centerline Panel
const roofGeo = new THREE.BoxGeometry(1.22, 0.05, 1.25);
const roof = new THREE.Mesh(roofGeo, materials.carbonFiber);
roof.position.set(0, roofTopY - 0.02, 0.25);
roof.castShadow = true;
chassis.add(roof);

// Rear Engine Bay Cover Glass (Sloping fastback backlight)
const rearGlassGroup = new THREE.Group();
rearGlassGroup.position.set(0, 0.98, 1.15);
rearGlassGroup.rotation.x = -0.62;
const rgGeo = new THREE.BoxGeometry(1.18, 0.85, 0.04);
const rgMesh = new THREE.Mesh(rgGeo, materials.glassCanopy);
rearGlassGroup.add(rgMesh);
chassis.add(rearGlassGroup);

// Side Window Glass & Carbon A/B/C Pillars
[-1, 1].forEach((side) => {
  const x = side * 0.65;
  const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 1.25), materials.glassCanopy);
  sideWin.position.set(x, 0.96, 0.22);
  chassis.add(sideWin);

  // Carbon A-Pillar
  const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), materials.carbonFiber);
  aPillar.position.set(side * 0.66, 0.96, -0.32);
  aPillar.rotation.x = 0.68;
  aPillar.rotation.z = -side * 0.15;
  chassis.add(aPillar);

  // Carbon C-Pillar
  const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.14), materials.carbonFiber);
  cPillar.position.set(side * 0.66, 0.98, 1.10);
  cPillar.rotation.x = -0.62;
  cPillar.rotation.z = side * 0.12;
  chassis.add(cPillar);
});

// 6. Sculpted Side Profile, Skirts & Side Air Intakes
[-1, 1].forEach((side) => {
  // Lower Carbon Fiber Side Skirt with Rear Winglet
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.5), materials.carbonFiber);
  skirt.position.set(side * 0.98, 0.20, 0);
  chassis.add(skirt);

  const skirtWinglet = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.28), materials.carbonFiber);
  skirtWinglet.position.set(side * 1.02, 0.26, 0.95);
  chassis.add(skirtWinglet);

  // Wide muscular rear fender flare (wider track at rear!)
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 1.6), materials.paintRed);
  fender.position.set(side * 0.94, 0.52, 1.25);
  fender.castShadow = true;
  chassis.add(fender);

  // Muscular front fender flare
  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.35, 1.4), materials.paintRed);
  frontFender.position.set(side * 0.92, 0.50, -1.35);
  frontFender.castShadow = true;
  chassis.add(frontFender);

  // Side Intercooler Air Intake Scoop (In front of rear wheel)
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.36), materials.carbonFiber);
  scoop.position.set(side * 0.94, 0.44, 0.48);
  chassis.add(scoop);

  // Carbon Aero Side Mirror
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(side * 0.82, 0.82, -0.45);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.04), materials.carbonFiber);
  mirrorGroup.add(stem);

  const mirrorShell = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.08, 0.09), materials.carbonFiber);
  mirrorShell.position.set(side * 0.12, 0, 0);
  mirrorGroup.add(mirrorShell);

  const mirrorLens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), materials.mirrorGlass);
  mirrorLens.position.set(side * 0.12, 0, 0.05);
  mirrorGroup.add(mirrorLens);

  chassis.add(mirrorGroup);
});

// 7. High-Downforce GT Rear Wing & Carbon Pylons
const wingGroup = new THREE.Group();
wingGroup.position.set(0, 1.08, 1.95);

// Main Aerodynamic Carbon Fiber Airfoil Wing
const airfoilGeo = new THREE.BoxGeometry(1.94, 0.04, 0.38);
const airfoil = new THREE.Mesh(airfoilGeo, materials.carbonFiber);
airfoil.castShadow = true;
wingGroup.add(airfoil);

// Wing Endplates (Left & Right)
[-1, 1].forEach((side) => {
  const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.44), materials.paintRed);
  endplate.position.set(side * 0.97, 0.04, 0);
  wingGroup.add(endplate);
});

// Dual Aluminum Swan-Neck Stanchions
[-0.52, 0.52].forEach((xPos) => {
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.12), materials.satinBlack);
  pylon.position.set(xPos, -0.16, -0.05);
  pylon.rotation.x = 0.25;
  wingGroup.add(pylon);
});
chassis.add(wingGroup);

// 8. Rear Fascia, Diffuser & Exhaust
// Full-Width LED Tail Lightbar (Continuous glowing red neon blade)
const taillightBarGeo = new THREE.BoxGeometry(1.82, 0.04, 0.06);
const taillightBar = new THREE.Mesh(taillightBarGeo, materials.taillightBar);
taillightBar.position.set(0, 0.72, 2.22);
chassis.add(taillightBar);

// Rear Bumper / Deck
const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.32, 0.45), materials.paintRed);
rearDeck.position.set(0, 0.54, 2.10);
rearDeck.castShadow = true;
chassis.add(rearDeck);

// Aggressive Carbon Fiber Rear Diffuser with 4 Vertical Fins
const diffuserGeo = new THREE.BoxGeometry(1.80, 0.18, 0.55);
const diffuser = new THREE.Mesh(diffuserGeo, materials.carbonFiber);
diffuser.position.set(0, 0.24, 2.15);
diffuser.rotation.x = -0.15; // angled upward for aerodynamic extraction
chassis.add(diffuser);

[-0.6, -0.2, 0.2, 0.6].forEach((xPos) => {
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.48), materials.carbonFiber);
  fin.position.set(xPos, 0.22, 2.15);
  fin.rotation.x = -0.15;
  chassis.add(fin);
});

// Dual Center-Exit Polished Titanium Exhaust Pipes
[-0.09, 0.09].forEach((xPos) => {
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 20), materials.titanium);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(xPos, 0.44, 2.28);
  chassis.add(pipe);
});

// 9. Minimalist Racing Cockpit (Visible through canopy)
const raceDash = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.22, 0.40), materials.interiorDark);
raceDash.position.set(0, 0.72, -0.35);
chassis.add(raceDash);

// Carbon Racing Bucket Seats (Dual lightweight seats)
[-0.35, 0.35].forEach((sx) => {
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.48), materials.interiorDark);
  seat.position.set(sx, 0.62, 0.22);
  chassis.add(seat);
});

// ==========================================
// 10. 4 High-Performance Racing Wheels
// ==========================================
function createSportsWheel(name, side) {
  const wheelGroup = new THREE.Group();
  wheelGroup.name = name;

  const tireWidth = 0.28;
  const tireRadius = 0.34;
  const rimRadius = 0.24;

  // 1. Wide Racing Slick Rubber Tire
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
  const tire = new THREE.Mesh(tireGeo, materials.tireRubber);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Rounded outer tire shoulder
  const shoulderGeo = new THREE.TorusGeometry(tireRadius - 0.035, 0.035, 16, 32);
  const shoulder = new THREE.Mesh(shoulderGeo, materials.tireRubber);
  shoulder.position.x = side * (tireWidth / 2);
  shoulder.rotation.y = Math.PI / 2;
  wheelGroup.add(shoulder);

  // 2. Alloy Rim Outer Barrel & Deep Lip
  const rimBarrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth + 0.005, 32);
  const rimBarrel = new THREE.Mesh(rimBarrelGeo, materials.rimAlloy);
  rimBarrel.rotation.z = Math.PI / 2;
  wheelGroup.add(rimBarrel);

  // 3. Lightweight 10-Spoke Forged Face
  const spokeGroup = new THREE.Group();
  spokeGroup.position.x = side * (tireWidth / 2 + 0.005);
  spokeGroup.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;

  // Center Hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 20), materials.satinBlack);
  hub.rotation.x = Math.PI / 2;
  spokeGroup.add(hub);

  // 10 Spokes
  for (let i = 0; i < 10; i++) {
    const angle = (i * 2 * Math.PI) / 10;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.028, rimRadius * 0.95, 0.02), materials.rimAlloy);
    spoke.position.set(
      Math.sin(angle) * (rimRadius * 0.45),
      Math.cos(angle) * (rimRadius * 0.45),
      0
    );
    spoke.rotation.z = -angle;
    spokeGroup.add(spoke);
  }
  wheelGroup.add(spokeGroup);

  // 4. Large Carbon-Ceramic Rotor & Yellow Brembo Caliper
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 24), materials.brakeDisc);
  rotor.rotation.z = Math.PI / 2;
  rotor.position.x = side * (tireWidth / 2 - 0.04);
  wheelGroup.add(rotor);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.08), materials.caliperYellow);
  caliper.position.set(side * (tireWidth / 2 - 0.04), 0.12, 0.02);
  wheelGroup.add(caliper);

  return wheelGroup;
}

// Sports Car Wheel Positions:
// Wheel center height = 0.34
// Front Axle: Z = -1.36, Rear Axle: Z = +1.36
// Track width: X = ±0.92 (wide planted stance)
const wheelPositions = {
  Wheel_FL: { x: -0.92, y: 0.34, z: -1.36, side: -1 },
  Wheel_FR: { x: 0.92, y: 0.34, z: -1.36, side: 1 },
  Wheel_RL: { x: -0.94, y: 0.34, z: 1.36, side: -1 },
  Wheel_RR: { x: 0.94, y: 0.34, z: 1.36, side: 1 },
};

for (const [name, pos] of Object.entries(wheelPositions)) {
  const wheel = createSportsWheel(name, pos.side);
  wheel.position.set(pos.x, pos.y, pos.z);
  root.add(wheel);
}

// ==========================================
// Export Sports Car to Binary GLTF (.glb)
// ==========================================
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (glbArrayBuffer) => {
    const buffer = Buffer.from(glbArrayBuffer);

    const targetPath1 = path.resolve('./src/assets/models/car.glb');
    fs.writeFileSync(targetPath1, buffer);
    console.log(`Saved new Aerodynamic Sports Car to ${targetPath1} (${buffer.length} bytes)`);

    const targetPath2 = path.resolve('./public/models/car.glb');
    fs.writeFileSync(targetPath2, buffer);
    console.log(`Saved new Aerodynamic Sports Car to ${targetPath2} (${buffer.length} bytes)`);
  },
  (error) => {
    console.error('Sports car GLTF Export failed:', error);
    process.exit(1);
  },
  { binary: true }
);
