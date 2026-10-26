import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Ground } from './components/canvas/Ground';
import { Lights } from './components/canvas/Lights';
import './App.css';

export function App() {
  return (
    <div className="canvas-container">
      <Canvas
        shadows
        camera={{ position: [0, 8, 14], fov: 50 }}
        dpr={[1, 2]}
      >
        {/* Atmosphere & Sky */}
        <color attach="background" args={['#0e131b']} />
        <fog attach="fog" args={['#0e131b', 30, 90]} />
        <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={6} />

        {/* Standard Game Lighting: Ambient + Directional Shadow Caster */}
        <Lights />

        {/* Camera Controls */}
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2.05}
          minDistance={2}
          maxDistance={60}
        />

        {/* Rapier Physics Simulation */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            {/* Static Ground Floor with Rigid Body Collider */}
            <Ground />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
