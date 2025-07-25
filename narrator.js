// narrator.js — ElevenLabs streamer
const ELEVEN_KEY = 'sk_c2f8ed0d2ae4f0d0c3c8b119b96d569dc00d888cd1d1f3d8';   // your key
const VOICE_ID   = 'EiNlNiXeDU1pqqOPrYMO';                                   // your chosen voice

let narratorOn   = false;
let audioElement = null;
let audioUnlocked = false;
let isPlaying = false;

/**
 * Unlocks audio playback on mobile browsers and initializes the persistent audio element.
 * This function should be called from within a user-initiated event (e.g., a click).
 * Uses the persistent audio element to ensure mobile compatibility.
 */
function unlockAudioForMobile() {
  if (audioUnlocked) return;
  
  // Get the persistent audio element
  audioElement = document.getElementById('narrator-audio-element');
  if (!audioElement) {
    console.warn('narrator-audio-element not found in DOM');
    return;
  }
  
  // Create a silent audio blob to unlock audio context
  const silentAudioBlob = new Blob([new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00,
    0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ])], { type: 'audio/wav' });
  
  // Set the silent audio and play to unlock
  const silentUrl = URL.createObjectURL(silentAudioBlob);
  audioElement.src = silentUrl;
  audioElement.volume = 0;
  
  const playPromise = audioElement.play();
  if (playPromise) {
    playPromise
      .then(() => {
        audioUnlocked = true;
        // Clean up the silent audio
        audioElement.pause();
        URL.revokeObjectURL(silentUrl);
        console.log('Mobile audio unlocked successfully');
      })
      .catch((error) => {
        console.warn('Audio unlock failed:', error);
        // Still mark as unlocked to prevent repeated attempts
        audioUnlocked = true;
      });
  } else {
    audioUnlocked = true;
  }
}

export function toggleNarrator(flag) {
  // Unlock audio on the first time the narrator is enabled
  if (flag && !audioUnlocked) {
    unlockAudioForMobile();
  }

  // Stop any currently playing audio
  if (audioElement && isPlaying) {
    audioElement.pause();
    isPlaying = false;
  }
  
  narratorOn = flag;
}

// Listen for user interaction events to unlock audio
document.addEventListener('userInteraction', () => {
  if (!audioUnlocked) {
    unlockAudioForMobile();
  }
});

// Also try to unlock on first click anywhere in the document
document.addEventListener('click', () => {
  if (!audioUnlocked) {
    unlockAudioForMobile();
  }
}, { once: true });

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
  // Ensure we have the audio element and it's unlocked
  if (!audioElement) {
    audioElement = document.getElementById('narrator-audio-element');
    if (!audioElement) {
      console.error('narrator-audio-element not found');
      return;
    }
  }
  
  if (!audioUnlocked) {
    console.warn('Audio not unlocked, skipping narration');
    return;
  }

  try {
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
    const audioUrl = URL.createObjectURL(blob);

    // Use the persistent audio element
    audioElement.src = audioUrl;
    isPlaying = true;

    // Play and wait for completion
    await new Promise((resolve, reject) => {
      const onEnded = () => {
        isPlaying = false;
        URL.revokeObjectURL(audioUrl);
        audioElement.removeEventListener('ended', onEnded);
        audioElement.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = (error) => {
        isPlaying = false;
        URL.revokeObjectURL(audioUrl);
        audioElement.removeEventListener('ended', onEnded);
        audioElement.removeEventListener('error', onError);
        console.warn('Audio playback error:', error);
        resolve(); // Continue to next chunk even if this one fails
      };

      audioElement.addEventListener('ended', onEnded);
      audioElement.addEventListener('error', onError);
      
      const playPromise = audioElement.play();
      if (playPromise) {
        playPromise.catch((playError) => {
          console.warn('Audio play failed:', playError);
          onError(playError);
        });
      }
    });
  } catch (error) {
    console.error('TTS streaming error:', error);
    isPlaying = false;
    // Continue to next chunk even if this one fails
  }
}