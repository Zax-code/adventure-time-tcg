import { Platform } from "react-native";

import type { PackOpeningSequenceProps } from "./pack-opening-sequence.types";

const PackOpeningSequenceImpl =
  Platform.OS === "web"
    ? require("./pack-opening-sequence.web").default
    : require("./pack-opening-sequence.native").default;

export default function PackOpeningSequence(props: PackOpeningSequenceProps) {
  return <PackOpeningSequenceImpl {...props} />;
}
