import React, { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import './LoadingScreen.css';

export const LoadingScreen: React.FC = () => {
  const { active, progress, item } = useProgress();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // When all assets have finished loading (active is false and progress is 100%)
    if (!active && progress === 100) {
      // Brief pause to display complete lights-out sequence
      const fadeTimer = setTimeout(() => {
        setFading(true);
      }, 400);

      // Unmount overlay after CSS opacity transition finishes
      const unmountTimer = setTimeout(() => {
        setVisible(false);
      }, 950);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [active, progress]);

  if (!visible) return null;

  // Compute number of illuminated F1 start light pods (1 to 5)
  const illuminatedLights = Math.min(5, Math.floor((progress / 100) * 5) + 1);
  const isComplete = !active && progress === 100;

  // Clean friendly display name for current asset
  let assetLabel = 'Initializing 3D Simulation...';
  if (item.includes('track.glb')) {
    assetLabel = 'Loading 588m Formula 1 Circuit (13MB)...';
  } else if (item.includes('car.glb')) {
    assetLabel = 'Calibrating Sports Car Aerodynamics...';
  } else if (item.includes('audio') || item.includes('.wav')) {
    assetLabel = 'Loading Spatial Audio Buffers...';
  } else if (progress > 90) {
    assetLabel = 'Compiling Trimesh Physics Colliders...';
  }

  return (
    <div className={`loading-screen-overlay ${fading ? 'fade-out' : ''}`}>
      <div className="loading-content-box">
        {/* Brand / Circuit Header */}
        <div className="loading-badge">FIA GRADE-1 FORMULA 1 GRAND PRIX</div>
        <h1 className="loading-title">APEX GT RACING</h1>
        <p className="loading-subtitle">588m High-Downforce Circuit • Procedural WebGL Physics</p>

        {/* 5 F1 FIA Start Light Pods */}
        <div className="f1-gantry-lights">
          {[1, 2, 3, 4, 5].map((lightNum) => {
            const isLit = lightNum <= illuminatedLights;
            return (
              <div key={lightNum} className="light-pod">
                <div className={`light-bulb ${isLit ? (isComplete ? 'green-lit' : 'red-lit') : ''}`} />
                <div className={`light-bulb ${isLit ? (isComplete ? 'green-lit' : 'red-lit') : ''}`} />
                <div className={`light-bulb ${isLit ? (isComplete ? 'green-lit' : 'red-lit') : ''}`} />
              </div>
            );
          })}
        </div>

        {/* Status Callout */}
        <div className="loading-status-text">
          {isComplete ? 'LIGHTS OUT AND AWAY WE GO!' : assetLabel}
        </div>

        {/* Dynamic Progress Bar */}
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${isComplete ? 'complete' : ''}`}
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>

        {/* Numerical Percentage */}
        <div className="progress-metrics">
          <span className="progress-percent">{Math.round(progress)}%</span>
          <span className="telemetry-info">RAPIER RIGID BODY COLLIDERS READY</span>
        </div>

        {/* Loading Hint */}
        <div className="loading-hint">
          <span>Drop-spawn safe drop enabled: Car lands securely on asphalt upon collider initialization.</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
