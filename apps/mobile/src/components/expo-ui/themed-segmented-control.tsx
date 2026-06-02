import {
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text as ComposeText,
  Host as ComposeHost,
} from "@expo/ui/jetpack-compose";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { Host as SwiftHost, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import {
  disabled as swiftDisabled,
  font,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Platform, View } from "react-native";

import { useThemeStore } from "../../stores/theme-store";
import {
  getExpoUIColorScheme,
  THEME_COLORS,
  type ThemeName,
} from "../../theme/themes";

type SegmentedOption<T extends string> = {
  label: string;
  value: T;
};

type ThemedExpoSegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  themeName?: ThemeName;
};

export function ThemedExpoSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
  themeName: explicitThemeName,
}: ThemedExpoSegmentedControlProps<T>) {
  const storedThemeName = useThemeStore((state) => state.themeName);
  const themeName = explicitThemeName ?? storedThemeName;
  const tc = THEME_COLORS[themeName];
  const colorScheme = getExpoUIColorScheme(themeName);

  if (Platform.OS === "ios") {
    return (
      <View
        className="rounded-[22] border p-2"
        style={{
          backgroundColor: tc.surfaceMuted,
          borderColor: tc.primaryBorder,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <SwiftHost colorScheme={colorScheme} style={{ width: "100%" }}>
          <Picker
            selection={value}
            onSelectionChange={(nextValue) => {
              if (typeof nextValue === "string") {
                onChange(nextValue as T);
              }
            }}
            modifiers={[
              pickerStyle("segmented"),
              tint(tc.primaryText),
              swiftDisabled(disabled),
            ]}
          >
            {options.map((option) => (
              <SwiftText
                key={option.value}
                modifiers={[
                  tag(option.value),
                  font({
                    family: "Nunito-Bold",
                    size: 13,
                  }),
                ]}
              >
                {option.label}
              </SwiftText>
            ))}
          </Picker>
        </SwiftHost>
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <View
        className="rounded-[22] border p-2"
        style={{
          backgroundColor: tc.surfaceMuted,
          borderColor: tc.primaryBorder,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <ComposeHost colorScheme={colorScheme} seedColor={tc.primary} style={{ width: "100%" }}>
          <SingleChoiceSegmentedButtonRow>
            {options.map((option) => (
              <SegmentedButton
                key={option.value}
                selected={option.value === value}
                onClick={() => onChange(option.value)}
                enabled={!disabled}
                colors={{
                  activeContainerColor: tc.primaryText,
                  activeContentColor: "#FFFFFF",
                  activeBorderColor: tc.primaryDark,
                  inactiveContainerColor: tc.surface,
                  inactiveContentColor: tc.primaryStrong,
                  inactiveBorderColor: tc.primaryBorder,
                  disabledActiveContainerColor: tc.primaryBorder,
                  disabledActiveContentColor: "#FFFFFF",
                  disabledInactiveContainerColor: tc.surface,
                  disabledInactiveContentColor: tc.fgMuted,
                  disabledInactiveBorderColor: tc.primaryBorder,
                }}
              >
                <SegmentedButton.Label>
                  <ComposeText
                    style={{
                      fontFamily: "Nunito-Bold",
                      fontSize: 13,
                    }}
                  >
                    {option.label}
                  </ComposeText>
                </SegmentedButton.Label>
              </SegmentedButton>
            ))}
          </SingleChoiceSegmentedButtonRow>
        </ComposeHost>
      </View>
    );
  }

  return (
    <SegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={Math.max(
        0,
        options.findIndex((option) => option.value === value),
      )}
      enabled={!disabled}
      onChange={(event) => {
        const selectedOption = options[event.nativeEvent.selectedSegmentIndex];
        if (selectedOption) {
          onChange(selectedOption.value);
        }
      }}
      tintColor={tc.primaryText}
      appearance={colorScheme}
      style={{ height: 40 }}
    />
  );
}
