import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '@/stores/useGameStore';

/**
 * Three invisible static rigid body trigger zones (sensors) along the F1 Grand Prix circuit.
 * Enforces strict checkpoint progression (1 -> 2 -> 3 -> 1) so laps only count
 * if the player drives the full circuit.
 */
export function Checkpoints() {
  const passCheckpoint = useGameStore((state) => state.passCheckpoint);

  return (
    <>
      {/* Checkpoint 1: Start / Finish Line (Under FIA starting lights gantry at X = -45, Z = 50) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[8.5, 4.0, 1.2]}
          position={[-45, 4.0, 50]}
          sensor
          onIntersectionEnter={() => passCheckpoint(1)}
        />
      </RigidBody>

      {/* Checkpoint 2: Sector 2 Esses Apex (X = 45, Z = -80) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[8.5, 4.0, 8.5]}
          position={[45, 4.0, -80]}
          sensor
          onIntersectionEnter={() => passCheckpoint(2)}
        />
      </RigidBody>

      {/* Checkpoint 3: Back DRS Straight (X = 85, Z = 0) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[8.5, 4.0, 1.5]}
          position={[85, 4.0, 0]}
          sensor
          onIntersectionEnter={() => passCheckpoint(3)}
        />
      </RigidBody>
    </>
  );
}

export default Checkpoints;
