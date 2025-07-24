// narrator.js  —  ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // ← your key
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';       // swap voice if you want
let narratorOn   = false;
let currentAudio = null;

export function toggleNarrator(flag) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  narratorOn = flag;
}

function splitIntoChunks(text, maxLen = 280) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)          // sentence boundaries
    .reduce((chunks, sent) => {
      if (!chunks.length || (chunks.at(-1) + sent).length > maxLen) {
        chunks.push(sent);
      } else {
        chunks[chunks.length - 1] += ' ' + sent;
      }
      return chunks;
    }, []);
}

export async function narrate(text) {
  if (!narratorOn) return;
  for (const chunk of splitIntoChunks(text)) {
    await streamChunk(chunk);        // defined below
    if (!narratorOn) break;          // user toggled off in the meantime
  }
}

async function streamChunk(chunk) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?optimize_streaming_latency=3`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY
      },
      body: JSON.stringify({
        text: chunk,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.70, similarity_boost: 0.65 }
      })
    }
  );
  if (!res.ok) throw new Error('TTS failed: ' + res.status);

  const reader = res.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  const audio = new Audio(URL.createObjectURL(blob));
  const audio = new Audio(URL.createObjectURL(blob));
  await new Promise((resolve) => {
    audio.onended = resolve;
    audio.onerror = resolve;       // fail‑safe
    audio.play();
  });


