export async function analyzeAcousticProperties(audioBlob, translationResult) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const wordsArray = translationResult.words || [];

  if (wordsArray.length === 0) {
    const singleWord = translationResult.text ? translationResult.text.trim() : "";
    return [processWord(channelData, 0, channelData.length, sampleRate, singleWord, { medianRms: 0.1, basePitch: 150 })];
  }

  // --- PASS 1: Calculate Sentence-Wide Baseline ---
  const sentenceBaseline = computeSentenceBaseline(channelData, wordsArray, sampleRate);

  // --- PASS 2: Relative Word Evaluation ---
  return wordsArray.map(w => {
    const startSample = Math.floor(w.start * sampleRate);
    const endSample = Math.min(Math.floor(w.end * sampleRate), channelData.length);
    return processWord(channelData, startSample, endSample, sampleRate, w.word.trim(), sentenceBaseline);
  });
}

// --- PASS 1 HELPER: Global Sentence Baseline ---
function computeSentenceBaseline(buffer, wordsArray, sampleRate) {
  let totalRms = 0;
  let validPitchSum = 0;
  let validPitchCount = 0;

  for (const w of wordsArray) {
    const start = Math.floor(w.start * sampleRate);
    const end = Math.min(Math.floor(w.end * sampleRate), buffer.length);
    if (end <= start) continue;

    const rms = computeRMS(buffer, start, end);
    totalRms += rms;

    const pitchRes = computePitchAndConfidence(buffer, start, end, sampleRate);
    if (pitchRes.isVoiced && pitchRes.pitch > 0) {
      validPitchSum += pitchRes.pitch;
      validPitchCount++;
    }
  }

  return {
    medianRms: wordsArray.length > 0 ? totalRms / wordsArray.length : 0.1,
    basePitch: validPitchCount > 0 ? validPitchSum / validPitchCount : 150
  };
}

// --- PASS 2 HELPER: Per-Word Relative Processing ---
function processWord(buffer, start, end, sampleRate, wordText, baseline) {
  const rms = computeRMS(buffer, start, end);
  const zcr = computeZCR(buffer, start, end);
  const pitchResult = computePitchAndConfidence(buffer, start, end, sampleRate);

  // Relative Loudness: Scaled around the sentence median baseline
  const loudnessRatio = baseline.medianRms > 0 ? rms / baseline.medianRms : 1.0;
  const normalizedLoudness = Math.min(Math.max((loudnessRatio - 0.5) * 1.5, 0.0), 1.0);

  // Relative Pitch: Scaled around the sentence base pitch
  let normalizedPitch = 0.5;
  if (pitchResult.isVoiced && pitchResult.pitch > 0) {
    const pitchDelta = pitchResult.pitch - baseline.basePitch;
    // Map deviations around sentence base pitch (-50Hz to +50Hz) to 0.0 - 1.0
    normalizedPitch = Math.min(Math.max((pitchDelta + 50) / 100, 0), 1.0);
  }

  // Texture: ZCR combined with voiced state
  const rawTexture = Math.min(zcr * 4, 1.0);
  const normalizedTexture = pitchResult.isVoiced ? rawTexture * 0.7 : Math.max(rawTexture, 0.6);

  return {
    word: wordText,
    normalized: {
      loudness: Number(normalizedLoudness.toFixed(3)),
      pitch: Number(normalizedPitch.toFixed(3)),
      texture: Number(normalizedTexture.toFixed(3)),
      isVoiced: pitchResult.isVoiced
    }
  };
}

// --- DSP Math Helpers ---

function computeRMS(buffer, start, end) {
  if (end <= start) return 0;
  let sumSquares = 0;
  for (let i = start; i < end; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / (end - start));
}

function computeZCR(buffer, start, end) {
  if (end - start <= 1) return 0;
  let crossings = 0;
  for (let i = start + 1; i < end; i++) {
    if ((buffer[i] >= 0 && buffer[i - 1] < 0) || (buffer[i] < 0 && buffer[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (end - start);
}

function computePitchAndConfidence(buffer, start, end, sampleRate) {
  const MIN_FREQ = 85;  
  const MAX_FREQ = 250; 
  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.ceil(sampleRate / MIN_FREQ);
  
  let bestLag = -1;
  let maxCorrelation = -1;
  const sliceLen = end - start;

  if (sliceLen < maxLag * 2) {
    return { pitch: 0, isVoiced: false };
  }

  let energy = 0;
  for (let i = 0; i < sliceLen; i++) {
    energy += buffer[start + i] * buffer[start + i];
  }
  if (energy === 0) return { pitch: 0, isVoiced: false };

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    const limit = sliceLen - lag;
    
    for (let i = 0; i < limit; i++) {
      correlation += buffer[start + i] * buffer[start + i + lag];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }

  const periodicity = maxCorrelation / energy;
  const VOICED_THRESHOLD = 0.35;
  const isVoiced = periodicity > VOICED_THRESHOLD && bestLag > 0;

  const pitch = isVoiced ? sampleRate / bestLag : 0;
  return { pitch, isVoiced };
}