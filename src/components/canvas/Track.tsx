import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

/**
 * Professional Formula 1 Grand Prix Circuit.
 * Uses a decoupled architecture:
 * 1. High-fidelity visual mesh (textures, rumble strips, tire stacks, gantries, grid lines).
 * 2. Dedicated Simplified Collision Mesh (seamless continuous manifold ribbon & smooth perimeter walls).
 * This completely prevents the car's wheels from snagging or getting stuck on internal decorative edges.
 */
export function Track() {
  const { scene } = useGLTF('/models/track.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Extract the simplified collision mesh engineered specifically to prevent internal edge snagging
  const { visualScene, collisionObject } = useMemo(() => {
    const visual = clonedScene.clone(true);
    let colMesh: THREE.Object3D | null = null;

    const existingCol = visual.getObjectByName('Simplified_Collision_Mesh');
    if (existingCol) {
      colMesh = existingCol.clone(true);
      // Remove collision mesh from visual scene so it doesn't render twice
      existingCol.removeFromParent();
    }

    return { visualScene: visual, collisionObject: colMesh };
  }, [clonedScene]);

  return (
    <>
      {/* 1. Full High-Fidelity Visual Scene (colliders decoupled to prevent edge snagging) */}
      <primitive object={visualScene} />

      {/* 2. Simplified Rigid Body Collision Mesh (clean manifold ribbon & barrier walls) */}
      {collisionObject && (
        <RigidBody
          type="fixed"
          colliders="trimesh"
          friction={1.2}
          restitution={0.05}
        >
          <primitive object={collisionObject} visible={false} />
        </RigidBody>
      )}
    </>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
