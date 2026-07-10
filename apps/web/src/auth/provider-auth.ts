type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleIdentityServices = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        callback: (response: GoogleTokenResponse) => void;
        client_id: string;
        error_callback: (error: { message?: string; type?: string }) => void;
        scope: string;
      }) => GoogleTokenClient;
    };
  };
};

type AppleSignInResponse = {
  authorization?: {
    id_token?: string;
    state?: string;
  };
  user?: {
    name?: {
      firstName?: string | null;
      lastName?: string | null;
    };
  };
};

type AppleIdentityServices = {
  auth: {
    init: (options: {
      clientId: string;
      nonce: string;
      redirectURI: string;
      scope: string;
      state: string;
      usePopup: boolean;
    }) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

declare global {
  interface Window {
    AppleID?: AppleIdentityServices;
    google?: GoogleIdentityServices;
  }
}

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const APPLE_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
const scriptLoads = new Map<string, Promise<void>>();

function loadProviderScript(src: string, ready: () => boolean) {
  if (ready()) {
    return Promise.resolve();
  }

  const activeLoad = scriptLoads.get(src);
  if (activeLoad) {
    return activeLoad;
  }

  const load = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => {
      reject(new Error("The sign-in provider took too long to load."));
    }, 15_000);

    function finish() {
      window.clearTimeout(timeout);
      if (ready()) {
        resolve();
      } else {
        reject(new Error("The sign-in provider did not initialize."));
      }
    }

    function fail() {
      window.clearTimeout(timeout);
      reject(new Error("The sign-in provider could not be loaded."));
    }

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.async = true;
      script.defer = true;
      script.src = src;
      document.head.append(script);
    }
  }).catch((error) => {
    scriptLoads.delete(src);
    throw error;
  });

  scriptLoads.set(src, load);
  return load;
}

function popupError(provider: string, detail?: string) {
  if (detail && /closed|cancel/i.test(detail)) {
    return new Error(`${provider} sign-in was cancelled.`);
  }

  return new Error(`${provider} sign-in could not be completed.`);
}

export async function requestGoogleAccessToken(clientId: string) {
  await loadProviderScript(GOOGLE_SCRIPT_URL, () => Boolean(window.google));

  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      callback: (response) => {
        if (response.access_token) {
          resolve(response.access_token);
          return;
        }

        reject(
          popupError(
            "Google",
            response.error_description ?? response.error,
          ),
        );
      },
      client_id: clientId,
      error_callback: (error) => {
        reject(popupError("Google", error.message ?? error.type));
      },
      scope: "openid email profile",
    });

    if (!client) {
      reject(new Error("Google sign-in did not initialize."));
      return;
    }

    client.requestAccessToken({ prompt: "select_account" });
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function requestAppleIdentity(options: {
  clientId: string;
  redirectUri: string;
}) {
  await loadProviderScript(APPLE_SCRIPT_URL, () => Boolean(window.AppleID));

  const nonce = randomToken();
  const state = randomToken();
  const hashedNonce = await sha256Hex(nonce);

  window.AppleID?.auth.init({
    clientId: options.clientId,
    nonce: hashedNonce,
    redirectURI: options.redirectUri,
    scope: "name email",
    state,
    usePopup: true,
  });

  const response = await window.AppleID?.auth.signIn();
  const identityToken = response?.authorization?.id_token;

  if (!identityToken || response?.authorization?.state !== state) {
    throw new Error("Apple sign-in returned an invalid response.");
  }

  return {
    identityToken,
    nonce,
    fullName: response.user?.name
      ? {
          givenName: response.user.name.firstName ?? null,
          familyName: response.user.name.lastName ?? null,
        }
      : undefined,
  };
}
