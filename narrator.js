// narrator.js — ElevenLabs streamer
let ELEVEN_KEY = localStorage.getItem('elevenlabs_key') || '';   // user key
const VOICE_ID  = 'EiNlNiXeDU1pqqOPrYMO';                         // your chosen voice

export function setElevenKey(key) {
  key = (key || '').trim();
  ELEVEN_KEY = key;
  if (key) {
    localStorage.setItem('elevenlabs_key', key);
  } else {
    localStorage.removeItem('elevenlabs_key');
  }
}

let narratorOn   = false;
let currentAudio = null;

export function toggleNarrator(flag) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  narratorOn = flag;
}

/* ---------- helper: break long text into ≤280‑char chunks ---------- */
function splitIntoChunks(text, maxLen = 280) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)      // sentence boundaries
    .reduce((chunks, sent) => {
      if (!chunks.length || (chunks.at(-1) + sent).length > maxLen) {
        chunks.push(sent);
      } else {
        chunks[chunks.length - 1] += ' ' + sent;
      }
      return chunks;
    }, []);
}

/* ---------- public: narrate whole scene ---------- */
export async function narrate(text) {
  if (!narratorOn) return;
  const chunks = splitIntoChunks(text);
  let next = fetchAudio(chunks[0]);
  try {
    for (let i = 0; i < chunks.length; i++) {
      const audio = await next;
      if (!narratorOn) break;
      if (i + 1 < chunks.length) next = fetchAudio(chunks[i + 1]);
      await playAudio(audio);
      if (!narratorOn) break;
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

/* ---------- private helpers ---------- */
async function fetchAudio(chunk) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?optimize_streaming_latency=3`,
    {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key'  : ELEVEN_KEY
      },
      body: JSON.stringify({
        text          : chunk,
        model_id      : 'eleven_multilingual_v2',
        voice_settings: { stability: 0.70, similarity_boost: 0.65 }
      })
    }
  );
  if (!res.ok) {
    if (res.status === 401) {
      setElevenKey('');
      throw new Error('TTS failed: invalid or missing ElevenLabs API key.');
    }
    throw new Error('TTS failed: ' + res.status);
  }

  // assemble streamed audio into a blob
  const reader = res.body.getReader();
  const parts  = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const blob  = new Blob(parts, { type: 'audio/mpeg' });
  return new Audio(URL.createObjectURL(blob));
}

async function playAudio(audio) {
  await new Promise((resolve) => {
    audio.onended = resolve;
    audio.onerror = resolve;  // fail‑safe
    currentAudio  = audio;
    audio.play();
  });
}
