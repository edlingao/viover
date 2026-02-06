import { createSignal, createEffect, onCleanup } from "solid-js";
import { core } from "../../wailsjs/go/models";
import { GetAudioData } from "../../wailsjs/go/adapters/App";

interface AudioPlaybackManagerProps {
  recordings: core.Recording[];
  currentTime: number;
  isPlaying: boolean;
  characterVolumes?: Record<string, number>;
  masterVolume?: number;
  mutedCharacters?: Record<string, boolean>;
  recordingGains?: Record<string, number>;
}

interface AudioState {
  element: HTMLAudioElement;
  audioUrl: string;
  isReady: boolean;
  recordingId: string;
  timecode: number;
  duration: number;
  source: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
}

const audioCache = new Map<string, AudioState>();
const loadingIds = new Set<string>();

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

(window as any).audioDebug = {
  getCache: () => audioCache,
  playFirst: () => {
    const first = audioCache.values().next().value;
    if (first) {
      console.log("[AudioDebug] Playing first cached audio:", first.recordingId);
      first.element.currentTime = 0;
      if (first.gainNode) {
        first.gainNode.gain.value = 1;
      }
      first.element.play().then(() => console.log("[AudioDebug] Playing!")).catch(e => console.error("[AudioDebug] Error:", e));
    } else {
      console.log("[AudioDebug] No audio in cache");
    }
  },
  listAll: () => {
    audioCache.forEach((state, id) => {
      console.log("[AudioDebug]", id, "- ready:", state.isReady, "duration:", state.duration, "timecode:", state.timecode);
    });
  }
};

export function AudioPlaybackManager(props: AudioPlaybackManagerProps) {
  const [loadedCount, setLoadedCount] = createSignal(0);

  createEffect(() => {
    console.log("[AudioManager] Props update - isPlaying:", props.isPlaying, "currentTime:", props.currentTime?.toFixed(2), "recordings:", props.recordings?.length);
  });

  const loadAudio = async (recording: core.Recording) => {
    if (audioCache.has(recording.id) || loadingIds.has(recording.id)) return;
    loadingIds.add(recording.id);

    try {
      console.log("[AudioManager] Loading audio for", recording.id);

      let base64Data: string | null = null;
      try {
        base64Data = await GetAudioData(recording.id);
      } catch (e) {
        console.error("[AudioManager] GetAudioData threw error:", e);
      }

      console.log("[AudioManager] GetAudioData returned base64 string, length:", base64Data?.length);

      if (!base64Data || base64Data.length === 0) {
        console.error("[AudioManager] No audio data for", recording.id);
        loadingIds.delete(recording.id);
        return;
      }

      const dataUrl = `data:audio/wav;base64,${base64Data}`;
      console.log("[AudioManager] Data URL created, length:", dataUrl.length);

      const audio = new Audio();
      audio.preload = "auto";

      const dataForDebug = {
        base64Length: base64Data.length,
        audioUrl: dataUrl.substring(0, 100) + "...",
      };

      const state: AudioState = {
        element: audio,
        audioUrl: dataUrl,
        isReady: false,
        recordingId: recording.id,
        timecode: recording.timecode,
        duration: recording.duration,
        source: null,
        gainNode: null,
      };

      audio.oncanplaythrough = () => {
        console.log("[AudioManager] Audio ready for", recording.id, "audioDuration:", audio.duration, "recordingDuration:", recording.duration);
        state.isReady = true;
        state.duration = audio.duration || recording.duration;

        try {
          const ctx = getAudioContext();
          if (!state.source) {
            state.source = ctx.createMediaElementSource(audio);
            state.gainNode = ctx.createGain();
            state.source.connect(state.gainNode);
            state.gainNode.connect(ctx.destination);
          }
        } catch (e) {
          console.error("[AudioManager] Failed to create Web Audio nodes:", e);
        }

        setLoadedCount(c => c + 1);

        if (state.gainNode) {
          state.gainNode.gain.value = 0.5;
        }
        console.log("[AudioManager] TEST: Attempting to play audio to verify it works...");
        audio.play().then(() => {
          console.log("[AudioManager] TEST: Audio CAN play! Pausing test playback.");
          setTimeout(() => audio.pause(), 500);
        }).catch((e) => {
          console.error("[AudioManager] TEST: Audio CANNOT play:", e.message || e);
        });
      };

      audio.onerror = () => {
        const err = audio.error;
        console.error("[AudioManager] Audio load error for", recording.id);
        console.error("[AudioManager] Error code:", err?.code, "- 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED");
        console.error("[AudioManager] Error message:", err?.message);
        console.error("[AudioManager] Audio URL prefix:", dataForDebug.audioUrl);
        console.error("[AudioManager] Base64 length was:", dataForDebug.base64Length);
      };

      audio.src = dataUrl;
      audioCache.set(recording.id, state);
      loadingIds.delete(recording.id);
    } catch (e) {
      console.error("[AudioManager] Failed to load audio:", e);
      loadingIds.delete(recording.id);
    }
  };

  createEffect(() => {
    const recordings = props.recordings;
    const currentIds = new Set(recordings.map((r) => r.id));

    console.log("[AudioManager] Recordings changed - count:", recordings.length, "cached:", audioCache.size);
    recordings.forEach((r, i) => {
      console.log(`[AudioManager] Recording[${i}]:`, r.id, "path:", r.file_path, "timecode:", r.timecode, "duration:", r.duration);
    });

    audioCache.forEach((state, id) => {
      if (!currentIds.has(id)) {
        console.log("[AudioManager] Removing stale audio:", id);
        state.element.pause();
        state.element.src = "";
        audioCache.delete(id);
      }
    });

    recordings.forEach((r) => {
      if (!audioCache.has(r.id) && !loadingIds.has(r.id)) {
        console.log("[AudioManager] Will load new recording:", r.id);
      }
      loadAudio(r);
    });
  });

  createEffect(() => {
    const _loaded = loadedCount();
    void _loaded;
    const masterVol = props.masterVolume ?? 1;
    const charVols = props.characterVolumes ?? {};
    const mutedChars = props.mutedCharacters ?? {};
    const recGains = props.recordingGains ?? {};

    props.recordings.forEach((r) => {
      const state = audioCache.get(r.id);
      if (!state || !state.gainNode) return;
      const isMuted = mutedChars[r.character_id] ?? false;
      const charVol = charVols[r.character_id] ?? 1;
      const recVol = (r as any).volume ?? 1;
      const gainDB = recGains[r.id] ?? (r as any).gain_db ?? 0;
      const gainLinear = dbToLinear(gainDB);
      const finalGain = isMuted ? 0 : masterVol * charVol * recVol * gainLinear;
      if (Math.abs(state.gainNode.gain.value - finalGain) > 0.001) {
        console.log("[AudioManager] Setting gain for", r.id, "to", finalGain.toFixed(3), "(master:", masterVol, "char:", charVol, "rec:", recVol, "gainDB:", gainDB, "muted:", isMuted, ")");
        state.gainNode.gain.value = finalGain;
      }
    });
  });

  createEffect(() => {
    const _loaded = loadedCount();
    void _loaded;
    const time = props.currentTime;
    const playing = props.isPlaying;
    const recordings = props.recordings;

    if (recordings.length > 0 && audioCache.size > 0) {
      console.log("[AudioManager] Playback check - time:", time.toFixed(2), "playing:", playing, "recordings:", recordings.length, "cached:", audioCache.size);
    }

    recordings.forEach((r) => {
      const state = audioCache.get(r.id);
      if (!state) {
        if (playing) {
          console.log("[AudioManager] Audio not loaded yet for", r.id);
        }
        return;
      }
      if (!state.isReady) {
        if (playing) {
          console.log("[AudioManager] Audio not ready yet for", r.id);
        }
        return;
      }

      const audio = state.element;
      const audioDuration = state.duration || audio.duration || r.duration;
      const recordingStart = r.timecode;
      const recordingEnd = recordingStart + audioDuration;
      const isInRange = time >= recordingStart && time < recordingEnd;

      if (isInRange && playing) {
        const offset = time - recordingStart;

        if (Math.abs(audio.currentTime - offset) > 0.5) {
          console.log("[AudioManager] Seeking audio", r.id, "from", audio.currentTime.toFixed(2), "to", offset.toFixed(2));
          audio.currentTime = Math.max(0, Math.min(offset, audioDuration));
        }

        if (audio.paused) {
          if (audioContext && audioContext.state === "suspended") {
            audioContext.resume();
          }
          console.log("[AudioManager] Playing audio", r.id, "at offset", offset.toFixed(2), "gain:", state.gainNode?.gain.value, "range:", recordingStart.toFixed(2), "-", recordingEnd.toFixed(2));
          audio.play().then(() => {
            console.log("[AudioManager] Play started successfully for", r.id);
          }).catch((e) => {
            console.error("[AudioManager] Audio play error:", e.message || e);
          });
        }
      } else {
        if (!audio.paused) {
          console.log("[AudioManager] Pausing audio", r.id, "- out of range or not playing");
          audio.pause();
        }
      }
    });
  });

  onCleanup(() => {
    audioCache.forEach((state) => {
      state.element.pause();
      state.element.src = "";
    });
    audioCache.clear();
    loadingIds.clear();
  });

  return null;
}
