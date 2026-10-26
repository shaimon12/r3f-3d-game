import { create } from 'zustand';

export interface GameState {
  // Laps & Timing
  laps: number;
  currentTime: number; // in milliseconds
  bestTime: number | null; // in milliseconds
  lastLapTime: number | null;
  isTimerRunning: boolean;

  // Circuit Checkpoint Progression (1 -> 2 -> 3 -> 1)
  checkpointsPassed: number[];
  nextCheckpoint: number;
  lapCompletedNotice: string | null;

  // Vehicle Telemetry
  speedMph: number;

  // Actions
  tickTimer: (deltaMs: number) => void;
  passCheckpoint: (checkpointId: number) => void;
  setSpeedMph: (speed: number) => void;
  resetGame: () => void;
  clearNotice: () => void;
}

export function formatLapTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '--:--.---';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
}

let noticeTimeout: NodeJS.Timeout | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  laps: 1,
  currentTime: 0,
  bestTime: null,
  lastLapTime: null,
  isTimerRunning: false,
  checkpointsPassed: [],
  nextCheckpoint: 1,
  lapCompletedNotice: null,
  speedMph: 0,

  tickTimer: (deltaMs: number) => {
    if (get().isTimerRunning) {
      set((state) => ({ currentTime: state.currentTime + deltaMs }));
    }
  },

  setSpeedMph: (speed: number) => {
    set({ speedMph: speed });
  },

  clearNotice: () => {
    set({ lapCompletedNotice: null });
  },

  passCheckpoint: (checkpointId: number) => {
    const state = get();

    // Checkpoint 1: Start / Finish Line
    if (checkpointId === 1) {
      // 1. Initial race start when driving across start line for the first time
      if (!state.isTimerRunning || state.checkpointsPassed.length === 0) {
        set({
          isTimerRunning: true,
          currentTime: 0,
          checkpointsPassed: [1],
          nextCheckpoint: 2,
          lapCompletedNotice: 'RACE STARTED!',
        });

        if (noticeTimeout) clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => get().clearNotice(), 2500);
        return;
      }

      // 2. Lap Completion: Valid only if Checkpoints 1, 2, and 3 were all passed in sequence!
      if (state.checkpointsPassed.includes(2) && state.checkpointsPassed.includes(3)) {
        const completedTime = state.currentTime;
        const isNewRecord = state.bestTime === null || completedTime < state.bestTime;
        const newBest = isNewRecord ? completedTime : state.bestTime;

        const noticeText = isNewRecord
          ? `NEW BEST LAP! ${formatLapTime(completedTime)}`
          : `LAP ${state.laps} COMPLETE! ${formatLapTime(completedTime)}`;

        set({
          laps: state.laps + 1,
          lastLapTime: completedTime,
          bestTime: newBest,
          currentTime: 0,
          checkpointsPassed: [1],
          nextCheckpoint: 2,
          lapCompletedNotice: noticeText,
        });

        if (noticeTimeout) clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => get().clearNotice(), 3500);
        return;
      }
    }

    // Checkpoint 2: Mid-circuit (North Bend after ramp jump)
    if (checkpointId === 2) {
      if (state.checkpointsPassed.includes(1) && !state.checkpointsPassed.includes(2)) {
        set({
          checkpointsPassed: [...state.checkpointsPassed, 2],
          nextCheckpoint: 3,
        });
      }
      return;
    }

    // Checkpoint 3: Back-straight section
    if (checkpointId === 3) {
      if (state.checkpointsPassed.includes(2) && !state.checkpointsPassed.includes(3)) {
        set({
          checkpointsPassed: [...state.checkpointsPassed, 3],
          nextCheckpoint: 1,
        });
      }
      return;
    }
  },

  resetGame: () => {
    if (noticeTimeout) clearTimeout(noticeTimeout);
    set({
      laps: 1,
      currentTime: 0,
      bestTime: null,
      lastLapTime: null,
      isTimerRunning: false,
      checkpointsPassed: [],
      nextCheckpoint: 1,
      lapCompletedNotice: null,
      speedMph: 0,
    });
  },
}));

export default useGameStore;
