const URL_REGEX = /https?:\/\/[^\s<>"']+/i;

export function extractFirstUrl(content: string): string | undefined {
  return content.match(URL_REGEX)?.[0];
}
