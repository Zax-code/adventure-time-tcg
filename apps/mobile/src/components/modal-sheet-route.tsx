import { useRef, useState, type ReactNode } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_TOP_GAP = 56;
const TOP_PADDING = 16;

export function ModalSheetRoute({
  children,
  onClose,
  sheetBackgroundColor,
  handleColor,
  sheetStyle,
}: {
  children: ReactNode;
  onClose: () => void;
  sheetBackgroundColor: string;
  handleColor: string;
  sheetStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(1);
  const closingRef = useRef(false);
  const topGap = Math.max(insets.top + TOP_PADDING, MIN_TOP_GAP);
  const maxSheetHeight = Math.max(0, height - topGap);

  return (
    <View className="flex-1" pointerEvents="box-none">
      <ModalBottomSheet
        index={index}
        onIndexChange={setIndex}
        onSettle={(nextIndex) => {
          if (nextIndex !== 0 || closingRef.current) {
            return;
          }

          closingRef.current = true;
          onClose();
        }}
        detents={[0, "content"]}
        scrimColor="rgba(0,0,0,0.4)"
        surface={
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: sheetBackgroundColor,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
              },
            ]}
          />
        }
      >
        <View style={[{ maxHeight: maxSheetHeight }, sheetStyle]}>
          <View
            className="items-center pb-1 pt-2"
            style={{ backgroundColor: sheetBackgroundColor }}
          >
            <View
              className="h-1.5 w-10 rounded-full"
              style={{ backgroundColor: handleColor }}
            />
          </View>
          {children}
        </View>
      </ModalBottomSheet>
    </View>
  );
}
