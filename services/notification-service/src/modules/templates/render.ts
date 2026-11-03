/** Fills `{{name}}` placeholders. A placeholder without a value is an error, never sent blank. */
export function render(body: string, values: ReadonlyMap<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values.get(key);
    if (value === undefined) throw new Error(`Template placeholder {{${key}}} has no value`);
    return value;
  });
}
