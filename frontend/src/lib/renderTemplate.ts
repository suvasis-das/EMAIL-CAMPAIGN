/**
 * Client-side mirror of the backend's pure template renderer.
 * Powers instant, zero-latency previews on the Templates page.
 */
export function renderTemplatePreview(
  template: string,
  variables: Record<string, string>
): string {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    normalized[key.toLowerCase()] = value;
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match, rawKey: string) => normalized[rawKey.toLowerCase()] ?? ''
  );
}
