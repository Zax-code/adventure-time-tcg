import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import Orientation from "react-native-orientation-locker";

export function useLandscapeOrientationLock() {
  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();

      return () => {
        Orientation.lockToPortrait();
      };
    }, []),
  );
}
