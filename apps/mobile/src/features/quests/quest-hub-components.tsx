import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import * as Haptics from "expo-haptics";
import {
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ChevronRightIcon,
  ShareIcon,
} from "../../components/icons";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import Coins from "lucide-react-native/icons/coins";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Share from "lucide-react-native/icons/share";
import Sparkles from "lucide-react-native/icons/sparkles";

import { RADIUS } from "@adventure-time/theme";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";
import { IconButton } from "../../components/ui/icon-button";
import { IconTile } from "../../components/ui/icon-tile";
import { Notice } from "../../components/ui/notice";
import { ProgressBar } from "../../components/ui/progress-bar";
import { SheetHeader } from "../../components/ui/sheet-header";
import {
  getBackdropColor,
  ICON_STROKE_WIDTH,
  type IconSlot,
  type Tone,
  useThemeName,
} from "../../components/ui/tokens";
import { QuestActionButton } from "./quest-action-button";
import type { QuestHubPreferenceId, QuestLifecycle } from "./quest-hub-model";
import type { THEME_COLORS } from "../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type QuestIconComponent = ComponentType<{ size?: number; color?: string }>;

export type QuestVariantOption = {
  id: string;
  label: string;
  meta: string;
  onPress: () => void;
  reward: number;
  rewardAccessibilityLabel: string;
  statusLabel: string;
  lifecycle: QuestLifecycle;
  testID: string;
};

export type QuestRecapAction = {
  id: string;
  title: string;
  detail: string;
  buttonLabel: string;
  icon: QuestIconComponent;
  isLoading: boolean;
  onPress: () => void;
  testID: string;
};

export type QuestOrderOption = {
  id: QuestHubPreferenceId;
  title: string;
  icon: IconSlot;
  iconTone: Tone;
  positionLabel: string;
};

function QuestRewardPill({
  accessibilityLabel,
  amount,
  label,
}: {
  accessibilityLabel: string;
  amount: number;
  label?: string;
}) {
  return (
    <Chip
      tone="secondary"
      icon={Coins}
      label={label ? `${amount} ${label}` : String(amount)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function QuestHubSummary({
  actionRef,
  actionDisabled,
  actionLabel,
  actionLoading,
  claimMode,
  customizeLabel,
  finishedCount,
  onAction,
  onCustomize,
  onShare,
  readyReward,
  rewardAccessibilityLabel,
  shareLabel,
  shareRef,
  subtitle,
  title,
  totalCount,
}: {
  actionRef?: Ref<View>;
  actionDisabled?: boolean;
  actionLabel: string;
  actionLoading?: boolean;
  claimMode: boolean;
  customizeLabel: string;
  finishedCount: number;
  onAction?: () => void;
  onCustomize: () => void;
  onShare?: () => void;
  readyReward: number;
  rewardAccessibilityLabel: string;
  shareLabel: string;
  shareRef?: Ref<View>;
  subtitle: string;
  tc: ThemeColors;
  title: string;
  totalCount: number;
}) {
  const { fontScale, width } = useWindowDimensions();
  const stackActions = fontScale >= 1.25 || width < 375;

  return (
    <Card tone="primary" testID="quests-progress-summary">
      <View className="flex-row items-center justify-between gap-ds-3">
        <Text className="shrink font-nunito-bold text-ds-overline uppercase tracking-[1.5px] text-primaryText">
          {title}
        </Text>
        <QuestActionButton
          tone="ghost"
          size="sm"
          label={customizeLabel}
          onPress={onCustomize}
          testID="quests-customize-order"
        />
      </View>
      <View className={stackActions ? "gap-ds-3" : "flex-row items-end gap-ds-4"}>
        <View className="flex-1">
          <View
            accessible
            accessibilityLabel={`${finishedCount} / ${totalCount}`}
            className="flex-row items-baseline gap-[6px]"
          >
            <Text className="font-nunito-extrabold text-ds-display text-fg">
              {finishedCount}
            </Text>
            <Text className="shrink font-nunito text-ds-body text-fgMuted">
              {`/ ${totalCount} ${subtitle}`}
            </Text>
          </View>
        </View>
        {readyReward > 0 ? (
          <QuestRewardPill
            accessibilityLabel={rewardAccessibilityLabel}
            amount={readyReward}
          />
        ) : null}
      </View>

      <ProgressBar
        value={totalCount === 0 ? 0 : finishedCount / totalCount}
        accessibilityLabel={`${finishedCount} / ${totalCount}`}
      />

      {onAction ? (
        <View
          className="w-full"
          testID={claimMode ? "quests-primary-mode-claim" : "quests-primary-mode-open"}
        >
          <QuestActionButton
            tone={claimMode ? "secondary" : "primary"}
            size="lg"
            buttonRef={actionRef}
            label={actionLabel}
            onPress={onAction}
            disabled={actionDisabled}
            loading={actionLoading}
            loadingMode="inline"
            leadingIcon={claimMode ? Coins : Sparkles}
            style={{ width: "100%" }}
            testID="quests-primary-action"
          />
        </View>
      ) : (
        <Notice
          tone="success"
          icon={Sparkles}
          title={actionLabel}
          testID="quests-completion-status"
        />
      )}
      {onShare ? (
        <QuestActionButton
          tone="ghost"
          size="lg"
          buttonRef={shareRef}
          label={shareLabel}
          onPress={onShare}
          leadingIcon={Share}
          style={{ width: "100%" }}
          testID="quests-share-results"
        />
      ) : null}
    </Card>
  );
}

export function QuestHubCard({
  actionFocusRef,
  accessibilitySummary,
  accessibilityHint,
  cardRef,
  disabled = false,
  divider = true,
  footer,
  icon,
  iconTone = "primary",
  highlighted = false,
  meta,
  onLayout,
  onPress,
  reward,
  rewardAccessibilityLabel,
  tc,
  testID,
  title,
  titleFocusRef,
}: {
  actionFocusRef?: Ref<View>;
  accessibilityHint?: string;
  accessibilitySummary?: string;
  cardRef?: Ref<View>;
  disabled?: boolean;
  // Hairline under the row; off for the last row of the list.
  divider?: boolean;
  footer?: ReactNode;
  icon: IconSlot;
  iconTone?: Tone;
  highlighted?: boolean;
  meta: string;
  onLayout?: (event: import("react-native").LayoutChangeEvent) => void;
  onPress?: () => void;
  reward?: number;
  rewardAccessibilityLabel?: string;
  tc: ThemeColors;
  testID: string;
  title: string;
  titleFocusRef?: Ref<Text>;
}) {
  const rowAccessibilityLabel = [
    title,
    meta,
    accessibilitySummary,
    reward != null && reward > 0 ? rewardAccessibilityLabel : undefined,
  ]
    .filter(Boolean)
    .join(". ");
  const rowContent = (
    <>
      <IconTile icon={icon} tone={iconTone} />
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text
          ref={titleFocusRef}
          className="font-nunito-bold text-ds-body text-fg"
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text className="font-nunito text-ds-sm text-fgMuted" numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {reward != null && reward > 0 ? (
        <QuestRewardPill
          accessibilityLabel={rewardAccessibilityLabel ?? String(reward)}
          amount={reward}
        />
      ) : null}
      {onPress ? (
        <ChevronRight size={18} color={tc.muted} strokeWidth={ICON_STROKE_WIDTH} />
      ) : null}
    </>
  );
  const rowClass = "min-h-[56px] flex-row items-center gap-ds-3 px-ds-4 py-ds-3";

  return (
    <View
      ref={cardRef}
      className={`${divider ? "border-b border-primaryBorder" : ""} ${
        highlighted ? "bg-accentTint" : ""
      }`}
      onLayout={onLayout}
      testID={testID}
    >
      {onPress ? (
        <Pressable
          ref={actionFocusRef}
          accessibilityRole="button"
          accessibilityLabel={rowAccessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          className={rowClass}
          style={({ pressed }) => ({
            opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
          })}
        >
          {rowContent}
        </Pressable>
      ) : (
        <View className={rowClass}>{rowContent}</View>
      )}
      {footer ? <View className="px-ds-4 pb-ds-3">{footer}</View> : null}
    </View>
  );
}

function SheetSurface({ tc }: { tc: ThemeColors }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tc.bg,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
        },
      ]}
    />
  );
}

function QuestSheetHeader({
  headingRef,
  subtitle,
  title,
}: {
  headingRef: RefObject<Text | null>;
  subtitle: string;
  title: string;
}) {
  return <SheetHeader headingRef={headingRef} title={title} subtitle={subtitle} />;
}

function useSheetHeadingFocus(
  index: number,
  headingRef: RefObject<Text | null>,
) {
  useEffect(() => {
    if (index <= 0) return;

    const timer = setTimeout(() => {
      const node = findNodeHandle(headingRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 320);
    return () => clearTimeout(timer);
  }, [headingRef, index]);
}

export function QuestLaunchSheet({
  historyAction,
  index,
  onDismiss,
  onIndexChange,
  options,
  subtitle,
  tc,
  title,
}: {
  historyAction?: { label: string; onPress: () => void; testID: string };
  index: number;
  onDismiss: () => void;
  onIndexChange: (index: number) => void;
  options: QuestVariantOption[];
  subtitle: string;
  tc: ThemeColors;
  title: string;
}) {
  const { fontScale, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const stackOptions = fontScale >= 1.6;
  const useBoundedHeight = fontScale >= 1.6;
  const surface = useMemo(() => <SheetSurface tc={tc} />, [tc]);
  const themeName = useThemeName();
  const headingRef = useRef<Text>(null);
  useSheetHeadingFocus(index, headingRef);

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={onIndexChange}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) onDismiss();
      }}
      detents={[0, "content"]}
      scrimColor={getBackdropColor(themeName)}
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-launch-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
        />
        <ScrollView
          style={{ flex: useBoundedHeight ? 1 : undefined, flexShrink: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 0,
            gap: 12,
          }}
        >
          {/* Launcher choices are fixed at three or fewer; virtualization would add overhead. */}
          {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}. ${option.statusLabel}. ${option.meta}. ${option.rewardAccessibilityLabel}`}
              onPress={() => {
                void Haptics.selectionAsync();
                option.onPress();
              }}
              className="rounded-[22px] p-4 active:opacity-80"
              style={{
                backgroundColor:
                  option.lifecycle === "ready"
                    ? tc.successTint
                    : option.lifecycle === "failed"
                      ? tc.dangerTint
                      : tc.surfaceMuted,
                borderColor:
                  option.lifecycle === "ready"
                    ? tc.successDark
                    : option.lifecycle === "failed"
                      ? tc.dangerDark
                      : tc.primary,
                borderCurve: "continuous",
                borderWidth: 1.5,
              }}
              testID={option.testID}
            >
              <View
                className={
                  stackOptions ? "gap-3" : "flex-row items-center gap-3"
                }
              >
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-nunito-extrabold text-base"
                    style={{ color: tc.primaryText }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    className="mt-0.5 font-nunito-semibold text-sm"
                    style={{ color: tc.fgMuted }}
                  >
                    {option.meta}
                  </Text>
                  <Text
                    className="mt-1 font-nunito-bold text-xs"
                    style={{
                      color:
                        option.lifecycle === "ready"
                          ? tc.successDark
                          : option.lifecycle === "failed"
                            ? tc.dangerDark
                            : tc.primaryText,
                    }}
                  >
                    {option.statusLabel}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <QuestRewardPill
                    accessibilityLabel={option.rewardAccessibilityLabel}
                    amount={option.reward}
                  />
                  <ChevronRightIcon size={20} color={tc.muted} />
                </View>
              </View>
            </Pressable>
          ))}

          {historyAction ? (
            <QuestActionButton
              tone="ghost"
              label={historyAction.label}
              onPress={historyAction.onPress}
              testID={historyAction.testID}
            />
          ) : null}
          <View style={{ height: Math.max(bottom + 20, 32) }} />
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}

export function QuestRecapSheet({
  actions,
  index,
  onDismiss,
  onIndexChange,
  subtitle,
  tc,
  title,
}: {
  actions: QuestRecapAction[];
  index: number;
  onDismiss: () => void;
  onIndexChange: (index: number) => void;
  subtitle: string;
  tc: ThemeColors;
  title: string;
}) {
  const { fontScale, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const useBoundedHeight = fontScale >= 1.6;
  const surface = useMemo(() => <SheetSurface tc={tc} />, [tc]);
  const isBusy = actions.some((action) => action.isLoading);
  const themeName = useThemeName();
  const headingRef = useRef<Text>(null);
  useSheetHeadingFocus(index, headingRef);

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={onIndexChange}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) onDismiss();
      }}
      detents={[0, "content"]}
      scrimColor={getBackdropColor(themeName)}
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-recap-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
        />
        <ScrollView
          style={{ flex: useBoundedHeight ? 1 : undefined, flexShrink: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 0,
            gap: 12,
          }}
        >
          {/* Recap actions are fixed at two or fewer; virtualization would add overhead. */}
          {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <View
                key={action.id}
                className="rounded-[22px] p-4"
                style={{
                  backgroundColor: tc.surfaceMuted,
                  borderColor: tc.primary,
                  borderCurve: "continuous",
                  borderWidth: 1.5,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: tc.primaryTint }}
                  >
                    <Icon size={27} color={tc.primaryText} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="font-nunito-extrabold text-base"
                      style={{ color: tc.primaryText }}
                    >
                      {action.title}
                    </Text>
                    <Text className="mt-0.5 font-nunito-semibold text-sm text-fgMuted">
                      {action.detail}
                    </Text>
                  </View>
                </View>
                <QuestActionButton
                  tone="ghost"
                  label={action.buttonLabel}
                  onPress={action.onPress}
                  disabled={isBusy && !action.isLoading}
                  loading={action.isLoading}
                  loadingMode="inline"
                  leadingIcon={ShareIcon}
                  style={{ marginTop: 12 }}
                  testID={action.testID}
                />
              </View>
            );
          })}
          <View style={{ height: Math.max(bottom + 20, 32) }} />
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}

export function QuestOrderSheet({
  index,
  moveDownLabel,
  moveUpLabel,
  onDismiss,
  onIndexChange,
  onMove,
  onReset,
  options,
  resetLabel,
  subtitle,
  tc,
  title,
}: {
  index: number;
  moveDownLabel: string;
  moveUpLabel: string;
  onDismiss: () => void;
  onIndexChange: (index: number) => void;
  onMove: (id: QuestHubPreferenceId, direction: "up" | "down") => void;
  onReset: () => void;
  options: QuestOrderOption[];
  resetLabel: string;
  subtitle: string;
  tc: ThemeColors;
  title: string;
}) {
  const { fontScale, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const useBoundedHeight = fontScale >= 1.6;
  const surface = useMemo(() => <SheetSurface tc={tc} />, [tc]);
  const themeName = useThemeName();
  const headingRef = useRef<Text>(null);
  useSheetHeadingFocus(index, headingRef);

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={onIndexChange}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) onDismiss();
      }}
      detents={[0, "content"]}
      scrimColor={getBackdropColor(themeName)}
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-order-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
        />
        <ScrollView
          style={{ flex: useBoundedHeight ? 1 : undefined, flexShrink: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 0,
            gap: 12,
          }}
        >
          <Card flush>
            {/* Quest order is fixed at five rows; virtualization would add overhead. */}
            {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
            {options.map((option, optionIndex) => (
              <View
                key={option.id}
                className={`min-h-[72px] flex-row items-center gap-ds-3 px-ds-4 py-[10px] ${
                  optionIndex === options.length - 1
                    ? ""
                    : "border-b border-primaryBorder"
                }`}
                testID={`quests-order-row-${option.id}`}
              >
                <IconTile icon={option.icon} tone={option.iconTone} />
                <View className="min-w-0 flex-1 gap-ds-1">
                  <Text
                    className="font-nunito-bold text-ds-body text-fg"
                    numberOfLines={2}
                  >
                    {option.title}
                  </Text>
                  <Chip
                    tone={optionIndex === 0 ? "primary" : "neutral"}
                    label={option.positionLabel}
                  />
                </View>
                <IconButton
                  icon={ChevronUp}
                  accessibilityLabel={`${moveUpLabel}: ${option.title}`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onMove(option.id, "up");
                  }}
                  disabled={optionIndex === 0}
                  testID={`quests-order-up-${option.id}`}
                />
                <IconButton
                  icon={ChevronDown}
                  accessibilityLabel={`${moveDownLabel}: ${option.title}`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onMove(option.id, "down");
                  }}
                  disabled={optionIndex === options.length - 1}
                  testID={`quests-order-down-${option.id}`}
                />
              </View>
            ))}
          </Card>
          <Button
            tone="ghost"
            icon={RotateCcw}
            onPress={() => {
              void Haptics.selectionAsync();
              onReset();
            }}
            testID="quests-order-reset"
          >
            {resetLabel}
          </Button>
          <View style={{ height: Math.max(bottom + 20, 32) }} />
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
