interface LightsProps {
  directionalIntensity?: number;
}

/**
 * Scene directional lighting matching the Sunset HDRI.
 * Note: Ambient light has been removed in favor of Drei's <Environment background preset="sunset"/> HDRI.
 */
export function Lights({ directionalIntensity = 1.6 }: LightsProps) {
  return (
    <directionalLight
      castShadow
      position={[50, 45, -30]}
      intensity={directionalIntensity}
      color="#fff1e0"
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={0.5}
      shadow-camera-far={250}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-bias={-0.0001}
    />
  );
}

export default Lights;
