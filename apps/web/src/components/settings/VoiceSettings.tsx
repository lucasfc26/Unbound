import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function VoiceSettings() {
  const [testing, setTesting] = useState(false);

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Voz e vídeo</h1>

      <section className="mb-6">
        <label className="mb-2 block text-caption font-semibold uppercase tracking-wide text-text-muted">
          Microfone
        </label>
        <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary outline-none focus:border-accent">
          <option>Microfone padrão</option>
          <option>Headset USB</option>
          <option>Microfone da webcam</option>
        </select>

        <p className="mb-1.5 mt-4 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Entrada
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full w-2/3 rounded-full bg-success" />
        </div>
      </section>

      <section className="mb-6">
        <label className="mb-2 block text-caption font-semibold uppercase tracking-wide text-text-muted">
          Câmera
        </label>
        <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary outline-none focus:border-accent">
          <option>Câmera padrão</option>
          <option>Webcam externa</option>
        </select>
      </section>

      <Button variant="secondary" onClick={() => setTesting((v) => !v)}>
        {testing ? "Parar teste" : "Testar microfone"}
      </Button>
    </div>
  );
}
