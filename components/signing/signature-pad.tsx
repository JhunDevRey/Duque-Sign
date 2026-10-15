"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const INK = "#0b1f4b";
const MAX_EXPORT_WIDTH = 600;

/** Crops transparent margins and scales the drawing down, keeping the PNG small. */
function exportTrimmed(source: HTMLCanvasElement): string | null {
  const context = source.getContext("2d");
  if (!context) return null;
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 8;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const scale = Math.min(1, MAX_EXPORT_WIDTH / cropWidth);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(cropWidth * scale));
  output.height = Math.max(1, Math.round(cropHeight * scale));
  output.getContext("2d")?.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, output.width, output.height);
  return output.toDataURL("image/png");
}

function signatureFontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-signature").trim() || "cursive";
}

async function renderTyped(text: string): Promise<string | null> {
  const family = signatureFontFamily();
  await document.fonts.load(`96px ${family}`).catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = INK;
  context.textBaseline = "middle";
  let size = 120;
  context.font = `${size}px ${family}`;
  while (size > 30 && context.measureText(text).width > canvas.width - 40) {
    size -= 6;
    context.font = `${size}px ${family}`;
  }
  context.fillText(text, 20, canvas.height / 2);
  return exportTrimmed(canvas);
}

/** Draw-or-type signature capture. Produces a PNG data URL. */
export function SignaturePad({
  open,
  kind,
  defaultName,
  onClose,
  onAdopt,
}: {
  open: boolean;
  kind: "signature" | "initials";
  defaultName: string;
  onClose: () => void;
  onAdopt: (dataUrl: string) => void;
}) {
  const initials = defaultName.split(/\s+/).filter(Boolean).map((part) => part[0]?.toLocaleUpperCase()).join("").slice(0, 4);
  const [mode, setMode] = useState<"draw" | "type">("type");
  const [typed, setTyped] = useState(kind === "initials" ? initials : defaultName);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);

  // Size the drawing canvas to its box at device resolution whenever it is shown.
  useEffect(() => {
    if (!open || mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.6;
    context.strokeStyle = INK;
    setHasInk(false);
  }, [open, mode]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function adopt() {
    setError(null);
    const dataUrl = mode === "draw"
      ? canvasRef.current && exportTrimmed(canvasRef.current)
      : typed.trim() ? await renderTyped(typed.trim()) : null;
    if (!dataUrl) {
      setError(mode === "draw" ? "Draw your signature first." : "Type your name first.");
      return;
    }
    onAdopt(dataUrl);
  }

  const title = kind === "initials" ? "Add your initials" : "Add your signature";
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div role="tablist" aria-label="Signature method" className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted p-1">
          {(["type", "draw"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => { setMode(option); setError(null); }}
              className={cn(
                "h-10 rounded-full text-sm font-medium transition-colors",
                mode === option ? "bg-surface text-foreground shadow-elevation-1" : "text-muted hover:text-foreground",
              )}
            >
              {option === "type" ? "Type" : "Draw"}
            </button>
          ))}
        </div>

        {mode === "type" ? (
          <div className="space-y-3">
            <Input
              aria-label={kind === "initials" ? "Your initials" : "Your full name"}
              value={typed}
              maxLength={kind === "initials" ? 6 : 80}
              onChange={(event) => setTyped(event.target.value)}
              data-autofocus
            />
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white px-4">
              <span className="truncate font-script text-5xl text-[#0b1f4b]">{typed || " "}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-white">
              <canvas
                ref={canvasRef}
                aria-label="Signature drawing area"
                className="absolute inset-0 size-full cursor-crosshair touch-none"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drawing.current = point(event);
                  const context = event.currentTarget.getContext("2d");
                  context?.beginPath();
                  context?.arc(drawing.current.x, drawing.current.y, 1.2, 0, Math.PI * 2);
                  if (context) context.fillStyle = INK;
                  context?.fill();
                  setHasInk(true);
                }}
                onPointerMove={(event) => {
                  if (!drawing.current) return;
                  const next = point(event);
                  const context = event.currentTarget.getContext("2d");
                  context?.beginPath();
                  context?.moveTo(drawing.current.x, drawing.current.y);
                  context?.lineTo(next.x, next.y);
                  context?.stroke();
                  drawing.current = next;
                }}
                onPointerUp={() => { drawing.current = null; }}
                onPointerCancel={() => { drawing.current = null; }}
              />
              <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-[#c4c7c5]" />
              {!hasInk && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#747775]">
                  Sign here with your finger or mouse
                </span>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={clear} disabled={!hasInk}>Clear</Button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">
          By selecting Adopt, you agree this mark is your electronic {kind === "initials" ? "initials" : "signature"} for this document.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={adopt}>Adopt and sign</Button>
        </div>
      </div>
    </Dialog>
  );
}
