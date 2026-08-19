const PALETTE = [
  "#7c6cff",
  "#3dc57a",
  "#eb9a3d",
  "#ed5c5c",
  "#4ea1f7",
  "#e05fc4",
];

export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
