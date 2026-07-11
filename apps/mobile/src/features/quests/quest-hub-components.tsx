import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
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
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  CoinIcon,
  ShareIcon,
  SparklesIcon,
} from "../../components/icons";
import { QuestActionButton } from "./quest-action-button";
import type {
  QuestHubPreferenceId,
  QuestLifecycle,
} from "./quest-hub-model";
import type { THEME_COLORS } from "../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type QuestIconComponent = ComponentType<{ size?: number; color?: string }>;

export type QuestTone = {
  border: string;
  iconBackground: string;
  iconColor: string;
  statusBackground: string;
  statusText: string;
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

export function QuestRewardPill({
  accessibilityLabel,
  amount,
  label,
  tc,
}: {
  accessibilityLabel: string;
  amount: number;
  label?: string;
  tc: ThemeColors;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-center gap-1 rounded-full border px-2.5 py-1.5"
      style={{
        backgroundColor: tc.secondaryTint,
        borderColor: tc.secondaryBorder,
      }}
    >
      <CoinIcon size={16} />
      <Text
        className="font-nunito-extrabold text-sm"
        style={{ color: tc.secondaryText }}
      >
        {amount}
      </Text>
      {label ? (
        <Text
          className="font-nunito-bold text-xs"
          style={{ color: tc.secondaryText }}
        >
          {label}
        </Text>
      ) : null}
    </View>
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
  tc,
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
  const percentage = totalCount === 0 ? 0 : (finishedCount / totalCount) * 100;
  const stackActions = fontScale >= 1.25 || width < 375;

  return (
    <View
      className="overflow-hidden rounded-[28px] border"
      style={{
        borderColor: tc.primaryBorder,
        boxShadow: `0px 10px 22px ${tc.primaryStrong}24`,
      }}
      testID="quests-progress-summary"
    >
      <LinearGradient
        colors={[tc.surface, tc.primaryTint, tc.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20 }}
      >
        <View className="absolute -right-4 -top-4 opacity-20">
          <SparklesIcon size={88} color={tc.primary} />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text className="shrink font-nunito-bold text-xs uppercase tracking-[2px] text-primaryText">
            {title}
          </Text>
          <QuestActionButton
            label={customizeLabel}
            onPress={onCustomize}
            backgroundColor={tc.surface}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            minHeight={36}
            textClassName="font-nunito-bold text-xs"
            testID="quests-customize-order"
          />
        </View>
        <View
          className={
            stackActions ? "mt-2 gap-3" : "mt-2 flex-row items-end gap-4"
          }
        >
          <View className="flex-1">
            <Text className="font-nunito-extrabold text-[28px] leading-8 text-fg">
              {finishedCount}
              <Text className="font-nunito-bold text-lg text-fgMuted">
                {` / ${totalCount}`}
              </Text>
            </Text>
            <Text className="mt-1 font-nunito-semibold text-sm text-fgMuted">
              {subtitle}
            </Text>
          </View>
          {readyReward > 0 ? (
            <QuestRewardPill
              accessibilityLabel={rewardAccessibilityLabel}
              amount={readyReward}
              tc={tc}
            />
          ) : null}
        </View>

        <View
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface"
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: Math.max(totalCount, 1),
            now: finishedCount,
          }}
        >
          <View
            className="h-full rounded-full"
            style={{
              backgroundColor: tc.primaryStrong,
              width: `${percentage}%`,
            }}
          />
        </View>

        <View className={stackActions ? "mt-4 gap-3" : "mt-4 flex-row gap-3"}>
          {onAction ? (
            <View
              style={stackActions ? { width: "100%" } : { flex: 1 }}
              testID={
                claimMode
                  ? "quests-primary-mode-claim"
                  : "quests-primary-mode-open"
              }
            >
              <QuestActionButton
                buttonRef={actionRef}
                label={actionLabel}
                onPress={onAction}
                disabled={actionDisabled}
                loading={actionLoading}
                loadingMode="inline"
                backgroundColor={claimMode ? tc.successTint : tc.primaryStrong}
                foregroundColor={claimMode ? tc.successText : "#FFFFFF"}
                borderColor={claimMode ? tc.successBorder : undefined}
                leadingAccessory={
                  claimMode ? (
                    <CoinIcon size={19} />
                  ) : (
                    <SparklesIcon size={19} color="#FFFFFF" />
                  )
                }
                minHeight={50}
                style={{ width: "100%" }}
                testID="quests-primary-action"
              />
            </View>
          ) : (
            <View
              accessible
              accessibilityLabel={actionLabel}
              className="min-h-[50px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-primaryBorder bg-surfaceMuted px-4 py-3"
              testID="quests-completion-status"
            >
              <SparklesIcon size={19} color={tc.primaryText} />
              <Text className="shrink text-center font-nunito-extrabold text-sm text-primaryText">
                {actionLabel}
              </Text>
            </View>
          )}
          {onShare ? (
            <QuestActionButton
              buttonRef={shareRef}
              label={shareLabel}
              onPress={onShare}
              backgroundColor={tc.surface}
              foregroundColor={tc.primaryText}
              borderColor={tc.primaryBorder}
              leadingIcon={ShareIcon}
              minHeight={50}
              style={stackActions ? { width: "100%" } : undefined}
              testID="quests-share-results"
            />
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

function QuestStatusPill({ label, tone }: { label: string; tone: QuestTone }) {
  return (
    <View
      className="self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: tone.statusBackground }}
    >
      <Text
        className="font-nunito-extrabold text-xs"
        style={{ color: tone.statusText }}
      >
        {label}
      </Text>
    </View>
  );
}

export function QuestVariantChip({
  label,
  tone,
}: {
  label: string;
  tone: QuestTone;
}) {
  return (
    <View
      className="rounded-full border px-2.5 py-1"
      style={{
        backgroundColor: tone.statusBackground,
        borderColor: tone.border,
      }}
    >
      <Text
        className="font-nunito-bold text-xs"
        style={{ color: tone.statusText }}
      >
        {label}
      </Text>
    </View>
  );
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
  index,
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
  index: number;
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
      <View className="flex-row items-start gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tone.iconBackground }}
        >
          <Icon size={28} color={tone.iconColor} />
        </View>

        <View className="min-w-0 flex-1">
          <View
            className={
              stackMetadata
                ? "items-start gap-2"
                : "flex-row items-start justify-between gap-2"
            }
          >
            <View className="min-w-0 flex-1">
              <Text
                ref={titleFocusRef}
                className="font-nunito-extrabold text-base text-fg"
              >
                {title}
              </Text>
              <Text className="mt-0.5 font-nunito-semibold text-sm text-fgMuted">
                {description}
              </Text>
            </View>
            <View
              className={
                stackMetadata ? "items-start gap-2" : "items-end gap-2"
              }
            >
              {reward != null && reward > 0 ? (
                <QuestRewardPill
                  accessibilityLabel={
                    rewardAccessibilityLabel ?? String(reward)
                  }
                  amount={reward}
                  tc={tc}
                />
              ) : null}
              {onPress ? <ChevronRightIcon size={19} color={tc.muted} /> : null}
            </View>
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <QuestStatusPill label={statusLabel} tone={tone} />
            {variants}
          </View>
        </View>
      </View>

      {progressLabel != null && progressPercentage != null ? (
        <View className="mt-3">
          <View className="mb-1 flex-row items-center justify-between gap-3">
            <Text className="font-nunito-semibold text-xs text-fgMuted">
              {progressLabel}
            </Text>
            <Text
              className="font-nunito-extrabold text-xs"
              style={{ color: tone.statusText }}
            >
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          <View
            className="h-2 overflow-hidden rounded-full bg-primaryTint"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPercentage }}
          >
            <View
              className="h-full rounded-full"
              style={{
                backgroundColor: tone.statusText,
                width: `${progressPercentage}%`,
              }}
            />
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <Animated.View
      entering={FadeInUp.duration(220)
        .delay(index * 45)
        .reduceMotion(ReduceMotion.System)}
    >
      <View
        ref={cardRef}
        className="overflow-hidden rounded-[24px] border bg-surface"
        style={{
          borderColor: highlighted ? tc.accentStrong : tone.border,
          borderWidth: highlighted ? 2 : 1,
          boxShadow:
            lifecycle === "ready"
              ? `0px 8px 16px ${tc.successDark}24`
              : `0px 4px 10px ${tc.primaryStrong}14`,
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
            className="p-4"
            style={({ pressed }) => ({
              opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
            })}
          >
            {cardContent}
          </Pressable>
        ) : (
          <View className="p-4">{cardContent}</View>
        )}
        {footer ? (
          <View
            className="border-t px-4 pb-4 pt-3"
            style={{ borderColor: tc.primaryBorder }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function SheetSurface({ tc }: { tc: ThemeColors }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tc.bg,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        },
      ]}
    />
  );
}

function QuestSheetHeader({
  headingRef,
  subtitle,
  tc,
  title,
}: {
  headingRef: RefObject<Text | null>;
  subtitle: string;
  tc: ThemeColors;
  title: string;
}) {
  return (
    <View className="px-5 pb-4 pt-3">
      <View
        className="mb-4 h-1.5 w-11 self-center rounded-full"
        style={{ backgroundColor: tc.muted }}
      />
      <Text
        ref={headingRef}
        className="text-center font-nunito-extrabold text-2xl text-fg"
        accessibilityRole="header"
        maxFontSizeMultiplier={1.8}
      >
        {title}
      </Text>
      <Text
        className="mt-1 text-center font-nunito text-sm leading-5 text-fgMuted"
        maxFontSizeMultiplier={2}
      >
        {subtitle}
      </Text>
    </View>
  );
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
      scrimColor="rgba(0,0,0,0.42)"
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-launch-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
          tc={tc}
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
                    tc={tc}
                  />
                  <ChevronRightIcon size={20} color={tc.muted} />
                </View>
              </View>
            </Pressable>
          ))}

          {historyAction ? (
            <QuestActionButton
              label={historyAction.label}
              onPress={historyAction.onPress}
              backgroundColor={tc.surface}
              foregroundColor={tc.primaryText}
              borderColor={tc.primaryBorder}
              minHeight={48}
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
      scrimColor="rgba(0,0,0,0.42)"
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-recap-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
          tc={tc}
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
                  label={action.buttonLabel}
                  onPress={action.onPress}
                  disabled={isBusy && !action.isLoading}
                  loading={action.isLoading}
                  loadingMode="inline"
                  backgroundColor={tc.surface}
                  foregroundColor={tc.primaryText}
                  borderColor={tc.primaryBorder}
                  leadingIcon={ShareIcon}
                  minHeight={48}
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
      scrimColor="rgba(0,0,0,0.42)"
      surface={surface}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => onIndexChange(0)}
        className="bg-bg"
        style={{
          height: useBoundedHeight ? height * 0.82 : undefined,
          maxHeight: height * 0.82,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
        testID="quests-order-sheet"
      >
        <QuestSheetHeader
          headingRef={headingRef}
          title={title}
          subtitle={subtitle}
          tc={tc}
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
                      accessibilityLabel={`${moveUpLabel}: ${option.title}`}
                      label={moveUpLabel}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onMove(option.id, "up");
                      }}
                      disabled={optionIndex === 0}
                      backgroundColor={tc.surface}
                      foregroundColor={tc.primaryText}
                      borderColor={tc.primaryBorder}
                      leadingAccessory={
                        <View style={{ transform: [{ rotate: "180deg" }] }}>
                          <ChevronDownIcon size={16} color={tc.primaryText} />
                        </View>
                      }
                      minHeight={40}
                      textClassName="font-nunito-bold text-xs"
                      style={stackRowActions ? { flex: 1 } : undefined}
                      testID={`quests-order-up-${option.id}`}
                    />
                    <QuestActionButton
                      accessibilityLabel={`${moveDownLabel}: ${option.title}`}
                      label={moveDownLabel}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onMove(option.id, "down");
                      }}
                      disabled={optionIndex === options.length - 1}
                      backgroundColor={tc.surface}
                      foregroundColor={tc.primaryText}
                      borderColor={tc.primaryBorder}
                      leadingAccessory={
                        <ChevronDownIcon size={16} color={tc.primaryText} />
                      }
                      minHeight={40}
                      textClassName="font-nunito-bold text-xs"
                      style={stackRowActions ? { flex: 1 } : undefined}
                      testID={`quests-order-down-${option.id}`}
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <QuestActionButton
            label={resetLabel}
            onPress={() => {
              void Haptics.selectionAsync();
              onReset();
            }}
            backgroundColor={tc.surface}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            minHeight={46}
            testID="quests-order-reset"
          />
          <View style={{ height: Math.max(bottom + 20, 32) }} />
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
