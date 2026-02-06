import { createEffect } from "solid-js";

interface WaveformDisplayProps {
  samples: number[];
  width: number;
  height: number;
  color: string;
}

export function WaveformDisplay(props: WaveformDisplayProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  createEffect(() => {
    if (!canvasRef || !props.samples.length) return;

    const width = props.width;
    const height = props.height;

    canvasRef.width = width;
    canvasRef.height = height;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, props.color);
    gradient.addColorStop(0.5, props.color + "aa");
    gradient.addColorStop(1, props.color);
    ctx.fillStyle = gradient;

    const barWidth = Math.max(width / props.samples.length, 2);
    const centerY = height / 2;
    const maxAmplitude = 32767;

    props.samples.forEach((sample, i) => {
      const normalizedHeight = (Math.abs(sample) / maxAmplitude) * centerY * 0.9;
      const x = i * barWidth;
      const barH = Math.max(normalizedHeight, 2);
      ctx.fillRect(x, centerY - barH, barWidth - 1, barH * 2);
    });
  });

  return (
    <canvas
      ref={canvasRef}
      class="rounded"
      style={{ "background-color": "rgba(0,0,0,0.3)", width: `${props.width}px`, height: `${props.height}px` }}
    />
  );
}
