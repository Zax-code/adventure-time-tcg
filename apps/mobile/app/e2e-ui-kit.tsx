import { type ReactNode, useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEME_NAMES, type ThemeName } from "@adventure-time/theme";

import { Button, type ButtonSize, type ButtonTone } from "../src/components/ui/button";
import { Card } from "../src/components/ui/card";
import { Chip, type ChipTone } from "../src/components/ui/chip";
import { Dialog } from "../src/components/ui/dialog";
import { IconButton } from "../src/components/ui/icon-button";
import { IconTile } from "../src/components/ui/icon-tile";
import { Input } from "../src/components/ui/input";
import { ListRow } from "../src/components/ui/list-row";
import { Notice, type NoticeTone } from "../src/components/ui/notice";
import { ProgressBar } from "../src/components/ui/progress-bar";
import { SectionHeader } from "../src/components/ui/section-header";
import { SegmentedControl } from "../src/components/ui/segmented-control";
import { StatePanel } from "../src/components/ui/state-panel";
import { StatTile } from "../src/components/ui/stat-tile";
import type { Tone } from "../src/components/ui/tokens";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

// Dev and E2E only: renders every design system primitive so Maestro can
// capture the kit (see .maestro/ui-kit-screenshots.yaml). Copy here is
// fixture text for the preview, not product copy.
const IS_KIT_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_E2E_AUTH === "1";

const TONES: Tone[] = ["primary", "secondary", "accent", "success", "info", "danger"];
const BUTTON_TONES: ButtonTone[] = ["primary", "secondary", "ghost", "danger"];
const BUTTON_SIZES: ButtonSize[] = ["lg", "md", "sm"];
const CHIP_TONES: ChipTone[] = ["neutral", ...TONES, "selected"];
const NOTICE_TONES: NoticeTone[] = ["info", "warning", "success", "danger"];
const WORDLE_REWARD = <Chip tone="secondary" label="+50" />;
const SCROLL_CONTENT_STYLE = { paddingHorizontal: 16, paddingVertical: 16, gap: 24 };

export default function E2EUiKitScreen() {
  if (!IS_KIT_ENABLED) {
    return <Redirect href="/" />;
  }

  return <UiKit />;
}

function KitSection({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <View testID={testID} className="gap-ds-3">
      <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function UiKit() {
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((state) => state.themeName);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [segment, setSegment] = useState<"daily" | "weekly" | "history">("daily");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <View
      testID="e2e-ui-kit"
      className="flex-1 bg-bg"
      style={[
        THEME_VARS[themeName],
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScrollView testID="e2e-ui-kit-scroll" contentContainerStyle={SCROLL_CONTENT_STYLE}>
        <Text className="font-nunito-extrabold text-ds-h1 text-fg">UI kit</Text>

        <KitSection title="Theme" testID="e2e-ui-kit-theme">
          <SegmentedControl<ThemeName>
            options={THEME_NAMES.map((name) => ({
              value: name,
              label: name,
              testID: `e2e-ui-kit-theme-${name}`,
            }))}
            value={themeName}
            onChange={(name) => void setTheme(name)}
          />
        </KitSection>

        <KitSection title="Button" testID="e2e-ui-kit-buttons">
          {BUTTON_TONES.map((tone) => (
            <View key={tone} className="flex-row flex-wrap items-center gap-ds-2">
              {BUTTON_SIZES.map((size) => (
                <Button key={size} tone={tone} size={size}>
                  {`${tone} ${size}`}
                </Button>
              ))}
            </View>
          ))}
          <View className="flex-row flex-wrap items-center gap-ds-2">
            <Button icon="play">With icon</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
          </View>
          <Button size="lg">Full width lg</Button>
        </KitSection>

        <KitSection title="Icon button" testID="e2e-ui-kit-icon-buttons">
          <View className="flex-row flex-wrap gap-ds-2">
            <IconButton icon="chevron-back" accessibilityLabel="Back" />
            <IconButton icon="close" accessibilityLabel="Close" />
            <IconButton icon="settings-outline" accessibilityLabel="Settings" />
            {TONES.map((tone) => (
              <IconButton key={tone} icon="star-outline" tone={tone} accessibilityLabel={tone} />
            ))}
            <IconButton icon="trash-outline" accessibilityLabel="Disabled" disabled />
          </View>
        </KitSection>

        <KitSection title="Chip" testID="e2e-ui-kit-chips">
          <View className="flex-row flex-wrap gap-ds-2">
            {CHIP_TONES.map((tone) => (
              <Chip key={tone} tone={tone} label={tone} />
            ))}
            <Chip tone="secondary" icon="cash-outline" label="Coins 5000" />
            <Chip tone="success" icon="checkmark" label="Ready" onPress={() => {}} />
          </View>
        </KitSection>

        <KitSection title="Segmented control" testID="e2e-ui-kit-segmented">
          <SegmentedControl
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "history", label: "History", count: 12 },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </KitSection>

        <KitSection title="Icon tile" testID="e2e-ui-kit-icon-tiles">
          <View className="flex-row flex-wrap items-center gap-ds-2">
            {TONES.map((tone) => (
              <IconTile key={tone} tone={tone} icon="sparkles-outline" />
            ))}
            <IconTile size={32} icon="trophy-outline" />
            <IconTile size={48} icon="gift-outline" tone="secondary" />
          </View>
        </KitSection>

        <KitSection title="Stat tile" testID="e2e-ui-kit-stat-tiles">
          <View className="flex-row flex-wrap gap-ds-2">
            <StatTile className="w-[160px]" label="Unique cards" value={105} caption="of 105 collected" />
            {TONES.map((tone) => (
              <StatTile key={tone} className="w-[160px]" tone={tone} label={tone} value="5,000" />
            ))}
          </View>
        </KitSection>

        <KitSection title="Card" testID="e2e-ui-kit-cards">
          <Card>
            <Text className="font-nunito-extrabold text-ds-h3 text-fg">Card title</Text>
            <Text className="font-nunito text-ds-body text-fgMuted">
              Body copy on the default card: surface, radius 24, padding 16.
            </Text>
          </Card>
          <Card tone="secondary">
            <Text className="font-nunito-extrabold text-ds-h3 text-secondaryText">Reward card</Text>
            <ProgressBar value={0.6} />
          </Card>
        </KitSection>

        <KitSection title="Section header" testID="e2e-ui-kit-section-header">
          <SectionHeader
            title="Up next"
            subtitle="Start, continue, or collect a reward"
            action={{ label: "See all", onPress: () => {} }}
          />
        </KitSection>

        <KitSection title="Notice" testID="e2e-ui-kit-notices">
          {NOTICE_TONES.map((tone) => (
            <Notice key={tone} tone={tone} title={`${tone} notice`} body="Short supporting sentence." />
          ))}
          <Notice title="With actions" body="Notices can carry inline actions.">
            <Button size="sm">Open</Button>
            <Button size="sm" tone="ghost">
              Later
            </Button>
          </Notice>
        </KitSection>

        <KitSection title="List row" testID="e2e-ui-kit-list-rows">
          <Card className="p-0">
            <ListRow
              icon="grid-outline"
              iconTone="success"
              title="Daily Wordle"
              meta="Two languages · 0 / 2 done"
              trailing={WORDLE_REWARD}
              chevron
              onPress={() => {}}
            />
            <ListRow icon="calculator-outline" iconTone="info" title="Speed Calculus" meta="Best 42" chevron />
            <ListRow icon="time-outline" iconTone="accent" title="Perfect Timing" divider={false} />
          </Card>
        </KitSection>

        <KitSection title="Input" testID="e2e-ui-kit-inputs">
          <Input
            icon="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or character"
            testID="e2e-ui-kit-input"
          />
          <Input value="Invalid value" onChangeText={() => {}} invalid />
        </KitSection>

        <KitSection title="Progress bar" testID="e2e-ui-kit-progress">
          <ProgressBar value={0} />
          <ProgressBar value={0.4} />
          <ProgressBar value={1} />
        </KitSection>

        <KitSection title="State panel" testID="e2e-ui-kit-state-panels">
          <StatePanel
            title="No received gifts yet"
            body="When another player sends you a card, it will show up here."
            action={{ label: "Send a gift", onPress: () => {} }}
          />
          <StatePanel variant="error" title="Could not load" body="Pull to retry." />
          <StatePanel variant="loading" title="Loading" />
        </KitSection>

        <KitSection title="Dialog" testID="e2e-ui-kit-dialog">
          <Button tone="ghost" onPress={() => setDialogOpen(true)} testID="e2e-ui-kit-open-dialog">
            Open dialog
          </Button>
        </KitSection>
      </ScrollView>

      <Dialog
        visible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon="alarm-outline"
        title="Time's up!"
        body="The quest day just ended. Fresh quests are ready."
        cancel={{ label: "Later", onPress: () => setDialogOpen(false) }}
        confirm={{
          label: "Continue",
          onPress: () => setDialogOpen(false),
          testID: "e2e-ui-kit-dialog-confirm",
        }}
        testID="e2e-ui-kit-dialog-panel"
      />
    </View>
  );
}
