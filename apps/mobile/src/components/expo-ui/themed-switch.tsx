import { Host as ComposeHost, Switch as ComposeSwitch } from "@expo/ui/jetpack-compose";
import { Host as SwiftHost, Toggle } from "@expo/ui/swift-ui";
import { disabled as swiftDisabled, tint } from "@expo/ui/swift-ui/modifiers";
import { Platform, Switch as RNSwitch } from "react-native";

import { useThemeStore } from "../../stores/theme-store";
import {
  getExpoUIColorScheme,
  THEME_COLORS,
  type ThemeName,
} from "../../theme/themes";

type ThemedExpoSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  themeName?: ThemeName;
};

export function ThemedExpoSwitch({
  value,
  onValueChange,
  disabled,
  testID,
  themeName: explicitThemeName,
}: ThemedExpoSwitchProps) {
  const storedThemeName = useThemeStore((state) => state.themeName);
  const themeName = explicitThemeName ?? storedThemeName;
  const tc = THEME_COLORS[themeName];
  const colorScheme = getExpoUIColorScheme(themeName);

  if (Platform.OS === "ios") {
    return (
      <SwiftHost colorScheme={colorScheme} matchContents>
        <Toggle
          isOn={value}
          onIsOnChange={onValueChange}
          testID={testID}
          modifiers={[tint(tc.primary), swiftDisabled(disabled)]}
        />
      </SwiftHost>
    );
  }

  if (Platform.OS === "android") {
    return (
      <ComposeHost colorScheme={colorScheme} seedColor={tc.primary} matchContents>
        <ComposeSwitch
          value={value}
          onCheckedChange={onValueChange}
          enabled={!disabled}
          colors={{
            checkedThumbColor: "#FFFFFF",
            checkedTrackColor: tc.primary,
            checkedBorderColor: tc.primaryDark,
            uncheckedThumbColor: "#FFFFFF",
            uncheckedTrackColor: tc.primaryBorder,
            uncheckedBorderColor: tc.primaryBorder,
            disabledCheckedThumbColor: "#FFFFFF",
            disabledCheckedTrackColor: tc.primaryBorder,
            disabledCheckedBorderColor: tc.primaryBorder,
            disabledUncheckedThumbColor: "#FFFFFF",
            disabledUncheckedTrackColor: tc.primaryBorder,
            disabledUncheckedBorderColor: tc.primaryBorder,
          }}
        />
      </ComposeHost>
    );
  }

  return (
    <RNSwitch
      disabled={disabled}
      onValueChange={onValueChange}
      testID={testID}
      thumbColor="#FFFFFF"
      trackColor={{
        false: tc.primaryBorder,
        true: tc.primary,
      }}
      value={value}
    />
  );
}
