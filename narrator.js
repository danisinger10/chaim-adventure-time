// narrator.js  —  ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // ← your key
const VOICE_ID   = 'EXAVITQu4vr4xnSDxMaL';       // swap voice if you want
let narratorOn   = false;
let currentAudio = null;

export function toggleNarrator(flag) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  narratorOn = flag;
}

export async function narrate(text) {
  if (!narratorOn) return;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.9 }
      })
    }
  );
  if (!res.ok) throw new Error('ElevenLabs TTS failed');

  const reader = res.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  currentAudio = new Audio(URL.createObjectURL(blob));
  await currentAudio.play();
}
