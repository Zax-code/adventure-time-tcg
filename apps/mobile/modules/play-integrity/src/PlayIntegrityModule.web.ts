import { registerWebModule, NativeModule } from "expo";

// PlayIntegrityModule is not available on the web platform.
class PlayIntegrityModule extends NativeModule<{}> {
  async prepareAsync(): Promise<void> {}

  async requestTokenAsync(): Promise<string> {
    throw new Error("Play Integrity is unavailable");
  }
}

export default registerWebModule(PlayIntegrityModule, "PlayIntegrity");
