import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '@/stores/useGameStore';

/**
 * Three invisible static rigid body trigger zones (sensors) along the circuit.
 * Enforces strict checkpoint progression (1 -> 2 -> 3 -> 1) so laps only count
 * if the player drives the full circuit.
 */
export function Checkpoints() {
  const passCheckpoint = useGameStore((state) => state.passCheckpoint);

  return (
    <>
      {/* Checkpoint 1: Start / Finish Line (Under overhead gantry arch at Z = 56, X = 0) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[9.0, 4.0, 1.2]}
          position={[0, 4.0, 56]}
          sensor
          onIntersectionEnter={() => passCheckpoint(1)}
        />
      </RigidBody>

      {/* Checkpoint 2: North Sweeping Turn Apex (Z = -145, X = 35) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[9.0, 4.0, 1.2]}
          position={[35, 4.0, -145]}
          sensor
          onIntersectionEnter={() => passCheckpoint(2)}
        />
      </RigidBody>

      {/* Checkpoint 3: Back-Straight Section (X = 70, Z = -15) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[1.2, 4.0, 9.0]}
          position={[70, 4.0, -15]}
          sensor
          onIntersectionEnter={() => passCheckpoint(3)}
        />
      </RigidBody>
    </>
  );
}

export default Checkpoints;
