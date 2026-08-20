import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";

const VIEW = 280;
const OUTPUT = 512;

interface ImageCropDialogProps {
  file: File | null;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export function ImageCropDialog({
  file,
  open,
  title,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    if (!file || !open) {
      setImage(null);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      const cover = Math.max(VIEW / img.width, VIEW / img.height);
      setMinScale(cover);
      setScale(cover);
      setOffset({
        x: (VIEW - img.width * cover) / 2,
        y: (VIEW - img.height * cover) / 2,
      });
      setImage(img);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  function clamp(next: { x: number; y: number }, nextScale: number) {
    if (!image) return next;
    const width = image.width * nextScale;
    const height = image.height * nextScale;
    return {
      x: Math.min(0, Math.max(VIEW - width, next.x)),
      y: Math.min(0, Math.max(VIEW - height, next.y)),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOffset(
      clamp(
        {
          x: drag.current.ox + (event.clientX - drag.current.x),
          y: drag.current.oy + (event.clientY - drag.current.y),
        },
        scale,
      ),
    );
  }

  function handlePointerUp() {
    drag.current = null;
  }

  function handleZoom(nextScale: number) {
    if (!image) return;
    const centerX = VIEW / 2;
    const centerY = VIEW / 2;
    const ratio = nextScale / scale;
    setScale(nextScale);
    setOffset(
      clamp(
        {
          x: centerX - (centerX - offset.x) * ratio,
          y: centerY - (centerY - offset.y) * ratio,
        },
        nextScale,
      ),
    );
  }

  async function handleConfirm() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT / VIEW;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(
      image,
      offset.x * ratio,
      offset.y * ratio,
      image.width * scale * ratio,
      image.height * scale * ratio,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;
    onConfirm(new File([blob], "crop.jpg", { type: "image/jpeg" }));
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      nested
      title={title}
      description="Arraste para escolher a área visível. A imagem será recortada em quadrado."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!image}>
            Usar recorte
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative cursor-grab overflow-hidden rounded-lg border border-border bg-black active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="pointer-events-none max-w-none select-none"
              style={{
                width: image ? image.width * scale : undefined,
                height: image ? image.height * scale : undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-white/40" />
        </div>
        <label className="flex w-full items-center gap-3 text-caption text-text-muted">
          Zoom
          <input
            type="range"
            min={minScale}
            max={minScale * 3}
            step={0.01}
            value={scale}
            onChange={(event) => handleZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-accent"
          />
        </label>
      </div>
    </Modal>
  );
}
