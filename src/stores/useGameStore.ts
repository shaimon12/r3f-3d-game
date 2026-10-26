import { create } from 'zustand';

export interface GameState {
  // Laps & Timing
  laps: number;
  currentTime: number; // in milliseconds
  bestTime: number | null; // in milliseconds
  lastLapTime: number | null;
  isTimerRunning: boolean;

  // Circuit Checkpoint Progression (0 -> 1 -> 2 -> 3 -> 0)
  checkpointsPassed: number[];
  targetCheckpoint: number; // Current required checkpoint index (0, 1, 2, 3)
  nextCheckpoint: number; // Alias for UI compatibility
  lapCompletedNotice: string | null;
  wrongWayWarning: boolean;

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
  targetCheckpoint: 0,
  nextCheckpoint: 1,
  lapCompletedNotice: null,
  wrongWayWarning: false,
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
    set({ lapCompletedNotice: null, wrongWayWarning: false });
  },

  /**
   * Overhauled sequential checkpoint trigger handler:
   * Prevents backwards driving and enforces strict 0 -> 1 -> 2 -> 3 -> 0 progression.
   * Checkpoint 0: Start / Finish Line (0%)
   * Checkpoint 1: Sector 1 Chicane Exit (25%)
   * Checkpoint 2: Sector 2 DRS Straight (50%)
   * Checkpoint 3: Sector 3 Hairpin Apex (75%)
   */
  passCheckpoint: (checkpointId: number) => {
    const state = get();

    // 1. Checkpoint 0: Start / Finish Line
    if (checkpointId === 0) {
      // Valid lap completion: ONLY increment when car crosses Start/Finish IF it has
      // successfully triggered checkpoints 1, 2, and 3 in the correct sequential order!
      const hasTriggered123InOrder =
        state.checkpointsPassed.length === 3 &&
        state.checkpointsPassed[0] === 1 &&
        state.checkpointsPassed[1] === 2 &&
        state.checkpointsPassed[2] === 3;

      if (hasTriggered123InOrder) {
        const completedTime = state.currentTime;
        const isNewRecord = state.bestTime === null || completedTime < state.bestTime;
        const newBest = isNewRecord ? completedTime : state.bestTime;

        const noticeText = isNewRecord
          ? `NEW RECORD! ${formatLapTime(completedTime)}`
          : `LAP ${state.laps} COMPLETE! ${formatLapTime(completedTime)}`;

        if (noticeTimeout) clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => get().clearNotice(), 3500);

        set({
          laps: state.laps + 1,
          lastLapTime: completedTime,
          bestTime: newBest,
          currentTime: 0,
          checkpointsPassed: [],
          targetCheckpoint: 0, // Reset the checkpoint target to 0 upon a valid lap completion
          nextCheckpoint: 1,
          lapCompletedNotice: noticeText,
          wrongWayWarning: false,
        });
        return;
      }

      // Initial race start: crossing Start/Finish from the grid for the first time
      if (!state.isTimerRunning) {
        if (noticeTimeout) clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => get().clearNotice(), 2500);

        set({
          isTimerRunning: true,
          currentTime: 0,
          checkpointsPassed: [],
          targetCheckpoint: 1,
          nextCheckpoint: 1,
          lapCompletedNotice: 'RACE STARTED - GREEN FLAG!',
          wrongWayWarning: false,
        });
        return;
      }

      // Crossed finish line out of order (backwards or skipped checkpoints):
      // Lap counter does NOT increment.
      return;
    }

    // 2. Checkpoint 1: Sector 1 Chicane Exit (25%)
    if (checkpointId === 1) {
      const isTargetingCp1 = state.targetCheckpoint === 1 || state.targetCheckpoint === 0;
      if (isTargetingCp1 && !state.checkpointsPassed.includes(1)) {
        set({
          checkpointsPassed: [1],
          targetCheckpoint: 2,
          nextCheckpoint: 2,
          wrongWayWarning: false,
        });
      }
      return;
    }

    // 3. Checkpoint 2: Sector 2 DRS Straight (50%)
    if (checkpointId === 2) {
      if (
        state.targetCheckpoint === 2 &&
        state.checkpointsPassed.length === 1 &&
        state.checkpointsPassed[0] === 1
      ) {
        set({
          checkpointsPassed: [1, 2],
          targetCheckpoint: 3,
          nextCheckpoint: 3,
          wrongWayWarning: false,
        });
      }
      return;
    }

    // 4. Checkpoint 3: Sector 3 Hairpin Apex (75%)
    if (checkpointId === 3) {
      if (
        state.targetCheckpoint === 3 &&
        state.checkpointsPassed.length === 2 &&
        state.checkpointsPassed[0] === 1 &&
        state.checkpointsPassed[1] === 2
      ) {
        set({
          checkpointsPassed: [1, 2, 3],
          targetCheckpoint: 0, // Advance target to Start/Finish line (Checkpoint 0)
          nextCheckpoint: 0,
          wrongWayWarning: false,
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
      targetCheckpoint: 0,
      nextCheckpoint: 1,
      lapCompletedNotice: null,
      wrongWayWarning: false,
      speedMph: 0,
    });
  },
}));

export default useGameStore;
