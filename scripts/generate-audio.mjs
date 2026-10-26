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
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = Math.floor(s < 0 ? s * 32768 : s * 32767);
    dataBuffer.writeInt16LE(intVal, i * 2);
  }

  const finalBuffer = Buffer.concat([header, dataBuffer]);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, finalBuffer);
  console.log(`Saved ${filename} (${finalBuffer.length} bytes)`);
}

const sampleRate = 44100;

// ==========================================
// 1. ENGINE LOOP (engine.wav)
// ==========================================
console.log('Synthesizing high-performance sports car engine loop...');
const engineDuration = 2.0;
const numEngineSamples = Math.floor(sampleRate * engineDuration);
const engineSamples = new Float32Array(numEngineSamples);
const f0 = 55.0;

for (let i = 0; i < numEngineSamples; i++) {
  const t = i / sampleRate;

  const h1 = Math.sin(2 * Math.PI * f0 * t);
  const h2 = 0.7 * Math.sin(2 * Math.PI * (f0 * 2) * t);
  const h3 = 0.5 * Math.sin(2 * Math.PI * (f0 * 3) * t);
  const h4 = 0.35 * Math.sin(2 * Math.PI * (f0 * 4) * t);
  const h5 = 0.25 * Math.sin(2 * Math.PI * (f0 * 6) * t);
  const h6 = 0.15 * Math.sin(2 * Math.PI * (f0 * 8) * t);

  const sub = 0.4 * Math.sin(2 * Math.PI * (f0 * 0.5) * t);
  const pulseMod = Math.pow((Math.sin(2 * Math.PI * f0 * t) + 1) * 0.5, 3);
  const noise = (Math.random() * 2 - 1) * 0.08 * (0.5 + 0.5 * pulseMod);

  const raw = (h1 + h2 + h3 + h4 + h5 + h6 + sub + noise) * 0.45;
  const saturated = Math.tanh(raw * 1.8);
  engineSamples[i] = saturated * 0.85;
}
createWavFile(path.resolve('./public/audio/engine.wav'), engineSamples);

// ==========================================
// 2. TIRE SCREECH (skid.wav)
// ==========================================
console.log('Synthesizing tire-screeching skid sound...');
const skidDuration = 1.5;
const numSkidSamples = Math.floor(sampleRate * skidDuration);
const skidSamples = new Float32Array(numSkidSamples);

let b0 = 0, b1 = 0;
for (let i = 0; i < numSkidSamples; i++) {
  const t = i / sampleRate;

  const mod1 = Math.sin(2 * Math.PI * 46 * t);
  const mod2 = Math.sin(2 * Math.PI * 72 * t);
  const squealFreq1 = 1950 + 350 * mod1;
  const squealFreq2 = 2550 + 400 * mod2;

  const tone1 = Math.sin(2 * Math.PI * squealFreq1 * t);
  const tone2 = 0.6 * Math.sin(2 * Math.PI * squealFreq2 * t);

  const white = (Math.random() * 2 - 1);
  b0 = 0.82 * b0 + 0.18 * white;
  b1 = 0.82 * b1 + 0.18 * b0;
  const filteredNoise = (white - b1) * 0.45;

  const judder = 0.65 + 0.35 * Math.sin(2 * Math.PI * 55 * t);
  const rawSkid = (tone1 * 0.45 + tone2 * 0.35 + filteredNoise * 0.55) * judder;
  skidSamples[i] = Math.tanh(rawSkid * 1.5) * 0.8;
}

const crossfadeLen = Math.floor(sampleRate * 0.05);
for (let i = 0; i < crossfadeLen; i++) {
  const t = i / crossfadeLen;
  skidSamples[i] = skidSamples[i] * t + skidSamples[numSkidSamples - crossfadeLen + i] * (1 - t);
}
createWavFile(path.resolve('./public/audio/skid.wav'), skidSamples);

// ==========================================
// 3. METALLIC CRASH SOUND EFFECT (crash.wav)
// ==========================================
console.log('Synthesizing heavy metallic vehicle crash sound effect...');
const crashDuration = 1.3;
const numCrashSamples = Math.floor(sampleRate * crashDuration);
const crashSamples = new Float32Array(numCrashSamples);

for (let i = 0; i < numCrashSamples; i++) {
  const t = i / sampleRate;

  // 1. Initial Heavy Sub-Bass Impact Thud (140 Hz down to 35 Hz in first 180ms)
  const envThud = Math.exp(-t * 14.0);
  const freqThud = 35 + 105 * Math.exp(-t * 22.0);
  const thud = Math.sin(2 * Math.PI * freqThud * t) * envThud * 0.9;

  // 2. Metallic Sheet-Metal Deformation & Resonance (ringing inharmonic partials)
  const envMetal = Math.exp(-t * 4.5);
  const m1 = Math.sin(2 * Math.PI * 480 * t) * 0.35;
  const m2 = Math.sin(2 * Math.PI * 860 * t + 0.5 * Math.sin(2 * Math.PI * 80 * t)) * 0.4;
  const m3 = Math.sin(2 * Math.PI * 1420 * t) * 0.3;
  const m4 = Math.sin(2 * Math.PI * 2240 * t) * 0.25;
  const m5 = Math.sin(2 * Math.PI * 3400 * t) * 0.2;
  const metallic = (m1 + m2 + m3 + m4 + m5) * envMetal;

  // 3. High-energy abrasive metal crunch / tearing noise (first 300ms burst)
  const envCrunch = Math.exp(-t * 8.0);
  const crunchNoise = (Math.random() * 2 - 1) * envCrunch * 0.6;

  // 4. Secondary Debris Clatter (decays over 1.2s)
  const envRattle = Math.exp(-t * 3.2);
  const rattleMod = Math.sin(2 * Math.PI * 32 * t) * Math.sin(2 * Math.PI * 67 * t);
  const rattle = (Math.random() * 2 - 1) * Math.abs(rattleMod) * envRattle * 0.25;

  // Total mixed signal with punchy non-linear distortion
  const mixed = thud + metallic + crunchNoise + rattle;
  const saturated = Math.tanh(mixed * 2.2);

  crashSamples[i] = saturated * 0.95;
}
createWavFile(path.resolve('./public/audio/crash.wav'), crashSamples);
