import { NativeModule, requireOptionalNativeModule } from "expo";

declare class PlayIntegrityModule extends NativeModule<{}> {
  prepareAsync(cloudProjectNumber: number): Promise<void>;
  requestTokenAsync(requestHash: string): Promise<string>;
}

export default requireOptionalNativeModule<PlayIntegrityModule>(
  "PlayIntegrity",
);
