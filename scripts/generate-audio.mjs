import * as fs from 'fs';
import * as path from 'path';

function createWavFile(filename, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  header.writeUInt16LE(numChannels * bytesPerSample, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const dataBuffer = Buffer.alloc(dataSize);
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 .. 1.0
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = Math.floor(s < 0 ? s * 32768 : s * 32767);
    dataBuffer.writeInt16LE(intVal, i * 2);
  }

  const finalBuffer = Buffer.concat([header, dataBuffer]);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, finalBuffer);
  console.log(`Saved ${filename} (${finalBuffer.length} bytes)`);
}

// ==========================================
// 1. GENERATE ENGINE LOOP SOUND (engine.wav)
// ==========================================
console.log('Synthesizing high-performance sports car engine loop...');
const sampleRate = 44100;
const engineDuration = 2.0; // 2.0s loop
const numEngineSamples = Math.floor(sampleRate * engineDuration);
const engineSamples = new Float32Array(numEngineSamples);

// Fundamental engine firing frequency: exactly 55 Hz (110 full cycles in 2 seconds)
const f0 = 55.0;

for (let i = 0; i < numEngineSamples; i++) {
  const t = i / sampleRate;

  // Primary firing pulses (odd and even harmonics)
  const h1 = Math.sin(2 * Math.PI * f0 * t);
  const h2 = 0.7 * Math.sin(2 * Math.PI * (f0 * 2) * t);
  const h3 = 0.5 * Math.sin(2 * Math.PI * (f0 * 3) * t);
  const h4 = 0.35 * Math.sin(2 * Math.PI * (f0 * 4) * t);
  const h5 = 0.25 * Math.sin(2 * Math.PI * (f0 * 6) * t);
  const h6 = 0.15 * Math.sin(2 * Math.PI * (f0 * 8) * t);

  // Sub-bass rumble (27.5 Hz)
  const sub = 0.4 * Math.sin(2 * Math.PI * (f0 * 0.5) * t);

  // Low frequency cylinder exhaust pulse modulation
  const pulseMod = Math.pow((Math.sin(2 * Math.PI * f0 * t) + 1) * 0.5, 3);

  // High-frequency mechanical valve/exhaust grit
  const noise = (Math.random() * 2 - 1) * 0.08 * (0.5 + 0.5 * pulseMod);

  // Combine and apply soft non-linear saturation for throaty combustion sound
  const raw = (h1 + h2 + h3 + h4 + h5 + h6 + sub + noise) * 0.45;
  const saturated = Math.tanh(raw * 1.8);

  engineSamples[i] = saturated * 0.85;
}

// Fade ends slightly if needed (already continuous integer cycles)
createWavFile(path.resolve('./public/audio/engine.wav'), engineSamples);

// ==========================================
// 2. GENERATE TIRE SCREECH SOUND (skid.wav)
// ==========================================
console.log('Synthesizing tire-screeching skid sound...');
const skidDuration = 1.5;
const numSkidSamples = Math.floor(sampleRate * skidDuration);
const skidSamples = new Float32Array(numSkidSamples);

// Simple 2-pole IIR bandpass filter state
let b0 = 0, b1 = 0, b2 = 0;

for (let i = 0; i < numSkidSamples; i++) {
  const t = i / sampleRate;

  // Stick-slip friction frequency modulation (squeal sweeps around 1800 - 2600 Hz)
  const mod1 = Math.sin(2 * Math.PI * 46 * t);
  const mod2 = Math.sin(2 * Math.PI * 72 * t);
  const squealFreq1 = 1950 + 350 * mod1;
  const squealFreq2 = 2550 + 400 * mod2;

  const tone1 = Math.sin(2 * Math.PI * squealFreq1 * t);
  const tone2 = 0.6 * Math.sin(2 * Math.PI * squealFreq2 * t);

  // Harsh tire tearing white noise
  const white = (Math.random() * 2 - 1);
  // Simple lowpass/bandpass filtering
  b0 = 0.82 * b0 + 0.18 * white;
  b1 = 0.82 * b1 + 0.18 * b0;
  const filteredNoise = (white - b1) * 0.45;

  // Stick-slip judder amplitude modulation
  const judder = 0.65 + 0.35 * Math.sin(2 * Math.PI * 55 * t);

  const rawSkid = (tone1 * 0.45 + tone2 * 0.35 + filteredNoise * 0.55) * judder;
  skidSamples[i] = Math.tanh(rawSkid * 1.5) * 0.8;
}

// Apply 50ms crossfade at loop boundaries for seamless looping
const crossfadeLen = Math.floor(sampleRate * 0.05);
for (let i = 0; i < crossfadeLen; i++) {
  const t = i / crossfadeLen;
  skidSamples[i] = skidSamples[i] * t + skidSamples[numSkidSamples - crossfadeLen + i] * (1 - t);
}

createWavFile(path.resolve('./public/audio/skid.wav'), skidSamples);
