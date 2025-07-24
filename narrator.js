// narrator.js — ElevenLabs streamer (client‑side version)
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8'; // ⚠️ move server‑side in production
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';

let narratorOn    = false;
let audioUnlocked = false;

// persistent <audio> element in your HTML
// <audio id="narrator‑audio-element" preload="auto"></audio>
const narratorAudioElement = document.getElementById('narrator-audio-element');

/* ---------- mobile‑audio unlock ---------- */
function unlockAudioForMobile() {
  if (audioUnlocked) return;

  const silentAudio = new Audio(
    // 44‑byte silent WAV (1‑sample)
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
  );
  silentAudio.volume = 0;
  silentAudio.play().catch(() => { /* desktop browsers may reject – ignore */ });
  audioUnlocked = true;
}

/* ---------- public API ---------- */
export function toggleNarrator(flag) {
  if (flag && !audioUnlocked) unlockAudioForMobile();   // first time ON → unlock
  if (!flag && narratorAudioElement) {
    narratorAudioElement.pause();
    narratorAudioElement.src = '';
  }
  narratorOn = !!flag;
}

export async function narrate(text) {
  if (!narratorOn || !narratorAudioElement) return;
  if (!audioUnlocked) unlockAudioForMobile();           // belt‑and‑suspenders

  for (const chunk of splitIntoChunks(text)) {
    if (!narratorOn) break;                             // user toggled off mid‑story
    try {
      await streamChunk(chunk);
    } catch (err) {
      console.error('TTS error:', err);
      break;
    }
  }

  narratorAudioElement.src = '';                        // cleanup
}

/* ---------- helpers ---------- */
function splitIntoChunks(text, maxLen = 280) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)               // sentence boundaries
    .reduce((chunks, sent) => {
      if (!chunks.length || (chunks.at(-1) + sent).length > maxLen) {
        chunks.push(sent);
      } else {
        chunks[chunks.length - 1] += ' ' + sent;
      }
      return chunks;
    }, []);
}

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

  // accumulate streamed MP3 bytes
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
  await new Promise(resolve => {
    narratorAudioElement.onended = narratorAudioElement.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    narratorAudioElement.play().catch(err => {
      console.error('Playback error:', err);
      URL.revokeObjectURL(audioUrl);
      resolve();
    });
  });
}
