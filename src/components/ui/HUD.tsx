import React from 'react';
import { useGameStore, formatLapTime } from '@/stores/useGameStore';
import { MiniMap } from './MiniMap';
import './HUD.css';

interface HUDProps {
  cameraMode: 'follow' | 'orbit';
  onToggleCamera: () => void;
  markerRef: React.RefObject<SVGGElement>;
}

export const HUD: React.FC<HUDProps> = ({ cameraMode, onToggleCamera, markerRef }) => {
  const laps = useGameStore((state) => state.laps);
  const currentTime = useGameStore((state) => state.currentTime);
  const bestTime = useGameStore((state) => state.bestTime);
  const lastLapTime = useGameStore((state) => state.lastLapTime);
  const checkpointsPassed = useGameStore((state) => state.checkpointsPassed);
  const targetCheckpoint = useGameStore((state) => state.targetCheckpoint);
  const lapCompletedNotice = useGameStore((state) => state.lapCompletedNotice);
  const speedMph = useGameStore((state) => state.speedMph);

  // Speed bar percentage (0 - 140 mph)
  const speedRatio = Math.min(100, (speedMph / 140) * 100);

  // Gear detection
  const currentGear = speedMph === 0 ? 'P' : 'D';

  return (
    <div className="game-hud">
      {/* 1. TOP-LEFT: Dynamic High-Tech Speedometer & Telemetry */}
      <div className="hud-card top-left speedo-overlay">
        <div className="speedo-header">
          <span className="live-status-dot" />
          <span className="telemetry-label">SPEEDOMETER</span>
          <span className="gear-badge">{currentGear}</span>
        </div>

        <div className="speedo-display">
          <span className="speedo-digits">{speedMph}</span>
          <span className="speedo-unit">MPH</span>
        </div>

        {/* Dynamic Multi-Color Speed Bar */}
        <div className="speedo-bar-track">
          <div
            className="speedo-bar-fill"
            style={{ width: `${speedRatio}%` }}
          />
        </div>

        <div className="car-label">Apex GT • F1 Grand Prix Circuit (588m)</div>
      </div>

      {/* 2. TOP-CENTER: Lap Counter & Live Millisecond Timer */}
      <div className="hud-card top-center timer-lap-overlay">
        <div className="lap-badge-row">
          <div className="lap-counter-badge">
            <span className="lap-tag">LAP</span>
            <span className="lap-val">{laps}</span>
          </div>
          <div className="checkpoints-pills">
            {[
              { id: 1, label: 'CP 1' },
              { id: 2, label: 'CP 2' },
              { id: 3, label: 'CP 3' },
              { id: 0, label: 'S/F' },
            ].map(({ id, label }) => {
              const isPassed = id === 0 ? false : checkpointsPassed.includes(id);
              const isNext =
                id === 0
                  ? targetCheckpoint === 0 && checkpointsPassed.length === 3
                  : targetCheckpoint === id || (id === 1 && targetCheckpoint === 0 && checkpointsPassed.length === 0);

              return (
                <div
                  key={id}
                  className={`cp-dot ${isPassed ? 'passed' : ''} ${isNext ? 'next' : ''}`}
                  title={id === 0 ? 'Start / Finish Line' : `Checkpoint ${id}`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Millisecond Lap Timer */}
        <div className="live-timer-readout">
          {formatLapTime(currentTime)}
        </div>

        {/* Best Lap & Last Lap Times */}
        <div className="timing-stats-row">
          <div className="stat-col">
            <span className="stat-label">BEST:</span>
            <span className="stat-time gold">{formatLapTime(bestTime)}</span>
          </div>
          {lastLapTime !== null && (
            <div className="stat-col">
              <span className="stat-label">LAST:</span>
              <span className="stat-time">{formatLapTime(lastLapTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. TOP-RIGHT: Camera Mode Switcher */}
      <div className="hud-card top-right">
        <button className="camera-toggle-btn" onClick={onToggleCamera}>
          <span className="cam-icon">🎥</span>
          <span>Camera: <strong>{cameraMode === 'follow' ? 'Follow Chase' : 'Free Orbit'}</strong></span>
        </button>
      </div>

      {/* 4. CENTER SCREEN: Animated Lap/Record Flash Notification */}
      {lapCompletedNotice && (
        <div className="lap-notification-banner">
          <div className="notification-content">
            <span className="notification-icon">🏁</span>
            <span className="notification-text">{lapCompletedNotice}</span>
          </div>
        </div>
      )}

      {/* 5. BOTTOM-LEFT: Input Controls Reminder */}
      <div className="hud-card bottom-left">
        <div className="controls-header">VEHICLE CONTROLS</div>
        <div className="key-row">
          <kbd className="key">W</kbd> <span>Accelerate (8840 N)</span>
        </div>
        <div className="key-row">
          <kbd className="key">S</kbd> <span>Brake / Reverse</span>
        </div>
        <div className="key-row">
          <kbd className="key">A</kbd> <kbd className="key">D</kbd> <span>Steering</span>
        </div>
        <div className="key-row">
          <kbd className="key wide">SPACE</kbd> <span>Handbrake Drift</span>
        </div>
        <div className="key-row">
          <kbd className="key">SHIFT</kbd> <span>Turbo Boost (15k N)</span>
        </div>
        <div className="key-row">
          <kbd className="key">R</kbd> <span>Reset to Track</span>
        </div>
      </div>

      {/* 6. BOTTOM-RIGHT: Real-time 2D Mini-Map GPS Radar */}
      <MiniMap markerRef={markerRef} />
    </div>
  );
};

export default HUD;
