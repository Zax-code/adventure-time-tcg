import * as React from "react";

export const reactEffect = React.useEffect;

export function effectEvent<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
