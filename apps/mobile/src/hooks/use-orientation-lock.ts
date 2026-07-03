import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import Orientation from "react-native-orientation-locker";

export function useLandscapeOrientationLock() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "ios") {
        return;
      }

      Orientation.lockToLandscape();

      return () => {
        Orientation.lockToPortrait();
      };
    }, []),
  );
}
