import type { FormEvent } from "react";

export function formValues(event: FormEvent<HTMLFormElement>) {
  return Object.fromEntries(new FormData(event.currentTarget).entries());
}

export function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Your progress is safe. Please try again.";
}
