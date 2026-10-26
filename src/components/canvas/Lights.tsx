interface LightsProps {
  directionalIntensity?: number;
}

/**
 * Optimized scene directional lighting matching the Sunset HDRI.
 * Shadow map resolution reduced from 2048 to 1024 to save 75% GPU fill rate and memory,
 * with shadow frustum tightly bounding the active circuit to maintain crisp vehicle shadows.
 */
export function Lights({ directionalIntensity = 1.6 }: LightsProps) {
  return (
    <directionalLight
      castShadow
      position={[50, 45, -30]}
      intensity={directionalIntensity}
      color="#fff1e0"
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-near={1.0}
      shadow-camera-far={180}
      shadow-camera-left={-65}
      shadow-camera-right={95}
      shadow-camera-top={75}
      shadow-camera-bottom={-85}
      shadow-bias={-0.0002}
    />
  );
}

export default Lights;
