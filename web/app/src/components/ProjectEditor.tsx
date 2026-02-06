import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { core } from "../../wailsjs/go/models";
import {
  GetCurrentProject,
  SelectVideo,
  GetVideoURL,
  AddCharacter,
  UpdateCharacter,
  DeleteCharacter,
  RecordAudio,
  StopRecording,
  DeleteRecording,
  ExportRecordings,
  ListDevices,
  SelectDevice,
  GetSelectedDevice,
  CloseProject,
  UpdateRecordingTimecode,
  UpdateRecordingVolume,
  UpdateRecordingGain,
  SetMicrophoneGain,
  GetMicrophoneGain,
} from "../../wailsjs/go/adapters/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { VideoControls } from "./VideoControls";
import { TimecodeRuler } from "./TimecodeRuler";
import { Playhead } from "./Playhead";
import { TimelineScrollbar } from "./TimelineScrollbar";
import { CharacterTrack } from "./CharacterTrack";
import { CountdownModal } from "./CountdownModal";
import { AudioPlaybackManager } from "./AudioPlaybackManager";

interface ProjectEditorProps {
  projectId: string;
  onClose: () => void;
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

const MIN_PIXELS_PER_SECOND = 20;
const MAX_PIXELS_PER_SECOND = 150;
const PADDING = 24;
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 450;
const SEEK_STEP = 5;
const FINE_SEEK_STEP = 1;

export function ProjectEditor(props: ProjectEditorProps) {
  const [project, setProject] = createSignal<core.Project | null>(null);
  const [videoUrl, setVideoUrl] = createSignal("");
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [selectedCharacterId, setSelectedCharacterId] = createSignal<
    string | null
  >(null);
  const [devices, setDevices] = createSignal<core.DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] =
    createSignal<core.DeviceInfo | null>(null);
  const [showDeviceMenu, setShowDeviceMenu] = createSignal(false);
  const [showExportMenu, setShowExportMenu] = createSignal(false);
  const [pixelsPerSecond, setPixelsPerSecond] = createSignal(50);
  const [scrollPos, setScrollPos] = createSignal(0);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [showAddCharacter, setShowAddCharacter] = createSignal(false);
  const [newCharacterName, setNewCharacterName] = createSignal("");
  const [showCountdown, setShowCountdown] = createSignal(false);
  const [recordingStartTime, setRecordingStartTime] = createSignal<
    number | undefined
  >(undefined);
  const [masterVolume, setMasterVolume] = createSignal(1);
  const [characterVolumes, setCharacterVolumes] = createSignal<
    Record<string, number>
  >({});
  const [mutedCharacters, setMutedCharacters] = createSignal<
    Record<string, boolean>
  >({});
  const [sidebarWidth, setSidebarWidth] = createSignal(DEFAULT_SIDEBAR_WIDTH);
  const [micGainDB, setMicGainDB] = createSignal(0);
  const [recordingGains, setRecordingGains] = createSignal<Record<string, number>>({});

  let videoRef: HTMLVideoElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  let trackContainerRef: HTMLDivElement | undefined;

  const trackWidth = () => Math.max(duration() * pixelsPerSecond(), 800);
  const contentWidth = () => sidebarWidth() + trackWidth() + PADDING * 2;

  const loadProject = async () => {
    const p = await GetCurrentProject();
    setProject(p);
    if (p?.video) {
      const url = await GetVideoURL();
      setVideoUrl(url);
    }
  };

  const loadDevices = async () => {
    const d = await ListDevices();
    setDevices(d || []);
    const selected = await GetSelectedDevice();
    if (selected?.id) {
      setSelectedDevice(selected);
    } else if (d && d.length > 0) {
      setSelectedDevice(d[0]);
    }
    const gain = await GetMicrophoneGain();
    setMicGainDB(gain || 0);
  };

  const handleSelectVideo = async () => {
    const video = await SelectVideo();
    if (video) {
      await loadProject();
      const url = await GetVideoURL();
      setVideoUrl(url);
    }
  };

  const handleAddCharacter = () => {
    setNewCharacterName("");
    setShowAddCharacter(true);
  };

  const confirmAddCharacter = async () => {
    const name = newCharacterName().trim();
    if (!name) return;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    await AddCharacter(name, color);
    await loadProject();
    setShowAddCharacter(false);
    setNewCharacterName("");
  };

  const handleUpdateCharacter = async (
    id: string,
    name: string,
    color: string,
  ) => {
    await UpdateCharacter(id, name, color);
    await loadProject();
  };

  const handleDeleteCharacter = async (id: string) => {
    await DeleteCharacter(id);
    if (selectedCharacterId() === id) {
      setSelectedCharacterId(null);
    }
    await loadProject();
  };

  const handleRecord = async () => {
    const charId = selectedCharacterId();
    if (!charId) {
      alert("Select a character first");
      return;
    }
    if (isRecording()) {
      await StopRecording();
      if (videoRef) videoRef.pause();
    } else {
      setShowCountdown(true);
    }
  };

  const startRecordingAfterCountdown = async () => {
    setShowCountdown(false);
    const charId = selectedCharacterId();
    if (!charId) return;
    const startTime = currentTime();
    setRecordingStartTime(startTime);
    setIsRecording(true);
    if (videoRef) videoRef.play();
    await RecordAudio(charId, startTime);
    setRecordingStartTime(undefined);
    await loadProject();
  };

  const cancelCountdown = () => {
    setShowCountdown(false);
  };

  const handleDeleteRecording = async (id: string) => {
    await DeleteRecording(id);
    await loadProject();
  };

  const handleMoveRecording = async (id: string, newTimecode: number) => {
    await UpdateRecordingTimecode(id, newTimecode);
    await loadProject();
  };

  const handleCharacterVolumeChange = (charId: string, volume: number) => {
    setCharacterVolumes((prev) => ({ ...prev, [charId]: volume }));
  };

  const handleMuteToggle = (charId: string) => {
    setMutedCharacters((prev) => ({ ...prev, [charId]: !prev[charId] }));
  };

  const handleRecordingVolumeChange = async (
    recordingId: string,
    volume: number,
  ) => {
    await UpdateRecordingVolume(recordingId, volume);
    await loadProject();
  };

  const handleRecordingGainChange = async (
    recordingId: string,
    gainDB: number,
  ) => {
    setRecordingGains((prev) => ({ ...prev, [recordingId]: gainDB }));
    await UpdateRecordingGain(recordingId, gainDB);
    await loadProject();
  };

  const handleMicGainChange = async (gainDB: number) => {
    setMicGainDB(gainDB);
    await SetMicrophoneGain(gainDB);
  };

  const handleExport = async (format: string) => {
    setShowExportMenu(false);
    const path = await ExportRecordings(format);
    if (path) {
      alert(`Exported to: ${path}`);
    }
  };

  const handleDeviceSelect = async (device: core.DeviceInfo) => {
    await SelectDevice(device.id);
    setSelectedDevice(device);
    setShowDeviceMenu(false);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef) return;
    setDuration(videoRef.duration);
  };

  const handleTimeUpdate = () => {
    if (!videoRef) return;
    setCurrentTime(videoRef.currentTime);
  };

  const handleSeek = (time: number) => {
    if (!videoRef) return;
    videoRef.currentTime = time;
    setCurrentTime(time);
  };

  const togglePlayPause = () => {
    if (!videoRef || isRecording()) return;
    if (videoRef.paused) {
      videoRef.play();
    } else {
      videoRef.pause();
    }
  };

  const handleWheel = (e: WheelEvent) => {
    if (!e.shiftKey && scrollRef) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      const oldPps = pixelsPerSecond();
      const newPps = Math.max(
        MIN_PIXELS_PER_SECOND,
        Math.min(MAX_PIXELS_PER_SECOND, oldPps + delta),
      );
      if (newPps !== oldPps) {
        const playheadPos = currentTime() * oldPps + PADDING;
        const playheadInView = playheadPos - scrollRef.scrollLeft;
        setPixelsPerSecond(newPps);
        const newPlayheadPos = currentTime() * newPps + PADDING;
        scrollRef.scrollLeft = newPlayheadPos - playheadInView;
      }
    }
  };

  const handleScroll = () => {
    if (scrollRef) setScrollPos(scrollRef.scrollLeft);
  };

  const handleTrackClick = (e: MouseEvent) => {
    if (!trackContainerRef || !scrollRef) return;
    const target = e.target as HTMLElement;
    if (target.closest(".playhead")) return;
    if (target.closest(".character-sidebar")) return;
    const rect = trackContainerRef.getBoundingClientRect();
    const x = e.clientX - rect.left - sidebarWidth();
    const time = x / pixelsPerSecond();
    handleSeek(Math.max(0, Math.min(time, duration())));
  };

  const handleSidebarResize = (newWidth: number) => {
    const clampedWidth = Math.max(
      MIN_SIDEBAR_WIDTH,
      Math.min(MAX_SIDEBAR_WIDTH, newWidth),
    );
    setSidebarWidth(clampedWidth);
  };

  const position = () => (duration() > 0 ? currentTime() / duration() : 0);

  const handlePlayheadDrag = (pos: number) => {
    handleSeek(pos * duration());
  };

  const handleRulerClick = (time: number) => {
    handleSeek(time);
  };

  const selectNextCharacter = () => {
    const chars = project()?.characters || [];
    if (chars.length === 0) return;
    const currentId = selectedCharacterId();
    const currentIdx = chars.findIndex((c) => c.id === currentId);
    const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % chars.length;
    setSelectedCharacterId(chars[nextIdx].id);
  };

  const selectPrevCharacter = () => {
    const chars = project()?.characters || [];
    if (chars.length === 0) return;
    const currentId = selectedCharacterId();
    const currentIdx = chars.findIndex((c) => c.id === currentId);
    const prevIdx = currentIdx <= 0 ? chars.length - 1 : currentIdx - 1;
    setSelectedCharacterId(chars[prevIdx].id);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;

    switch (e.code) {
      case "Space":
        if (videoUrl()) {
          e.preventDefault();
          togglePlayPause();
        }
        break;
      case "KeyR":
        if (selectedCharacterId()) {
          e.preventDefault();
          handleRecord();
        }
        break;
      case "KeyC":
        e.preventDefault();
        handleAddCharacter();
        break;
      case "ArrowLeft":
        e.preventDefault();
        handleSeek(
          Math.max(
            0,
            currentTime() - (e.shiftKey ? FINE_SEEK_STEP : SEEK_STEP),
          ),
        );
        break;
      case "ArrowRight":
        e.preventDefault();
        handleSeek(
          Math.min(
            duration(),
            currentTime() + (e.shiftKey ? FINE_SEEK_STEP : SEEK_STEP),
          ),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        selectPrevCharacter();
        break;
      case "ArrowDown":
        e.preventDefault();
        selectNextCharacter();
        break;
      case "Home":
        e.preventDefault();
        handleSeek(0);
        break;
      case "End":
        e.preventDefault();
        handleSeek(duration());
        break;
      case "Slash":
        if (e.shiftKey) {
          e.preventDefault();
          setShowShortcuts(!showShortcuts());
        }
        break;
      case "Escape":
        setShowShortcuts(false);
        setShowDeviceMenu(false);
        setShowExportMenu(false);
        break;
    }
  };

  const handleClose = async () => {
    await CloseProject();
    props.onClose();
  };

  EventsOn("recording-started", () => {
    setIsRecording(true);
  });

  EventsOn("recording-stopped", () => {
    setIsRecording(false);
    setRecordingStartTime(undefined);
    // Note: loadProject is called in startRecordingAfterCountdown after RecordAudio returns
    // which ensures the recording has been saved before loading
  });

  onMount(() => {
    loadProject();
    loadDevices();
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  createEffect(() => {
    if (!scrollRef || !isPlaying()) return;
    const playheadPos = currentTime() * pixelsPerSecond() + PADDING;
    const viewportWidth = scrollRef.clientWidth;
    const targetOffset = viewportWidth * 0.3;
    const targetScroll = Math.max(0, playheadPos - targetOffset);
    const maxScroll = contentWidth() - viewportWidth;
    if (targetScroll <= maxScroll) {
      scrollRef.scrollLeft = targetScroll;
    }
  });

  const getRecordingsForCharacter = (charId: string) => {
    return (
      project()?.recordings?.filter((r) => r.character_id === charId) || []
    );
  };

  const snapPoints = createMemo(() => {
    const points: number[] = [];
    for (const char of project()?.characters || []) {
      for (const rec of project()?.recordings?.filter(r => r.character_id === char.id) || []) {
        points.push(rec.timecode);
        points.push(rec.timecode + rec.duration);
      }
    }
    return [...new Set(points)].sort((a, b) => a - b);
  });

  return (
    <div class="flex flex-col h-screen bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#90e0ef]">
      <div class="aero-header flex items-center gap-4 p-4">
        <button
          onClick={handleClose}
          class="aero-button p-2.5 text-slate-800 hover:text-white"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <h1 class="text-xl font-bold aero-title">
          {project()?.title || "Loading..."}
        </h1>
        <div class="flex-1" />

        <div class="flex items-center gap-2 px-3">
          <svg
            class="w-4 h-4 text-slate-700"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
              clip-rule="evenodd"
            />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume()}
            onInput={(e) => setMasterVolume(parseFloat(e.currentTarget.value))}
            class="w-20 h-1 accent-[#00ff88] cursor-pointer"
            title={`Master Volume: ${Math.round(masterVolume() * 100)}%`}
          />
        </div>

        <div class="flex items-center gap-2 px-3">
          <svg
            class="w-4 h-4 text-slate-700"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="text-xs text-slate-600 w-12 text-right">
            {micGainDB() >= 0 ? "+" : ""}{micGainDB().toFixed(1)}dB
          </span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={micGainDB()}
            onInput={(e) => handleMicGainChange(parseFloat(e.currentTarget.value))}
            class="w-16 h-1 accent-[#ffaa00] cursor-pointer"
            title={`Mic Gain: ${micGainDB().toFixed(1)} dB`}
          />
        </div>

        <button
          onClick={() => setShowShortcuts(!showShortcuts())}
          class="aero-button px-3 py-2 text-slate-800 hover:text-white text-sm"
          title="Keyboard shortcuts (?)"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        <div class="relative">
          <button
            onClick={() => setShowDeviceMenu(!showDeviceMenu())}
            class="aero-button flex items-center gap-2 px-4 py-2 text-slate-800 text-sm font-medium"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="max-w-32 truncate">
              {selectedDevice()?.devices_name || "Select Mic"}
            </span>
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <Show when={showDeviceMenu()}>
            <div class="aero-dropdown absolute right-0 mt-2 w-72 py-2 z-50">
              <For each={devices()}>
                {(d) => (
                  <button
                    onClick={() => handleDeviceSelect(d)}
                    class={`aero-dropdown-item w-full px-4 py-2.5 text-left text-sm ${
                      selectedDevice()?.id === d.id
                        ? "text-[#004d40] font-bold"
                        : "text-slate-800"
                    }`}
                  >
                    <div class="flex items-center gap-3">
                      <Show when={selectedDevice()?.id === d.id}>
                        <svg
                          class="w-4 h-4 shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </Show>
                      <span class="truncate">{d.devices_name}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu())}
            class="aero-button aero-button-primary px-5 py-2 font-medium text-sm"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Export
            </span>
          </button>
          <Show when={showExportMenu()}>
            <div class="aero-dropdown absolute right-0 mt-2 w-36 py-2 z-50">
              <button
                onClick={() => handleExport("wav")}
                class="aero-dropdown-item w-full px-4 py-2.5 text-left text-sm text-slate-800"
              >
                WAV
              </button>
              <button
                onClick={() => handleExport("mp3")}
                class="aero-dropdown-item w-full px-4 py-2.5 text-left text-sm text-slate-800"
              >
                MP3
              </button>
              <button
                onClick={() => handleExport("flac")}
                class="aero-dropdown-item w-full px-4 py-2.5 text-left text-sm text-slate-800"
              >
                FLAC
              </button>
            </div>
          </Show>
        </div>
      </div>

      <Show when={showShortcuts()}>
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            class="aero-glass rounded-2xl p-8 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-2xl font-bold aero-title mb-6">
              Keyboard Shortcuts
            </h2>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="flex items-center gap-3">
                <span class="aero-badge">Space</span>
                <span class="text-slate-800">Play / Pause</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">R</span>
                <span class="text-slate-800">Record</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">C</span>
                <span class="text-slate-800">Add Character</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">Left/Right</span>
                <span class="text-slate-800">Seek 5s</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">Shift+L/R</span>
                <span class="text-slate-800">Seek 1s</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">Up/Down</span>
                <span class="text-slate-800">Select Character</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">Home</span>
                <span class="text-slate-800">Go to Start</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">End</span>
                <span class="text-slate-800">Go to End</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">Scroll</span>
                <span class="text-slate-800">Zoom Timeline</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="aero-badge">?</span>
                <span class="text-slate-800">Toggle Help</span>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              class="aero-button aero-button-primary w-full mt-6 py-2.5 font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </Show>

      <Show when={showAddCharacter()}>
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowAddCharacter(false)}
        >
          <div
            class="aero-glass rounded-2xl p-8 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-bold aero-title mb-4">Add Character</h2>
            <input
              type="text"
              placeholder="Character name"
              value={newCharacterName()}
              onInput={(e) => setNewCharacterName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAddCharacter();
                if (e.key === "Escape") setShowAddCharacter(false);
              }}
              autofocus
              class="aero-input w-full px-4 py-3 text-white mb-4"
            />
            <div class="flex gap-3">
              <button
                onClick={() => setShowAddCharacter(false)}
                class="aero-button flex-1 py-2.5 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddCharacter}
                class="aero-button aero-button-primary flex-1 py-2.5 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showCountdown()}>
        <CountdownModal
          onComplete={startRecordingAfterCountdown}
          onCancel={cancelCountdown}
        />
      </Show>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 flex items-center justify-center p-6 overflow-auto">
          <Show
            when={videoUrl()}
            fallback={
              <div
                onClick={handleSelectVideo}
                class="aero-video-placeholder w-full max-w-2xl aspect-video flex flex-col items-center justify-center cursor-pointer"
              >
                <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00ff88] flex items-center justify-center mb-5 bubble-float">
                  <svg
                    class="w-10 h-10 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
                <span class="text-slate-800 text-lg font-medium mb-2">
                  Click to select a video
                </span>
                <span class="text-slate-600 text-sm">
                  Drag and drop also supported
                </span>
              </div>
            }
          >
            <video
              ref={videoRef}
              src={videoUrl()}
              class="max-h-full max-w-full rounded-xl shadow-2xl"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </Show>
        </div>

        <Show when={videoUrl()}>
          <div class="shrink-0 aero-timeline overflow-visible">
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
              <VideoControls
                videoRef={videoRef}
                isPlaying={isPlaying()}
                currentTime={currentTime()}
                duration={duration()}
                onPlayPause={togglePlayPause}
              />
              <button
                onClick={handleAddCharacter}
                class="aero-button aero-button-primary px-4 py-2 text-sm font-semibold"
              >
                <span class="flex items-center gap-2">
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Character
                  <span class="aero-badge ml-1">C</span>
                </span>
              </button>
              <Show when={selectedCharacterId()}>
                {(() => {
                  const char = project()?.characters?.find(c => c.id === selectedCharacterId());
                  return (
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20">
                      <div
                        class="w-3 h-3 rounded-full"
                        style={{ "background-color": char?.color }}
                      />
                      <span class="text-sm font-medium text-slate-800 max-w-32 truncate">
                        {char?.name}
                      </span>
                    </div>
                  );
                })()}
                <button
                  onClick={handleRecord}
                  class={`aero-button px-5 py-2 text-sm font-semibold ${
                    isRecording()
                      ? "aero-button-record recording"
                      : "aero-button-record"
                  }`}
                >
                  <span class="flex items-center gap-2">
                    <Show
                      when={isRecording()}
                      fallback={
                        <svg
                          class="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <circle cx="10" cy="10" r="6" />
                        </svg>
                      }
                    >
                      <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <rect x="5" y="5" width="10" height="10" rx="1" />
                      </svg>
                    </Show>
                    {isRecording() ? "Stop" : "Record"}
                    <span class="aero-badge ml-1">R</span>
                  </span>
                </button>
              </Show>
              <Show
                when={
                  !selectedCharacterId() &&
                  (project()?.characters?.length || 0) > 0
                }
              >
                <span class="text-slate-700 text-sm ml-2">
                  Select a character to record
                </span>
              </Show>
            </div>

            <div
              ref={scrollRef}
              class="overflow-x-scroll scrollbar-hide"
              onWheel={handleWheel}
              onScroll={handleScroll}
              style={{
                "scrollbar-width": "none",
                "-ms-overflow-style": "none",
              }}
            >
              <div
                style={{
                  width: `${contentWidth()}px`,
                  "min-width": "100%",
                  "padding-left": `${PADDING}px`,
                  "padding-right": `${PADDING}px`,
                }}
              >
                <div style={{ "margin-left": `${sidebarWidth()}px` }}>
                  <TimecodeRuler
                    duration={duration()}
                    width={trackWidth()}
                    onClick={handleRulerClick}
                  />
                </div>
                <div
                  ref={trackContainerRef}
                  class="relative"
                  onClick={handleTrackClick}
                >
                  <For each={project()?.characters || []}>
                    {(char) => (
                      <CharacterTrack
                        character={char}
                        recordings={getRecordingsForCharacter(char.id)}
                        duration={duration()}
                        pixelsPerSecond={pixelsPerSecond()}
                        isRecording={
                          isRecording() && selectedCharacterId() === char.id
                        }
                        selectedCharacterId={selectedCharacterId()}
                        currentTime={currentTime()}
                        recordingStartTime={
                          selectedCharacterId() === char.id
                            ? recordingStartTime()
                            : undefined
                        }
                        volume={characterVolumes()[char.id] ?? 1}
                        isMuted={mutedCharacters()[char.id] ?? false}
                        sidebarWidth={sidebarWidth()}
                        onSidebarResize={handleSidebarResize}
                        onSelect={() => setSelectedCharacterId(char.id)}
                        onUpdateCharacter={(name, color) =>
                          handleUpdateCharacter(char.id, name, color)
                        }
                        onDeleteCharacter={() => handleDeleteCharacter(char.id)}
                        onDeleteRecording={handleDeleteRecording}
                        onMoveRecording={handleMoveRecording}
                        onVolumeChange={(vol) =>
                          handleCharacterVolumeChange(char.id, vol)
                        }
                        onMuteToggle={() => handleMuteToggle(char.id)}
                        onRecordingVolumeChange={handleRecordingVolumeChange}
                        onRecordingGainChange={handleRecordingGainChange}
                      />
                    )}
                  </For>
                  <Show when={(project()?.characters?.length || 0) === 0}>
                    <div class="h-16 flex items-center justify-center text-slate-700 text-sm">
                      <span class="flex items-center gap-2">
                        Press <span class="aero-badge">C</span> or click "+
                        Character" to add a character
                      </span>
                    </div>
                  </Show>
                  <div class="h-4 bg-gradient-to-b from-transparent to-black/10" />
                  <Playhead
                    position={position()}
                    onDrag={handlePlayheadDrag}
                    containerRef={trackContainerRef}
                    trackWidth={trackWidth()}
                    sidebarWidth={sidebarWidth()}
                    snapPoints={snapPoints()}
                    duration={duration()}
                  />
                </div>
              </div>
            </div>
            <TimelineScrollbar
              scrollRef={scrollRef}
              contentWidth={contentWidth()}
              scrollPos={scrollPos()}
            />
            <AudioPlaybackManager
              recordings={project()?.recordings || []}
              currentTime={currentTime()}
              isPlaying={isPlaying()}
              masterVolume={masterVolume()}
              characterVolumes={characterVolumes()}
              mutedCharacters={mutedCharacters()}
              recordingGains={recordingGains()}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
