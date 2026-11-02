export async function translateAudioChunk(audioBlob, apiKey) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'live_audio.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');
  // Request word-level timestamps from Groq
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Groq API HTTP Error: ${response.status} ${response.statusText}`);
  }

  return await response.json(); // Returns an object containing .words [{word, start, end}, ...]
}