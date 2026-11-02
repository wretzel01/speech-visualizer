export class AudioIngestion {
  constructor(onChunkReady, silenceThreshold = 0.015, pauseDurationMs = 800) {
    this.onChunkReady = onChunkReady;
    this.silenceThreshold = silenceThreshold; 
    this.pauseDurationMs = pauseDurationMs;   
    
    this.streamInstance = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    
    this.chunks = [];
    this.silenceTimer = null;
    this.isSpeaking = false;
    this.animationFrameId = null;
  }

  async start() {
    try {
      this.streamInstance = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isRecording = true;

      // Set up Web Audio API to monitor volume levels (VAD)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.streamInstance);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      // Start recording chunks
      this._startNewRecorder();
      this._monitorVolume();

      return true;
    } catch (err) {
      console.error("Layer 1 VAD Ingestion Error:", err);
      throw err;
    }
  }

  _startNewRecorder() {
    if (!this.isRecording) return;

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.streamInstance, { mimeType: 'audio/webm' });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      if (this.chunks.length > 0) {
        const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
        if (typeof this.onChunkReady === 'function') {
          this.onChunkReady(audioBlob);
        }
      }
    };

    this.mediaRecorder.start();
  }

  _monitorVolume() {
    if (!this.isRecording) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS volume level
    let sumSquares = 0.0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Uncomment line below if you want to inspect microphone volume in F12 console:
    // console.log("Current RMS:", rms.toFixed(4));

    if (rms > this.silenceThreshold) {
      // Speech detected
      if (!this.isSpeaking) {
        this.isSpeaking = true;
      }
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else {
      // Silence detected
      if (this.isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            // Stop current recorder to package the speech block
            this.mediaRecorder.stop();
            this.isSpeaking = false;
            this.silenceTimer = null;

            // Spin up a fresh recorder for the next phrase
            setTimeout(() => this._startNewRecorder(), 50);
          }
        }, this.pauseDurationMs);
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this._monitorVolume());
  }

  stop() {
    this.isRecording = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.streamInstance) {
      this.streamInstance.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}