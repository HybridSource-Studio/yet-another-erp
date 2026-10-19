// Forms read values from the page on submit, not from React state, so browser autofill and AI
// browser agents that set values directly still work.

export function formText(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function formChecked(form: HTMLFormElement, name: string): boolean {
  return new FormData(form).get(name) !== null;
}

/** A user-facing message for an error from the data layer. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name !== "Error") return error.message;
  console.error(error);
  return "Something went wrong. Please try again.";
}
