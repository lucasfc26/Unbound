export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function assertImageFile(file: File): void {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem");
  }
}
