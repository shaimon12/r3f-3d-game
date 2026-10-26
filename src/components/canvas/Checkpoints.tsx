import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '@/stores/useGameStore';

/**
 * Four invisible sequential checkpoint triggers spaced evenly around the F1 circuit.
 * Enforces strict sequential checkpoint progression (0 -> 1 -> 2 -> 3 -> 0) to prevent
 * backwards driving and ensure the car completes the full track loop.
 *
 * - Checkpoint 0: Start / Finish Line (0% mark, under starting lights gantry)
 * - Checkpoint 1: Sector 1 Chicane Exit (25% mark)
 * - Checkpoint 2: Sector 2 DRS Straight (50% mark)
 * - Checkpoint 3: Sector 3 Hairpin Apex (75% mark)
 */
export function Checkpoints() {
  const passCheckpoint = useGameStore((state) => state.passCheckpoint);

  return (
    <>
      {/* Checkpoint 0: Start / Finish Line (0% mark: X = -45, Z = 50) */}
      <RigidBody type="fixed" colliders={false} position={[-45, 4.0, 50]}>
        <CuboidCollider
          args={[9.0, 4.0, 1.2]}
          sensor
          onIntersectionEnter={() => passCheckpoint(0)}
        />
      </RigidBody>

      {/* Checkpoint 1: Sector 1 Chicane Exit (25% mark: X = -28.65, Z = -92.83) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-28.65, 4.0, -92.83]}
        rotation={[0, 2.374, 0]}
      >
        <CuboidCollider
          args={[9.0, 4.0, 1.5]}
          sensor
          onIntersectionEnter={() => passCheckpoint(1)}
        />
      </RigidBody>

      {/* Checkpoint 2: Sector 2 DRS Straight (50% mark: X = 85.77, Z = -36.44) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[85.77, 4.0, -36.44]}
        rotation={[0, 0.163, 0]}
      >
        <CuboidCollider
          args={[9.0, 4.0, 1.5]}
          sensor
          onIntersectionEnter={() => passCheckpoint(2)}
        />
      </RigidBody>

      {/* Checkpoint 3: Sector 3 Hairpin Apex (75% mark: X = 58.24, Z = 101.74) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[58.24, 4.0, 101.74]}
        rotation={[0, -1.035, 0]}
      >
        <CuboidCollider
          args={[9.0, 4.0, 1.5]}
          sensor
          onIntersectionEnter={() => passCheckpoint(3)}
        />
      </RigidBody>
    </>
  );
}

export default Checkpoints;
