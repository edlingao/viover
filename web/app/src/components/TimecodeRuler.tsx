import { createMemo, For } from "solid-js";

interface TimecodeRulerProps {
  duration: number;
  width: number;
  onClick: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TimecodeRuler(props: TimecodeRulerProps) {
  const ticks = createMemo(() => {
    const duration = props.duration || 1;
    const interval = duration > 60 ? 10 : duration > 30 ? 5 : 2;
    const count = Math.floor(duration / interval) + 1;
    return Array.from({ length: count }, (_, i) => ({
      time: i * interval,
      position: (i * interval) / duration,
    }));
  });

  const handleClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / props.width) * props.duration;
    props.onClick(Math.max(0, Math.min(time, props.duration)));
  };

  return (
    <div
      class="relative h-6 bg-gradient-to-r from-[#48cae4] to-[#90e0ef] cursor-pointer select-none"
      onClick={handleClick}
    >
      <For each={ticks()}>
        {(tick) => (
          <div
            class="absolute top-0 flex flex-col items-center"
            style={{ left: `${tick.position * 100}%` }}
          >
            <div class="w-px h-2 bg-[#0077b6]" />
            <span class="text-[10px] text-[#004d73] font-medium -translate-x-1/2">
              {formatTime(tick.time)}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}
