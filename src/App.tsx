import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sky, ContactShadows } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from './components/canvas/Ground';
import { Lights } from './components/canvas/Lights';
import { Vehicle } from './components/canvas/Vehicle';
import { Track } from './components/canvas/Track';
import { Checkpoints } from './components/canvas/Checkpoints';
import { CameraController, type VehicleState } from './components/canvas/CameraController';
import { MiniMapDriver } from './components/canvas/MiniMapDriver';
import { HUD } from './components/ui/HUD';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { CountdownOverlay } from './components/ui/CountdownOverlay';
import { useGameStore } from './stores/useGameStore';
import './App.css';

/**
 * Timer tick loop running inside the R3F render pipeline to advance
 * the live millisecond lap timer in lockstep with frame rendering.
 */
function TimerLoop() {
  const tickTimer = useGameStore((state) => state.tickTimer);

  useFrame((_, delta) => {
    tickTimer(delta * 1000);
  });

  return null;
}

/**
 * Dynamic contact shadow that follows directly underneath the sports car.
 */
function VehicleContactShadow({
  vehicleStateRef,
}: {
  vehicleStateRef: React.MutableRefObject<VehicleState>;
}) {
  const shadowGroupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (shadowGroupRef.current) {
      const pos = vehicleStateRef.current.position;
      shadowGroupRef.current.position.set(pos.x, Math.max(0.02, pos.y - 0.28), pos.z);
    }
  });

  return (
    <group ref={shadowGroupRef}>
      <ContactShadows
        opacity={0.92}
        scale={8.5}
        blur={1.6}
        far={5}
        resolution={256}
        color="#000000"
      />
    </group>
  );
}

export function App() {
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow');
  const setSpeedMph = useGameStore((state) => state.setSpeedMph);

  // SVG DOM ref for the real-time mini-map player arrow icon
  const miniMapMarkerRef = useRef<SVGGElement>(null);

  // Shared reactive state ref for vehicle position, orientation, and velocity
  // Explicitly set initial spawn coordinates slightly above the track (Y = 2.0)
  // so it drops safely onto the pavement only after the track collider exists.
  const vehicleStateRef = useRef<VehicleState>({
    position: new THREE.Vector3(-42.5, 2.0, 56),
    quaternion: new THREE.Quaternion(),
    speedMph: 0,
  });

  const toggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'follow' ? 'orbit' : 'follow'));
  };

  return (
    <div className="canvas-container">
      {/* HTML Loading Screen Overlay: Remains active until all .glb assets and colliders fully load */}
      <LoadingScreen />

      {/* Pre-Race Countdown State Machine Overlay: Displays traffic lights and '3, 2, 1, GO!' */}
      <CountdownOverlay />

      {/* Sleek, Modern HTML Overlay for Lap Counter, Millisecond Timer, Speedometer & GPS Mini-Map */}
      <HUD
        cameraMode={cameraMode}
        onToggleCamera={toggleCameraMode}
        markerRef={miniMapMarkerRef}
      />

      {/* 3D WebGL Canvas with Adaptive DPR and High-Performance GPU Profile */}
      <Canvas
        shadows
        camera={{ position: [-42.5, 4.5, 64], fov: 52 }}
        dpr={[1, 2]}
        gl={{
          powerPreference: 'high-performance',
          antialias: true,
          stencil: false,
          depth: true,
        }}
      >
        {/* React Suspense Boundary wrapping the entire 3D scene */}
        <Suspense fallback={null}>
          {/* Render-loop Timer Driver */}
          <TimerLoop />

          {/* Real-time Mini-Map Driver updating 2D SVG arrow position & heading in useFrame */}
          <MiniMapDriver markerRef={miniMapMarkerRef} vehicleStateRef={vehicleStateRef} />

          {/* Realistic Sunset HDRI Environment & Reflections */}
          <Environment background preset="sunset" />

          {/* Atmosphere & Sky enhancement */}
          <Sky
            sunPosition={[140, 25, -60]}
            turbidity={8}
            rayleigh={4}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />

          {/* Directional Sun Light with reduced 1024x1024 shadow map resolution */}
          <Lights directionalIntensity={1.8} />

          {/* Static Track Contact Shadows: rendered once and cached on GPU via frames={1} */}
          <ContactShadows
            position={[0, 0.02, 0]}
            opacity={0.75}
            scale={220}
            blur={2.0}
            far={25}
            resolution={512}
            frames={1}
            color="#000000"
          />

          {/* Contact Shadows directly under the moving Sports Car */}
          <VehicleContactShadow vehicleStateRef={vehicleStateRef} />

          {/* Cinematic Follow-Camera using lerp to trail smoothly behind & above */}
          <CameraController mode={cameraMode} vehicleStateRef={vehicleStateRef} />

          {/* Rapier Physics Simulation with variable timeStep to eliminate physics jitter */}
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            {/* 500x500 Ground Plane with 4 Invisible Perimeter Boundary Walls */}
            <Ground size={[500, 500]} color="#141820" gridColor="#2a3444" />

            {/* Professional Formula 1 Grand Prix Circuit with Continuous Tire Barriers */}
            <Track />

            {/* Three Invisible Rigid Body Sensor Checkpoints to Track Valid Laps */}
            <Checkpoints />

            {/* Aerodynamic Sports Car dropping safely from Y = 2.0 onto track pavement */}
            <Vehicle
              position={[-42.5, 2.0, 56]}
              onSpeedChange={(mph) => setSpeedMph(mph)}
              vehicleStateRef={vehicleStateRef}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
