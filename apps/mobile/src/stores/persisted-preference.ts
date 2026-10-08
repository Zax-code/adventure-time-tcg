import * as SecureStore from "expo-secure-store";

import { runStartupTask } from "../lib/startup-recovery";

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

// A string preference kept in SecureStore under an after-first-unlock key.
// A value found only under the legacy key is migrated on first read.
export function createPersistedPreference<T extends string>({
  key,
  legacyKey,
  isValid,
  defaultValue,
}: {
  key: string;
  legacyKey: string;
  isValid: (value: string) => value is T;
  defaultValue: T;
}) {
  const normalize = (value: string | null | undefined): T =>
    value && isValid(value) ? value : defaultValue;

  function read() {
    return runStartupTask(async () => {
      const stored = await SecureStore.getItemAsync(key);
      if (stored) {
        return normalize(stored);
      }

      const legacyStored = await SecureStore.getItemAsync(legacyKey);
      const value = normalize(legacyStored);

      if (legacyStored) {
        await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
      }

      return value;
    });
  }

  return {
    defaultValue,
    read,
    async readOrDefault() {
      const result = await read();
      return result.ok ? result.value : defaultValue;
    },
    write(value: T) {
      return runStartupTask(() =>
        SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS),
      );
    },
  };
}
