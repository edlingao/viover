import { createSignal, createEffect } from "solid-js";
import { Playhead } from "./Playhead";
import { TimecodeRuler } from "./TimecodeRuler";
import { TimelineScrollbar } from "./TimelineScrollbar";

interface TimelineProps {
  videoRef: HTMLVideoElement | undefined;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

const MIN_PIXELS_PER_SECOND = 20;
const MAX_PIXELS_PER_SECOND = 150;
const PADDING = 24;

export function Timeline(props: TimelineProps) {
  let containerRef: HTMLDivElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  const [pixelsPerSecond, setPixelsPerSecond] = createSignal(50);
  const [scrollPos, setScrollPos] = createSignal(0);

  const trackWidth = () => Math.max(props.duration * pixelsPerSecond(), 800);
  const contentWidth = () => trackWidth() + PADDING * 2;

  const handleScroll = () => {
    if (scrollRef) setScrollPos(scrollRef.scrollLeft);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!e.shiftKey && scrollRef) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      const oldPps = pixelsPerSecond();
      const newPps = Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, oldPps + delta));

      if (newPps !== oldPps) {
        const playheadPos = props.currentTime * oldPps + PADDING;
        const playheadInView = playheadPos - scrollRef.scrollLeft;

        setPixelsPerSecond(newPps);

        const newPlayheadPos = props.currentTime * newPps + PADDING;
        scrollRef.scrollLeft = newPlayheadPos - playheadInView;
      }
    }
  };

  const handlePlayheadDrag = (position: number) => {
    props.onSeek(position * props.duration);
  };

  const handleRulerClick = (time: number) => {
    props.onSeek(time);
  };

  const handleTrackClick = (e: MouseEvent) => {
    if (!containerRef || !scrollRef) return;
    if ((e.target as HTMLElement).closest(".playhead")) return;

    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / trackWidth()) * props.duration;
    props.onSeek(Math.max(0, Math.min(time, props.duration)));
  };

  const position = () =>
    props.duration > 0 ? props.currentTime / props.duration : 0;

  createEffect(() => {
    if (!scrollRef || !props.isPlaying) return;
    const playheadPos = props.currentTime * pixelsPerSecond() + PADDING;
    const viewportWidth = scrollRef.clientWidth;
    const targetOffset = viewportWidth * 0.3;

    const targetScroll = Math.max(0, playheadPos - targetOffset);
    const maxScroll = contentWidth() - viewportWidth;

    if (targetScroll <= maxScroll) {
      scrollRef.scrollLeft = targetScroll;
    }
  });

  return (
    <div class="w-full shrink-0 bg-[#1a1a1a] border-t border-[#333333]">
      <div
        ref={scrollRef}
        class="overflow-x-scroll scrollbar-hide"
        onWheel={handleWheel}
        onScroll={handleScroll}
        style={{ "scrollbar-width": "none", "-ms-overflow-style": "none" }}
      >
        <div style={{ width: `${contentWidth()}px`, "min-width": "100%", "padding-left": `${PADDING}px`, "padding-right": `${PADDING}px` }}>
          <TimecodeRuler
            duration={props.duration}
            width={trackWidth()}
            onClick={handleRulerClick}
          />
          <div
            ref={containerRef}
            class="relative cursor-pointer h-16 bg-[#2a2a2a]"
            onClick={handleTrackClick}
          >
            <Playhead
              position={position()}
              onDrag={handlePlayheadDrag}
              containerRef={containerRef}
              trackWidth={trackWidth()}
              sidebarWidth={0}
            />
          </div>
        </div>
      </div>
      <TimelineScrollbar
        scrollRef={scrollRef}
        contentWidth={contentWidth()}
        scrollPos={scrollPos()}
      />
    </div>
  );
}
