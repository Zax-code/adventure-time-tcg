import PackOpeningSequenceDom from "./pack-opening-sequence-dom";
import type { PackOpeningSequenceProps } from "./pack-opening-sequence.types";

export default function PackOpeningSequence({
  mode,
  pack,
}: PackOpeningSequenceProps) {
  return <PackOpeningSequenceDom mode={mode} pack={pack} />;
}
