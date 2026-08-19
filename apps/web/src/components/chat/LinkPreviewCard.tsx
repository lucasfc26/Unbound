import { Link2 } from "lucide-react";
import type { LinkPreview } from "@/types";

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block max-w-md rounded-md border border-border bg-surface p-3 transition-colors duration-150 hover:bg-hover"
    >
      <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-accent">
        <Link2 className="h-3.5 w-3.5" />
        {preview.siteName}
      </p>
      <p className="text-small font-medium text-text-primary">
        {preview.title}
      </p>
      {preview.description && (
        <p className="mt-0.5 text-small text-text-secondary">
          {preview.description}
        </p>
      )}
      <p className="mt-1.5 text-caption text-text-muted">{preview.domain}</p>
    </a>
  );
}
