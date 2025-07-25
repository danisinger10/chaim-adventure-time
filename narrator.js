// narrator.js — ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // your key
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';                                   // your chosen voice

let narratorOn   = false;
let currentAudio = null;
let audioUnlocked = false; // tracks if audio playback was unlocked
const narratorAudioElement =
  document.getElementById('narrator-audio-element');

/**
 * NEW: Unlocks audio playback on mobile browsers.
 * This function should be called from within a user-initiated event (e.g., a click).
 * It plays a tiny silent audio clip, which "primes" the browser to allow
 * subsequent programmatic audio playback.
 */
function unlockAudioForMobile() {
  if (audioUnlocked) return;
  narratorAudioElement.src =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  narratorAudioElement.volume = 0;
  narratorAudioElement.play().catch(() => {
    // Errors are expected on desktop and where not needed; we can ignore them.
  });
  audioUnlocked = true;
}

export function toggleNarrator(flag) {
  // <<< MODIFIED: Unlock audio on the first time the narrator is enabled.
  if (flag && !audioUnlocked) {
    unlockAudioForMobile();
  }

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
  for (const chunk of splitIntoChunks(text)) {
    await streamChunk(chunk);       // wait until finished
    if (!narratorOn) break;         // user toggled off
  }
}

/* ---------- private: stream one chunk ---------- */
async function streamChunk(chunk) {
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
  if (!res.ok) throw new Error('TTS failed: ' + res.status);

  // assemble streamed audio into a blob
  const reader = res.body.getReader();
  const parts  = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const blob     = new Blob(parts, { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(blob);

  narratorAudioElement.src = audioUrl;
  await new Promise((resolve) => {
    narratorAudioElement.onended = narratorAudioElement.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    currentAudio = narratorAudioElement;
    narratorAudioElement.play().catch((err) => {
      console.error('Playback error:', err);
      URL.revokeObjectURL(audioUrl);
      resolve();
    });
  });
}