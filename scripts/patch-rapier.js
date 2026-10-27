import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rapierDir = path.resolve(__dirname, '../node_modules/@react-three/rapier');

if (fs.existsSync(rapierDir)) {
  // 1. ESM
  const esmPath = path.join(rapierDir, 'dist/react-three-rapier.esm.js');
  if (fs.existsSync(esmPath)) {
    let esm = fs.readFileSync(esmPath, 'utf8');
    if (!esm.includes('export { AnyCollider, Debug,')) {
      esm = esm.replace('export { AnyCollider,', 'export { AnyCollider, Debug,');
      fs.writeFileSync(esmPath, esm);
    }
  }

  // 2. CJS DEV
  const cjsDevPath = path.join(rapierDir, 'dist/react-three-rapier.cjs.dev.js');
  if (fs.existsSync(cjsDevPath)) {
    let cjsDev = fs.readFileSync(cjsDevPath, 'utf8');
    if (!cjsDev.includes('exports.Debug = Debug;')) {
      cjsDev += '\nexports.Debug = Debug;\n';
      fs.writeFileSync(cjsDevPath, cjsDev);
    }
  }

  // 3. CJS PROD
  const cjsProdPath = path.join(rapierDir, 'dist/react-three-rapier.cjs.prod.js');
  if (fs.existsSync(cjsProdPath)) {
    let cjsProd = fs.readFileSync(cjsProdPath, 'utf8');
    if (!cjsProd.includes('exports.Debug = Debug;')) {
      cjsProd += '\nexports.Debug = Debug;\n';
      fs.writeFileSync(cjsProdPath, cjsProd);
    }
  }

  // 4. DTS
  const dtsPath = path.join(rapierDir, 'dist/declarations/src/index.d.ts');
  if (fs.existsSync(dtsPath)) {
    let dts = fs.readFileSync(dtsPath, 'utf8');
    if (!dts.includes('export declare const Debug')) {
      dts += '\nexport declare const Debug: import("react").FC;\n';
      fs.writeFileSync(dtsPath, dts);
    }
  }
}
