import React from 'react';
import './HUD.css';

interface HUDProps {
  speed: number;
  cameraMode: 'follow' | 'orbit';
  onToggleCamera: () => void;
}

export const HUD: React.FC<HUDProps> = ({ speed, cameraMode, onToggleCamera }) => {
  return (
    <div className="game-hud">
      {/* Top Left: Title & Vehicle Specs */}
      <div className="hud-card top-left">
        <div className="vehicle-badge">XV30 PLATFORM</div>
        <h1 className="vehicle-title">Toyota Camry Sedan</h1>
        <p className="vehicle-sub">3D Browser Vehicle Simulation • Rapier Raycast Physics</p>
      </div>

      {/* Top Right: Camera Mode Switcher */}
      <div className="hud-card top-right">
        <button className="camera-toggle-btn" onClick={onToggleCamera}>
          <span className="cam-icon">🎥</span>
          <span>Camera: <strong>{cameraMode === 'follow' ? 'Follow Chase' : 'Free Orbit'}</strong></span>
        </button>
      </div>

      {/* Bottom Left: Input Controls Reference */}
      <div className="hud-card bottom-left">
        <div className="controls-header">VEHICLE CONTROLS</div>
        <div className="key-row">
          <kbd className="key">W</kbd> <span>Accelerate</span>
        </div>
        <div className="key-row">
          <kbd className="key">S</kbd> <span>Brake / Reverse</span>
        </div>
        <div className="key-row">
          <kbd className="key">A</kbd> <kbd className="key">D</kbd> <span>Steering</span>
        </div>
        <div className="key-row">
          <kbd className="key wide">SPACE</kbd> <span>Handbrake</span>
        </div>
        <div className="key-row">
          <kbd className="key">SHIFT</kbd> <span>Turbo Boost</span>
        </div>
        <div className="key-row">
          <kbd className="key">R</kbd> <span>Reset Car</span>
        </div>
      </div>

      {/* Bottom Right: Digital Speedometer */}
      <div className="hud-card bottom-right speedometer-card">
        <div className="speedo-label">SPEED</div>
        <div className="speedo-digits">
          <span className="speedo-number">{speed}</span>
          <span className="speedo-unit">KM/H</span>
        </div>
        <div className="speedo-bar-container">
          <div
            className="speedo-bar-fill"
            style={{ width: `${Math.min(100, (speed / 160) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default HUD;
