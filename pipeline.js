import { AudioIngestion } from './layer1_ingestion.js';
import { translateAudioChunk } from './layer2_translation.js';
import { analyzeAcousticProperties } from './layer3_dsp.js';
import { assignStyles } from './layer4_assignment.js';
import { AudioVisualizerUI } from './layer5_ui.js';
import { shouldFilterOut } from './filter.js';

let ingestionEngine = null;
let logCounter = 0;
let isPipelineActive = false;

const apiKeyInput = document.getElementById('apiKey');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const logOutput = document.getElementById('logOutput');
const visualizerContainer = document.getElementById('visualizerContainer');

// Initialize Layer 5 UI Renderer
const visualizerUI = new AudioVisualizerUI(visualizerContainer);

startBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Please enter your Groq API key.');
    return;
  }

  startBtn.disabled = true;
  apiKeyInput.disabled = true;
  statusText.textContent = 'Status: Initializing microphone...';

  isPipelineActive = true;
  visualizerUI.clear();

  ingestionEngine = new AudioIngestion(async (audioBlob) => {
    if (!isPipelineActive) return;

    appendLog('Layer 1', 'Speech segment captured. Running translation...');
    try {
      // Step 1: Translate and get word timestamps from Layer 2
      const translationResult = await translateAudioChunk(audioBlob, apiKey);
      
      if (!isPipelineActive) return;

      const rawText = translationResult.text ? translationResult.text.trim() : "";

      // Step 2: Filter out noise
      if (shouldFilterOut(rawText)) {
        console.log('Filtered out noise/artifact fragment:', rawText);
        return;
      }

      appendLog('Layer 2 Output', `"${rawText}"`);

      // Step 3: Run per-word acoustic DSP analysis (Layer 3)
      const wordDspResults = await analyzeAcousticProperties(audioBlob, translationResult);

      if (!isPipelineActive) return;

      // Step 4: Map numeric metrics to concrete UI style assignments (Layer 4)
      const styledWords = assignStyles(wordDspResults);

      // Step 5: Render directly to DOM via Layer 5 UI Renderer
      visualizerUI.renderWords(styledWords);

      appendLog('Layer 5 UI', `Rendered ${styledWords.length} styled word(s) to viewport.`);

    } catch (err) {
      if (isPipelineActive) {
        appendLog('Error', err.message);
      }
    }
  }, 0.015, 800);

  try {
    await ingestionEngine.start();
    stopBtn.disabled = false;
    statusDot.classList.add('active');
    statusText.textContent = 'Status: Live Stream Listening...';
    appendLog('System', 'Pipeline active: Layers 1 through 5 fully linked.');
  } catch (err) {
    console.error(err);
    alert('Microphone initialization failed.');
    resetUI();
  }
});

stopBtn.addEventListener('click', () => {
  isPipelineActive = false;
  if (ingestionEngine) {
    ingestionEngine.stop();
  }
  resetUI();
  appendLog('System', 'Pipeline stopped.');
});

function resetUI() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  apiKeyInput.disabled = false;
  statusDot.classList.remove('active');
  statusText.textContent = 'Status: Idle';
}

function appendLog(source, text) {
  if (logCounter === 0) {
    logOutput.innerHTML = '';
  }
  logCounter++;

  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<span class="timestamp">[${source}]</span> ${text}`;
  logOutput.appendChild(item);
  logOutput.scrollTop = logOutput.scrollHeight;
}