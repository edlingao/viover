import { createSignal, For, Show } from "solid-js";
import { core } from "../../wailsjs/go/models";
import {
  ListProjects,
  CreateProject,
  DeleteProject,
  UpdateProjectTitle,
} from "../../wailsjs/go/adapters/App";

interface ProjectListProps {
  onOpenProject: (id: string) => void;
}

export function ProjectList(props: ProjectListProps) {
  const [projects, setProjects] = createSignal<core.ProjectMeta[]>([]);
  const [newTitle, setNewTitle] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const loadProjects = async () => {
    const list = await ListProjects();
    setProjects(list || []);
  };

  const handleCreate = async () => {
    const title = newTitle().trim();
    if (!title) return;
    setLoading(true);
    try {
      const project = await CreateProject(title);
      if (project) {
        setNewTitle("");
        props.onOpenProject(project.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project and all its files?")) return;
    await DeleteProject(id);
    await loadProjects();
  };

  const startEdit = (p: core.ProjectMeta) => {
    setEditingId(p.id);
    setEditTitle(p.title);
  };

  const saveEdit = async () => {
    const id = editingId();
    if (!id) return;
    await UpdateProjectTitle(id, editTitle());
    setEditingId(null);
    await loadProjects();
  };

  loadProjects();

  return (
    <div class="flex flex-col h-full bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#90e0ef] p-8">
      <div class="max-w-3xl mx-auto w-full">
        <div class="text-center mb-10">
          <h1 class="text-5xl font-extrabold aero-title mb-3 bubble-float">Viover</h1>
          <p class="text-slate-700 text-sm font-medium tracking-wide">Voice Recording Studio for Video Projects</p>
        </div>

        <div class="aero-glass rounded-2xl p-6 mb-8">
          <div class="flex gap-3">
            <input
              type="text"
              placeholder="Enter project name..."
              value={newTitle()}
              onInput={(e) => setNewTitle(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              class="aero-input flex-1 px-5 py-3 text-white placeholder-gray-400"
            />
            <button
              onClick={handleCreate}
              disabled={loading() || !newTitle().trim()}
              class="aero-button aero-button-primary px-8 py-3 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Create
              </span>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <Show when={projects().length === 0}>
            <div class="text-center py-16">
              <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00ff88] flex items-center justify-center bubble-float opacity-60">
                <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p class="text-slate-700 text-lg mb-2">No projects yet</p>
              <p class="text-slate-600 text-sm">Create your first project to start recording</p>
            </div>
          </Show>

          <div class="grid gap-4">
            <For each={projects()}>
              {(p) => (
                <div class="aero-card p-5 group">
                  <Show
                    when={editingId() === p.id}
                    fallback={
                      <div class="flex items-center gap-4">
                        <div
                          class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00ff88] flex items-center justify-center shrink-0"
                        >
                          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div
                          class="flex-1 cursor-pointer min-w-0"
                          onClick={() => props.onOpenProject(p.id)}
                        >
                          <div class="font-semibold text-slate-800 text-lg truncate">{p.title}</div>
                          <div class="text-sm text-slate-700 truncate mt-0.5">{p.path}</div>
                        </div>
                        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(p)}
                            class="aero-button p-2.5 text-slate-800 hover:text-white"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            class="aero-button p-2.5 text-slate-800 hover:text-red-400"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  >
                    <div class="flex items-center gap-3">
                      <input
                        type="text"
                        value={editTitle()}
                        onInput={(e) => setEditTitle(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autofocus
                        class="aero-input flex-1 px-4 py-2 text-white"
                      />
                      <button
                        onClick={saveEdit}
                        class="aero-button aero-button-primary px-5 py-2 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        class="aero-button px-5 py-2 text-slate-800 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="mt-8 text-center text-slate-600 text-xs">
          <span class="aero-badge">Space</span> Play/Pause
          <span class="mx-2">|</span>
          <span class="aero-badge">R</span> Record
          <span class="mx-2">|</span>
          <span class="aero-badge">C</span> Add Character
        </div>
      </div>
    </div>
  );
}
