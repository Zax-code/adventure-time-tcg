import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  Pressable,
  View,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

import type {
  DailyNumbersMode,
  DailyNumbersStateResponse,
  QuestsResponse,
  WordleLocale,
  WordleStateResponse,
} from "@adventure-time/api-client";

import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClaimedIcon,
  CoinIcon,
  DailyLoginQuestIcon,
  DailyNumbersQuestIcon,
  HelpCircleIcon,
  ShareIcon,
  SpeedCalculusQuestIcon,
  SparklesIcon,
  StepQuestIcon,
  WordleQuestIcon,
  XCircleIcon,
} from "../../src/components/icons";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { ToastBanner } from "../../src/components/toast-banner";
import { DailyNumbersQuestShareCard } from "../../src/features/quests/daily-numbers/quest-share-card";
import type { DailyNumbersQuestShareCardStrings } from "../../src/features/quests/daily-numbers/quest-share-card";
import {
  buildDailyNumbersShareResult,
  type DailyNumbersShareResult,
} from "../../src/features/quests/daily-numbers/share-result";
import {
  DAILY_NUMBERS_MODES,
  formatDailyNumbersElapsedTime,
  getModeLabelKey,
} from "../../src/features/quests/daily-numbers/shared";
import { GroupedQuestShareImage } from "../../src/features/quests/grouped-quest-share-image";
import { QuestActionButton as QuestButton } from "../../src/features/quests/quest-action-button";
import { WordleQuestShareCard } from "../../src/features/quests/wordle/quest-share-card";
import type { WordleQuestShareCardStrings } from "../../src/features/quests/wordle/quest-share-card";
import {
  buildWordleShareResult,
  type WordleQuestShareResult,
} from "../../src/features/quests/wordle/share-result";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { connectFitbit } from "../../src/lib/fitbit";
import {
  applyLocalStepProgressToQuests,
  openDeviceHealthSetup,
  syncDeviceStepsNow,
} from "../../src/lib/step-sync";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useSessionStore } from "../../src/stores/session-store";
import { useStepSyncStore } from "../../src/stores/step-sync-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { asStyle } from "../../src/lib/style-object";

type QuestStatus = "active" | "completed" | "claimed" | "failed";
type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type Quest = QuestsResponse["quests"][number];
type QuestCardItem =
  | { kind: "quest"; quest: Quest }
  | {
      kind: "wordle";
      quests: Partial<Record<WordleLocale, Quest>>;
    }
  | {
      kind: "dailyNumbers";
      quests: Partial<Record<DailyNumbersMode, Quest>>;
    };
type DescriptionModalState = {
  title: string;
  description: string;
  status: QuestStatus;
} | null;
type SharingGroup = "wordle" | "dailyNumbers";
type WordleGroupShareItem = {
  language: WordleLocale;
  result: WordleQuestShareResult;
  strings: WordleQuestShareCardStrings;
};
type DailyNumbersGroupShareItem = {
  mode: DailyNumbersMode;
  result: DailyNumbersShareResult;
  strings: DailyNumbersQuestShareCardStrings;
};

let lastShownQuestResetToastAt = 0;
const WORDLE_MAX_ATTEMPTS = 6;
const WORDLE_WORD_LENGTH = 5;
const QUEST_SHARE_DATE_FORMAT_OPTIONS = {
  month: "short",
  day: "numeric",
  year: "numeric",
} as const;
const QUEST_SHARE_DATE_FORMATTERS = {
  en: new Intl.DateTimeFormat("en", QUEST_SHARE_DATE_FORMAT_OPTIONS),
  fr: new Intl.DateTimeFormat("fr", QUEST_SHARE_DATE_FORMAT_OPTIONS),
} as const;
const CLAIM_BUTTON_ICON = <SparklesIcon size={18} color="white" />;
const FULL_WIDTH_CLAIM_BUTTON_ICON = <SparklesIcon size={20} color="white" />;

function formatProgress(progress: number, target: number) {
  if (target >= 10000) {
    return `${(progress / 1000).toFixed(1)}k / ${(target / 1000).toFixed(0)}k`;
  }

  return `${progress.toLocaleString()} / ${target.toLocaleString()}`;
}

function getQuestStatus(quest: {
  claimed: boolean;
  completed: boolean;
  failed: boolean;
}): QuestStatus {
  if (quest.claimed) return "claimed";
  if (quest.completed) return "completed";
  if (quest.failed) return "failed";
  return "active";
}

function getQuestTitle(
  titleKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const translated = t(`quests.${titleKey}`);
  return translated.startsWith("quests.") ? titleKey : translated;
}

function getQuestDesc(
  descKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const translated = t(`quests.${descKey}`);
  return translated.startsWith("quests.") ? descKey : translated;
}

function getProgressColor(
  status: QuestStatus,
  tc: ThemeColors,
) {
  if (status === "claimed") return tc.successDark;
  if (status === "completed") return tc.successDark;
  if (status === "failed") return tc.dangerDark;
  return tc.accentStrong;
}

function getMetaColor(
  status: QuestStatus,
  tc: ThemeColors,
) {
  if (status === "claimed") return tc.successDark;
  if (status === "completed") return tc.successDark;
  return tc.primaryStrong;
}

function getQuestStatusLabel(
  status: QuestStatus,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (status === "completed") return t("quests.completedBadge");
  if (status === "claimed") return t("quests.claimedBadge");
  if (status === "failed") return t("quests.wordle.failedLabel");
  return t("quests.progress");
}

function getQuestActionButtonAppearance(
  status: QuestStatus,
  colors: { iconColor: string },
  tc: ThemeColors,
) {
  if (status === "active") {
    return {
      backgroundColor: tc.primary,
      foregroundColor: "#FFFFFF",
      borderColor: undefined,
    };
  }

  return {
    backgroundColor: colors.iconColor,
    foregroundColor: "#FFFFFF",
    borderColor: undefined,
  };
}

function getClaimableGroupedQuests<T extends string>(
  order: T[],
  quests: Partial<Record<T, Quest>>,
) {
  return order.flatMap((key) => {
    const quest = quests[key];
    return quest?.completed && !quest.claimed ? [quest] : [];
  });
}

function getQuestRewardTotal(quests: Quest[]) {
  return quests.reduce((total, quest) => total + quest.reward, 0);
}

function RewardAmount({
  amount,
  claimed,
  color,
  iconSize = 18,
  textClassName = "font-nunito-bold text-base",
}: {
  amount: number;
  claimed: boolean;
  color: string;
  iconSize?: number;
  textClassName?: string;
}) {
  return (
    <View
      className="flex-row items-center gap-1"
      style={{ position: "relative" }}
    >
      <CoinIcon size={iconSize} />
      <Text className={textClassName} style={{ color }}>
        {amount}
      </Text>
      {claimed ? (
        <View
          pointerEvents="none"
          style={asStyle({
            backgroundColor: color,
            borderRadius: 999,
            height: 2,
            left: -1,
            position: "absolute",
            right: -2,
            top: iconSize / 2,
            transform: [{ translateY: -1 }],
          })}
        />
      ) : null}
    </View>
  );
}

const WORDLE_LANGUAGES: WordleLocale[] = ["fr", "en"];

function isWordleQuest(questType: string) {
  return questType === "wordle_daily_fr" || questType === "wordle_daily_en";
}

function getWordleLanguageFromQuestType(
  questType: string,
): WordleLocale | null {
  if (questType === "wordle_daily_fr") {
    return "fr";
  }

  if (questType === "wordle_daily_en") {
    return "en";
  }

  return null;
}

function getWordleLanguageLabelKey(language: WordleLocale) {
  return language === "fr"
    ? "quests.wordle.frenchWords"
    : "quests.wordle.englishWords";
}

function getWordleShareLanguageLabelKey(language: WordleLocale) {
  return language === "fr"
    ? "quests.wordle.shareFrenchWord"
    : "quests.wordle.shareEnglishWord";
}

function getDailyNumbersShareModeLabelKey(mode: DailyNumbersMode) {
  if (mode === "1-5") {
    return "quests.dailyNumbers.shareMode1_5";
  }

  if (mode === "2-4") {
    return "quests.dailyNumbers.shareMode2_4";
  }

  return "quests.dailyNumbers.shareMode3_3";
}

function getDailyNumbersQuestTabModeLabelKey(mode: DailyNumbersMode) {
  if (mode === "1-5") {
    return "quests.dailyNumbers.oneFiveMix";
  }

  if (mode === "2-4") {
    return "quests.dailyNumbers.twoFourMix";
  }

  return "quests.dailyNumbers.threeThreeMix";
}

function isSpeedCalculusQuest(questType: string) {
  return questType === "speed_calculus_daily";
}

function isDailyNumbersQuest(questType: string) {
  return (
    questType === "daily_numbers_1_5" ||
    questType === "daily_numbers_2_4" ||
    questType === "daily_numbers_3_3"
  );
}

function isStepQuest(questType: string) {
  return questType === "steps_10k";
}

function isDailyLoginQuest(questType: string) {
  return questType === "daily_login";
}

function getDailyNumbersModeFromQuestType(
  questType: string,
): DailyNumbersMode | null {
  if (questType === "daily_numbers_1_5") {
    return "1-5";
  }

  if (questType === "daily_numbers_2_4") {
    return "2-4";
  }

  if (questType === "daily_numbers_3_3") {
    return "3-3";
  }

  return null;
}

function formatQuestShareDate(
  dateKey: string | null | undefined,
  locale: string,
): string | undefined {
  if (!dateKey) {
    return undefined;
  }

  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return dateKey;
  }

  const formatter = locale.startsWith("fr")
    ? QUEST_SHARE_DATE_FORMATTERS.fr
    : QUEST_SHARE_DATE_FORMATTERS.en;

  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function buildGroupedQuestShareFileName(
  group: SharingGroup,
  dateKey: string | undefined,
) {
  const parts = [
    group === "wordle"
      ? "adventure-time-wordle-all"
      : "adventure-time-numbers-all",
  ];

  if (dateKey) {
    parts.push(dateKey);
  }

  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "adventure-time-quests"}.png`;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function getWordleGroupStatus(
  quests: Partial<Record<WordleLocale, Quest>>,
): QuestStatus {
  const entries = WORDLE_LANGUAGES.flatMap((language) => {
    const quest = quests[language];
    return quest ? [quest] : [];
  });

  if (entries.length === 0) {
    return "active";
  }

  if (entries.every((quest) => quest.claimed)) {
    return "claimed";
  }

  if (entries.every((quest) => quest.completed || quest.claimed)) {
    return "completed";
  }

  if (entries.every((quest) => quest.failed)) {
    return "failed";
  }

  return "active";
}

function getDailyNumbersGroupStatus(
  quests: Partial<Record<DailyNumbersMode, Quest>>,
): QuestStatus {
  const entries = DAILY_NUMBERS_MODES.flatMap((mode) => {
    const quest = quests[mode];
    return quest ? [quest] : [];
  });

  if (entries.length === 0) {
    return "active";
  }

  const statuses = entries.map((quest) => getDailyNumbersQuestStatus(quest));

  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  if (statuses.every((status) => status === "claimed")) {
    return "claimed";
  }

  if (
    statuses.every((status) => status === "completed" || status === "claimed")
  ) {
    return "completed";
  }

  return "active";
}

function isDailyNumbersExactHit(quest: Quest) {
  return quest.distance === 0 && quest.finalValue != null;
}

function hasDailyNumbersResult(quest: Quest) {
  return (
    quest.score != null ||
    quest.distance != null ||
    quest.finalValue != null ||
    quest.completed ||
    quest.claimed
  );
}

function getDailyNumbersQuestStatus(quest: Quest): QuestStatus {
  if (quest.claimed && isDailyNumbersExactHit(quest)) {
    return "claimed";
  }

  if (isDailyNumbersExactHit(quest)) {
    return "completed";
  }

  if (hasDailyNumbersResult(quest)) {
    return "failed";
  }

  return "active";
}

function buildQuestCardItems(quests: Quest[]): QuestCardItem[] {
  const wordleQuests: Partial<Record<WordleLocale, Quest>> = {};
  const dailyNumbersQuests: Partial<Record<DailyNumbersMode, Quest>> = {};
  const singleQuests: { quest: Quest; index: number }[] = [];

  quests.forEach((quest, index) => {
    const language = getWordleLanguageFromQuestType(quest.type);
    if (language) {
      wordleQuests[language] = quest;
      return;
    }

    const mode = getDailyNumbersModeFromQuestType(quest.type);
    if (mode) {
      dailyNumbersQuests[mode] = quest;
      return;
    }

    singleQuests.push({ quest, index });
  });

  const orderedSingles = singleQuests
    .slice()
    .sort((left, right) => {
      const leftPriority = getQuestCardPriority(left.quest.type);
      const rightPriority = getQuestCardPriority(right.quest.type);
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({ quest }) => ({ kind: "quest" as const, quest }));

  const items: QuestCardItem[] = [...orderedSingles];

  if (WORDLE_LANGUAGES.some((language) => wordleQuests[language])) {
    items.push({
      kind: "wordle",
      quests: wordleQuests,
    });
  }

  if (DAILY_NUMBERS_MODES.some((mode) => dailyNumbersQuests[mode])) {
    items.push({
      kind: "dailyNumbers",
      quests: dailyNumbersQuests,
    });
  }

  return items;
}

function getQuestCardPriority(questType: string) {
  if (isStepQuest(questType)) {
    return 0;
  }

  if (isSpeedCalculusQuest(questType)) {
    return 1;
  }

  return 2;
}

function renderActiveQuestIcon(questType: string, size: number, color: string) {
  if (isStepQuest(questType)) {
    return <StepQuestIcon size={size} color={color} />;
  }

  if (isSpeedCalculusQuest(questType)) {
    return <SpeedCalculusQuestIcon size={size} color={color} />;
  }

  if (isDailyLoginQuest(questType)) {
    return <DailyLoginQuestIcon size={size} color={color} />;
  }

  if (isWordleQuest(questType)) {
    return <WordleQuestIcon size={size} color={color} />;
  }

  if (isDailyNumbersQuest(questType)) {
    return <DailyNumbersQuestIcon size={size} color={color} />;
  }

  return <SparklesIcon size={size} color={color} />;
}

function getDailyNumbersModeStatusLabel(
  quest: Quest,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const status = getDailyNumbersQuestStatus(quest);

  if (status === "claimed") {
    return t("quests.dailyNumbers.claimedLabel");
  }

  if (status === "completed") {
    return t("quests.dailyNumbers.completedLabel");
  }

  if (status === "failed") {
    return t("quests.dailyNumbers.submittedLabel");
  }

  return t("quests.dailyNumbers.freshLabel");
}

function getDailyNumbersResultLabel(
  quest: Quest,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (
    quest.score == null ||
    quest.distance == null ||
    quest.finalValue == null
  ) {
    return null;
  }

  const elapsedTime =
    quest.elapsedMs != null && quest.elapsedMs > 0
      ? formatDailyNumbersElapsedTime(quest.elapsedMs)
      : null;

  if (quest.distance === 0) {
    return elapsedTime
      ? t("quests.dailyNumbersQuestCardExactTimed", {
          score: quest.score,
          time: elapsedTime,
        })
      : t("quests.dailyNumbersQuestCardExact", {
          score: quest.score,
        });
  }

  return elapsedTime
    ? t("quests.dailyNumbersQuestCardMetaTimed", {
        value: quest.finalValue,
        distance: quest.distance,
        score: quest.score,
        time: elapsedTime,
      })
    : t("quests.dailyNumbersQuestCardMeta", {
        value: quest.finalValue,
        distance: quest.distance,
        score: quest.score,
      });
}

function getWordleLanguageStatusLabel(
  quest: Quest,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (quest.claimed) {
    return t("quests.dailyNumbers.claimedLabel");
  }

  if (quest.completed) {
    return t("quests.dailyNumbers.completedLabel");
  }

  if (quest.failed) {
    return t("quests.wordle.failedLabel");
  }

  if ((quest.attemptsUsed ?? 0) > 0) {
    return t("quests.dailyNumbers.submittedLabel");
  }

  return t("quests.dailyNumbers.freshLabel");
}

function getQuestProgressDisplay(quest: Quest) {
  if (isWordleQuest(quest.type)) {
    const used = quest.attemptsUsed ?? 0;
    return {
      progress: used,
      target: 6,
      progressPct: Math.min(100, (used / 6) * 100),
    };
  }

  return {
    progress: quest.progress,
    target: quest.target,
    progressPct: quest.completed
      ? 100
      : Math.min(100, (quest.progress / quest.target) * 100),
  };
}

export default function QuestsScreen() {
  return useQuestsScreenView();
}

function useQuestsScreenView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const patchUser = useSessionStore((state) => state.patchUser);
  const user = useSessionStore((state) => state.user);
  const stepSync = useStepSyncStore();
  const { locale, t } = useTranslation();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore(
    (state) => state.lastPayload,
  );

  const [showDescriptionFor, setShowDescriptionFor] =
    useState<DescriptionModalState>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isConnectingFitbit, setIsConnectingFitbit] = useState(false);
  const [stepQuestUiState, setStepQuestUiState] = useState({
    claimSyncWarning: null as string | null,
    isForceRefreshing: false,
  });
  const [collapsedGroups, setCollapsedGroups] = useState({
    wordle: true,
    dailyNumbers: true,
  });
  const [sharingGroup, setSharingGroup] = useState<SharingGroup | null>(null);
  const [wordleGroupShareItems, setWordleGroupShareItems] = useState<
    WordleGroupShareItem[] | null
  >(null);
  const [dailyNumbersGroupShareItems, setDailyNumbersGroupShareItems] =
    useState<DailyNumbersGroupShareItem[] | null>(null);
  const wordleGroupShareRef = useRef<View>(null);
  const dailyNumbersGroupShareRef = useRef<View>(null);
  const toastAnim = useSharedValue(-60);

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.value = -60;
    toastAnim.value = withTiming(0, { duration: 300 });
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  const STATUS_COLORS: Record<
    QuestStatus,
    {
      border: string;
      iconBg: string;
      iconColor: string;
    }
  > = {
    active: {
      border: tc.primaryBorder,
      iconBg: tc.primaryTint,
      iconColor: tc.primaryText,
    },
    completed: {
      border: tc.successBorder,
      iconBg: tc.successTint,
      iconColor: tc.successDark,
    },
    claimed: {
      border: tc.successBorder,
      iconBg: tc.successTint,
      iconColor: tc.successDark,
    },
    failed: {
      border: tc.dangerBorder,
      iconBg: tc.dangerTint,
      iconColor: tc.dangerDark,
    },
  };

  const {
    data: questsQueryData,
    error: questsQueryError,
    isError: questsQueryIsError,
    isLoading: questsQueryIsLoading,
    refetch: questsQueryRefetch,
  } = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
    refetchInterval: 30_000,
  });
  const showFitbitConnectCta =
    user?.preferredStepSource === "fitbit" &&
    !questsQueryData?.fitbitConnected;

  const showStepQuestActivationPrompt =
    user?.preferredStepSource === "device_health" &&
    (stepSync.availability === "setup_required" ||
      stepSync.healthPermissionStatus !== "granted");
  const healthSystemLabel = t(
    Platform.OS === "ios"
      ? "settings.healthSystems.ios"
      : Platform.OS === "android"
        ? "settings.healthSystems.android"
        : "settings.healthSystems.default",
  );
  const stepActionLabel =
    stepSync.availability === "setup_required"
      ? t("settings.openHealthConnect", {
          healthSystem: healthSystemLabel,
        })
      : stepSync.healthPermissionStatus === "granted"
        ? t("settings.syncNow")
        : t("settings.enableStepSync");

  const handleStepAction = useCallback(async () => {
    if (stepSync.availability === "setup_required") {
      await openDeviceHealthSetup();
      return;
    }

    await syncDeviceStepsNow({
      interactive: true,
      source: "manual",
    });
  }, [stepSync.availability]);

  const handleForceRefresh = useCallback(async () => {
    setStepQuestUiState((state) => ({
      ...state,
      isForceRefreshing: true,
    }));

    try {
      await syncDeviceStepsNow({
        interactive: false,
        source: "manual",
      });
      await questsQueryRefetch();
    } finally {
      setStepQuestUiState((state) => ({
        ...state,
        isForceRefreshing: false,
      }));
    }
  }, [questsQueryRefetch]);

  const handleConnectFitbit = useCallback(async () => {
    setIsConnectingFitbit(true);

    try {
      const result = await connectFitbit("/quests");

      await questsQueryRefetch();

      if (result.type === "success") {
        setToast({
          message: t("quests.fitbitConnectedSuccess"),
          type: "success",
        });
      } else if (result.type === "error") {
        setToast({
          message: t("quests.fitbitConnectFailed"),
          type: "error",
        });
      }
    } catch {
      setToast({
        message: t("quests.fitbitConnectFailed"),
        type: "error",
      });
    } finally {
      setIsConnectingFitbit(false);
    }
  }, [questsQueryRefetch, t]);

  const shareCapturedGroupImage = useCallback(
    async ({
      dateKey,
      group,
      ref,
    }: {
      dateKey: string | undefined;
      group: SharingGroup;
      ref: RefObject<View | null>;
    }) => {
      let captureTarget = ref.current;
      if (!captureTarget) {
        await waitForNextFrame();
        captureTarget = ref.current;
      }

      if (!captureTarget) {
        throw new Error("Grouped quest share image was not ready.");
      }

      const uri = await captureRef(captureTarget, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      let shareUri = uri;
      try {
        const fileName = buildGroupedQuestShareFileName(group, dateKey);
        const destination = new File(Paths.cache, fileName);
        if (destination.exists) {
          destination.delete();
        }
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename grouped quest share image", copyError);
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: t("quests.shareAllDialogTitle"),
        UTI: "public.png",
      });
    },
    [t],
  );

  const handleShareWordleGroup = useCallback(
    async (quests: Partial<Record<WordleLocale, Quest>>) => {
      if (sharingGroup) {
        return;
      }

      const availableLanguages = WORDLE_LANGUAGES.filter(
        (language) => quests[language],
      );
      if (availableLanguages.length === 0) {
        return;
      }

      setSharingGroup("wordle");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const [canShare, states] = await Promise.all([
          Sharing.isAvailableAsync(),
          Promise.all(
            availableLanguages.map((language) =>
              queryClient.fetchQuery({
                queryKey: ["wordle", language],
                queryFn: () => apiClient.wordleState(language),
                staleTime: 30_000,
              }),
            ),
          ),
        ]);

        if (!canShare) {
          Alert.alert(t("quests.shareAllUnavailable"));
          return;
        }

        let dateKey: string | undefined;
        const items = states.map((state: WordleStateResponse, index) => {
          const language = availableLanguages[index];
          const quest = quests[language];
          const completed = Boolean(
            quest?.completed || quest?.claimed || state.solved,
          );
          dateKey = dateKey ?? state.date;

          return {
            language,
            result: buildWordleShareResult({
              questTitle: t("quests.wordle.title"),
              date: state.date,
              wordLocale: language,
              solved: completed,
              maxAttempts: WORDLE_MAX_ATTEMPTS,
              wordLength: WORDLE_WORD_LENGTH,
              evaluations: state.guesses.map((guess) => guess.evaluation),
            }),
            strings: {
              brand: t("quests.wordle.shareBrand"),
              footer: t("quests.wordle.shareFooter"),
              date: formatQuestShareDate(state.date, locale),
              wordLanguage: t(getWordleShareLanguageLabelKey(language)),
              resultLine: completed
                ? t("quests.wordle.shareSolved", {
                    used: state.guesses.length,
                    total: WORDLE_MAX_ATTEMPTS,
                  })
                : t("quests.shareNotCompleted"),
            },
          };
        });

        setWordleGroupShareItems(items);
        await shareCapturedGroupImage({
          dateKey,
          group: "wordle",
          ref: wordleGroupShareRef,
        });
      } catch (error) {
        console.warn("Failed to share grouped Wordle results", error);
        Alert.alert(t("quests.shareAllError"));
      } finally {
        setWordleGroupShareItems(null);
        setSharingGroup(null);
      }
    },
    [locale, queryClient, shareCapturedGroupImage, sharingGroup, t],
  );

  const handleShareDailyNumbersGroup = useCallback(
    async (quests: Partial<Record<DailyNumbersMode, Quest>>) => {
      if (sharingGroup) {
        return;
      }

      const availableModes = DAILY_NUMBERS_MODES.filter((mode) => quests[mode]);
      if (availableModes.length === 0) {
        return;
      }

      setSharingGroup("dailyNumbers");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const [canShare, states] = await Promise.all([
          Sharing.isAvailableAsync(),
          Promise.all(
            availableModes.map((mode) =>
              queryClient.fetchQuery({
                queryKey: ["daily-numbers", mode],
                queryFn: () => apiClient.dailyNumbersState(mode),
                staleTime: 30_000,
              }),
            ),
          ),
        ]);

        if (!canShare) {
          Alert.alert(t("quests.shareAllUnavailable"));
          return;
        }

        let dateKey: string | undefined;
        const items = states.map((state: DailyNumbersStateResponse, index) => {
          const mode = availableModes[index];
          const quest = quests[mode];
          const submission = state.submission;
          const distance = submission?.distance ?? quest?.distance ?? null;
          const score = submission?.score ?? quest?.score ?? null;
          const finalValue =
            submission?.finalValue ?? quest?.finalValue ?? null;
          const elapsedMs = submission?.elapsedMs ?? quest?.elapsedMs ?? 0;
          const exact = distance === 0 && finalValue != null;
          const hasResult =
            score != null ||
            distance != null ||
            finalValue != null ||
            Boolean(
              state.completed || submission?.completed || quest?.completed,
            );
          dateKey = dateKey ?? state.date;

          let resultLine = t("quests.shareNotCompleted");
          if (exact) {
            resultLine = t("quests.dailyNumbers.shareExact", {
              score: score ?? 100,
            });
          } else if (hasResult) {
            resultLine = t("quests.dailyNumbers.shareMissed", {
              distance: distance ?? 0,
            });
          }

          return {
            mode,
            result: buildDailyNumbersShareResult({
              questTitle: t("quests.dailyNumbers.title"),
              modeLabel: t(getModeLabelKey(mode)),
              mode,
              date: state.date,
              target: state.target,
              finalValue,
              distance,
              score,
              elapsedTime: formatDailyNumbersElapsedTime(elapsedMs),
              exact,
              completed: exact,
            }),
            strings: {
              brand: t("quests.dailyNumbers.shareBrand"),
              modeLabel: t(getDailyNumbersShareModeLabelKey(mode)),
              resultLine,
              targetLabel: t("quests.dailyNumbers.target"),
              resultValueLabel: t("quests.dailyNumbers.shareResultValueLabel"),
              timeLabel: t("quests.dailyNumbers.solveTime"),
              archiveLabel: t("quests.dailyNumbers.archiveResultLabel"),
              footer: t("quests.dailyNumbers.shareFooter"),
              date: formatQuestShareDate(state.date, locale),
            },
          };
        });

        setDailyNumbersGroupShareItems(items);
        await shareCapturedGroupImage({
          dateKey,
          group: "dailyNumbers",
          ref: dailyNumbersGroupShareRef,
        });
      } catch (error) {
        console.warn("Failed to share grouped Daily Numbers results", error);
        Alert.alert(t("quests.shareAllError"));
      } finally {
        setDailyNumbersGroupShareItems(null);
        setSharingGroup(null);
      }
    },
    [locale, queryClient, shareCapturedGroupImage, sharingGroup, t],
  );

  useFocusEffect(
    useCallback(() => {
      void questsQueryRefetch();
    }, [questsQueryRefetch]),
  );

  const claimQuestMutation = useMutation({
    mutationFn: async (quest: Quest) => {
      if (
        isStepQuest(quest.type) &&
        user?.preferredStepSource === "device_health"
      ) {
        const syncThenGetServerStepQuest = async () => {
          await syncDeviceStepsNow({
            allowPermissionPrompt: false,
            forceServerSync: true,
            interactive: false,
            source: "manual",
          });

          const serverQuests = await apiClient.quests();
          return serverQuests.quests.find((entry) => isStepQuest(entry.type));
        };

        const firstServerStepQuest = await syncThenGetServerStepQuest();
        if (firstServerStepQuest?.completed || firstServerStepQuest?.claimed) {
          return apiClient.claimQuest({
            questId: firstServerStepQuest.id,
          });
        }

        const secondServerStepQuest = await syncThenGetServerStepQuest();
        if (
          secondServerStepQuest?.completed ||
          secondServerStepQuest?.claimed
        ) {
          return apiClient.claimQuest({
            questId: secondServerStepQuest.id,
          });
        }

        throw new Error("STEP_CLAIM_SYNC_PENDING");
      }

      return apiClient.claimQuest({ questId: quest.id });
    },
    onMutate: (quest) => {
      if (isStepQuest(quest.type)) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: null,
        }));
      }
    },
    onSuccess: async (data, quest) => {
      if (isStepQuest(quest.type)) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: null,
        }));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      await patchUser({ coins: data.newBalance });

      setToast({
        message: t("quests.claimSuccess", {
          amount: quest.reward,
        }),
        type: "success",
      });
    },
    onError: (error, quest) => {
      if (
        isStepQuest(quest.type) &&
        error instanceof Error &&
        error.message === "STEP_CLAIM_SYNC_PENDING"
      ) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: t("quests.stepClaimSyncPending"),
        }));
        return;
      }

      setToast({ message: t("quests.claimFailed"), type: "error" });
    },
  });

  const claimGroupedQuestsMutation = useMutation({
    mutationFn: async ({
      quests,
    }: {
      group: SharingGroup;
      quests: Quest[];
    }) => {
      const responses = await Promise.all(
        quests.map((quest) => apiClient.claimQuest({ questId: quest.id })),
      );

      const newBalance = responses.reduce<number | null>(
        (highest, response) =>
          highest == null
            ? response.newBalance
            : Math.max(highest, response.newBalance),
        null,
      );

      return {
        claimedReward: getQuestRewardTotal(quests),
        newBalance,
      };
    },
    onSuccess: async (data) => {
      if (data.newBalance != null) {
        await patchUser({ coins: data.newBalance });
      }

      setToast({
        message: t("quests.claimSuccess", {
          amount: data.claimedReward,
        }),
        type: "success",
      });
    },
    onError: () => {
      setToast({ message: t("quests.claimFailed"), type: "error" });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  useEffect(() => {
    if (!lastQuestResetAt || !lastQuestResetPayload) return;
    if (lastShownQuestResetToastAt === lastQuestResetAt) return;

    setToast({
      type: "success",
      message: lastQuestResetPayload.resetByName
        ? t("quests.questResetByAdmin", {
            name: lastQuestResetPayload.resetByName,
          })
        : t("quests.questReset"),
    });
    lastShownQuestResetToastAt = lastQuestResetAt;
  }, [lastQuestResetAt, lastQuestResetPayload, t]);

  const openQuest = useCallback(
    (quest: Quest) => {
      if (!quest.actionPath) return;

      router.push(quest.actionPath as never);
    },
    [router],
  );

  if (questsQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("nav.quests")}
        message={t("common.loadingStates.pageBody")}
        icon="trophy"
      />
    );
  }

  if (questsQueryIsError || !questsQueryData) {
    return (
      <PageErrorState
        error={questsQueryError}
        title={questsQueryError ? undefined : t("quests.unavailable")}
        body={
          questsQueryError ? undefined : t("common.errorStates.generic.body")
        }
        detail={
          questsQueryError ? undefined : t("common.errorStates.generic.detail")
        }
        onRetry={() => {
          void questsQueryRefetch();
        }}
      />
    );
  }

  const displayedQuests =
    applyLocalStepProgressToQuests(questsQueryData, user) ?? questsQueryData;
  const questCardItems = buildQuestCardItems(displayedQuests.quests);

  return (
    <View className="flex-1 bg-bg">
      {toast ? (
        <ToastBanner
          message={toast.message}
          type={toast.type}
          translateY={toastAnim}
          successColor={tc.successDark}
          errorColor={tc.dangerDark}
          topOffset={headerHeight + 16}
        />
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 24,
          paddingHorizontal: 16,
        }}
        contentInset={{ bottom: bottomTabPadding }}
        scrollIndicatorInsets={{ bottom: bottomTabPadding }}
      >
        <View style={{ paddingTop: headerHeight + 16 }}>
          <View className="items-center mb-6" style={{ gap: 8 }}>
            <Text
              className="font-nunito-extrabold text-3xl text-primaryDark"
              style={{
                textShadowColor: "rgba(0,0,0,0.15)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              }}
            >
              {t("quests.title")}
            </Text>
            <Text
              className="font-nunito-medium text-sm px-4"
              style={{
                color: tc.primaryDark,
                textAlign: "center",
              }}
            >
              {t("quests.subtitle")}
            </Text>
          </View>

          {showFitbitConnectCta ? (
            <View
              className="bg-successTint border border-successBorder"
              style={{
                borderRadius: 16,
                padding: 16,
                marginTop: 16,
                marginBottom: 16,
                boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.08)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <StepQuestIcon size={32} color={tc.successDark} />
                <View style={{ flex: 1 }}>
                  <Text className="font-nunito-bold text-base text-successDark">
                    {t("settings.connectFitbit")}
                  </Text>
                  <Text className="font-nunito text-sm mt-1 text-successDark">
                    {t("quests.connectFitbitDesc")}
                  </Text>
                  <QuestButton
                    label={
                      isConnectingFitbit
                        ? t("settings.connectingFitbit")
                        : t("settings.connectFitbit")
                    }
                    onPress={() => {
                      void handleConnectFitbit();
                    }}
                    disabled={isConnectingFitbit}
                    backgroundColor={tc.successDark}
                    minHeight={40}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 12,
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {questsQueryData.quests.length === 0 ? (
            <View
              className="bg-surfaceMuted border border-primaryBorder"
              style={{
                borderRadius: 16,
                padding: 32,
                alignItems: "center",
              }}
            >
              {!showFitbitConnectCta ? (
                <>
                  <SparklesIcon size={48} color={tc.primaryBorder} />
                  <Text className="font-nunito-bold text-base text-fgMuted mt-4">
                    {t("quests.noQuests")}
                  </Text>
                  <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">
                    {t("quests.checkBackLater")}
                  </Text>
                </>
              ) : (
                <>
                  <StepQuestIcon size={48} color={tc.primaryBorder} />
                  <Text className="font-nunito-bold text-base text-fgMuted mt-4">
                    {t("settings.connectFitbit")}
                  </Text>
                  <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">
                    {t("quests.connectFitbitDesc")}
                  </Text>
                  <QuestButton
                    label={
                      isConnectingFitbit
                        ? t("settings.connectingFitbit")
                        : t("settings.connectFitbit")
                    }
                    onPress={() => {
                      void handleConnectFitbit();
                    }}
                    disabled={isConnectingFitbit}
                    backgroundColor={tc.primaryText}
                    minHeight={40}
                    style={{ marginTop: 16 }}
                  />
                </>
              )}
            </View>
          ) : (
            questCardItems.map((item, index) => {
              if (item.kind === "wordle") {
                const groupStatus = getWordleGroupStatus(item.quests);
                const colors = STATUS_COLORS[groupStatus];
                const shareButtonAppearance = getQuestActionButtonAppearance(
                  groupStatus,
                  colors,
                  tc,
                );
                const availableLanguages = WORDLE_LANGUAGES.filter(
                  (language) => item.quests[language],
                );
                const completedLanguages = availableLanguages.filter(
                  (language) => {
                    const quest = item.quests[language];
                    return quest?.completed || quest?.claimed;
                  },
                ).length;
                const totalReward = availableLanguages.reduce(
                  (sum, language) => sum + (item.quests[language]?.reward ?? 0),
                  0,
                );
                const claimableQuests = getClaimableGroupedQuests(
                  WORDLE_LANGUAGES,
                  item.quests,
                );
                const isGroupClaimLoading =
                  claimGroupedQuestsMutation.isPending &&
                  claimGroupedQuestsMutation.variables?.group === "wordle";
                const progressPct =
                  availableLanguages.length === 0
                    ? 0
                    : (completedLanguages / availableLanguages.length) * 100;

                return (
                  <View
                    key="wordle-group"
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: tc.surface,
                      borderWidth: 2,
                      borderColor: colors.border,
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      marginBottom:
                        index === questCardItems.length - 1 ? 0 : 12,
                    }}
                  >
                    <Pressable
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        zIndex: 1,
                      }}
                      onPress={() =>
                        setShowDescriptionFor({
                          title: t("quests.wordle.title"),
                          description: t("quests.wordleGroupDesc"),
                          status: groupStatus,
                        })
                      }
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <View
                        style={{
                          backgroundColor: tc.surface,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: colors.border,
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        <HelpCircleIcon
                          size={20}
                          color={colors.border}
                          noCircle
                        />
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setCollapsedGroups((groups) => ({
                          ...groups,
                          wordle: !groups.wordle,
                        }))
                      }
                      style={{
                        paddingRight: 24,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 16,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.iconBg,
                            padding: 12,
                            borderRadius: 12,
                          }}
                        >
                          <WordleQuestIcon size={28} color={colors.iconColor} />
                        </View>

                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <Text className="font-nunito-bold text-base text-fg">
                            {t("quests.wordle.title")}
                          </Text>
                          {groupStatus === "completed" ||
                          groupStatus === "claimed" ? (
                            <View
                              className="rounded-full px-2 py-1 mt-1 self-start"
                              style={{ backgroundColor: colors.iconBg }}
                            >
                              <Text
                                className="font-nunito-bold text-[11px]"
                                style={{ color: colors.iconColor }}
                              >
                                {getQuestStatusLabel(groupStatus, t)}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row items-center gap-2">
                          <RewardAmount
                            amount={totalReward}
                            claimed={groupStatus === "claimed"}
                            color={tc.secondaryDark}
                          />
                          {collapsedGroups.wordle ? (
                            <ChevronRightIcon size={20} color={tc.muted} />
                          ) : (
                            <ChevronDownIcon size={20} color={tc.muted} />
                          )}
                        </View>
                      </View>

                      <View style={{ marginTop: 16 }}>
                        <View className="flex-row justify-between mb-1">
                          <Text className="font-nunito text-xs text-fgMuted">
                            {t("quests.progress")}
                          </Text>
                          <Text
                            className="font-nunito-bold text-xs"
                            style={{ color: getProgressColor(groupStatus, tc) }}
                          >
                            {t("quests.dailyNumbersLevelsCleared", {
                              completed: completedLanguages,
                              total: availableLanguages.length,
                            })}
                          </Text>
                        </View>
                        <View className="h-3 rounded-full overflow-hidden bg-primaryTint">
                          <View
                            style={{
                              width: `${progressPct}%`,
                              height: "100%",
                              backgroundColor: colors.iconColor,
                            }}
                          />
                        </View>
                      </View>
                    </Pressable>

                    <View className="mt-4 flex-row gap-3">
                      {claimableQuests.length > 0 ? (
                        <QuestButton
                          label={t("quests.claimAll")}
                          onPress={() => {
                            void claimGroupedQuestsMutation.mutateAsync({
                              group: "wordle",
                              quests: claimableQuests,
                            });
                          }}
                          disabled={
                            claimQuestMutation.isPending ||
                            claimGroupedQuestsMutation.isPending
                          }
                          loading={isGroupClaimLoading}
                          leadingAccessory={CLAIM_BUTTON_ICON}
                          backgroundColor={tc.successDark}
                          minHeight={48}
                          testID="quests-wordle-claim-all"
                          style={{
                            flex: 1,
                          }}
                        />
                      ) : null}
                      <QuestButton
                        label={
                          sharingGroup === "wordle"
                            ? t("quests.shareGroupPreparing")
                            : t("quests.shareGroupResult")
                        }
                        onPress={() => {
                          void handleShareWordleGroup(item.quests);
                        }}
                        disabled={
                          sharingGroup !== null && sharingGroup !== "wordle"
                        }
                        loading={sharingGroup === "wordle"}
                        loadingMode="inline"
                        backgroundColor={shareButtonAppearance.backgroundColor}
                        foregroundColor={shareButtonAppearance.foregroundColor}
                        borderColor={shareButtonAppearance.borderColor}
                        leadingIcon={ShareIcon}
                        minHeight={48}
                        style={{
                          flex: 1,
                        }}
                      />
                    </View>

                    {collapsedGroups.wordle ? null : (
                      <View className="mt-4 gap-3">
                        {WORDLE_LANGUAGES.map((language) => {
                          const quest = item.quests[language];
                          if (!quest) {
                            return null;
                          }

                          const languageStatus = getQuestStatus(quest);
                          const languageColors = STATUS_COLORS[languageStatus];
                          const languageActionAppearance =
                            getQuestActionButtonAppearance(
                              languageStatus,
                              languageColors,
                              tc,
                            );
                          const isClaimLoading =
                            claimQuestMutation.isPending &&
                            claimQuestMutation.variables?.id === quest.id;
                          const actionLabel =
                            languageStatus === "active"
                              ? t("quests.dailyNumbers.playAction")
                              : t("quests.wordle.seeGuesses");
                          const attemptsUsed = quest.attemptsUsed ?? 0;

                          return (
                            <View
                              key={language}
                              className="rounded-2xl border p-3"
                              style={{
                                borderColor: languageColors.border,
                                backgroundColor: tc.primaryBg,
                              }}
                            >
                              <View className="flex-row items-start gap-3">
                                <View className="flex-1 gap-2">
                                  <View className="flex-row items-center gap-2">
                                    <Text className="font-nunito-bold text-base text-fg">
                                      {t(getWordleLanguageLabelKey(language))}
                                    </Text>
                                    <View
                                      className="rounded-full px-2 py-1"
                                      style={{
                                        backgroundColor: languageColors.iconBg,
                                      }}
                                    >
                                      <Text
                                        className="font-nunito-bold text-[11px]"
                                        style={{
                                          color: languageColors.iconColor,
                                        }}
                                      >
                                        {getWordleLanguageStatusLabel(quest, t)}
                                      </Text>
                                    </View>
                                  </View>

                                  {attemptsUsed > 0 ? (
                                    <Text
                                      className="font-nunito-bold text-xs"
                                      style={{
                                        color:
                                          languageStatus === "failed"
                                            ? tc.dangerDark
                                            : languageStatus === "completed" ||
                                                languageStatus === "claimed"
                                              ? tc.successDark
                                              : getMetaColor(
                                                  languageStatus,
                                                  tc,
                                                ),
                                      }}
                                    >
                                      {quest.completed
                                        ? t("quests.wordleSolvedIn", {
                                            used: attemptsUsed,
                                            total: 6,
                                          })
                                        : t("quests.wordleAttemptsUsed", {
                                            used: attemptsUsed,
                                            total: 6,
                                          })}
                                    </Text>
                                  ) : null}
                                </View>

                                <View className="items-end gap-2">
                                  <RewardAmount
                                    amount={quest.reward}
                                    claimed={languageStatus === "claimed"}
                                    color={tc.secondaryDark}
                                    iconSize={16}
                                    textClassName="font-nunito-bold text-sm"
                                  />
                                </View>
                              </View>

                              <View className="mt-3 flex-row gap-3">
                                <QuestButton
                                  label={actionLabel}
                                  onPress={() =>
                                    router.push(
                                      `/quests/wordle?language=${language}` as never,
                                    )
                                  }
                                  backgroundColor={
                                    languageActionAppearance.backgroundColor
                                  }
                                  foregroundColor={
                                    languageActionAppearance.foregroundColor
                                  }
                                  borderColor={
                                    languageActionAppearance.borderColor
                                  }
                                  style={{
                                    flex: 1,
                                  }}
                                />

                                {quest.completed && !quest.claimed ? (
                                  <QuestButton
                                    label={t("quests.claim")}
                                    onPress={() =>
                                      void claimQuestMutation.mutateAsync(quest)
                                    }
                                    disabled={
                                      claimGroupedQuestsMutation.isPending
                                    }
                                    loading={isClaimLoading}
                                    leadingAccessory={CLAIM_BUTTON_ICON}
                                    backgroundColor={tc.successDark}
                                    style={{
                                      minWidth: 108,
                                    }}
                                  />
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              if (item.kind === "dailyNumbers") {
                const groupStatus = getDailyNumbersGroupStatus(item.quests);
                const colors = STATUS_COLORS[groupStatus];
                const shareButtonAppearance = getQuestActionButtonAppearance(
                  groupStatus,
                  colors,
                  tc,
                );
                const availableModes = DAILY_NUMBERS_MODES.filter(
                  (mode) => item.quests[mode],
                );
                const completedModes = availableModes.filter((mode) => {
                  const quest = item.quests[mode];
                  return quest ? isDailyNumbersExactHit(quest) : false;
                }).length;
                const totalReward = availableModes.reduce((sum, mode) => {
                  return sum + (item.quests[mode]?.reward ?? 0);
                }, 0);
                const claimableQuests = getClaimableGroupedQuests(
                  DAILY_NUMBERS_MODES,
                  item.quests,
                );
                const isGroupClaimLoading =
                  claimGroupedQuestsMutation.isPending &&
                  claimGroupedQuestsMutation.variables?.group ===
                    "dailyNumbers";
                const progressPct =
                  availableModes.length === 0
                    ? 0
                    : (completedModes / availableModes.length) * 100;

                return (
                  <View
                    key="daily-numbers-group"
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: tc.surface,
                      borderWidth: 2,
                      borderColor: colors.border,
                      boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
                      marginBottom:
                        index === questCardItems.length - 1 ? 0 : 12,
                    }}
                  >
                    <Pressable
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        zIndex: 1,
                      }}
                      onPress={() =>
                        setShowDescriptionFor({
                          title: t("quests.dailyNumbers.title"),
                          description: t("quests.dailyNumbersGroupDesc"),
                          status: groupStatus,
                        })
                      }
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <View
                        style={{
                          backgroundColor: tc.surface,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: colors.border,
                          boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        <HelpCircleIcon
                          size={20}
                          color={colors.border}
                          noCircle
                        />
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setCollapsedGroups((groups) => ({
                          ...groups,
                          dailyNumbers: !groups.dailyNumbers,
                        }))
                      }
                      style={{
                        paddingRight: 24,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 16,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.iconBg,
                            padding: 4,
                            borderRadius: 12,
                          }}
                        >
                          <DailyNumbersQuestIcon
                            size={44}
                            color={colors.iconColor}
                          />
                        </View>

                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <Text className="font-nunito-bold text-base text-fg">
                            {t("quests.dailyNumbers.title")}
                          </Text>
                          {groupStatus === "completed" ||
                          groupStatus === "claimed" ? (
                            <View
                              className="rounded-full px-2 py-1 mt-1 self-start"
                              style={{ backgroundColor: colors.iconBg }}
                            >
                              <Text
                                className="font-nunito-bold text-[11px]"
                                style={{ color: colors.iconColor }}
                              >
                                {getQuestStatusLabel(groupStatus, t)}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row items-center gap-2">
                          <RewardAmount
                            amount={totalReward}
                            claimed={groupStatus === "claimed"}
                            color={tc.secondaryDark}
                          />
                          {collapsedGroups.dailyNumbers ? (
                            <ChevronRightIcon size={20} color={tc.muted} />
                          ) : (
                            <ChevronDownIcon size={20} color={tc.muted} />
                          )}
                        </View>
                      </View>

                      <View style={{ marginTop: 16 }}>
                        <View className="flex-row justify-between mb-1">
                          <Text className="font-nunito text-xs text-fgMuted">
                            {t("quests.progress")}
                          </Text>
                          <Text
                            className="font-nunito-bold text-xs"
                            style={{ color: getProgressColor(groupStatus, tc) }}
                          >
                            {t("quests.dailyNumbersLevelsCleared", {
                              completed: completedModes,
                              total: availableModes.length,
                            })}
                          </Text>
                        </View>
                        <View className="h-3 rounded-full overflow-hidden bg-primaryTint">
                          <View
                            style={{
                              width: `${progressPct}%`,
                              height: "100%",
                              backgroundColor: colors.iconColor,
                            }}
                          />
                        </View>
                      </View>
                    </Pressable>

                    <View className="mt-4">
                      <QuestButton
                        label={t("quests.dailyNumbers.historyAction")}
                        onPress={() =>
                          router.push("/quests/daily-numbers-history" as never)
                        }
                        backgroundColor={tc.surface}
                        foregroundColor={tc.primaryDark}
                        borderColor={tc.primaryBorder}
                        minHeight={48}
                        testID="quests-daily-numbers-history"
                      />
                    </View>

                    <View className="mt-3 flex-row gap-3">
                      {claimableQuests.length > 0 ? (
                        <QuestButton
                          label={t("quests.claimAll")}
                          onPress={() => {
                            void claimGroupedQuestsMutation.mutateAsync({
                              group: "dailyNumbers",
                              quests: claimableQuests,
                            });
                          }}
                          disabled={
                            claimQuestMutation.isPending ||
                            claimGroupedQuestsMutation.isPending
                          }
                          loading={isGroupClaimLoading}
                          leadingAccessory={CLAIM_BUTTON_ICON}
                          backgroundColor={tc.successDark}
                          minHeight={48}
                          testID="quests-daily-numbers-claim-all"
                          style={{
                            flex: 1,
                          }}
                        />
                      ) : null}
                      <QuestButton
                        label={
                          sharingGroup === "dailyNumbers"
                            ? t("quests.shareGroupPreparing")
                            : t("quests.shareGroupResult")
                        }
                        onPress={() => {
                          void handleShareDailyNumbersGroup(item.quests);
                        }}
                        disabled={
                          sharingGroup !== null &&
                          sharingGroup !== "dailyNumbers"
                        }
                        loading={sharingGroup === "dailyNumbers"}
                        loadingMode="inline"
                        backgroundColor={shareButtonAppearance.backgroundColor}
                        foregroundColor={shareButtonAppearance.foregroundColor}
                        borderColor={shareButtonAppearance.borderColor}
                        leadingIcon={ShareIcon}
                        minHeight={48}
                        style={{
                          flex: 1,
                        }}
                      />
                    </View>

                    {collapsedGroups.dailyNumbers ? null : (
                      <View className="mt-4 gap-3">
                        {DAILY_NUMBERS_MODES.map((mode) => {
                          const quest = item.quests[mode];
                          if (!quest) {
                            return null;
                          }

                          const modeStatus = getDailyNumbersQuestStatus(quest);
                          const modeColors = STATUS_COLORS[modeStatus];
                          const modeActionAppearance =
                            getQuestActionButtonAppearance(
                              modeStatus,
                              modeColors,
                              tc,
                            );
                          const isClaimLoading =
                            claimQuestMutation.isPending &&
                            claimQuestMutation.variables?.id === quest.id;
                          const actionLabel =
                            modeStatus === "active"
                              ? t("quests.dailyNumbers.playAction")
                              : t("quests.dailyNumbers.viewResult");

                          return (
                            <View
                              key={mode}
                              className="rounded-2xl border p-3"
                              style={{
                                borderColor: modeColors.border,
                                backgroundColor: tc.primaryBg,
                              }}
                            >
                              <View className="flex-row items-start gap-3">
                                <View className="flex-1 gap-2">
                                  <View className="flex-row items-center gap-2">
                                    <Text className="font-nunito-bold text-base text-fg">
                                      {t(
                                        getDailyNumbersQuestTabModeLabelKey(
                                          mode,
                                        ),
                                      )}
                                    </Text>
                                    <View
                                      className="rounded-full px-2 py-1"
                                      style={{
                                        backgroundColor: modeColors.iconBg,
                                      }}
                                    >
                                      <Text
                                        className="font-nunito-bold text-[11px]"
                                        style={{ color: modeColors.iconColor }}
                                      >
                                        {getDailyNumbersModeStatusLabel(
                                          quest,
                                          t,
                                        )}
                                      </Text>
                                    </View>
                                  </View>

                                  {getDailyNumbersResultLabel(quest, t) ? (
                                    <Text
                                      className="font-nunito-bold text-xs"
                                      style={{
                                        color:
                                          modeStatus === "failed"
                                            ? tc.dangerDark
                                            : modeStatus === "completed"
                                              ? tc.successDark
                                              : getMetaColor(modeStatus, tc),
                                      }}
                                    >
                                      {getDailyNumbersResultLabel(quest, t)}
                                    </Text>
                                  ) : null}
                                </View>

                                <View className="items-end gap-2">
                                  <RewardAmount
                                    amount={quest.reward}
                                    claimed={modeStatus === "claimed"}
                                    color={tc.secondaryDark}
                                    iconSize={16}
                                    textClassName="font-nunito-bold text-sm"
                                  />
                                </View>
                              </View>

                              <View className="mt-3 flex-row gap-3">
                                <QuestButton
                                  label={actionLabel}
                                  onPress={() =>
                                    router.push(
                                      `/quests/daily-numbers-play?mode=${mode}` as never,
                                    )
                                  }
                                  backgroundColor={
                                    modeActionAppearance.backgroundColor
                                  }
                                  foregroundColor={
                                    modeActionAppearance.foregroundColor
                                  }
                                  borderColor={modeActionAppearance.borderColor}
                                  style={{
                                    flex: 1,
                                  }}
                                />

                                {quest.completed && !quest.claimed ? (
                                  <QuestButton
                                    label={t("quests.claim")}
                                    onPress={() =>
                                      void claimQuestMutation.mutateAsync(quest)
                                    }
                                    disabled={
                                      claimGroupedQuestsMutation.isPending
                                    }
                                    loading={isClaimLoading}
                                    leadingAccessory={CLAIM_BUTTON_ICON}
                                    backgroundColor={tc.successDark}
                                    style={{
                                      minWidth: 108,
                                    }}
                                  />
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              const quest = item.quest;
              const status = getQuestStatus(quest);
              const colors = STATUS_COLORS[status];
              const actionAppearance = getQuestActionButtonAppearance(
                status,
                colors,
                tc,
              );
              const progressDisplay = getQuestProgressDisplay(quest);
              const isClaimLoading =
                claimQuestMutation.isPending &&
                claimQuestMutation.variables?.id === quest.id;
              const title = getQuestTitle(quest.title, t);
              const isStep = isStepQuest(quest.type);
              const isSpeedCalculus = isSpeedCalculusQuest(quest.type);
              const actionLabel =
                status === "active"
                  ? t("quests.playQuest")
                  : isSpeedCalculus
                    ? t("quests.seeAttempts")
                    : t("quests.seeResults");
              const shouldShowActivationPrompt =
                isStep && status === "active" && showStepQuestActivationPrompt;
              const shouldShowDiscreteSyncButton =
                isStep &&
                status === "active" &&
                user?.preferredStepSource === "device_health" &&
                !shouldShowActivationPrompt;
              const shouldShowCompletionSummary =
                (status === "completed" || status === "claimed") &&
                !isStep &&
                !isSpeedCalculus;

              let statusIcon;
              if (isStep) {
                statusIcon = renderActiveQuestIcon(
                  quest.type,
                  44,
                  colors.iconColor,
                );
              } else if (isSpeedCalculus) {
                statusIcon = renderActiveQuestIcon(
                  quest.type,
                  28,
                  colors.iconColor,
                );
              } else if (status === "completed") {
                statusIcon = (
                  <CheckCircleIcon size={28} color={colors.iconColor} />
                );
              } else if (status === "claimed") {
                statusIcon = <ClaimedIcon size={28} color={colors.iconColor} />;
              } else if (status === "failed") {
                statusIcon = <XCircleIcon size={28} color={colors.iconColor} />;
              } else {
                statusIcon = renderActiveQuestIcon(
                  quest.type,
                  isStepQuest(quest.type) ? 44 : 28,
                  colors.iconColor,
                );
              }

              return (
                <View
                  key={quest.id}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: tc.surface,
                    borderWidth: 2,
                    borderColor: colors.border,
                    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
                    marginBottom: index === questCardItems.length - 1 ? 0 : 12,
                  }}
                >
                  <Pressable
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      zIndex: 1,
                    }}
                    onPress={() =>
                      setShowDescriptionFor({
                        title: getQuestTitle(quest.title, t),
                        description: getQuestDesc(quest.description, t),
                        status,
                      })
                    }
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <View
                      style={{
                        backgroundColor: tc.surface,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: colors.border,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                      }}
                    >
                      <HelpCircleIcon
                        size={20}
                        color={colors.border}
                        noCircle
                      />
                    </View>
                  </Pressable>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                      paddingRight: 24,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: colors.iconBg,
                        padding: isStep ? 4 : 12,
                        borderRadius: 12,
                      }}
                    >
                      {statusIcon}
                    </View>

                    <View style={{ flex: 1, justifyContent: "center" }}>
                      <Text className="font-nunito-bold text-base text-fg">
                        {title}
                      </Text>
                      {status === "completed" || status === "claimed" ? (
                        <View
                          className="rounded-full px-2 py-1 mt-1 self-start"
                          style={{ backgroundColor: colors.iconBg }}
                        >
                          <Text
                            className="font-nunito-bold text-[11px]"
                            style={{ color: colors.iconColor }}
                          >
                            {getQuestStatusLabel(status, t)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <RewardAmount
                      amount={quest.reward}
                      claimed={status === "claimed"}
                      color={tc.secondaryDark}
                    />
                  </View>

                  <View style={{ marginTop: 16 }}>
                    {shouldShowActivationPrompt ? (
                      <View
                        className="rounded-2xl border border-primaryBorder bg-primaryTint p-3"
                        style={{ marginBottom: 16 }}
                      >
                        <Text className="font-nunito-bold text-sm text-primaryStrong">
                          {t("quests.stepSyncPromptTitle")}
                        </Text>
                        <Text className="font-nunito text-sm text-primaryStrong mt-1">
                          {stepSync.availability === "setup_required"
                            ? t("quests.stepSyncPromptSetupBody", {
                                healthSystem: healthSystemLabel,
                              })
                            : t("quests.stepSyncPromptBody", {
                                healthSystem: healthSystemLabel,
                              })}
                        </Text>
                        {stepSync.lastError ? (
                          <Text className="font-nunito text-sm text-dangerDark mt-2">
                            {stepSync.lastError}
                          </Text>
                        ) : null}
                        <View className="flex-row flex-wrap items-center gap-3 mt-3">
                          <QuestButton
                            label={
                              stepSync.isSyncing
                                ? t("settings.syncing")
                                : stepActionLabel
                            }
                            onPress={() => {
                              void handleStepAction();
                            }}
                            disabled={stepSync.isSyncing}
                            backgroundColor={colors.iconColor}
                            minHeight={40}
                          />
                        </View>
                      </View>
                    ) : null}

                    {shouldShowCompletionSummary ? (
                      <View
                        className="rounded-2xl border p-3 flex-row items-center gap-3"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: colors.iconBg,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: tc.surface,
                            borderRadius: 999,
                            padding: 6,
                          }}
                        >
                          {status === "claimed" ? (
                            <ClaimedIcon size={20} color={colors.iconColor} />
                          ) : (
                            <CheckCircleIcon
                              size={20}
                              color={colors.iconColor}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            className="font-nunito-bold text-sm"
                            style={{ color: colors.iconColor }}
                          >
                            {getQuestStatusLabel(status, t)}
                          </Text>
                          <Text
                            className="font-nunito-semibold text-xs mt-0.5"
                            style={{ color: colors.iconColor }}
                          >
                            {status === "claimed"
                              ? t("quests.rewardClaimed", {
                                  count: quest.reward,
                                })
                              : t("quests.rewardReady", {
                                  count: quest.reward,
                                })}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View className="flex-row justify-between mb-1">
                          <Text className="font-nunito text-xs text-fgMuted">
                            {t("quests.progress")}
                          </Text>
                          <Text
                            className="font-nunito-bold text-xs"
                            style={{ color: getProgressColor(status, tc) }}
                          >
                            {formatProgress(
                              progressDisplay.progress,
                              progressDisplay.target,
                            )}
                          </Text>
                        </View>
                        <View className="h-3 rounded-full overflow-hidden bg-primaryTint">
                          <View
                            style={{
                              width: `${progressDisplay.progressPct}%`,
                              height: "100%",
                              backgroundColor: colors.iconColor,
                            }}
                          />
                        </View>
                      </>
                    )}
                    {isWordleQuest(quest.type) && quest.attemptsUsed != null ? (
                      <Text
                        className="font-nunito-bold text-xs text-center mt-1"
                        style={{
                          color:
                            status === "claimed"
                              ? tc.successDark
                              : status === "failed"
                                ? tc.dangerDark
                                : status === "completed"
                                  ? tc.successDark
                                  : getMetaColor(status, tc),
                        }}
                      >
                        {quest.completed
                          ? t("quests.wordleSolvedIn", {
                              used: quest.attemptsUsed,
                              total: 6,
                            })
                          : t("quests.wordleAttemptsUsed", {
                              used: quest.attemptsUsed,
                              total: 6,
                            })}
                      </Text>
                    ) : null}
                    {isSpeedCalculusQuest(quest.type) ? (
                      <Text
                        className="font-nunito-bold text-xs text-center mt-1"
                        style={{ color: getMetaColor(status, tc) }}
                      >
                        {t("quests.speedCalculusQuestCardMeta", {
                          score: quest.latestScore ?? 0,
                          reward: quest.rewardPreview ?? quest.reward,
                          runs: quest.runsUsed ?? quest.progress,
                          total: quest.maxRuns ?? quest.target,
                        })}
                      </Text>
                    ) : null}
                    {isDailyNumbersQuest(quest.type) &&
                    getDailyNumbersResultLabel(quest, t) ? (
                      <Text
                        className="font-nunito-bold text-xs text-center mt-1"
                        style={{
                          color:
                            status === "failed"
                              ? tc.dangerDark
                              : status === "completed"
                                ? tc.successDark
                                : getMetaColor(status, tc),
                        }}
                      >
                        {getDailyNumbersResultLabel(quest, t)}
                      </Text>
                    ) : null}
                    {shouldShowDiscreteSyncButton || stepSync.lastError ? (
                      <View className="mt-2">
                        {shouldShowDiscreteSyncButton ? (
                          <QuestButton
                            label={
                              stepSync.isSyncing ||
                              stepQuestUiState.isForceRefreshing
                                ? t("settings.syncing")
                                : t("settings.syncNow")
                            }
                            onPress={() => {
                              void handleForceRefresh();
                            }}
                            disabled={
                              stepSync.isSyncing ||
                              stepQuestUiState.isForceRefreshing
                            }
                            backgroundColor={tc.primaryTint}
                            foregroundColor={tc.primaryText}
                            borderColor={tc.primaryBorder}
                            minHeight={36}
                            textClassName="font-nunito-semibold text-xs"
                            style={{ alignSelf: "stretch" }}
                          />
                        ) : null}
                        {stepSync.lastError ? (
                          <Text className="font-nunito text-xs text-dangerDark mt-1 text-right">
                            {stepSync.lastError}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {quest.actionPath ? (
                    <View
                      style={{
                        marginTop: 16,
                        borderRadius: 12,
                      }}
                    >
                      <QuestButton
                        label={actionLabel}
                        onPress={() => void openQuest(quest)}
                        backgroundColor={actionAppearance.backgroundColor}
                        foregroundColor={actionAppearance.foregroundColor}
                        borderColor={actionAppearance.borderColor}
                      />
                    </View>
                  ) : null}

                  {quest.completed && !quest.claimed ? (
                    <View
                      style={{
                        marginTop: 16,
                        borderRadius: 12,
                      }}
                    >
                      {isStepQuest(quest.type) &&
                      stepQuestUiState.claimSyncWarning ? (
                        <Text className="font-nunito-semibold text-xs text-dangerDark mb-2 text-center">
                          {stepQuestUiState.claimSyncWarning}
                        </Text>
                      ) : null}
                      <QuestButton
                        label={t("quests.claim")}
                        onPress={() =>
                          void claimQuestMutation.mutateAsync(quest)
                        }
                        loading={isClaimLoading}
                        leadingAccessory={FULL_WIDTH_CLAIM_BUTTON_ICON}
                        backgroundColor={tc.successDark}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {wordleGroupShareItems ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <View ref={wordleGroupShareRef} collapsable={false}>
            <GroupedQuestShareImage colors={tc}>
              {wordleGroupShareItems.map((item) => (
                <WordleQuestShareCard
                  key={item.language}
                  result={item.result}
                  colors={tc}
                  strings={item.strings}
                />
              ))}
            </GroupedQuestShareImage>
          </View>
        </View>
      ) : null}

      {dailyNumbersGroupShareItems ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <View ref={dailyNumbersGroupShareRef} collapsable={false}>
            <GroupedQuestShareImage colors={tc}>
              {dailyNumbersGroupShareItems.map((item) => (
                <DailyNumbersQuestShareCard
                  key={item.mode}
                  result={item.result}
                  colors={tc}
                  strings={item.strings}
                />
              ))}
            </GroupedQuestShareImage>
          </View>
        </View>
      ) : null}

      <Modal
        visible={showDescriptionFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDescriptionFor(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {showDescriptionFor
            ? (() => {
                const status = showDescriptionFor.status;
                const colors = STATUS_COLORS[status];

                return (
                  <View
                    style={{
                      backgroundColor: tc.surface,
                      borderRadius: 16,
                      borderWidth: 3,
                      borderColor: colors.border,
                      padding: 24,
                      gap: 12,
                    }}
                  >
                    <View
                      className="absolute rounded-full border-[3px] p-1"
                      style={{
                        backgroundColor: tc.surface,
                        borderColor: colors.border,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                        right: -10,
                        top: -10,
                      }}
                    >
                      <HelpCircleIcon
                        size={18}
                        color={colors.border}
                        noCircle
                      />
                    </View>
                    <Text
                      className="font-nunito-bold text-lg text-fg text-center"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: tc.accentBorder,
                        paddingBottom: 12,
                      }}
                    >
                      {showDescriptionFor.title}
                    </Text>
                    <Text className="font-nunito text-sm text-fgMuted">
                      {showDescriptionFor.description}
                    </Text>
                    <QuestButton
                      label={t("common.close")}
                      onPress={() => setShowDescriptionFor(null)}
                      backgroundColor={colors.iconColor}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                );
              })()
            : null}
        </View>
      </Modal>
    </View>
  );
}
