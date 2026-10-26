import React from 'react';
import './HUD.css';

interface HUDProps {
  speedMph: number;
  cameraMode: 'follow' | 'orbit';
  onToggleCamera: () => void;
}

export const HUD: React.FC<HUDProps> = ({ speedMph, cameraMode, onToggleCamera }) => {
  return (
    <div className="game-hud">
      {/* Top Left: Primary Speedometer & Velocity Overlay */}
      <div className="hud-card speed-overlay-top-left">
        <div className="speed-header">
          <span className="live-dot" />
          <span className="speed-title">VEHICLE VELOCITY</span>
        </div>
        <div className="speed-readout">
          <span className="speed-number">{speedMph}</span>
          <span className="speed-unit">MPH</span>
        </div>
        <div className="speed-bar-track">
          <div
            className="speed-bar-progress"
            style={{ width: `${Math.min(100, (speedMph / 120) * 100)}%` }}
          />
        </div>
        <div className="vehicle-caption">
          Apex GT Hypercar • 500x500 Stunt Circuit
        </div>
      </div>

      {/* Top Right: Camera Switcher */}
      <div className="hud-card top-right">
        <button className="camera-toggle-btn" onClick={onToggleCamera}>
          <span className="cam-icon">🎥</span>
          <span>Camera: <strong>{cameraMode === 'follow' ? 'Follow Chase' : 'Free Orbit'}</strong></span>
        </button>
      </div>

      {/* Bottom Left: Vehicle Controls Reference */}
      <div className="hud-card bottom-left">
        <div className="controls-header">CONTROLS</div>
        <div className="key-row">
          <kbd className="key">W</kbd> <span>Accelerate (+30% Force)</span>
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
          <kbd className="key">R</kbd> <span>Reset to Track</span>
        </div>
      </div>
    </div>
  );
};

export default HUD;
