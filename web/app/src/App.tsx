import { createSignal, Show } from "solid-js";
import { OpenProject } from "../wailsjs/go/adapters/App";
import { ProjectList } from "./components/ProjectList";
import { ProjectEditor } from "./components/ProjectEditor";

type View = "list" | "editor";

function App() {
  const [view, setView] = createSignal<View>("list");
  const [currentProjectId, setCurrentProjectId] = createSignal<string | null>(null);

  const handleOpenProject = async (id: string) => {
    await OpenProject(id);
    setCurrentProjectId(id);
    setView("editor");
  };

  const handleCloseProject = () => {
    setCurrentProjectId(null);
    setView("list");
  };

  return (
    <div class="h-screen w-full overflow-hidden">
      {/* Frutiger Aero decorative bubbles */}
      <div class="aero-bg-bubbles">
        <div class="aero-bubble-decoration" />
        <div class="aero-bubble-decoration" />
        <div class="aero-bubble-decoration" />
        <div class="aero-bubble-decoration" />
        <div class="aero-bubble-decoration" />
        <div class="aero-bubble-decoration" />
      </div>

      <Show when={view() === "list"}>
        <ProjectList onOpenProject={handleOpenProject} />
      </Show>
      <Show when={view() === "editor" && currentProjectId()}>
        <ProjectEditor
          projectId={currentProjectId()!}
          onClose={handleCloseProject}
        />
      </Show>
    </div>
  );
}

export default App;
