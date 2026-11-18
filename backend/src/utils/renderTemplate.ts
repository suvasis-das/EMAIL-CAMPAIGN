/**
 * Variables available when personalizing a template for a lead.
 * Index signature allows additional custom placeholders if added later.
 */
export interface TemplateVariables {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Pure function that replaces `{{placeholder}}` tokens in a string
 * using values from the `variables` object.
 *
 * Examples:
 *   renderTemplate("Hi {{name}} from {{company}}", { name: "Ada", company: "Acme" })
 *   -> "Hi Ada from Acme"
 *
 * Behavior:
 * - Ignores extra spaces inside braces: `{{ name }}` works just like `{{name}}`.
 * - Case-insensitive key lookup: `{{Name}}` matches `variables.name`.
 * - Missing or null values are replaced with an empty string `""` so raw
 *   `{{company}}` never leaks into a sent email.
 *
 * Keeping this as a pure function (no DB, no I/O) makes it trivial to unit test
 * and reuse identically on the worker and in previews.
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  // Build a lowercase lookup map once so matching is case-insensitive
  const normalizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    normalizedVars[key.toLowerCase()] = value == null ? '' : String(value);
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    return normalizedVars[key] ?? '';
  });
}
