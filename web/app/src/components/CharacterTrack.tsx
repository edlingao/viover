import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { core } from "../../wailsjs/go/models";
import { GetRecordingWaveform } from "../../wailsjs/go/adapters/App";

interface CharacterTrackProps {
  character: core.Character;
  recordings: core.Recording[];
  duration: number;
  pixelsPerSecond: number;
  isRecording: boolean;
  selectedCharacterId: string | null;
  currentTime: number;
  recordingStartTime?: number;
  volume?: number;
  isMuted?: boolean;
  sidebarWidth?: number;
  onSidebarResize?: (width: number) => void;
  onSelect: () => void;
  onUpdateCharacter: (name: string, color: string) => void;
  onDeleteCharacter: () => void;
  onDeleteRecording: (id: string) => void;
  onMoveRecording?: (id: string, newTimecode: number) => void;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: () => void;
  onRecordingVolumeChange?: (recordingId: string, volume: number) => void;
  onRecordingGainChange?: (recordingId: string, gainDB: number) => void;
}

const COLORS = [
  "#00ffcc",
  "#00d4ff",
  "#00ff88",
  "#ffaa00",
  "#ff7f7f",
  "#cc99ff",
  "#ffcc00",
  "#ff99cc",
];

interface RecordingWaveformProps {
  peaks: number[];
  width: number;
  height: number;
  color: string;
}

function RecordingWaveform(props: RecordingWaveformProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  createEffect(() => {
    if (!canvasRef || !props.peaks.length) return;

    const width = Math.floor(props.width);
    const height = Math.floor(props.height);

    canvasRef.width = width;
    canvasRef.height = height;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = props.color;

    const barWidth = Math.max(width / props.peaks.length, 1);
    const centerY = height / 2;
    const maxPeak = Math.max(...props.peaks, 1);

    props.peaks.forEach((peak, i) => {
      const normalizedHeight = (peak / maxPeak) * centerY * 0.9;
      const x = i * barWidth;
      const barH = Math.max(normalizedHeight, 1);
      ctx.fillRect(x, centerY - barH, barWidth - 0.5, barH * 2);
    });
  });

  return <canvas ref={canvasRef} class="absolute inset-0 w-full h-full" />;
}

export function CharacterTrack(props: CharacterTrackProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal(props.character.name);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [waveforms, setWaveforms] = createSignal<Record<string, number[]>>({});
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragStartX, setDragStartX] = createSignal(0);
  const [dragOffset, setDragOffset] = createSignal(0);
  const [pickerPosition, setPickerPosition] = createSignal({ top: 0, left: 0 });
  const [isResizing, setIsResizing] = createSignal(false);
  const [resizeStartX, setResizeStartX] = createSignal(0);
  const [resizeStartWidth, setResizeStartWidth] = createSignal(0);

  let trackAreaRef: HTMLDivElement | undefined;
  let colorSwatchRef: HTMLDivElement | undefined;

  const isSelected = () => props.selectedCharacterId === props.character.id;

  const SNAP_THRESHOLD_PX = 10;

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingId()) return;
    const deltaX = e.clientX - dragStartX();
    const recording = props.recordings.find((r) => r.id === draggingId());
    if (!recording) return;
    const baseLeft = recording.timecode * props.pixelsPerSecond;
    let newLeft = Math.max(0, baseLeft + deltaX);

    const cursorPx = props.currentTime * props.pixelsPerSecond;
    if (Math.abs(newLeft - cursorPx) <= SNAP_THRESHOLD_PX) {
      newLeft = cursorPx;
    }

    setDragOffset(newLeft);
  };

  const handleMouseUp = () => {
    if (!draggingId() || !props.onMoveRecording) {
      setDraggingId(null);
      return;
    }
    const newTimecode = Math.max(0, dragOffset() / props.pixelsPerSecond);
    props.onMoveRecording(draggingId()!, newTimecode);
    setDraggingId(null);
  };

  createEffect(() => {
    if (draggingId()) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  });

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing() || !props.onSidebarResize) return;
    const deltaX = e.clientX - resizeStartX();
    props.onSidebarResize(resizeStartWidth() + deltaX);
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
  };

  createEffect(() => {
    if (isResizing()) {
      document.addEventListener("mousemove", handleResizeMouseMove);
      document.addEventListener("mouseup", handleResizeMouseUp);
    } else {
      document.removeEventListener("mousemove", handleResizeMouseMove);
      document.removeEventListener("mouseup", handleResizeMouseUp);
    }
  });

  const handleResizeStart = (e: MouseEvent) => {
    if (!props.onSidebarResize) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartWidth(props.sidebarWidth ?? 208);
  };

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("mousemove", handleResizeMouseMove);
    document.removeEventListener("mouseup", handleResizeMouseUp);
  });

  const loadWaveforms = async () => {
    const currentWaveforms = { ...waveforms() };
    let hasNew = false;
    for (const recording of props.recordings) {
      if (!currentWaveforms[recording.id]) {
        try {
          const peaks = await GetRecordingWaveform(recording.id);
          if (peaks && peaks.length > 0) {
            currentWaveforms[recording.id] = peaks;
            hasNew = true;
          }
        } catch (e) {
          console.error("Failed to load waveform:", e);
        }
      }
    }
    if (hasNew) {
      setWaveforms(currentWaveforms);
    }
  };

  createEffect(() => {
    const recordings = props.recordings;
    if (recordings.length > 0) {
      loadWaveforms();
    }
  });

  const saveEdit = () => {
    props.onUpdateCharacter(editName(), props.character.color);
    setIsEditing(false);
  };

  const selectColor = (color: string) => {
    props.onUpdateCharacter(props.character.name, color);
    setShowColorPicker(false);
  };

  createEffect(() => {
    if (showColorPicker()) {
      const handleClickOutside = () => setShowColorPicker(false);
      setTimeout(
        () => document.addEventListener("click", handleClickOutside),
        0,
      );
      onCleanup(() =>
        document.removeEventListener("click", handleClickOutside),
      );
    }
  });

  return (
    <div
      class={`aero-track flex h-14 overflow-visible ${isSelected() ? "selected" : ""} ${props.isMuted ? "opacity-50" : ""}`}
    >
      <div
        class="character-sidebar group shrink-0 flex items-center gap-3 px-4 cursor-pointer transition-all hover:bg-white/10 overflow-visible sticky left-0 z-30 bg-white/60 backdrop-blur-md"
        style={{ width: `${props.sidebarWidth ?? 208}px` }}
        onClick={(e) => {
          e.stopPropagation();
          props.onSelect();
        }}
      >
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            props.onDeleteCharacter();
          }}
          class="absolute top-1 right-2 w-5 h-5 bg-gradient-to-br from-red-400 to-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg transition-opacity z-50 pointer-events-auto cursor-pointer"
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div class="relative overflow-visible">
          <div
            ref={colorSwatchRef}
            class="w-5 h-5 rounded-md cursor-pointer aero-color-swatch transition-transform hover:scale-110"
            style={{ "background-color": props.character.color }}
            onClick={(e) => {
              e.stopPropagation();
              if (colorSwatchRef) {
                const rect = colorSwatchRef.getBoundingClientRect();
                setPickerPosition({ top: rect.top - 8, left: rect.left });
              }
              setShowColorPicker(!showColorPicker());
            }}
          />
          <Show when={showColorPicker()}>
            <Portal>
              <div
                class="aero-color-picker fixed p-3 grid grid-cols-4 gap-2 min-w-max"
                style={{
                  top: `${pickerPosition().top}px`,
                  left: `${pickerPosition().left}px`,
                  transform: "translateY(-100%)",
                  "z-index": 9999,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <For each={COLORS}>
                  {(color) => (
                    <div
                      class="aero-color-swatch w-6 h-6 cursor-pointer"
                      style={{ "background-color": color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectColor(color);
                      }}
                    />
                  )}
                </For>
              </div>
            </Portal>
          </Show>
        </div>
        <Show
          when={isEditing()}
          fallback={
            <span
              class="text-sm text-slate-800 truncate font-medium min-w-[100px] max-w-[300px]"
              onDblClick={(e) => {
                e.stopPropagation();
                setEditName(props.character.name);
                setIsEditing(true);
              }}
              title={props.character.name}
            >
              {props.character.name}
            </span>
          }
        >
          <input
            type="text"
            value={editName()}
            onInput={(e) => setEditName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onBlur={saveEdit}
            autofocus
            class="aero-input flex-1 px-2 py-1 text-sm text-white min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          />
        </Show>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onMuteToggle?.();
          }}
          class={`aero-button p-1.5 transition-colors ${props.isMuted ? "text-red-400" : "text-slate-700 hover:text-white"}`}
          title={props.isMuted ? "Unmute" : "Mute"}
        >
          <Show
            when={props.isMuted}
            fallback={
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            }
          >
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </Show>
        </button>
        <Show when={isSelected()}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={props.volume ?? 1}
            onInput={(e) => {
              e.stopPropagation();
              props.onVolumeChange?.(parseFloat(e.currentTarget.value));
            }}
            onClick={(e) => e.stopPropagation()}
            class="w-20 h-1 accent-current cursor-pointer"
            style={{ color: props.character.color }}
            title={`Volume: ${Math.round((props.volume ?? 1) * 100)}%`}
          />
        </Show>
        <div
          class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#00d4ff] transition-colors"
          style={{
            "background-color": isResizing()
              ? "#00d4ff"
              : "rgba(255,255,255,0.1)",
          }}
          onMouseDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div class="flex-1 relative" ref={trackAreaRef}>
        <For each={props.recordings}>
          {(recording) => {
            const baseLeft = () => recording.timecode * props.pixelsPerSecond;
            const width = () => Math.max(
              recording.duration * props.pixelsPerSecond,
              24,
            );
            const peaks = () => waveforms()[recording.id] || [];
            const isDragging = () => draggingId() === recording.id;
            const displayLeft = () =>
              isDragging() ? dragOffset() : baseLeft();

            const handleDragStart = (e: MouseEvent) => {
              if (!props.onMoveRecording) return;
              e.preventDefault();
              e.stopPropagation();
              setDraggingId(recording.id);
              setDragStartX(e.clientX);
              setDragOffset(baseLeft());
            };

            return (
              <div
                class={`aero-recording absolute top-2 bottom-2 group ${isDragging() ? "cursor-grabbing z-30 opacity-80" : "cursor-grab z-10"}`}
                style={{
                  left: `${displayLeft()}px`,
                  width: `${width()}px`,
                  "background-color": props.character.color,
                }}
                onMouseDown={handleDragStart}
              >
                <Show when={peaks().length > 0}>
                  <RecordingWaveform
                    peaks={peaks()}
                    width={width()}
                    height={40}
                    color="rgba(255,255,255,0.6)"
                  />
                </Show>
                <div class="absolute bottom-0 left-1 right-5 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col gap-0.5">
                  <div class="flex items-center gap-1">
                    <span class="text-[8px] text-white/70 w-4">Vol</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={(recording as any).volume ?? 1}
                      onInput={(e) => {
                        e.stopPropagation();
                        props.onRecordingVolumeChange?.(
                          recording.id,
                          parseFloat(e.currentTarget.value),
                        );
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      class="flex-1 h-1 accent-white cursor-pointer"
                      title={`Volume: ${Math.round(((recording as any).volume ?? 1) * 100)}%`}
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-[8px] text-white/70 w-4">dB</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={(recording as any).gain_db ?? 0}
                      onInput={(e) => {
                        e.stopPropagation();
                        props.onRecordingGainChange?.(
                          recording.id,
                          parseFloat(e.currentTarget.value),
                        );
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      class="flex-1 h-1 accent-[#ffaa00] cursor-pointer"
                      title={`Gain: ${((recording as any).gain_db ?? 0).toFixed(1)} dB`}
                    />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteRecording(recording.id);
                  }}
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-red-400 to-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg transition-opacity z-10 cursor-pointer"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            );
          }}
        </For>
        <Show
          when={
            isSelected() &&
            props.isRecording &&
            props.recordingStartTime !== undefined
          }
        >
          {(() => {
            const startTime = props.recordingStartTime!;
            const elapsed = Math.max(0, props.currentTime - startTime);
            const left = startTime * props.pixelsPerSecond;
            const width = Math.max(elapsed * props.pixelsPerSecond, 4);
            return (
              <div
                class="absolute top-2 bottom-2 rounded-md opacity-80"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  "background-color": props.character.color,
                  "box-shadow": `0 0 10px ${props.character.color}`,
                }}
              >
                <div class="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
            );
          })()}
        </Show>
      </div>
    </div>
  );
}
