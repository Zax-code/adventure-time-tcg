import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  Alert,
  findNodeHandle,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

import type {
  DailyNumbersMode,
  DailyNumbersStateResponse,
  WordleLocale,
  WordleStateResponse,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import {
  DailyLoginQuestIcon,
  DailyNumbersQuestIcon,
  SpeedCalculusQuestIcon,
  SparklesIcon,
  StepQuestIcon,
  WordleQuestIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { ToastBanner } from "../../src/components/toast-banner";
import { DailyNumbersQuestShareCard } from "../../src/features/quests/daily-numbers/quest-share-card";
import type { DailyNumbersQuestShareCardStrings } from "../../src/features/quests/daily-numbers/quest-share-card";
import {
  buildDailyNumbersShareResult,
  type DailyNumbersShareResult,
} from "../../src/features/quests/daily-numbers/share-result";
import {
  formatDailyNumbersElapsedTime,
  getModeLabelKey,
} from "../../src/features/quests/daily-numbers/shared";
import { GroupedQuestShareImage } from "../../src/features/quests/grouped-quest-share-image";
import {
  QuestHubCard,
  QuestHubSummary,
  QuestLaunchSheet,
  QuestRecapSheet,
  QuestVariantChip,
  type QuestRecapAction,
  type QuestTone,
  type QuestVariantOption,
} from "../../src/features/quests/quest-hub-components";
import {
  buildQuestHubItems,
  claimQuestsSequentially,
  DAILY_NUMBERS_MODES,
  getDailyNumbersModeFromQuestType,
  getNextQuestHubItem,
  getQuestHubItemLifecycle,
  getQuestHubItemStats,
  getQuestHubSummary,
  getQuestLifecycle,
  getQuestProgressDisplay,
  getWordleLanguageFromQuestType,
  isDailyLoginQuest,
  isDailyNumbersQuest,
  isQuestShareable,
  isSpeedCalculusQuest,
  isStepQuest,
  isWordleQuest,
  WORDLE_LANGUAGES,
  type Quest,
  type QuestHubItem,
  type QuestLifecycle,
} from "../../src/features/quests/quest-hub-model";
import { QuestActionButton } from "../../src/features/quests/quest-action-button";
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

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type SharingGroup = "wordle" | "dailyNumbers";
type LauncherKind = "wordle" | "dailyNumbers";
type QuestIcon = ComponentType<{ size?: number; color?: string }>;
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;
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

let lastShownQuestResetToastAt = 0;

function getQuestTitle(titleKey: string, t: Translate) {
  const translated = t("quests." + titleKey);
  return translated.startsWith("quests.") ? titleKey : translated;
}

function getQuestDescription(descriptionKey: string, t: Translate) {
  const translated = t("quests." + descriptionKey);
  return translated.startsWith("quests.") ? descriptionKey : translated;
}

function formatProgress(progress: number, target: number) {
  if (target >= 10_000) {
    return (
      (progress / 1000).toFixed(1) + "k / " + (target / 1000).toFixed(0) + "k"
    );
  }

  return progress.toLocaleString() + " / " + target.toLocaleString();
}

function getLifecycleTone(
  lifecycle: QuestLifecycle,
  tc: ThemeColors,
): QuestTone {
  if (lifecycle === "ready") {
    return {
      border: tc.successBorder,
      iconBackground: tc.successTint,
      iconColor: tc.successDark,
      statusBackground: tc.successTint,
      statusText: tc.successText,
    };
  }

  if (lifecycle === "claimed") {
    return {
      border: tc.primaryBorder,
      iconBackground: tc.surfaceMuted,
      iconColor: tc.muted,
      statusBackground: tc.surfaceMuted,
      statusText: tc.fgMuted,
    };
  }

  if (lifecycle === "failed") {
    return {
      border: tc.dangerBorder,
      iconBackground: tc.dangerTint,
      iconColor: tc.dangerDark,
      statusBackground: tc.dangerTint,
      statusText: tc.dangerText,
    };
  }

  if (lifecycle === "in_progress") {
    return {
      border: tc.infoBorder,
      iconBackground: tc.infoTint,
      iconColor: tc.infoDark,
      statusBackground: tc.infoTint,
      statusText: tc.infoText,
    };
  }

  return {
    border: tc.primaryBorder,
    iconBackground: tc.primaryTint,
    iconColor: tc.primaryText,
    statusBackground: tc.primaryTint,
    statusText: tc.primaryText,
  };
}

function getLifecycleLabel(lifecycle: QuestLifecycle, t: Translate) {
  if (lifecycle === "ready") return t("quests.hub.rewardReady");
  if (lifecycle === "claimed") return t("quests.hub.claimed");
  if (lifecycle === "failed") return t("quests.hub.finished");
  if (lifecycle === "in_progress") return t("quests.hub.inProgress");
  return t("quests.hub.fresh");
}

function getQuestIcon(questType: string): QuestIcon {
  if (isStepQuest(questType)) return StepQuestIcon;
  if (isSpeedCalculusQuest(questType)) return SpeedCalculusQuestIcon;
  if (isDailyLoginQuest(questType)) return DailyLoginQuestIcon;
  if (isWordleQuest(questType)) return WordleQuestIcon;
  if (isDailyNumbersQuest(questType)) return DailyNumbersQuestIcon;
  return SparklesIcon;
}

function getItemIcon(item: QuestHubItem): QuestIcon {
  if (item.kind === "wordle") return WordleQuestIcon;
  if (item.kind === "dailyNumbers") return DailyNumbersQuestIcon;
  return getQuestIcon(item.quest.type);
}

function getItemTitle(item: QuestHubItem, t: Translate) {
  if (item.kind === "wordle") return t("quests.wordle.title");
  if (item.kind === "dailyNumbers") return t("quests.dailyNumbers.title");
  return getQuestTitle(item.quest.title, t);
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
  if (mode === "1-5") return "quests.dailyNumbers.shareMode1_5";
  if (mode === "2-4") return "quests.dailyNumbers.shareMode2_4";
  return "quests.dailyNumbers.shareMode3_3";
}

function getDailyNumbersModeShortLabel(mode: DailyNumbersMode, t: Translate) {
  if (mode === "1-5") return t("quests.dailyNumbers.oneFive");
  if (mode === "2-4") return t("quests.dailyNumbers.twoFour");
  return t("quests.dailyNumbers.threeThree");
}

function getDailyNumbersMixLabel(mode: DailyNumbersMode, t: Translate) {
  if (mode === "1-5") return t("quests.dailyNumbers.oneFiveMix");
  if (mode === "2-4") return t("quests.dailyNumbers.twoFourMix");
  return t("quests.dailyNumbers.threeThreeMix");
}

function getRewardAccessibilityLabel(amount: number, t: Translate) {
  return t("quests.hub.coinReward", { amount });
}

function getVariantStatusLabel(quest: Quest, t: Translate) {
  const lifecycle = getQuestLifecycle(quest);
  if (lifecycle === "in_progress" && isWordleQuest(quest.type)) {
    return t("quests.hub.wordleAttempts", {
      used: quest.attemptsUsed ?? 0,
      total: WORDLE_MAX_ATTEMPTS,
    });
  }

  if (lifecycle === "in_progress" && isSpeedCalculusQuest(quest.type)) {
    return t("quests.hub.speedRuns", {
      used: quest.runsUsed ?? quest.progress,
      total: quest.maxRuns ?? quest.target,
    });
  }

  return getLifecycleLabel(lifecycle, t);
}

function getItemDescription(item: QuestHubItem, t: Translate) {
  if (item.kind === "wordle") {
    return t("quests.hub.wordleCardDescription");
  }

  if (item.kind === "dailyNumbers") {
    return t("quests.hub.dailyNumbersCardDescription");
  }

  const quest = item.quest;
  if (isStepQuest(quest.type)) {
    return formatProgress(quest.progress, quest.target);
  }

  if (isSpeedCalculusQuest(quest.type)) {
    return t("quests.hub.speedSummary", {
      score: quest.latestScore ?? 0,
      used: quest.runsUsed ?? quest.progress,
      total: quest.maxRuns ?? quest.target,
    });
  }

  return getQuestDescription(quest.description, t);
}

function getItemProgress(item: QuestHubItem) {
  if (item.kind !== "single") {
    const stats = getQuestHubItemStats(item);
    return {
      label: stats.finishedCount + " / " + stats.totalCount,
      percentage:
        stats.totalCount === 0
          ? 0
          : (stats.finishedCount / stats.totalCount) * 100,
    };
  }

  const progress = getQuestProgressDisplay(item.quest);
  return {
    label: formatProgress(progress.progress, progress.target),
    percentage: progress.percentage,
  };
}

function getItemAccessibilitySummary(item: QuestHubItem, t: Translate) {
  if (item.kind === "wordle") {
    return WORDLE_LANGUAGES.flatMap((language) => {
      const quest = item.questsByLanguage[language];
      return quest
        ? [
            `${t(getWordleLanguageLabelKey(language))}: ${getVariantStatusLabel(quest, t)}`,
          ]
        : [];
    }).join(". ");
  }

  if (item.kind === "dailyNumbers") {
    return DAILY_NUMBERS_MODES.flatMap((mode) => {
      const quest = item.questsByMode[mode];
      return quest
        ? [
            `${getDailyNumbersModeShortLabel(mode, t)}: ${getVariantStatusLabel(quest, t)}`,
          ]
        : [];
    }).join(". ");
  }

  return `${t("quests.progress")}: ${getItemProgress(item).label}`;
}

function formatQuestShareDate(
  dateKey: string | null | undefined,
  locale: string,
) {
  if (!dateKey) return undefined;

  const parts = dateKey.split("-").map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return dateKey;

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
      ? "adventure-time-wordle-recap"
      : "adventure-time-numbers-recap",
  ];

  if (dateKey) parts.push(dateKey);

  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (slug || "adventure-time-quests") + ".png";
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function QuestsScreen() {
  return useQuestsScreenView();
}

function useQuestsScreenView() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const queryClient = useQueryClient();
  const patchUser = useSessionStore((state) => state.patchUser);
  const user = useSessionStore((state) => state.user);
  const stepSync = useStepSyncStore();
  const { locale, t } = useTranslation();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore(
    (state) => state.lastPayload,
  );

  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const stepCardRef = useRef<View>(null);
  const stepCardFocusRef = useRef<Text>(null);
  const wordleCardFocusRef = useRef<View>(null);
  const dailyNumbersCardFocusRef = useRef<View>(null);
  const summaryShareRef = useRef<View>(null);
  const claimLockRef = useRef(false);
  const shareLockRef = useRef(false);
  const pendingLauncherPathRef = useRef<string | null>(null);
  const launcherNavigationTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const sheetFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const handledStepFocusRef = useRef(false);
  const stepFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stepAccessibilityTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [highlightSteps, setHighlightSteps] = useState(focus === "steps");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isConnectingFitbit, setIsConnectingFitbit] = useState(false);
  const [stepQuestUiState, setStepQuestUiState] = useState({
    claimSyncWarning: null as string | null,
    isForceRefreshing: false,
  });
  const [activeLauncher, setActiveLauncher] = useState<LauncherKind | null>(
    null,
  );
  const [launcherSheetIndex, setLauncherSheetIndex] = useState(0);
  const [recapOpenSignature, setRecapOpenSignature] = useState<string | null>(
    null,
  );
  const [sharingGroup, setSharingGroup] = useState<SharingGroup | null>(null);
  const [wordleGroupShareItems, setWordleGroupShareItems] = useState<
    WordleGroupShareItem[] | null
  >(null);
  const [dailyNumbersGroupShareItems, setDailyNumbersGroupShareItems] =
    useState<DailyNumbersGroupShareItem[] | null>(null);
  const wordleGroupShareRef = useRef<View>(null);
  const dailyNumbersGroupShareRef = useRef<View>(null);
  const toastAnim = useSharedValue(-60);

  const focusStepQuest = useCallback(() => {
    setHighlightSteps(true);
    requestAnimationFrame(() => {
      stepCardRef.current?.measureInWindow((_x, y) => {
        const desiredTop = headerHeight + 12;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + y - desiredTop),
          animated: true,
        });
      });
    });

    if (stepAccessibilityTimeoutRef.current) {
      clearTimeout(stepAccessibilityTimeoutRef.current);
    }
    stepAccessibilityTimeoutRef.current = setTimeout(() => {
      const node = findNodeHandle(stepCardFocusRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 450);

    if (stepFocusTimeoutRef.current) {
      clearTimeout(stepFocusTimeoutRef.current);
    }
    stepFocusTimeoutRef.current = setTimeout(
      () => setHighlightSteps(false),
      3500,
    );
  }, [headerHeight]);

  useEffect(() => {
    if (!toast) return;

    toastAnim.value = -60;
    toastAnim.value = withTiming(0, { duration: 260 });
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

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

  const shareableQuestSignature =
    questsQueryData?.quests
      .reduce<string[]>((parts, quest) => {
        if (isQuestShareable(quest)) {
          parts.push(
            `${quest.id}:${quest.completed}:${quest.claimed}:${quest.failed}`,
          );
        }
        return parts;
      }, [])
      .join("|") ?? "";
  const recapSheetIndex =
    shareableQuestSignature && recapOpenSignature === shareableQuestSignature
      ? 1
      : 0;

  useFocusEffect(
    useCallback(() => {
      void questsQueryRefetch();
    }, [questsQueryRefetch]),
  );

  useEffect(() => {
    if (focus !== "steps") {
      handledStepFocusRef.current = false;
      return;
    }

    if (!questsQueryData || handledStepFocusRef.current) return;

    handledStepFocusRef.current = true;
    focusStepQuest();
    router.setParams({ focus: undefined });
  }, [focus, focusStepQuest, questsQueryData, router]);

  useEffect(
    () => () => {
      if (stepFocusTimeoutRef.current) {
        clearTimeout(stepFocusTimeoutRef.current);
      }
      if (stepAccessibilityTimeoutRef.current) {
        clearTimeout(stepAccessibilityTimeoutRef.current);
      }
      if (launcherNavigationTimeoutRef.current) {
        clearTimeout(launcherNavigationTimeoutRef.current);
      }
      if (sheetFocusTimeoutRef.current) {
        clearTimeout(sheetFocusTimeoutRef.current);
      }
    },
    [],
  );

  const showFitbitConnectCta =
    user?.preferredStepSource === "fitbit" && !questsQueryData?.fitbitConnected;
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
      const result = await connectFitbit("/quests?focus=steps");
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

  const claimQuestReward = useCallback(
    async (quest: Quest) => {
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
          return apiClient.claimQuest({ questId: firstServerStepQuest.id });
        }

        const secondServerStepQuest = await syncThenGetServerStepQuest();
        if (
          secondServerStepQuest?.completed ||
          secondServerStepQuest?.claimed
        ) {
          return apiClient.claimQuest({ questId: secondServerStepQuest.id });
        }

        throw new Error("STEP_CLAIM_SYNC_PENDING");
      }

      return apiClient.claimQuest({ questId: quest.id });
    },
    [user?.preferredStepSource],
  );

  const claimQuestMutation = useMutation({
    mutationFn: claimQuestReward,
    onMutate: (quest) => {
      if (isStepQuest(quest.type)) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: null,
        }));
      }
    },
    onSuccess: async (data, quest) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      await patchUser({ coins: data.newBalance });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast({
        message: t("quests.claimSuccess", { amount: quest.reward }),
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
    onSettled: () => {
      claimLockRef.current = false;
    },
  });

  const claimAllMutation = useMutation({
    mutationFn: async (quests: Quest[]) => {
      const result = await claimQuestsSequentially(quests, claimQuestReward);

      if (result.claimedCount === 0) {
        const stepFailure = result.failures.find(({ quest }) =>
          isStepQuest(quest.type),
        );
        throw stepFailure?.error ?? new Error("CLAIM_ALL_FAILED");
      }
      return result;
    },
    onSuccess: async (result) => {
      if (result.newBalance != null) {
        await patchUser({ coins: result.newBalance });
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const stepSyncFailure = result.failures.some(
        ({ quest, error }) =>
          isStepQuest(quest.type) &&
          error instanceof Error &&
          error.message === "STEP_CLAIM_SYNC_PENDING",
      );
      if (stepSyncFailure) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: t("quests.stepClaimSyncPending"),
        }));
      }
      setToast({
        message: stepSyncFailure
          ? t("quests.stepClaimSyncPending")
          : result.failedCount > 0
            ? t("quests.hub.claimPartial", {
                claimed: result.claimedCount,
                total: result.requestedCount,
              })
            : t("quests.claimSuccess", { amount: result.claimedReward }),
        type: result.failedCount > 0 ? "error" : "success",
      });
    },
    onError: (error) => {
      const isStepSyncPending =
        error instanceof Error && error.message === "STEP_CLAIM_SYNC_PENDING";
      if (isStepSyncPending) {
        setStepQuestUiState((state) => ({
          ...state,
          claimSyncWarning: t("quests.stepClaimSyncPending"),
        }));
      }
      setToast({
        message: isStepSyncPending
          ? t("quests.stepClaimSyncPending")
          : t("quests.claimFailed"),
        type: "error",
      });
    },
    onSettled: async () => {
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["quests"] }),
          queryClient.invalidateQueries({ queryKey: ["home"] }),
        ]);
      } finally {
        claimLockRef.current = false;
      }
    },
  });

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
        throw new Error("Quest recap image was not ready.");
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
        if (destination.exists) destination.delete();
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename quest recap image", copyError);
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
      if (shareLockRef.current || sharingGroup) return;
      shareLockRef.current = true;

      const availableLanguages = WORDLE_LANGUAGES.filter((language) => {
        const quest = quests[language];
        return quest ? isQuestShareable(quest) : false;
      });
      if (availableLanguages.length === 0) {
        shareLockRef.current = false;
        return;
      }

      setSharingGroup("wordle");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const [canShare, states] = await Promise.all([
          Sharing.isAvailableAsync(),
          Promise.all(
            availableLanguages.map(async (language) => {
              const state = await apiClient.wordleState(language);
              queryClient.setQueryData(["wordle", language], state);
              return state;
            }),
          ),
        ]);

        if (!canShare) {
          Alert.alert(t("quests.shareAllUnavailable"));
          return;
        }

        let dateKey: string | undefined;
        const items = states.map((state: WordleStateResponse, index) => {
          const language = availableLanguages[index];
          if (!state.solved && state.guesses.length < WORDLE_MAX_ATTEMPTS) {
            throw new Error("Wordle share state is not terminal");
          }

          const solved = state.solved;
          dateKey = dateKey ?? state.date;

          return {
            language,
            result: buildWordleShareResult({
              questTitle: t("quests.wordle.title"),
              date: state.date,
              wordLocale: language,
              solved,
              maxAttempts: WORDLE_MAX_ATTEMPTS,
              wordLength: WORDLE_WORD_LENGTH,
              evaluations: state.guesses.map((guess) => guess.evaluation),
            }),
            strings: {
              brand: t("quests.wordle.shareBrand"),
              footer: t("quests.wordle.shareFooter"),
              date: formatQuestShareDate(state.date, locale),
              wordLanguage: t(getWordleShareLanguageLabelKey(language)),
              resultLine: solved
                ? t("quests.wordle.shareSolved", {
                    used: state.guesses.length,
                    total: WORDLE_MAX_ATTEMPTS,
                  })
                : t("quests.wordle.shareFailed", {
                    used: state.guesses.length,
                    total: WORDLE_MAX_ATTEMPTS,
                  }),
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
        console.warn("Failed to share Wordle recap", error);
        Alert.alert(t("quests.shareAllError"));
      } finally {
        shareLockRef.current = false;
        setWordleGroupShareItems(null);
        setSharingGroup(null);
      }
    },
    [locale, queryClient, shareCapturedGroupImage, sharingGroup, t],
  );

  const handleShareDailyNumbersGroup = useCallback(
    async (quests: Partial<Record<DailyNumbersMode, Quest>>) => {
      if (shareLockRef.current || sharingGroup) return;
      shareLockRef.current = true;

      const availableModes = DAILY_NUMBERS_MODES.filter((mode) => {
        const quest = quests[mode];
        return quest ? isQuestShareable(quest) : false;
      });
      if (availableModes.length === 0) {
        shareLockRef.current = false;
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
          const completed = Boolean(
            state.completed ||
            submission?.completed ||
            quest?.completed ||
            quest?.claimed,
          );
          dateKey = dateKey ?? state.date;

          const resultLine = exact
            ? t("quests.dailyNumbers.shareExact", {
                score: score ?? 100,
              })
            : completed
              ? t("quests.dailyNumbers.shareScore", {
                  score: score ?? 0,
                  distance: distance ?? 0,
                })
              : t("quests.dailyNumbers.shareMissed", {
                  distance: distance ?? 0,
                });

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
              completed,
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
        console.warn("Failed to share Daily Numbers recap", error);
        Alert.alert(t("quests.shareAllError"));
      } finally {
        shareLockRef.current = false;
        setDailyNumbersGroupShareItems(null);
        setSharingGroup(null);
      }
    },
    [locale, queryClient, shareCapturedGroupImage, sharingGroup, t],
  );

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
  const hubItems = buildQuestHubItems(displayedQuests.quests);
  const summary = getQuestHubSummary(displayedQuests.quests);
  const nextItem = getNextQuestHubItem(hubItems);
  const activeItems = hubItems.filter((item) => {
    const lifecycle = getQuestHubItemLifecycle(item);
    return lifecycle !== "claimed" && lifecycle !== "failed";
  });
  const finishedItems = hubItems.filter((item) => {
    const lifecycle = getQuestHubItemLifecycle(item);
    return lifecycle === "claimed" || lifecycle === "failed";
  });
  const wordleItem = hubItems.find((item) => item.kind === "wordle");
  const dailyNumbersItem = hubItems.find(
    (item) => item.kind === "dailyNumbers",
  );
  const unfinishedStepItem = hubItems.find(
    (item) =>
      item.kind === "single" &&
      isStepQuest(item.quest.type) &&
      (getQuestLifecycle(item.quest) === "fresh" ||
        getQuestLifecycle(item.quest) === "in_progress"),
  );
  const claimInFlight =
    claimQuestMutation.isPending || claimAllMutation.isPending;

  const claimQuestFromHub = (quest: Quest) => {
    if (claimLockRef.current || claimInFlight) return;
    claimLockRef.current = true;
    claimQuestMutation.mutate(quest);
  };

  const openLauncher = (kind: LauncherKind) => {
    pendingLauncherPathRef.current = null;
    setLauncherSheetIndex(1);
    setActiveLauncher(kind);
  };

  const requestLauncherNavigation = (path: string) => {
    if (pendingLauncherPathRef.current) return;
    pendingLauncherPathRef.current = path;
    setLauncherSheetIndex(0);
  };

  const dismissLauncher = () => {
    const destination = pendingLauncherPathRef.current;
    const returnTarget =
      activeLauncher === "wordle"
        ? wordleCardFocusRef.current
        : dailyNumbersCardFocusRef.current;

    pendingLauncherPathRef.current = null;
    setLauncherSheetIndex(0);
    setActiveLauncher(null);

    if (destination) {
      launcherNavigationTimeoutRef.current = setTimeout(() => {
        router.push(destination as never);
      }, 80);
      return;
    }

    sheetFocusTimeoutRef.current = setTimeout(() => {
      const node = findNodeHandle(returnTarget);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 180);
  };

  const dismissRecap = () => {
    const returnTarget = summaryShareRef.current;
    setRecapOpenSignature(null);
    sheetFocusTimeoutRef.current = setTimeout(() => {
      const node = findNodeHandle(returnTarget);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 180);
  };

  const openHubItem = (item: QuestHubItem) => {
    if (claimLockRef.current || claimInFlight) return;
    void Haptics.selectionAsync();
    if (item.kind === "wordle") {
      openLauncher("wordle");
      return;
    }
    if (item.kind === "dailyNumbers") {
      openLauncher("dailyNumbers");
      return;
    }
    if (item.quest.actionPath) {
      router.push(item.quest.actionPath as never);
    }
  };

  const nextItemTitle = nextItem ? getItemTitle(nextItem, t) : "";
  const nextItemIsSpeed =
    nextItem?.kind === "single" && isSpeedCalculusQuest(nextItem.quest.type);
  const hasPrimaryAction =
    summary.claimableQuests.length > 0 ||
    nextItem != null ||
    unfinishedStepItem != null;
  const primaryActionLabel =
    summary.claimableQuests.length > 0
      ? t("quests.hub.claimReady", { amount: summary.readyReward })
      : nextItem
        ? nextItemIsSpeed
          ? t("quests.hub.openQuest", { quest: nextItemTitle })
          : getQuestHubItemLifecycle(nextItem) === "in_progress"
            ? t("quests.hub.continueQuest", { quest: nextItemTitle })
            : t("quests.hub.startQuest", { quest: nextItemTitle })
        : unfinishedStepItem
          ? t("quests.hub.viewStepProgress")
          : summary.finishedCount < summary.totalCount
            ? t("quests.hub.keepGoing")
            : t("quests.hub.allDone");

  const handlePrimaryAction = () => {
    if (claimLockRef.current || claimInFlight) return;
    if (summary.claimableQuests.length > 0) {
      if (claimLockRef.current) return;
      claimLockRef.current = true;
      claimAllMutation.mutate(summary.claimableQuests);
      return;
    }
    if (nextItem) {
      const inProgressQuests = nextItem.quests.filter(
        (quest) => getQuestLifecycle(quest) === "in_progress",
      );
      if (inProgressQuests.length === 1 && inProgressQuests[0]?.actionPath) {
        router.push(inProgressQuests[0].actionPath as never);
        return;
      }
      openHubItem(nextItem);
      return;
    }
    if (unfinishedStepItem) focusStepQuest();
  };

  const buildWordleOptions = (): QuestVariantOption[] => {
    if (!wordleItem || wordleItem.kind !== "wordle") return [];

    return WORDLE_LANGUAGES.flatMap((language) => {
      const quest = wordleItem.questsByLanguage[language];
      if (!quest) return [];
      const lifecycle = getQuestLifecycle(quest);
      const attemptsUsed = quest.attemptsUsed ?? 0;
      const meta =
        lifecycle === "ready" || lifecycle === "claimed"
          ? t("quests.hub.wordleSolvedMeta", {
              used: attemptsUsed,
              total: WORDLE_MAX_ATTEMPTS,
            })
          : lifecycle === "failed"
            ? t("quests.hub.wordleFailedMeta", {
                used: attemptsUsed,
                total: WORDLE_MAX_ATTEMPTS,
              })
            : lifecycle === "in_progress"
              ? t("quests.hub.wordleAttempts", {
                  used: attemptsUsed,
                  total: WORDLE_MAX_ATTEMPTS,
                })
              : t("quests.hub.wordleOption");
      return [
        {
          id: language,
          label: t(getWordleLanguageLabelKey(language)),
          meta,
          onPress: () => {
            requestLauncherNavigation("/quests/wordle?language=" + language);
          },
          reward: quest.reward,
          rewardAccessibilityLabel: getRewardAccessibilityLabel(
            quest.reward,
            t,
          ),
          statusLabel: getVariantStatusLabel(quest, t),
          lifecycle,
          testID: "quests-wordle-option-" + language,
        },
      ];
    });
  };

  const buildDailyNumbersOptions = (): QuestVariantOption[] => {
    if (!dailyNumbersItem || dailyNumbersItem.kind !== "dailyNumbers") {
      return [];
    }

    return DAILY_NUMBERS_MODES.flatMap((mode) => {
      const quest = dailyNumbersItem.questsByMode[mode];
      if (!quest) return [];
      const lifecycle = getQuestLifecycle(quest);
      const resultMeta =
        quest.score != null
          ? t("quests.hub.dailyNumbersScore", { score: quest.score })
          : getDailyNumbersMixLabel(mode, t);
      return [
        {
          id: mode,
          label: t(getModeLabelKey(mode)),
          meta: resultMeta,
          onPress: () => {
            requestLauncherNavigation(
              "/quests/daily-numbers-play?mode=" + mode,
            );
          },
          reward: quest.reward,
          rewardAccessibilityLabel: getRewardAccessibilityLabel(
            quest.reward,
            t,
          ),
          statusLabel: getVariantStatusLabel(quest, t),
          lifecycle,
          testID: "quests-daily-numbers-option-" + mode,
        },
      ];
    });
  };

  const recapActions: QuestRecapAction[] = [];
  if (
    wordleItem &&
    wordleItem.kind === "wordle" &&
    wordleItem.quests.some(isQuestShareable)
  ) {
    const count = wordleItem.quests.filter(isQuestShareable).length;
    recapActions.push({
      id: "wordle",
      title: t("quests.wordle.title"),
      detail: t("quests.hub.resultsReady", { count }),
      buttonLabel: t("quests.hub.shareWordle"),
      icon: WordleQuestIcon,
      isLoading: sharingGroup === "wordle",
      onPress: () => {
        void handleShareWordleGroup(wordleItem.questsByLanguage);
      },
      testID: "quests-share-wordle",
    });
  }
  if (
    dailyNumbersItem &&
    dailyNumbersItem.kind === "dailyNumbers" &&
    dailyNumbersItem.quests.some(isQuestShareable)
  ) {
    const count = dailyNumbersItem.quests.filter(isQuestShareable).length;
    recapActions.push({
      id: "dailyNumbers",
      title: t("quests.dailyNumbers.title"),
      detail: t("quests.hub.resultsReady", { count }),
      buttonLabel: t("quests.hub.shareDailyNumbers"),
      icon: DailyNumbersQuestIcon,
      isLoading: sharingGroup === "dailyNumbers",
      onPress: () => {
        void handleShareDailyNumbersGroup(dailyNumbersItem.questsByMode);
      },
      testID: "quests-share-daily-numbers",
    });
  }

  const renderVariants = (item: QuestHubItem) => {
    if (item.kind === "wordle") {
      return WORDLE_LANGUAGES.map((language) => {
        const quest = item.questsByLanguage[language];
        if (!quest) return null;
        const lifecycle = getQuestLifecycle(quest);
        return (
          <QuestVariantChip
            key={language}
            label={
              t(getWordleLanguageLabelKey(language)) +
              " · " +
              getVariantStatusLabel(quest, t)
            }
            tone={getLifecycleTone(lifecycle, tc)}
          />
        );
      });
    }

    if (item.kind === "dailyNumbers") {
      return DAILY_NUMBERS_MODES.map((mode) => {
        const quest = item.questsByMode[mode];
        if (!quest) return null;
        const lifecycle = getQuestLifecycle(quest);
        return (
          <QuestVariantChip
            key={mode}
            label={
              getDailyNumbersModeShortLabel(mode, t) +
              " · " +
              getVariantStatusLabel(quest, t)
            }
            tone={getLifecycleTone(lifecycle, tc)}
          />
        );
      });
    }

    return null;
  };

  const renderQuestCard = (item: QuestHubItem, index: number) => {
    const lifecycle = getQuestHubItemLifecycle(item);
    const stats = getQuestHubItemStats(item);
    const progress = getItemProgress(item);
    const potentialReward = item.quests
      .filter((quest) => {
        const questLifecycle = getQuestLifecycle(quest);
        return questLifecycle === "fresh" || questLifecycle === "in_progress";
      })
      .reduce((total, quest) => total + quest.reward, 0);
    const displayedReward =
      lifecycle === "ready"
        ? stats.readyReward
        : lifecycle === "fresh" || lifecycle === "in_progress"
          ? potentialReward
          : undefined;
    const isStep = item.kind === "single" && isStepQuest(item.quest.type);
    const isSpeed =
      item.kind === "single" && isSpeedCalculusQuest(item.quest.type);
    const stepLoading =
      stepSync.isSyncing || stepQuestUiState.isForceRefreshing;
    const isClaimLoading =
      item.kind === "single" &&
      claimQuestMutation.isPending &&
      claimQuestMutation.variables?.id === item.quest.id;
    const claimButton =
      item.kind === "single" && item.quest.completed && !item.quest.claimed ? (
        <QuestActionButton
          label={t("quests.hub.claimReady", { amount: item.quest.reward })}
          onPress={() => {
            claimQuestFromHub(item.quest);
          }}
          disabled={claimInFlight && !isClaimLoading}
          loading={isClaimLoading}
          loadingMode="inline"
          backgroundColor={tc.successTint}
          foregroundColor={tc.successText}
          borderColor={tc.successBorder}
          minHeight={46}
          testID={isStep ? "quests-step-claim" : "quests-passive-claim"}
        />
      ) : null;
    const stepFooter = isStep ? (
      <View className="gap-2">
        {showStepQuestActivationPrompt ? (
          <Text className="font-nunito-semibold text-sm text-primaryText">
            {stepSync.availability === "setup_required"
              ? t("quests.stepSyncPromptSetupBody", {
                  healthSystem: healthSystemLabel,
                })
              : t("quests.stepSyncPromptBody", {
                  healthSystem: healthSystemLabel,
                })}
          </Text>
        ) : null}
        {stepSync.lastError || stepQuestUiState.claimSyncWarning ? (
          <Text
            accessibilityRole="alert"
            className="font-nunito-semibold text-sm text-dangerText"
          >
            {stepQuestUiState.claimSyncWarning ?? t("quests.hub.stepSyncIssue")}
          </Text>
        ) : null}
        {lifecycle === "fresh" || lifecycle === "in_progress" ? (
          <QuestActionButton
            label={
              stepLoading
                ? t("settings.syncing")
                : showStepQuestActivationPrompt
                  ? stepActionLabel
                  : t("settings.syncNow")
            }
            onPress={() => {
              if (showStepQuestActivationPrompt) {
                void handleStepAction();
              } else {
                void handleForceRefresh();
              }
            }}
            disabled={stepLoading || claimInFlight}
            loading={stepLoading}
            loadingMode="inline"
            backgroundColor={tc.surface}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            minHeight={44}
            testID="quests-step-sync"
          />
        ) : null}
        {claimButton}
      </View>
    ) : null;
    const passiveClaimFooter =
      item.kind === "single" && !item.quest.actionPath && !isStep
        ? claimButton
        : null;

    return (
      <QuestHubCard
        key={item.id}
        actionFocusRef={
          item.kind === "wordle"
            ? wordleCardFocusRef
            : item.kind === "dailyNumbers"
              ? dailyNumbersCardFocusRef
              : undefined
        }
        accessibilityHint={
          item.kind === "single"
            ? t("quests.hub.openQuestHint")
            : t("quests.hub.chooseVariantHint")
        }
        accessibilitySummary={getItemAccessibilitySummary(item, t)}
        description={getItemDescription(item, t)}
        cardRef={isStep ? stepCardRef : undefined}
        disabled={claimInFlight}
        footer={stepFooter ?? passiveClaimFooter}
        titleFocusRef={isStep ? stepCardFocusRef : undefined}
        highlighted={isStep && highlightSteps}
        icon={getItemIcon(item)}
        index={index}
        lifecycle={lifecycle}
        onPress={
          isStep
            ? undefined
            : item.kind !== "single" || item.quest.actionPath
              ? () => openHubItem(item)
              : undefined
        }
        progressLabel={progress.label}
        progressPercentage={progress.percentage}
        reward={displayedReward}
        rewardAccessibilityLabel={getRewardAccessibilityLabel(
          displayedReward ?? 0,
          t,
        )}
        statusLabel={
          isSpeed && (lifecycle === "fresh" || lifecycle === "in_progress")
            ? t("quests.hub.openToPlay")
            : getLifecycleLabel(lifecycle, t)
        }
        tc={tc}
        testID={
          item.kind === "single"
            ? "quests-card-" + item.quest.type
            : "quests-card-" + item.id
        }
        title={getItemTitle(item, t)}
        tone={getLifecycleTone(lifecycle, tc)}
        variants={renderVariants(item)}
      />
    );
  };

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
        ref={scrollRef}
        className="flex-1"
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: 28,
          paddingHorizontal: 16,
        }}
        contentInset={{ bottom: bottomTabPadding }}
        scrollIndicatorInsets={{ bottom: bottomTabPadding }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: headerHeight + 12 }}>
          <View className="mb-5">
            <Text
              accessibilityRole="header"
              className="font-nunito-extrabold text-[28px] text-fg"
            >
              {t("quests.title")}
            </Text>
            <Text className="mt-1 font-nunito-semibold text-sm text-fgMuted">
              {t("quests.hub.subtitle")}
            </Text>
          </View>

          {displayedQuests.quests.length > 0 ? (
            <QuestHubSummary
              actionDisabled={claimInFlight}
              actionLabel={primaryActionLabel}
              actionLoading={claimAllMutation.isPending}
              claimMode={summary.claimableQuests.length > 0}
              finishedCount={summary.finishedCount}
              onAction={hasPrimaryAction ? handlePrimaryAction : undefined}
              onShare={
                recapActions.length > 0
                  ? () => setRecapOpenSignature(shareableQuestSignature)
                  : undefined
              }
              readyReward={summary.readyReward}
              rewardAccessibilityLabel={getRewardAccessibilityLabel(
                summary.readyReward,
                t,
              )}
              shareLabel={t("quests.hub.share")}
              shareRef={summaryShareRef}
              subtitle={t("quests.hub.finishedToday")}
              tc={tc}
              title={t("quests.hub.todayAdventure")}
              totalCount={summary.totalCount}
            />
          ) : null}

          {showFitbitConnectCta ? (
            <View
              className="mt-4 rounded-[22px] border border-successBorder bg-successTint p-4"
              testID="quests-fitbit-connect"
            >
              <View className="flex-row items-start gap-3">
                <StepQuestIcon size={30} color={tc.successDark} />
                <View className="min-w-0 flex-1">
                  <Text className="font-nunito-extrabold text-base text-successText">
                    {t("settings.connectFitbit")}
                  </Text>
                  <Text className="mt-1 font-nunito-semibold text-sm text-successText">
                    {t("quests.connectFitbitDesc")}
                  </Text>
                </View>
              </View>
              <QuestActionButton
                label={
                  isConnectingFitbit
                    ? t("settings.connectingFitbit")
                    : t("settings.connectFitbit")
                }
                onPress={() => {
                  void handleConnectFitbit();
                }}
                disabled={isConnectingFitbit}
                loading={isConnectingFitbit}
                loadingMode="inline"
                backgroundColor={tc.successDark}
                minHeight={46}
                style={{ marginTop: 12 }}
              />
            </View>
          ) : null}

          {displayedQuests.quests.length === 0 ? (
            <View className="mt-5 items-center rounded-[24px] border border-primaryBorder bg-surfaceMuted p-8">
              <SparklesIcon size={46} color={tc.primaryBorder} />
              <Text className="mt-4 text-center font-nunito-extrabold text-base text-fg">
                {t("quests.noQuests")}
              </Text>
              <Text className="mt-1 text-center font-nunito text-sm text-fgMuted">
                {t("quests.checkBackLater")}
              </Text>
            </View>
          ) : (
            <>
              {activeItems.length > 0 ? (
                <>
                  <View className="mb-3 mt-6">
                    <View>
                      <Text
                        accessibilityRole="header"
                        className="font-nunito-extrabold text-xl text-fg"
                      >
                        {t("quests.hub.upNext")}
                      </Text>
                      <Text className="mt-0.5 font-nunito-semibold text-sm text-fgMuted">
                        {t("quests.hub.upNextSubtitle")}
                      </Text>
                    </View>
                  </View>
                  <View className="gap-3">
                    {activeItems.map((item, index) =>
                      renderQuestCard(item, index),
                    )}
                  </View>
                </>
              ) : null}

              {finishedItems.length > 0 ? (
                <>
                  <View className="mb-3 mt-7">
                    <Text
                      accessibilityRole="header"
                      className="font-nunito-extrabold text-xl text-fg"
                    >
                      {t("quests.hub.finishedSection")}
                    </Text>
                    <Text className="mt-0.5 font-nunito-semibold text-sm text-fgMuted">
                      {t("quests.hub.finishedSectionSubtitle")}
                    </Text>
                  </View>
                  <View className="gap-3">
                    {finishedItems.map((item, index) =>
                      renderQuestCard(item, activeItems.length + index),
                    )}
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {activeLauncher === "wordle" ? (
        <QuestLaunchSheet
          index={launcherSheetIndex}
          onDismiss={dismissLauncher}
          onIndexChange={setLauncherSheetIndex}
          options={buildWordleOptions()}
          subtitle={t("quests.hub.wordleLauncherSubtitle")}
          tc={tc}
          title={t("quests.hub.wordleLauncherTitle")}
        />
      ) : null}

      {activeLauncher === "dailyNumbers" ? (
        <QuestLaunchSheet
          historyAction={{
            label: t("quests.dailyNumbers.historyAction"),
            onPress: () => {
              requestLauncherNavigation("/quests/daily-numbers-history");
            },
            testID: "quests-daily-numbers-history",
          }}
          index={launcherSheetIndex}
          onDismiss={dismissLauncher}
          onIndexChange={setLauncherSheetIndex}
          options={buildDailyNumbersOptions()}
          subtitle={t("quests.hub.dailyNumbersLauncherSubtitle")}
          tc={tc}
          title={t("quests.hub.dailyNumbersLauncherTitle")}
        />
      ) : null}

      {recapActions.length > 0 ? (
        <QuestRecapSheet
          actions={recapActions}
          index={recapSheetIndex}
          onDismiss={dismissRecap}
          onIndexChange={(index) => {
            setRecapOpenSignature(index > 0 ? shareableQuestSignature : null);
          }}
          subtitle={t("quests.hub.recapSubtitle")}
          tc={tc}
          title={t("quests.hub.recapTitle")}
        />
      ) : null}

      {wordleGroupShareItems ? (
        <View
          accessibilityElementsHidden
          pointerEvents="none"
          collapsable={false}
          importantForAccessibility="no-hide-descendants"
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
          accessibilityElementsHidden
          pointerEvents="none"
          collapsable={false}
          importantForAccessibility="no-hide-descendants"
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
    </View>
  );
}
