import { onCleanup } from "solid-js";

interface TimelineScrollbarProps {
  scrollRef: HTMLDivElement | undefined;
  contentWidth: number;
  scrollPos: number;
}

export function TimelineScrollbar(props: TimelineScrollbarProps) {
  let trackRef: HTMLDivElement | undefined;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;

  const thumbWidth = () => {
    if (!props.scrollRef) return 100;
    const viewportWidth = props.scrollRef.clientWidth;
    const ratio = viewportWidth / props.contentWidth;
    return Math.max(ratio * 100, 10);
  };

  const thumbPosition = () => {
    if (!props.scrollRef) return 0;
    const maxScroll = props.contentWidth - props.scrollRef.clientWidth;
    if (maxScroll <= 0) return 0;
    const ratio = props.scrollPos / maxScroll;
    const maxThumbPos = 100 - thumbWidth();
    return ratio * maxThumbPos;
  };

  const handleTrackClick = (e: MouseEvent) => {
    if (!trackRef || !props.scrollRef) return;
    if ((e.target as HTMLElement).closest(".thumb")) return;

    const rect = trackRef.getBoundingClientRect();
    const clickPos = (e.clientX - rect.left) / rect.width;
    const maxScroll = props.contentWidth - props.scrollRef.clientWidth;
    props.scrollRef.scrollLeft = clickPos * maxScroll;
  };

  const handleThumbMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartScroll = props.scrollRef?.scrollLeft || 0;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !trackRef || !props.scrollRef) return;
    const rect = trackRef.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / rect.width;
    const maxScroll = props.contentWidth - props.scrollRef.clientWidth;
    props.scrollRef.scrollLeft = dragStartScroll + deltaRatio * maxScroll;
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

  return (
    <div
      ref={trackRef}
      class="h-3 bg-[#0096c7] cursor-pointer relative"
      onClick={handleTrackClick}
    >
      <div class="absolute inset-x-2 top-1 bottom-1 bg-[#48cae4] rounded-full">
        <div
          class="thumb absolute top-0 bottom-0 bg-[#ff7f50] hover:bg-[#ff9f7a] rounded-full cursor-grab active:cursor-grabbing shadow-md"
          style={{
            left: `${thumbPosition()}%`,
            width: `${thumbWidth()}%`,
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  );
}
