import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VehicleState } from './CameraController';

export interface MiniMapDriverProps {
  vehicleStateRef: React.MutableRefObject<VehicleState>;
  markerRef: React.RefObject<SVGGElement>;
}

/**
 * World-to-SVG Coordinate Projection Parameters for the 588m F1 Circuit:
 * Scaled uniformly so turns and apexes maintain exact 1:1 real-world aspect ratio.
 *
 * SVG ViewBox: 0 0 200 240
 * 3D World Origin Alignment:
 * - Center of track: X = 20, Z = 0
 * - Scale factor: 0.84 px / meter
 * - SVG Center: (100, 120)
 */
const WORLD_CENTER_X = 20;
const WORLD_CENTER_Z = 0;
const SCALE = 0.84;
const SVG_CENTER_X = 100;
const SVG_CENTER_Y = 120;
const RAD_TO_DEG = 180 / Math.PI;

export function MiniMapDriver({ vehicleStateRef, markerRef }: MiniMapDriverProps) {
  // Pre-allocated reusable Three.js vector to eliminate per-frame garbage collection
  const forwardVec = useRef(new THREE.Vector3());

  useFrame(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const { position, quaternion } = vehicleStateRef.current;

    // 1. Map 3D World (X and Z) to 2D Mini-Map SVG Coordinates
    const svgX = SVG_CENTER_X + (position.x - WORLD_CENTER_X) * SCALE;
    const svgY = SVG_CENTER_Y + (position.z - WORLD_CENTER_Z) * SCALE;

    // 2. Compute 2D Heading Angle from Vehicle's 3D Quaternion
    // In car local space, forward direction is -Z (0, 0, -1)
    forwardVec.current.set(0, 0, -1).applyQuaternion(quaternion);

    // Map to 2D SVG rotation:
    // When car heads towards -Z (up on track map), angle is 0 deg
    // When car turns right towards +X, angle is +90 deg
    const headingDeg = Math.atan2(forwardVec.current.x, -forwardVec.current.z) * RAD_TO_DEG;

    // 3. Mutate SVG Transform Attribute Directly at 60+ FPS (Zero React Re-renders)
    marker.setAttribute(
      'transform',
      `translate(${svgX.toFixed(2)}, ${svgY.toFixed(2)}) rotate(${headingDeg.toFixed(1)})`
    );
  });

  return null;
}

export default MiniMapDriver;
