// narrator.js — ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // your key
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';                                   // your chosen voice

let narratorOn   = false;
let currentAudio = null;
let audioUnlocked = false; // Tracks if audio is unlocked
let persistentAudio = null; // Reference to the persistent audio element

/**
 * Unlocks audio playback on mobile browsers.
 * Uses the persistent audio element and ensures it's properly initialized.
 */
export function unlockAudioForMobile() {
  if (audioUnlocked) return;
  
  // Get or create the persistent audio element
  if (!persistentAudio) {
    persistentAudio = document.getElementById('narrator-audio-element');
    if (!persistentAudio) {
      persistentAudio = document.createElement('audio');
      persistentAudio.preload = 'auto';
      document.body.appendChild(persistentAudio);
    }
  }
  
  // Play a silent audio to unlock the audio context
  const silentDataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  persistentAudio.src = silentDataUrl;
  persistentAudio.volume = 0;
  persistentAudio.play().then(() => {
    audioUnlocked = true;
  }).catch(() => {
    // Try again with a different approach for stubborn mobile browsers
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume().then(() => {
        audioUnlocked = true;
      });
    } catch (e) {
      // If all else fails, mark as unlocked anyway to prevent infinite attempts
      audioUnlocked = true;
    }
  });
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
  const blob  = new Blob(parts, { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(blob);

  // Use the persistent audio element for better mobile support
  if (!persistentAudio) {
    persistentAudio = document.getElementById('narrator-audio-element');
    if (!persistentAudio) {
      persistentAudio = document.createElement('audio');
      persistentAudio.preload = 'auto';
      document.body.appendChild(persistentAudio);
    }
  }

  // Set the audio source and play
  persistentAudio.src = audioUrl;
  currentAudio = persistentAudio;

  // play completely before returning (prevents overlaps)
  await new Promise((resolve) => {
    persistentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl); // Clean up blob URL
      resolve();
    };
    persistentAudio.onerror = () => {
      URL.revokeObjectURL(audioUrl); // Clean up blob URL
      resolve(); // fail‑safe
    };
    
    // Attempt to play with better error handling for mobile
    persistentAudio.play().catch((error) => {
      console.warn('Audio playback failed:', error);
      // Try to unlock audio if not already done
      if (!audioUnlocked) {
        unlockAudioForMobile();
      }
      resolve(); // Continue even if playback fails
    });
  });
}