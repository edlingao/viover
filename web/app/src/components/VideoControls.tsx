import { createSignal } from "solid-js";

interface VideoControlsProps {
  videoRef: HTMLVideoElement | undefined;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
}

function formatTimecode(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

export function VideoControls(props: VideoControlsProps) {
  const [volume, setVolume] = createSignal(1);
  const [isMuted, setIsMuted] = createSignal(false);

  const handleVolumeChange = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setVolume(value);
    if (props.videoRef) {
      props.videoRef.volume = value;
      setIsMuted(value === 0);
    }
  };

  const toggleMute = () => {
    if (!props.videoRef) return;
    const muted = !isMuted();
    setIsMuted(muted);
    props.videoRef.muted = muted;
  };

  return (
    <div class="aero-controls flex items-center gap-4 px-4 py-2.5">
      <button
        onClick={props.onPlayPause}
        class="w-9 h-9 flex items-center justify-center text-white hover:text-[#ffcc00] transition-colors"
      >
        {props.isPlaying ? (
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button
        onClick={toggleMute}
        class="w-9 h-9 flex items-center justify-center text-white hover:text-[#ffcc00] transition-colors"
      >
        {isMuted() || volume() === 0 ? (
          <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume()}
        onInput={handleVolumeChange}
        class="aero-slider w-20 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer"
      />

      <div class="ml-auto shrink-0 whitespace-nowrap font-mono text-sm">
        <span class="text-white font-semibold">{formatTimecode(props.currentTime)}</span>
        <span class="text-white/40 mx-1">/</span>
        <span class="text-white/60">{formatTimecode(props.duration)}</span>
      </div>
    </div>
  );
}
