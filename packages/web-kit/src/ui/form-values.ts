/** The text a form field submitted ('' when absent). FormData can also hold files; forms here only send text. */
export function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
