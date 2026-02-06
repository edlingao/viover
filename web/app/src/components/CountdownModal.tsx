import { createSignal, createEffect, onCleanup } from "solid-js";

interface CountdownModalProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function CountdownModal(props: CountdownModalProps) {
  const [count, setCount] = createSignal(3);

  createEffect(() => {
    if (count() === 0) {
      props.onComplete();
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    onCleanup(() => clearTimeout(timer));
  });

  return (
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="text-center">
        <div
          class="text-9xl font-bold text-white animate-pulse"
          style={{
            "text-shadow": "0 0 60px rgba(0, 212, 255, 0.9)",
          }}
        >
          {count() > 0 ? count() : "GO!"}
        </div>
        <button
          onClick={props.onCancel}
          class="mt-12 aero-button px-8 py-3 text-lg font-medium text-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
