import { useEffect, useMemo } from 'react';
import { useGLTF, BakeShadows } from '@react-three/drei';
import { RigidBody, MeshCollider, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

/**
 * Professional Formula 1 Grand Prix Circuit.
 * - Stops using trimesh for the outer barriers to eliminate high-speed wall tunneling.
 * - Uses trimesh strictly for the drivable road floor (Simplified_Collision_Mesh).
 * - Instantiates thick, invisible <CuboidCollider> bumpers along perimeter edges of the track.
 */
export function Track() {
  const { scene } = useGLTF('/models/track.glb');

  // The Blindness Fix: calculate and console.log the exact bounding box size of the Track model
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log('🏁 [BOUNDING BOX] Track Model (Track.tsx):', {
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
    });
  }, [scene]);
  const { visualScene, roadMesh } = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });

    // Extract the dedicated road collision mesh for drivable trimesh
    const scm = s.getObjectByName('Simplified_Collision_Mesh') as THREE.Mesh | null;
    let roadClone: THREE.Mesh | null = null;
    if (scm) {
      scm.visible = false;
      roadClone = scm.clone();
      roadClone.name = 'track-floor';
      roadClone.visible = false;
    }

    return { visualScene: s, roadMesh: roadClone };
  }, [scene]);

  return (
    <>
      {/* Bake static shadows for track elements */}
      <BakeShadows />

      {/* Visual track model (asphalt, rumble strips, tire barriers, armco, gantry) */}
      <primitive object={visualScene} />

      {/* Physical Track Road Surface Trimesh Collider */}
      <RigidBody
        name="track-road"
        type="fixed"
        colliders={false}
        friction={0.1}
        restitution={0.5}
      >
        {/* Road surface trimesh: smooth drivable asphalt, no thin barrier meshes */}
        {roadMesh && (
          <MeshCollider type="trimesh">
            <primitive object={roadMesh} name="track-floor" />
          </MeshCollider>
        )}
      </RigidBody>

      {/* =========================================================================
          TIGHT OUTER PERIMETER BUMPERS
          Only placed tightly on the extreme outer X/Z bounds of the track bounding box.
          Height is kept low (Y in [0, 4]) to eliminate any sky/ceiling blockage.
          No diagonal colliders and none spanning the center [0, y, 0].
         ========================================================================= */}
      <RigidBody
        name="wall"
        type="fixed"
        colliders={false}
        friction={0.1}
        restitution={0.5}
      >
        {/* North Perimeter Wall (+Z: outer edge beyond max Z = 114) */}
        <CuboidCollider name="wall" args={[76, 2, 2]} position={[20, 2, 118]} />
        {/* South Perimeter Wall (-Z: outer edge beyond min Z = -114) */}
        <CuboidCollider name="wall" args={[76, 2, 2]} position={[20, 2, -118]} />
        {/* West Perimeter Wall (-X: outer edge beyond min X = -55) */}
        <CuboidCollider name="wall" args={[2, 2, 118]} position={[-58, 2, 0]} />
        {/* East Perimeter Wall (+X: outer edge beyond max X = 95) */}
        <CuboidCollider name="wall" args={[2, 2, 118]} position={[98, 2, 0]} />
      </RigidBody>
    </>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
