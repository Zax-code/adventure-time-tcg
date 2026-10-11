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
  ChevronDownIcon,
  ChevronRightIcon,
  ShareIcon,
} from "../../components/icons";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Coins from "lucide-react-native/icons/coins";
import Share from "lucide-react-native/icons/share";
import Sparkles from "lucide-react-native/icons/sparkles";

import { RADIUS } from "@adventure-time/theme";

import { Card } from "../../components/ui/card";
import { Chip, type ChipTone } from "../../components/ui/chip";
import { Notice } from "../../components/ui/notice";
import { ProgressBar } from "../../components/ui/progress-bar";
import { SheetHeader } from "../../components/ui/sheet-header";
import {
  getBackdropColor,
  ICON_STROKE_WIDTH,
  useThemeName,
} from "../../components/ui/tokens";
import { QuestActionButton } from "./quest-action-button";
import type { QuestHubPreferenceId, QuestLifecycle } from "./quest-hub-model";
import type { THEME_COLORS } from "../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type QuestIconComponent = ComponentType<{ size?: number; color?: string }>;

export type QuestTone = {
  border: string;
  iconBackground: string;
  iconColor: string;
  statusBackground: string;
  statusText: string;
  // Chip tone for status and variant labels; primary when omitted.
  chipTone?: ChipTone;
};

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
  icon: QuestIconComponent;
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
            <Text className="font-nunito text-ds-body text-fgMuted">
              {`/ ${totalCount}`}
            </Text>
          </View>
          <Text className="font-nunito text-ds-body text-fgMuted">{subtitle}</Text>
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

function QuestStatusPill({ label, tone }: { label: string; tone: QuestTone }) {
  return <Chip tone={tone.chipTone ?? "primary"} label={label} />;
}

export function QuestVariantChip({
  label,
  tone,
}: {
  label: string;
  tone: QuestTone;
}) {
  return <Chip tone={tone.chipTone ?? "primary"} label={label} />;
}

export function QuestHubCard({
  actionFocusRef,
  accessibilitySummary,
  accessibilityHint,
  cardRef,
  description,
  disabled = false,
  footer,
  icon: Icon,
  highlighted = false,
  lifecycle,
  onLayout,
  onPress,
  progressLabel,
  progressPercentage,
  reward,
  rewardAccessibilityLabel,
  statusLabel,
  tc,
  testID,
  title,
  titleFocusRef,
  tone,
  variants,
}: {
  actionFocusRef?: Ref<View>;
  accessibilityHint?: string;
  accessibilitySummary?: string;
  cardRef?: Ref<View>;
  description: string;
  disabled?: boolean;
  footer?: ReactNode;
  icon: QuestIconComponent;
  highlighted?: boolean;
  lifecycle: QuestLifecycle;
  onLayout?: (event: import("react-native").LayoutChangeEvent) => void;
  onPress?: () => void;
  progressLabel?: string;
  progressPercentage?: number;
  reward?: number;
  rewardAccessibilityLabel?: string;
  statusLabel: string;
  tc: ThemeColors;
  testID: string;
  title: string;
  titleFocusRef?: Ref<Text>;
  tone: QuestTone;
  variants?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const stackMetadata = fontScale >= 1.6;
  const cardAccessibilityLabel = [
    title,
    statusLabel,
    description,
    accessibilitySummary,
    reward != null && reward > 0 ? rewardAccessibilityLabel : undefined,
  ]
    .filter(Boolean)
    .join(". ");
  const cardContent = (
    <>
      <View className="flex-row items-start gap-ds-3">
        <View
          className="h-[40px] w-[40px] items-center justify-center rounded-ds-md"
          style={{ backgroundColor: tone.iconBackground }}
        >
          <Icon size={24} color={tone.iconColor} />
        </View>

        <View className="min-w-0 flex-1 gap-ds-2">
          <View
            className={
              stackMetadata
                ? "items-start gap-ds-2"
                : "flex-row items-start justify-between gap-ds-2"
            }
          >
            <View className="min-w-0 flex-1 gap-[2px]">
              <Text
                ref={titleFocusRef}
                className="font-nunito-bold text-ds-body text-fg"
              >
                {title}
              </Text>
              <Text className="font-nunito text-ds-sm text-fgMuted">
                {description}
              </Text>
            </View>
            <View
              className={
                stackMetadata
                  ? "flex-row items-center gap-ds-2"
                  : "flex-row items-center gap-ds-2"
              }
            >
              {reward != null && reward > 0 ? (
                <QuestRewardPill
                  accessibilityLabel={rewardAccessibilityLabel ?? String(reward)}
                  amount={reward}
                />
              ) : null}
              {onPress ? (
                <ChevronRight
                  size={18}
                  color={tc.muted}
                  strokeWidth={ICON_STROKE_WIDTH}
                />
              ) : null}
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-ds-2">
            <QuestStatusPill label={statusLabel} tone={tone} />
            {variants}
          </View>
        </View>
      </View>

      {progressLabel != null && progressPercentage != null ? (
        <View className="mt-ds-3 gap-ds-1">
          <View className="flex-row items-center justify-between gap-ds-3">
            <Text className="font-nunito-semibold text-ds-caption text-fgMuted">
              {progressLabel}
            </Text>
            <Text
              className="font-nunito-extrabold text-ds-caption"
              style={{ color: tone.statusText }}
            >
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          <ProgressBar value={progressPercentage / 100} />
        </View>
      ) : null}
    </>
  );

  return (
    <View
      ref={cardRef}
      className="overflow-hidden rounded-ds-lg border bg-surface"
      style={{
        borderColor: highlighted ? tc.accentStrong : tone.border,
        borderWidth: highlighted ? 2 : 1,
      }}
      onLayout={onLayout}
      testID={testID}
    >
      {onPress ? (
        <Pressable
          ref={actionFocusRef}
          accessibilityRole="button"
          accessibilityLabel={cardAccessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          className="p-ds-4"
          style={({ pressed }) => ({
            opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
          })}
        >
          {cardContent}
        </Pressable>
      ) : (
        <View className="p-ds-4">{cardContent}</View>
      )}
      {footer ? (
        <View
          className="border-t px-ds-4 pb-ds-4 pt-ds-3"
          style={{ borderColor: tc.primaryBorder }}
        >
          {footer}
        </View>
      ) : null}
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
  const stackRowActions = fontScale >= 1.35;
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
            paddingBottom: 0,
            gap: 10,
          }}
        >
          {/* Quest order is fixed at four rows; virtualization would add overhead. */}
          {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
          {options.map((option, optionIndex) => {
            const Icon = option.icon;
            return (
              <View
                key={option.id}
                className="rounded-[20px] p-3"
                style={{
                  backgroundColor: tc.surfaceMuted,
                  borderColor:
                    optionIndex === 0 ? tc.primary : tc.primaryBorder,
                  borderCurve: "continuous",
                  borderWidth: optionIndex === 0 ? 1.5 : 1,
                }}
                testID={`quests-order-row-${option.id}`}
              >
                <View
                  className={
                    stackRowActions ? "gap-3" : "flex-row items-center gap-3"
                  }
                >
                  <View className="min-w-0 flex-1 flex-row items-center gap-3">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: tc.primaryTint }}
                    >
                      <Icon size={25} color={tc.primaryText} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-nunito-extrabold text-base text-fg">
                        {option.title}
                      </Text>
                      <Text className="font-nunito-bold text-xs text-primaryText">
                        {option.positionLabel}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={
                      stackRowActions
                        ? "flex-row gap-2"
                        : "flex-row shrink-0 gap-2"
                    }
                  >
                    <QuestActionButton
                      tone="ghost"
                      size="sm"
                      accessibilityLabel={`${moveUpLabel}: ${option.title}`}
                      label={moveUpLabel}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onMove(option.id, "up");
                      }}
                      disabled={optionIndex === 0}
                      leadingAccessory={
                        <View style={{ transform: [{ rotate: "180deg" }] }}>
                          <ChevronDownIcon size={16} color={tc.primaryText} />
                        </View>
                      }
                      style={stackRowActions ? { flex: 1 } : undefined}
                      testID={`quests-order-up-${option.id}`}
                    />
                    <QuestActionButton
                      tone="ghost"
                      size="sm"
                      accessibilityLabel={`${moveDownLabel}: ${option.title}`}
                      label={moveDownLabel}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onMove(option.id, "down");
                      }}
                      disabled={optionIndex === options.length - 1}
                      leadingAccessory={
                        <ChevronDownIcon size={16} color={tc.primaryText} />
                      }
                      style={stackRowActions ? { flex: 1 } : undefined}
                      testID={`quests-order-down-${option.id}`}
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <QuestActionButton
            tone="ghost"
            label={resetLabel}
            onPress={() => {
              void Haptics.selectionAsync();
              onReset();
            }}
            testID="quests-order-reset"
          />
          <View style={{ height: Math.max(bottom + 20, 32) }} />
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
