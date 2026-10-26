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

console.log('Generating 3D Toyota Camry XV30 model...');

const root = new THREE.Group();
root.name = 'Toyota_Camry_2004';

// ==========================================
// Materials
// ==========================================
const materials = {
  paint: new THREE.MeshStandardMaterial({
    name: 'Car_Silver_Paint',
    color: 0xc2c7ce,
    metalness: 0.85,
    roughness: 0.24,
  }),
  paintDark: new THREE.MeshStandardMaterial({
    name: 'Car_Body_Trim',
    color: 0xa8aeb6,
    metalness: 0.7,
    roughness: 0.35,
  }),
  chrome: new THREE.MeshStandardMaterial({
    name: 'Chrome_Trim',
    color: 0xf5f7fa,
    metalness: 0.96,
    roughness: 0.1,
  }),
  plasticBlack: new THREE.MeshStandardMaterial({
    name: 'Black_Plastic',
    color: 0x181a1d,
    roughness: 0.75,
    metalness: 0.1,
  }),
  glassTint: new THREE.MeshStandardMaterial({
    name: 'Tinted_Glass',
    color: 0x222a33,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.65,
  }),
  glassClear: new THREE.MeshStandardMaterial({
    name: 'Clear_Lens_Glass',
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75,
  }),
  sunroof: new THREE.MeshStandardMaterial({
    name: 'Sunroof_Glass',
    color: 0x14181f,
    metalness: 0.2,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  }),
  headlightReflector: new THREE.MeshStandardMaterial({
    name: 'Headlight_Reflector',
    color: 0xffffff,
    metalness: 0.98,
    roughness: 0.05,
  }),
  amber: new THREE.MeshStandardMaterial({
    name: 'Amber_Indicator',
    color: 0xff8c00,
    metalness: 0.2,
    roughness: 0.2,
    emissive: 0x552c00,
  }),
  taillightRed: new THREE.MeshStandardMaterial({
    name: 'Taillight_Red',
    color: 0xcc0606,
    metalness: 0.3,
    roughness: 0.2,
    emissive: 0x330000,
  }),
  taillightClear: new THREE.MeshStandardMaterial({
    name: 'Taillight_Clear',
    color: 0xededed,
    metalness: 0.3,
    roughness: 0.2,
    transparent: true,
    opacity: 0.85,
  }),
  mirrorGlass: new THREE.MeshStandardMaterial({
    name: 'Mirror_Reflective_Glass',
    color: 0xecf0f1,
    metalness: 0.98,
    roughness: 0.04,
  }),
  tireRubber: new THREE.MeshStandardMaterial({
    name: 'Tire_Rubber',
    color: 0x212326,
    roughness: 0.88,
    metalness: 0.08,
  }),
  wheelAlloy: new THREE.MeshStandardMaterial({
    name: 'Wheel_5Spoke_Alloy',
    color: 0xd8dde4,
    metalness: 0.88,
    roughness: 0.22,
  }),
  brakeDisc: new THREE.MeshStandardMaterial({
    name: 'Brake_Disc_Steel',
    color: 0x7b838c,
    metalness: 0.9,
    roughness: 0.3,
  }),
  interiorTan: new THREE.MeshStandardMaterial({
    name: 'Interior_Tan_Leather',
    color: 0xd2c3ab,
    roughness: 0.92,
    metalness: 0.05,
  }),
  interiorCharcoal: new THREE.MeshStandardMaterial({
    name: 'Interior_Charcoal_Dash',
    color: 0x2b2e33,
    roughness: 0.88,
    metalness: 0.1,
  }),
};

// ==========================================
// Chassis / Main Body Group
// (Coordinates: Front = -Z, Rear = +Z, Right = +X, Left = -X, Up = +Y)
// ==========================================
const chassis = new THREE.Group();
chassis.name = 'Chassis';
root.add(chassis);

// 1. Lower Main Body Hull
const lowerBodyGeo = new THREE.BoxGeometry(1.82, 0.45, 4.6);
const lowerBody = new THREE.Mesh(lowerBodyGeo, materials.paint);
lowerBody.position.set(0, 0.45, 0);
lowerBody.castShadow = true;
lowerBody.receiveShadow = true;
chassis.add(lowerBody);

// Underside plate (black protective tray)
const underTrayGeo = new THREE.BoxGeometry(1.76, 0.08, 4.4);
const underTray = new THREE.Mesh(underTrayGeo, materials.plasticBlack);
underTray.position.set(0, 0.21, 0);
chassis.add(underTray);

// 2. Sculpted Hood (Sloping down from windshield cowl to front grille)
// Cowl: Z = -0.80, Y = 0.88; Nose: Z = -2.25, Y = 0.68
const hoodGeo = new THREE.BufferGeometry();
// Create a tapered, chamfered hood shape
const hw = 0.86; // hood half width at cowl
const hwn = 0.72; // hood half width at nose
const hoodVertices = new Float32Array([
  // Top surface (two triangles)
  -hw, 0.88, -0.80,   hw, 0.88, -0.80,   hwn, 0.68, -2.25,
  -hw, 0.88, -0.80,   hwn, 0.68, -2.25, -hwn, 0.68, -2.25,
  // Left chamfer slope
  -0.91, 0.68, -0.80,  -hw, 0.88, -0.80,  -hwn, 0.68, -2.25,
  -0.91, 0.68, -0.80,  -hwn, 0.68, -2.25, -0.84, 0.58, -2.25,
  // Right chamfer slope
   hw, 0.88, -0.80,   0.91, 0.68, -0.80,   hwn, 0.68, -2.25,
   0.91, 0.68, -0.80,  0.84, 0.58, -2.25,  hwn, 0.68, -2.25,
  // Front nose vertical drop to grille
  -hwn, 0.68, -2.25,   hwn, 0.68, -2.25,   0.65, 0.52, -2.32,
  -hwn, 0.68, -2.25,   0.65, 0.52, -2.32, -0.65, 0.52, -2.32,
]);
hoodGeo.setAttribute('position', new THREE.BufferAttribute(hoodVertices, 3));
hoodGeo.computeVertexNormals();
const hood = new THREE.Mesh(hoodGeo, materials.paint);
hood.castShadow = true;
hood.receiveShadow = true;
chassis.add(hood);

// 3. Front Bumper with Lower Intake & Fog Lamp niches
const frontBumperGeo = new THREE.BoxGeometry(1.84, 0.38, 0.42);
const frontBumper = new THREE.Mesh(frontBumperGeo, materials.paint);
frontBumper.position.set(0, 0.36, -2.24);
frontBumper.castShadow = true;
chassis.add(frontBumper);

// Lower central air intake (dark mesh)
const lowerIntakeGeo = new THREE.BoxGeometry(0.92, 0.12, 0.08);
const lowerIntake = new THREE.Mesh(lowerIntakeGeo, materials.plasticBlack);
lowerIntake.position.set(0, 0.28, -2.44);
chassis.add(lowerIntake);

// Fog light housings & lenses (left & right)
[-0.65, 0.65].forEach((xPos) => {
  const fogHousingGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
  const fogHousing = new THREE.Mesh(fogHousingGeo, materials.plasticBlack);
  fogHousing.rotation.x = Math.PI / 2;
  fogHousing.position.set(xPos, 0.28, -2.43);
  chassis.add(fogHousing);

  const fogLensGeo = new THREE.CircleGeometry(0.055, 16);
  const fogLens = new THREE.Mesh(fogLensGeo, materials.glassClear);
  fogLens.position.set(xPos, 0.28, -2.455);
  fogLens.rotation.y = Math.PI;
  chassis.add(fogLens);
});

// 4. Front Grille & Toyota Emblem
// Chrome Grille Frame
const grilleFrameGeo = new THREE.BoxGeometry(0.68, 0.16, 0.06);
const grilleFrame = new THREE.Mesh(grilleFrameGeo, materials.chrome);
grilleFrame.position.set(0, 0.60, -2.31);
chassis.add(grilleFrame);

// Grille Black Slat Background
const grilleSlatsGeo = new THREE.BoxGeometry(0.64, 0.13, 0.05);
const grilleSlats = new THREE.Mesh(grilleSlatsGeo, materials.plasticBlack);
grilleSlats.position.set(0, 0.60, -2.32);
chassis.add(grilleSlats);

// Horizontal Chrome Grille Bars
for (let b = -1; b <= 1; b++) {
  const barGeo = new THREE.BoxGeometry(0.63, 0.015, 0.06);
  const bar = new THREE.Mesh(barGeo, materials.chrome);
  bar.position.set(0, 0.60 + b * 0.038, -2.325);
  chassis.add(bar);
}

// Toyota Oval Emblem
const emblemOuter = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 12, 24), materials.chrome);
emblemOuter.position.set(0, 0.60, -2.35);
chassis.add(emblemOuter);
const emblemInner = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 12, 20), materials.chrome);
emblemInner.position.set(0, 0.61, -2.35);
emblemInner.scale.set(1.4, 0.8, 1);
chassis.add(emblemInner);

// 5. Camry Headlight Clusters (Swept-back multi-reflector assemblies)
[-1, 1].forEach((side) => {
  const x = side * 0.68;
  const hlGroup = new THREE.Group();
  hlGroup.position.set(x, 0.64, -2.26);

  // Chrome reflector housing angled back
  const hlBackingGeo = new THREE.BoxGeometry(0.36, 0.14, 0.18);
  const hlBacking = new THREE.Mesh(hlBackingGeo, materials.headlightReflector);
  hlBacking.rotation.y = side * 0.18;
  hlGroup.add(hlBacking);

  // Dual internal projector lamp bowls
  [-0.08, 0.06].forEach((bx) => {
    const bulbGeo = new THREE.SphereGeometry(0.045, 16, 12);
    const bulb = new THREE.Mesh(bulbGeo, materials.headlightReflector);
    bulb.position.set(bx, 0, -0.06);
    hlGroup.add(bulb);
  });

  // Amber turn signal slice on outer corner (as visible in the Camry image!)
  const amberGeo = new THREE.BoxGeometry(0.07, 0.12, 0.12);
  const amber = new THREE.Mesh(amberGeo, materials.amber);
  amber.position.set(side * 0.15, 0, -0.02);
  hlGroup.add(amber);

  // Clear polycarbonate outer lens cover
  const lensGeo = new THREE.BoxGeometry(0.38, 0.15, 0.04);
  const lens = new THREE.Mesh(lensGeo, materials.glassClear);
  lens.position.set(0, 0, -0.10);
  lens.rotation.y = side * 0.18;
  hlGroup.add(lens);

  chassis.add(hlGroup);
});

// 6. Cabin Greenhouse (Pillars, Roof, Windows)
// A-Pillars, B-Pillars, C-Pillars & Roof Shell
// Roof: X = 1.34, Z = -0.15 to +1.10, Y = 1.45
const roofGeo = new THREE.BoxGeometry(1.36, 0.06, 1.65);
const roof = new THREE.Mesh(roofGeo, materials.paint);
roof.position.set(0, 1.42, 0.35);
roof.castShadow = true;
chassis.add(roof);

// Sunroof (Rectangular tinted glass with black rubber gasket)
const sunroofGasketGeo = new THREE.BoxGeometry(0.82, 0.04, 0.52);
const sunroofGasket = new THREE.Mesh(sunroofGasketGeo, materials.plasticBlack);
sunroofGasket.position.set(0, 1.43, -0.05);
chassis.add(sunroofGasket);

const sunroofGlassGeo = new THREE.BoxGeometry(0.76, 0.045, 0.46);
const sunroofGlass = new THREE.Mesh(sunroofGlassGeo, materials.sunroof);
sunroofGlass.position.set(0, 1.435, -0.05);
chassis.add(sunroofGlass);

// Windshield (Front Raked Glass: Cowl at Z = -0.80, Y = 0.88 to Roof at Z = -0.45, Y = 1.42)
const windshieldGroup = new THREE.Group();
windshieldGroup.position.set(0, 1.15, -0.63);
windshieldGroup.rotation.x = 0.58; // ~33 degree rake angle
const windshieldGeo = new THREE.BoxGeometry(1.42, 0.72, 0.04);
const windshield = new THREE.Mesh(windshieldGeo, materials.glassTint);
windshieldGroup.add(windshield);
// Black windshield frit/border
const wsBorderGeo = new THREE.BoxGeometry(1.44, 0.74, 0.03);
const wsBorder = new THREE.Mesh(wsBorderGeo, materials.plasticBlack);
wsBorder.position.z = 0.005;
windshieldGroup.add(wsBorder);
chassis.add(windshieldGroup);

// Windshield Wipers at cowl
[-0.35, 0.25].forEach((wx) => {
  const wiperGeo = new THREE.BoxGeometry(0.55, 0.015, 0.02);
  const wiper = new THREE.Mesh(wiperGeo, materials.plasticBlack);
  wiper.position.set(wx, 0.89, -0.82);
  wiper.rotation.y = 0.15;
  chassis.add(wiper);
});

// Rear Window (Backlight: Roof at Z = 1.15, Y = 1.42 to Decklid at Z = 1.82, Y = 0.94)
const rearWindowGroup = new THREE.Group();
rearWindowGroup.position.set(0, 1.18, 1.48);
rearWindowGroup.rotation.x = -0.60;
const rearWinGeo = new THREE.BoxGeometry(1.36, 0.78, 0.04);
const rearWindow = new THREE.Mesh(rearWinGeo, materials.glassTint);
rearWindowGroup.add(rearWindow);
chassis.add(rearWindowGroup);

// Side Windows (Left & Right)
[-1, 1].forEach((side) => {
  const x = side * 0.73;
  const sideWinGroup = new THREE.Group();
  sideWinGroup.position.set(x, 1.15, 0.35);

  // Main window glass panel
  const winGeo = new THREE.BoxGeometry(0.04, 0.50, 1.70);
  const winMesh = new THREE.Mesh(winGeo, materials.glassTint);
  sideWinGroup.add(winMesh);

  // Black B-Pillar divider
  const bPillarGeo = new THREE.BoxGeometry(0.06, 0.52, 0.08);
  const bPillar = new THREE.Mesh(bPillarGeo, materials.plasticBlack);
  bPillar.position.set(0, 0, 0.08);
  sideWinGroup.add(bPillar);

  // C-Pillar quarter glass divider (Camry signature styling)
  const qPillarGeo = new THREE.BoxGeometry(0.05, 0.44, 0.04);
  const qPillar = new THREE.Mesh(qPillarGeo, materials.plasticBlack);
  qPillar.position.set(0, -0.02, 0.56);
  sideWinGroup.add(qPillar);

  // Chrome beltline trim along window sill
  const beltlineGeo = new THREE.BoxGeometry(0.05, 0.025, 2.10);
  const beltline = new THREE.Mesh(beltlineGeo, materials.chrome);
  beltline.position.set(0, -0.26, 0.05);
  sideWinGroup.add(beltline);

  chassis.add(sideWinGroup);
});

// A-Pillars & C-Pillars (Solid body colored outer pillars)
[-1, 1].forEach((side) => {
  // A-Pillar
  const aPillarGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
  const aPillar = new THREE.Mesh(aPillarGeo, materials.paint);
  aPillar.position.set(side * 0.72, 1.15, -0.62);
  aPillar.rotation.x = 0.58;
  aPillar.rotation.z = -side * 0.12;
  chassis.add(aPillar);

  // C-Pillar
  const cPillarGeo = new THREE.BoxGeometry(0.12, 0.76, 0.28);
  const cPillar = new THREE.Mesh(cPillarGeo, materials.paint);
  cPillar.position.set(side * 0.72, 1.16, 1.42);
  cPillar.rotation.x = -0.58;
  cPillar.rotation.z = side * 0.10;
  chassis.add(cPillar);
});

// 7. Interior (Beige cabin visible through glass)
// Dashboard
const dashGeo = new THREE.BoxGeometry(1.48, 0.28, 0.48);
const dash = new THREE.Mesh(dashGeo, materials.interiorCharcoal);
dash.position.set(0, 0.85, -0.62);
chassis.add(dash);

// Steering Wheel
const steeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 12), materials.interiorCharcoal);
steeringColumn.position.set(-0.38, 0.88, -0.42);
steeringColumn.rotation.x = 0.6;
chassis.add(steeringColumn);

const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 12, 24), materials.interiorCharcoal);
steeringWheel.position.set(-0.38, 0.94, -0.34);
steeringWheel.rotation.x = 0.6;
chassis.add(steeringWheel);

// Front Bucket Seats (Beige leather seats with headrests)
[-0.38, 0.38].forEach((sx) => {
  // Seat cushion
  const cushionGeo = new THREE.BoxGeometry(0.46, 0.18, 0.52);
  const cushion = new THREE.Mesh(cushionGeo, materials.interiorTan);
  cushion.position.set(sx, 0.52, 0.05);
  chassis.add(cushion);

  // Seat backrest
  const backGeo = new THREE.BoxGeometry(0.44, 0.52, 0.16);
  const back = new THREE.Mesh(backGeo, materials.interiorTan);
  back.position.set(sx, 0.82, 0.26);
  back.rotation.x = 0.18;
  chassis.add(back);

  // Headrest
  const headrestGeo = new THREE.BoxGeometry(0.24, 0.14, 0.12);
  const headrest = new THREE.Mesh(headrestGeo, materials.interiorTan);
  headrest.position.set(sx, 1.15, 0.32);
  chassis.add(headrest);
});

// Center console / armrest
const centerConsoleGeo = new THREE.BoxGeometry(0.24, 0.32, 0.72);
const centerConsole = new THREE.Mesh(centerConsoleGeo, materials.interiorTan);
centerConsole.position.set(0, 0.55, 0.08);
chassis.add(centerConsole);

// Rear Seat Bench
const rearSeatCushionGeo = new THREE.BoxGeometry(1.42, 0.20, 0.58);
const rearSeatCushion = new THREE.Mesh(rearSeatCushionGeo, materials.interiorTan);
rearSeatCushion.position.set(0, 0.52, 0.95);
chassis.add(rearSeatCushion);

const rearSeatBackGeo = new THREE.BoxGeometry(1.40, 0.54, 0.18);
const rearSeatBack = new THREE.Mesh(rearSeatBackGeo, materials.interiorTan);
rearSeatBack.position.set(0, 0.84, 1.22);
rearSeatBack.rotation.x = -0.15;
chassis.add(rearSeatBack);

// 8. Rear Decklid / Trunk & Rear Bumper
// Trunk lid (Z = 1.80 to 2.30, Y = 0.92)
const trunkGeo = new THREE.BoxGeometry(1.68, 0.14, 0.62);
const trunk = new THREE.Mesh(trunkGeo, materials.paint);
trunk.position.set(0, 0.86, 2.02);
trunk.castShadow = true;
chassis.add(trunk);

// Rear Bumper
const rearBumperGeo = new THREE.BoxGeometry(1.84, 0.42, 0.38);
const rearBumper = new THREE.Mesh(rearBumperGeo, materials.paint);
rearBumper.position.set(0, 0.40, 2.24);
rearBumper.castShadow = true;
chassis.add(rearBumper);

// Chrome Trunk Garnish above license plate
const trunkGarnishGeo = new THREE.BoxGeometry(0.62, 0.04, 0.04);
const trunkGarnish = new THREE.Mesh(trunkGarnishGeo, materials.chrome);
trunkGarnish.position.set(0, 0.81, 2.34);
chassis.add(trunkGarnish);

// License plate niche recess
const plateNicheGeo = new THREE.BoxGeometry(0.48, 0.20, 0.03);
const plateNiche = new THREE.Mesh(plateNicheGeo, materials.plasticBlack);
plateNiche.position.set(0, 0.68, 2.33);
chassis.add(plateNiche);

// Chrome Exhaust Tip on bottom right
const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16);
const exhaust = new THREE.Mesh(exhaustGeo, materials.chrome);
exhaust.rotation.x = Math.PI / 2;
exhaust.position.set(0.60, 0.20, 2.38);
chassis.add(exhaust);

// 9. Rear Taillight Assemblies (Wraparound red and clear lenses)
[-1, 1].forEach((side) => {
  const x = side * 0.72;
  const tailGroup = new THREE.Group();
  tailGroup.position.set(x, 0.78, 2.31);

  // Red main brake lamp housing
  const redGeo = new THREE.BoxGeometry(0.32, 0.18, 0.08);
  const redMesh = new THREE.Mesh(redGeo, materials.taillightRed);
  redMesh.rotation.y = -side * 0.15;
  tailGroup.add(redMesh);

  // Clear reverse / indicator central strip
  const clearGeo = new THREE.BoxGeometry(0.30, 0.06, 0.09);
  const clearMesh = new THREE.Mesh(clearGeo, materials.taillightClear);
  clearMesh.position.set(0, -0.01, 0.01);
  clearMesh.rotation.y = -side * 0.15;
  tailGroup.add(clearMesh);

  chassis.add(tailGroup);
});

// 10. Exterior Body Details (Side mirrors, door handles, body side molding)
// Body side molding strips (running along lower doors between wheel arches)
[-1, 1].forEach((side) => {
  const moldingGeo = new THREE.BoxGeometry(0.03, 0.06, 2.55);
  const molding = new THREE.Mesh(moldingGeo, materials.paintDark);
  molding.position.set(side * 0.92, 0.44, 0);
  chassis.add(molding);

  // Chrome strip insert inside molding
  const chromeInsertGeo = new THREE.BoxGeometry(0.035, 0.012, 2.50);
  const chromeInsert = new THREE.Mesh(chromeInsertGeo, materials.chrome);
  chromeInsert.position.set(side * 0.922, 0.44, 0);
  chassis.add(chromeInsert);
});

// Side Mirrors
[-1, 1].forEach((side) => {
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(side * 0.88, 0.92, -0.60);

  // Stem
  const stemGeo = new THREE.BoxGeometry(0.08, 0.03, 0.06);
  const stem = new THREE.Mesh(stemGeo, materials.plasticBlack);
  mirrorGroup.add(stem);

  // Housing (Silver aerodynamic shell)
  const housingGeo = new THREE.SphereGeometry(0.10, 16, 12);
  housingGeo.scale(1.2, 0.7, 0.9);
  const housing = new THREE.Mesh(housingGeo, materials.paint);
  housing.position.set(side * 0.10, 0, 0);
  mirrorGroup.add(housing);

  // Mirror Glass (Facing rearwards towards +Z)
  const glassGeo = new THREE.CircleGeometry(0.07, 16);
  const glass = new THREE.Mesh(glassGeo, materials.mirrorGlass);
  glass.position.set(side * 0.10, 0, 0.08);
  glass.scale.set(1.2, 0.75, 1);
  mirrorGroup.add(glass);

  chassis.add(mirrorGroup);
});

// 4 Door Handles (Front & Rear, Left & Right)
[-1, 1].forEach((side) => {
  [-0.20, 0.65].forEach((zPos) => {
    const handleRecessGeo = new THREE.BoxGeometry(0.02, 0.045, 0.16);
    const handleRecess = new THREE.Mesh(handleRecessGeo, materials.plasticBlack);
    handleRecess.position.set(side * 0.915, 0.80, zPos);
    chassis.add(handleRecess);

    const handleGripGeo = new THREE.BoxGeometry(0.035, 0.028, 0.14);
    const handleGrip = new THREE.Mesh(handleGripGeo, materials.paint);
    handleGrip.position.set(side * 0.93, 0.80, zPos);
    chassis.add(handleGrip);
  });
});

// ==========================================
// 11. 4 Realistic 5-Spoke Wheels & Tires
// ==========================================
function createWheel(name, side) {
  const wheelGroup = new THREE.Group();
  wheelGroup.name = name;

  const tireWidth = 0.24;
  const tireRadius = 0.33;
  const rimRadius = 0.22;

  // 1. Rubber Tire Tread & Sidewall
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
  const tire = new THREE.Mesh(tireGeo, materials.tireRubber);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Rounded outer tire shoulder (torus)
  const shoulderGeo = new THREE.TorusGeometry(tireRadius - 0.035, 0.035, 16, 32);
  const shoulderOuter = new THREE.Mesh(shoulderGeo, materials.tireRubber);
  shoulderOuter.position.x = side * (tireWidth / 2);
  shoulderOuter.rotation.y = Math.PI / 2;
  wheelGroup.add(shoulderOuter);

  // 2. Alloy Rim Outer Barrel & Lip
  const rimBarrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth + 0.005, 32);
  const rimBarrel = new THREE.Mesh(rimBarrelGeo, materials.wheelAlloy);
  rimBarrel.rotation.z = Math.PI / 2;
  wheelGroup.add(rimBarrel);

  // 3. 5-Spoke Face (Positioned on outer side of wheel)
  const spokeGroup = new THREE.Group();
  spokeGroup.position.x = side * (tireWidth / 2 + 0.005);
  spokeGroup.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;

  // Center Hub Cap
  const hubGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.025, 20);
  const hub = new THREE.Mesh(hubGeo, materials.wheelAlloy);
  hub.rotation.x = Math.PI / 2;
  spokeGroup.add(hub);

  // 5 Distinct Alloy Spokes
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5;
    const spokeGeo = new THREE.BoxGeometry(0.045, rimRadius * 0.95, 0.02);
    const spoke = new THREE.Mesh(spokeGeo, materials.wheelAlloy);
    spoke.position.set(
      Math.sin(angle) * (rimRadius * 0.45),
      Math.cos(angle) * (rimRadius * 0.45),
      0
    );
    spoke.rotation.z = -angle;
    spokeGroup.add(spoke);
  }

  // Lug Nuts (5 small indentations)
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 + Math.PI / 5;
    const lugGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8);
    const lug = new THREE.Mesh(lugGeo, materials.chrome);
    lug.rotation.x = Math.PI / 2;
    lug.position.set(Math.sin(angle) * 0.042, Math.cos(angle) * 0.042, 0.005);
    spokeGroup.add(lug);
  }

  wheelGroup.add(spokeGroup);

  // 4. Brake Disc & Caliper (Behind the rim)
  const brakeDiscGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.015, 24);
  const brakeDisc = new THREE.Mesh(brakeDiscGeo, materials.brakeDisc);
  brakeDisc.rotation.z = Math.PI / 2;
  brakeDisc.position.x = side * (tireWidth / 2 - 0.04);
  wheelGroup.add(brakeDisc);

  const caliperGeo = new THREE.BoxGeometry(0.04, 0.09, 0.07);
  const caliper = new THREE.Mesh(caliperGeo, materials.plasticBlack);
  caliper.position.set(side * (tireWidth / 2 - 0.04), 0.10, 0.02);
  wheelGroup.add(caliper);

  return wheelGroup;
}

// Wheel Positions (Wheel center height = 0.33)
// Front Axle: Z = -1.38, Rear Axle: Z = +1.38
// Track width: X = ±0.82
const wheelPositions = {
  Wheel_FL: { x: -0.84, y: 0.33, z: -1.38, side: -1 },
  Wheel_FR: { x: 0.84, y: 0.33, z: -1.38, side: 1 },
  Wheel_RL: { x: -0.84, y: 0.33, z: 1.38, side: -1 },
  Wheel_RR: { x: 0.84, y: 0.33, z: 1.38, side: 1 },
};

for (const [name, pos] of Object.entries(wheelPositions)) {
  const wheel = createWheel(name, pos.side);
  wheel.position.set(pos.x, pos.y, pos.z);
  root.add(wheel);
}

// ==========================================
// Export to Binary GLTF (.glb)
// ==========================================
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (glbArrayBuffer) => {
    const buffer = Buffer.from(glbArrayBuffer);
    
    // Save to /src/assets/models/car.glb
    const targetPath1 = path.resolve('./src/assets/models/car.glb');
    fs.writeFileSync(targetPath1, buffer);
    console.log(`Saved 3D model to ${targetPath1} (${buffer.length} bytes)`);

    // Also copy to /public/models/car.glb for client-side fetch compatibility
    const targetPath2 = path.resolve('./public/models/car.glb');
    fs.writeFileSync(targetPath2, buffer);
    console.log(`Saved 3D model to ${targetPath2} (${buffer.length} bytes)`);
  },
  (error) => {
    console.error('GLTF Export failed:', error);
    process.exit(1);
  },
  { binary: true }
);
