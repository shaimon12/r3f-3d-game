import React from 'react';
import './MiniMap.css';

interface MiniMapProps {
  markerRef: React.RefObject<SVGGElement>;
}

// 120-sample precision Catmull-Rom spline path of the 588m F1 Circuit
const SVG_TRACK_PATH =
  'M 45.4 178.8 L 44.8 174.8 L 44.4 170.7 L 44.3 166.6 L 44.3 162.4 L 44.4 158.3 L 44.5 154.2 L 44.7 150.1 L 44.9 146 L 45.1 141.8 L 45.2 137.7 L 45.3 133.6 L 45.4 129.5 L 45.4 125.4 L 45.3 121.3 L 45.2 117.2 L 45 113 L 44.9 108.9 L 44.7 104.8 L 44.6 100.7 L 44.5 96.6 L 44.5 92.5 L 44.6 88.4 L 44.8 84.2 L 45.1 80.1 L 45.7 76.1 L 46.3 72 L 47 67.9 L 47.8 63.9 L 48.8 59.9 L 50.1 56 L 51.7 52.2 L 53.8 48.7 L 56.2 45.4 L 58.9 42.3 L 61.9 39.4 L 65 36.8 L 68.5 34.5 L 72.2 32.7 L 76.1 31.5 L 80.2 31.4 L 84.3 32 L 88.2 33.1 L 92.1 34.5 L 95.9 36 L 99.6 37.9 L 103.1 40 L 106.5 42.3 L 109.8 44.8 L 113.1 47.2 L 116.4 49.7 L 119.8 52 L 123.3 54.2 L 126.9 56.1 L 130.6 58 L 134.3 59.9 L 137.8 62 L 141.1 64.5 L 143.9 67.4 L 146.6 70.6 L 148.9 74 L 151 77.5 L 152.8 81.2 L 154.2 85.1 L 155.2 89.1 L 155.7 93.2 L 155.8 97.3 L 155.7 101.4 L 155.4 105.5 L 155.1 109.6 L 154.8 113.7 L 154.6 117.8 L 154.6 121.9 L 154.7 126 L 154.8 130.2 L 155 134.3 L 155.1 138.4 L 155.2 142.5 L 155.3 146.6 L 155.2 150.7 L 154.9 154.8 L 154.5 158.9 L 154 163 L 153.4 167.1 L 152.8 171.2 L 152 175.2 L 151.1 179.2 L 150 183.2 L 148.5 187 L 146.6 190.7 L 144.3 194.1 L 141.7 197.3 L 138.9 200.2 L 135.8 202.9 L 132.4 205.3 L 128.7 207.2 L 124.8 208.3 L 120.7 208.3 L 116.6 207.6 L 112.7 206.3 L 108.9 204.7 L 105.3 202.8 L 101.7 200.8 L 98.3 198.5 L 95.3 195.6 L 92.8 192.4 L 90.3 189.1 L 87.6 186 L 84.4 183.5 L 80.4 182.5 L 76.3 182.8 L 72.3 183.8 L 68.4 185 L 64.5 186.2 L 60.8 188.1 L 57.2 190.1 L 53.4 191.5 L 49.7 190.3 L 47.6 186.7 L 46.3 182.8 Z';

export const MiniMap: React.FC<MiniMapProps> = ({ markerRef }) => {
  return (
    <div className="hud-card bottom-right mini-map-card">
      {/* Mini-map Header */}
      <div className="mini-map-header">
        <div className="map-title-row">
          <span className="live-status-dot mini-dot" />
          <span className="mini-map-title">GPS TRACK RADAR</span>
        </div>
        <div className="map-badges">
          <span className="compass-badge">N ↑</span>
          <span className="circuit-length-badge">588M</span>
        </div>
      </div>

      {/* Scalable 2D SVG Circuit Map */}
      <div className="svg-map-wrapper">
        <svg
          viewBox="0 0 200 240"
          className="mini-map-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Player Neon Glow Filter */}
            <filter id="player-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#38bdf8" />
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#ffffff" />
            </filter>

            {/* Checkpoint Glow */}
            <filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#10b981" />
            </filter>
          </defs>

          {/* Radar background grid lines */}
          <line x1="20" y1="120" x2="180" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
          <line x1="100" y1="20" x2="100" y2="220" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
          <circle cx="100" cy="120" r="45" fill="none" stroke="rgba(56,189,248,0.07)" strokeDasharray="2 4" />
          <circle cx="100" cy="120" r="90" fill="none" stroke="rgba(56,189,248,0.05)" />

          {/* 1. Track Outer Barrier Border */}
          <path
            d={SVG_TRACK_PATH}
            fill="none"
            stroke="#0f172a"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Track Asphalt Road Surface */}
          <path
            d={SVG_TRACK_PATH}
            fill="none"
            stroke="#1e293b"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. Dashed Racing Centerline */}
          <path
            d={SVG_TRACK_PATH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.45)"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 4. Start / Finish Line Marker (at X = 45.4, Y = 162.0) */}
          <g transform="translate(45.4, 162)">
            {/* Perpendicular Finish Line Bar */}
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="square" />
            <line x1="-8" y1="-1" x2="8" y2="-1" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" />
            {/* Finish Line Tag */}
            <text x="-16" y="3" fill="#f43f5e" fontSize="7" fontWeight="800" textAnchor="end">
              S/F
            </text>
          </g>

          {/* 5. Sector Checkpoint Markers */}
          {/* CP 1: Chicane Exit (59.1, 42.0) */}
          <g transform="translate(59.1, 42.0)" filter="url(#cp-glow)">
            <circle r="3.2" fill="#10b981" />
            <text x="-7" y="-5" fill="#34d399" fontSize="6.5" fontWeight="800">
              CP1
            </text>
          </g>

          {/* CP 2: DRS Straight (155.2, 89.4) */}
          <g transform="translate(155.2, 89.4)" filter="url(#cp-glow)">
            <circle r="3.2" fill="#10b981" />
            <text x="7" y="3" fill="#34d399" fontSize="6.5" fontWeight="800">
              CP2
            </text>
          </g>

          {/* CP 3: Hairpin Apex (132.1, 205.5) */}
          <g transform="translate(132.1, 205.5)" filter="url(#cp-glow)">
            <circle r="3.2" fill="#10b981" />
            <text x="7" y="3" fill="#34d399" fontSize="6.5" fontWeight="800">
              CP3
            </text>
          </g>

          {/* 6. REAL-TIME PLAYER VEHICLE ARROW ICON */}
          {/* Updated at 60+ FPS inside useFrame via markerRef transform */}
          <g
            ref={markerRef}
            id="mini-map-player-marker"
            transform="translate(47.5, 167) rotate(0)"
          >
            {/* Pulsating radar ping halo */}
            <circle r="9" fill="rgba(56, 189, 248, 0.25)" className="player-radar-halo" />

            {/* Aerodynamic Chevron Arrow Icon representing vehicle */}
            <polygon
              points="0,-11 7,8 0,3.5 -7,8"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinejoin="round"
              filter="url(#player-glow)"
            />

            {/* Center Core Dot */}
            <circle r="1.6" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default MiniMap;
