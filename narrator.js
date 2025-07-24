// narrator.js — ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // your key
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';                                   // your chosen voice

let narratorOn    = false;
let audioUnlocked = false;
// Get the persistent audio element from the DOM
const narratorAudioElement = document.getElementById('narrator-audio-element');

/**
 * Unlocks the persistent audio element for playback on mobile.
 * This must be called from a user-initiated event (e.g., a click).
 */
function unlockAudio() {
  if (audioUnlocked || !narratorAudioElement) return;
  
  // Play and immediately pause the element to "prime" it.
  // The browser now considers this element safe for programmatic playback.
  narratorAudioElement.play().then(() => {
    narratorAudioElement.pause();
    audioUnlocked = true;
    console.log('Audio element unlocked for playback.');
  }).catch(error => {
    // This can fail on desktop or if already unlocked, which is fine.
    console.warn('Audio unlock failed, but this may not be an error:', error);
  });
}

export function toggleNarrator(flag) {
  // On the first time the narrator is turned ON, unlock the audio element.
  if (flag && !audioUnlocked) {
    unlockAudio();
  }

  // If turning off, pause and clear any current audio.
  if (!flag && narratorAudioElement) {
    narratorAudioElement.pause();
    narratorAudioElement.src = '';
  }
  
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
  if (!narratorOn || !narratorAudioElement) return;

  for (const chunk of splitIntoChunks(text)) {
    // Stop narrating if the user toggled it off mid-sentence
    if (!narratorOn) {
      narratorAudioElement.pause();
      narratorAudioElement.src = '';
      break;
    }
    await streamChunk(chunk); // Wait until this chunk has finished playing
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

  // Assemble streamed audio into a blob
  const reader = res.body.getReader();
  const parts  = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const blob = new Blob(parts, { type: 'audio/mpeg' });
  
  // Use the persistent audio element to play the blob
  const audioUrl = URL.createObjectURL(blob);
  narratorAudioElement.src = audioUrl;

  // Play completely before returning (prevents overlaps)
  await new Promise((resolve) => {
    // When the audio finishes, release the object URL and resolve the promise
    narratorAudioElement.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    narratorAudioElement.onerror = () => {
      console.error("Error playing audio chunk.");
      URL.revokeObjectURL(audioUrl);
      resolve(); // fail‑safe
    };
    narratorAudioElement.play();
  });
}
