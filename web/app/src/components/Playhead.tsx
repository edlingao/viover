import { onCleanup } from "solid-js";

interface PlayheadProps {
  position: number;
  onDrag: (position: number) => void;
  containerRef: HTMLDivElement | undefined;
  trackWidth: number;
  sidebarWidth: number;
  snapPoints?: number[];
  duration?: number;
}

export function Playhead(props: PlayheadProps) {
  let isDragging = false;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const SNAP_THRESHOLD_PX = 10;

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !props.containerRef) return;
    const rect = props.containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left - props.sidebarWidth;
    let position = Math.max(0, Math.min(x / props.trackWidth, 1));

    if (props.snapPoints && props.duration) {
      const currentTime = position * props.duration;
      const thresholdSec = (SNAP_THRESHOLD_PX / props.trackWidth) * props.duration;
      for (const snapTime of props.snapPoints) {
        if (Math.abs(currentTime - snapTime) <= thresholdSec) {
          position = snapTime / props.duration;
          break;
        }
      }
    }

    props.onDrag(position);
  };

  const handleMouseUp = () => {
    isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  });

  const leftPx = () => props.sidebarWidth + props.position * props.trackWidth;

  return (
    <div
      class="playhead absolute top-0 bottom-0 w-0.5 bg-[#ff6b35] cursor-ew-resize z-20 shadow-lg"
      style={{ left: `${leftPx()}px` }}
      onMouseDown={handleMouseDown}
    >
      <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#ff6b35] rotate-45 shadow-md" />
    </div>
  );
}
