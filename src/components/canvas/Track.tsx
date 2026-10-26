import { useMemo } from 'react';
import { useGLTF, BakeShadows } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

/**
 * Professional Formula 1 Grand Prix Circuit.
 * Maps every triangle of the track perfectly using colliders="trimesh" on the static RigidBody.
 * Optimizes the rendering pipeline:
 * 1. Wraps static track elements in Drei BakeShadows to eliminate per-frame shadow pass lag.
 * 2. Explicitly disables castShadow on the track floor and road meshes.
 */
export function Track() {
  const { scene } = useGLTF('/models/track.glb');
  const clonedScene = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        // Disable castShadow on the track floor to optimize the shadow map rendering pipeline
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
    return s;
  }, [scene]);

  return (
    <>
      {/* Bake static shadows for track elements */}
      <BakeShadows />
      <RigidBody
        type="fixed"
        colliders="trimesh"
        friction={1.2}
        restitution={0.1}
      >
        <primitive object={clonedScene} />
      </RigidBody>
    </>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
