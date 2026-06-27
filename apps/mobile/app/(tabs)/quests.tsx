import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  SpeedCalculusQuestIcon,
  SparklesIcon,
  StepQuestIcon,
  WordleQuestIcon,
  XCircleIcon,
} from "../../src/components/icons";
import { PrimaryButton } from "../../src/components/button";
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

type QuestStatus = "active" | "completed" | "claimed" | "failed";
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
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (status === "claimed") return tc.muted;
  if (status === "completed") return tc.successDark;
  if (status === "failed") return tc.dangerDark;
  return tc.accentStrong;
}

function getMetaColor(
  status: QuestStatus,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (status === "claimed") return tc.muted;
  if (status === "completed") return tc.successDark;
  return tc.primaryStrong;
}

const WORDLE_LANGUAGES: WordleLocale[] = ["fr", "en"];

function isWordleQuest(questType: string) {
  return questType === "wordle_daily_fr" || questType === "wordle_daily_en";
}

function getWordleLanguageFromQuestType(questType: string): WordleLocale | null {
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

function renderActiveQuestIcon(
  questType: string,
  size: number,
  color: string,
) {
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
  if (quest.claimed) {
    return t("quests.dailyNumbers.claimedLabel");
  }

  if (quest.completed) {
    return t("quests.dailyNumbers.completedLabel");
  }

  if (quest.score != null) {
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
  const toastAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.setValue(-60);
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
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
      gradStart: string;
      gradEnd: string;
    }
  > = {
    active: {
      border: tc.primaryBorder,
      iconBg: tc.primaryTint,
      iconColor: tc.primaryText,
      gradStart: tc.primary,
      gradEnd: tc.primaryDark,
    },
    completed: {
      border: tc.successBorder,
      iconBg: tc.successTint,
      iconColor: tc.successDark,
      gradStart: tc.success,
      gradEnd: tc.successDark,
    },
    claimed: {
      border: tc.muted,
      iconBg: tc.surfaceMuted,
      iconColor: tc.muted,
      gradStart: tc.muted,
      gradEnd: tc.muted,
    },
    failed: {
      border: tc.dangerBorder,
      iconBg: tc.dangerTint,
      iconColor: tc.dangerDark,
      gradStart: tc.danger,
      gradEnd: tc.dangerDark,
    },
  };

  const questsQuery = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
    refetchInterval: 30_000,
  });
  const showFitbitConnectCta =
    user?.preferredStepSource === "fitbit" &&
    !questsQuery.data?.fitbitConnected;

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
      await questsQuery.refetch();
    } finally {
      setStepQuestUiState((state) => ({
        ...state,
        isForceRefreshing: false,
      }));
    }
  }, [questsQuery]);

  const handleConnectFitbit = useCallback(async () => {
    setIsConnectingFitbit(true);

    try {
      const result = await connectFitbit("/quests");

      await questsQuery.refetch();

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
  }, [questsQuery, t]);

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
          const completed = Boolean(
            quest?.completed ||
              quest?.claimed ||
              state.completed ||
              submission?.completed,
          );
          const distance = submission?.distance ?? quest?.distance ?? null;
          const score = submission?.score ?? quest?.score ?? null;
          const finalValue = submission?.finalValue ?? quest?.finalValue ?? null;
          const elapsedMs = submission?.elapsedMs ?? quest?.elapsedMs ?? 0;
          const exact = distance === 0 && finalValue != null;
          dateKey = dateKey ?? state.date;

          let resultLine = t("quests.shareNotCompleted");
          if (completed) {
            resultLine = exact
              ? t("quests.dailyNumbers.shareExact", {
                  score: score ?? 100,
                })
              : t("quests.dailyNumbers.shareScore", {
                  score: score ?? 0,
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
              completed,
            }),
            strings: {
              brand: t("quests.dailyNumbers.shareBrand"),
              modeLabel: t(getDailyNumbersShareModeLabelKey(mode)),
              resultLine,
              targetLabel: t("quests.dailyNumbers.target"),
              resultValueLabel: t(
                "quests.dailyNumbers.shareResultValueLabel",
              ),
              timeLabel: t("quests.dailyNumbers.solveTime"),
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
      void questsQuery.refetch();
    }, [questsQuery]),
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
          return serverQuests.quests.find((entry) =>
            isStepQuest(entry.type),
          );
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

  if (questsQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("nav.quests")}
        message={t("common.loadingStates.pageBody")}
        icon="trophy"
      />
    );
  }

  if (questsQuery.isError || !questsQuery.data) {
    return (
      <PageErrorState
        error={questsQuery.error}
        title={questsQuery.error ? undefined : t("quests.unavailable")}
        body={
          questsQuery.error ? undefined : t("common.errorStates.generic.body")
        }
        detail={
          questsQuery.error ? undefined : t("common.errorStates.generic.detail")
        }
        onRetry={() => {
          void questsQuery.refetch();
        }}
      />
    );
  }

  const displayedQuests =
    applyLocalStepProgressToQuests(questsQuery.data, user) ?? questsQuery.data;
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
          paddingBottom: bottomTabPadding,
          paddingHorizontal: 16,
        }}
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
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
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
                  <View
                    style={{
                      marginTop: 12,
                      alignSelf: "flex-start",
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 4,
                      borderRadius: 8,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        void handleConnectFitbit();
                      }}
                      style={{ borderRadius: 8, overflow: "hidden" }}
                    >
                      <LinearGradient
                        colors={[tc.success, tc.successDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                      >
                        <Text className="font-nunito text-white text-sm">
                          {isConnectingFitbit
                            ? t("settings.connectingFitbit")
                            : t("settings.connectFitbit")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {questsQuery.data.quests.length === 0 ? (
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
                  <TouchableOpacity
                    className="mt-4"
                    onPress={() => {
                      void handleConnectFitbit();
                    }}
                    disabled={isConnectingFitbit}
                  >
                    <Text className="font-nunito-bold text-primaryText">
                      {isConnectingFitbit
                        ? t("settings.connectingFitbit")
                        : t("settings.connectFitbit")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            questCardItems.map((item, index) => {
              if (item.kind === "wordle") {
                const groupStatus = getWordleGroupStatus(item.quests);
                const colors = STATUS_COLORS[groupStatus];
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
                  (sum, language) =>
                    sum + (item.quests[language]?.reward ?? 0),
                  0,
                );
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
                      opacity: groupStatus === "claimed" ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      marginBottom:
                        index === questCardItems.length - 1 ? 0 : 12,
                    }}
                  >
                    <TouchableOpacity
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
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        setCollapsedGroups((groups) => ({
                          ...groups,
                          wordle: !groups.wordle,
                        }))
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 16,
                        paddingRight: 24,
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

                      <View style={{ flex: 1 }}>
                        <Text className="font-nunito-bold text-base text-fg">
                          {t("quests.wordle.title")}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <View className="flex-row items-center gap-1">
                          <CoinIcon size={18} />
                          <Text
                            style={{ color: tc.secondaryDark }}
                            className="font-nunito-bold text-base"
                          >
                            {totalReward}
                          </Text>
                        </View>
                        {collapsedGroups.wordle ? (
                          <ChevronRightIcon size={20} color={tc.muted} />
                        ) : (
                          <ChevronDownIcon size={20} color={tc.muted} />
                        )}
                      </View>
                    </TouchableOpacity>

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

                    {collapsedGroups.wordle ? null : (
                      <View className="mt-4 gap-3">
                        <View className="flex-row justify-end">
                          <TouchableOpacity
                            onPress={() => {
                              void handleShareWordleGroup(item.quests);
                            }}
                            disabled={sharingGroup !== null}
                            style={{
                              borderRadius: 12,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.iconBg,
                            }}
                          >
                            <View
                              style={{
                                minHeight: 38,
                                paddingHorizontal: 14,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                className="font-nunito-bold text-sm"
                                style={{ color: colors.iconColor }}
                              >
                                {sharingGroup === "wordle"
                                  ? t("quests.shareGroupPreparing")
                                  : t("quests.shareGroupResult")}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>

                        {WORDLE_LANGUAGES.map((language) => {
                          const quest = item.quests[language];
                          if (!quest) {
                            return null;
                          }

                          const languageStatus = getQuestStatus(quest);
                          const languageColors = STATUS_COLORS[languageStatus];
                          const isClaimLoading =
                            claimQuestMutation.isPending &&
                            claimQuestMutation.variables?.id === quest.id;
                          const actionLabel =
                            languageStatus === "active"
                              ? t("quests.dailyNumbers.playAction")
                              : t("quests.dailyNumbers.viewResult");
                          const attemptsUsed = quest.attemptsUsed ?? 0;

                          return (
                            <View
                              key={language}
                              className="rounded-2xl border p-3"
                              style={{
                                borderColor: languageColors.border,
                                backgroundColor:
                                  languageStatus === "claimed"
                                    ? tc.surfaceMuted
                                    : tc.primaryBg,
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
                                  <View className="flex-row items-center gap-1">
                                    <CoinIcon size={16} />
                                    <Text
                                      className="font-nunito-bold text-sm"
                                      style={{ color: tc.secondaryDark }}
                                    >
                                      {quest.reward}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              <View className="mt-3 flex-row gap-3">
                                <TouchableOpacity
                                  onPress={() =>
                                    router.push(
                                      `/quests/wordle?language=${language}` as never,
                                    )
                                  }
                                  style={{
                                    flex: 1,
                                    borderRadius: 12,
                                    overflow: "hidden",
                                  }}
                                >
                                  <View
                                    style={{
                                      minHeight: 42,
                                      paddingHorizontal: 14,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: languageColors.iconColor,
                                    }}
                                  >
                                    <Text className="font-nunito-bold text-white">
                                      {actionLabel}
                                    </Text>
                                  </View>
                                </TouchableOpacity>

                                {quest.completed && !quest.claimed ? (
                                  <TouchableOpacity
                                    onPress={() =>
                                      void claimQuestMutation.mutateAsync(quest)
                                    }
                                    disabled={isClaimLoading}
                                    style={{
                                      borderRadius: 12,
                                      overflow: "hidden",
                                      minWidth: 108,
                                    }}
                                  >
                                    <View
                                      className="items-center flex-row justify-center gap-2"
                                      style={{
                                        minHeight: 42,
                                        paddingHorizontal: 14,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: tc.successDark,
                                      }}
                                    >
                                      {isClaimLoading ? (
                                        <ActivityIndicator
                                          color="white"
                                          size="small"
                                        />
                                      ) : (
                                        <>
                                          <SparklesIcon
                                            size={18}
                                            color="white"
                                          />
                                          <Text className="font-nunito-bold text-white">
                                            {t("quests.claim")}
                                          </Text>
                                        </>
                                      )}
                                    </View>
                                  </TouchableOpacity>
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
                const availableModes = DAILY_NUMBERS_MODES.filter(
                  (mode) => item.quests[mode],
                );
                const completedModes = availableModes.filter((mode) => {
                  const quest = item.quests[mode];
                  return quest?.completed || quest?.claimed;
                }).length;
                const totalReward = availableModes.reduce((sum, mode) => {
                  return sum + (item.quests[mode]?.reward ?? 0);
                }, 0);
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
                      opacity: groupStatus === "claimed" ? 0.6 : 1,
                      shadowColor: "#000",
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                      marginBottom:
                        index === questCardItems.length - 1 ? 0 : 12,
                    }}
                  >
                    <TouchableOpacity
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
                          shadowColor: "#000",
                          shadowOpacity: 0.15,
                          shadowRadius: 4,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 2,
                        }}
                      >
                        <HelpCircleIcon
                          size={20}
                          color={colors.border}
                          noCircle
                        />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        setCollapsedGroups((groups) => ({
                          ...groups,
                          dailyNumbers: !groups.dailyNumbers,
                        }))
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 16,
                        paddingRight: 24,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: colors.iconBg,
                          padding: 12,
                          borderRadius: 12,
                        }}
                      >
                        <DailyNumbersQuestIcon
                          size={28}
                          color={colors.iconColor}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text className="font-nunito-bold text-base text-fg">
                          {t("quests.dailyNumbers.title")}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <View className="flex-row items-center gap-1">
                          <CoinIcon size={18} />
                          <Text
                            style={{ color: tc.secondaryDark }}
                            className="font-nunito-bold text-base"
                          >
                            {totalReward}
                          </Text>
                        </View>
                        {collapsedGroups.dailyNumbers ? (
                          <ChevronRightIcon size={20} color={tc.muted} />
                        ) : (
                          <ChevronDownIcon size={20} color={tc.muted} />
                        )}
                      </View>
                    </TouchableOpacity>

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

                    {collapsedGroups.dailyNumbers ? null : (
                      <View className="mt-4 gap-3">
                        <View className="flex-row justify-end">
                          <TouchableOpacity
                            onPress={() => {
                              void handleShareDailyNumbersGroup(item.quests);
                            }}
                            disabled={sharingGroup !== null}
                            style={{
                              borderRadius: 12,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.iconBg,
                            }}
                          >
                            <View
                              style={{
                                minHeight: 38,
                                paddingHorizontal: 14,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                className="font-nunito-bold text-sm"
                                style={{ color: colors.iconColor }}
                              >
                                {sharingGroup === "dailyNumbers"
                                  ? t("quests.shareGroupPreparing")
                                  : t("quests.shareGroupResult")}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>

                        {DAILY_NUMBERS_MODES.map((mode) => {
                          const quest = item.quests[mode];
                          if (!quest) {
                            return null;
                          }

                          const modeStatus = getQuestStatus(quest);
                          const modeColors = STATUS_COLORS[modeStatus];
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
                                backgroundColor:
                                  modeStatus === "claimed"
                                    ? tc.surfaceMuted
                                    : tc.primaryBg,
                              }}
                            >
                            <View className="flex-row items-start gap-3">
                              <View className="flex-1 gap-2">
                                <View className="flex-row items-center gap-2">
                                  <Text className="font-nunito-bold text-base text-fg">
                                    {t(getModeLabelKey(mode))}
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
                                      {getDailyNumbersModeStatusLabel(quest, t)}
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
                                <View className="flex-row items-center gap-1">
                                  <CoinIcon size={16} />
                                  <Text
                                    className="font-nunito-bold text-sm"
                                    style={{ color: tc.secondaryDark }}
                                  >
                                    {quest.reward}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <View className="mt-3 flex-row gap-3">
                              <TouchableOpacity
                                onPress={() =>
                                  router.push(
                                    `/quests/daily-numbers-play?mode=${mode}` as never,
                                  )
                                }
                                style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
                              >
                                <View
                                  style={{
                                    minHeight: 42,
                                    paddingHorizontal: 14,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: modeColors.iconColor,
                                  }}
                                >
                                  <Text className="font-nunito-bold text-white">
                                    {actionLabel}
                                  </Text>
                                </View>
                              </TouchableOpacity>

                              {quest.completed && !quest.claimed ? (
                                <TouchableOpacity
                                  onPress={() =>
                                    void claimQuestMutation.mutateAsync(quest)
                                  }
                                  disabled={isClaimLoading}
                                  style={{
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    minWidth: 108,
                                  }}
                                >
                                  <View
                                    className="items-center flex-row justify-center gap-2"
                                    style={{
                                      minHeight: 42,
                                      paddingHorizontal: 14,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: tc.successDark,
                                    }}
                                  >
                                    {isClaimLoading ? (
                                      <ActivityIndicator
                                        color="white"
                                        size="small"
                                      />
                                    ) : (
                                      <>
                                        <SparklesIcon
                                          size={18}
                                          color="white"
                                        />
                                        <Text className="font-nunito-bold text-white">
                                          {t("quests.claim")}
                                        </Text>
                                      </>
                                    )}
                                  </View>
                                </TouchableOpacity>
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
              const progressDisplay = getQuestProgressDisplay(quest);
              const isClaimLoading =
                claimQuestMutation.isPending &&
                claimQuestMutation.variables?.id === quest.id;
              const title = getQuestTitle(quest.title, t);
              const actionLabel =
                status === "active"
                  ? t("quests.playQuest")
                  : t("quests.seeResults");
              const shouldShowActivationPrompt =
                isStepQuest(quest.type) &&
                status === "active" &&
                showStepQuestActivationPrompt;
              const shouldShowDiscreteSyncButton =
                isStepQuest(quest.type) &&
                status === "active" &&
                user?.preferredStepSource === "device_health" &&
                !shouldShowActivationPrompt;

              let statusIcon;
              if (status === "completed") {
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
                  28,
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
                    opacity: status === "claimed" ? 0.6 : 1,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                    marginBottom:
                      index === questCardItems.length - 1 ? 0 : 12,
                  }}
                >
                  <TouchableOpacity
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
                  </TouchableOpacity>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 16,
                      paddingRight: 24,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: colors.iconBg,
                        padding: 12,
                        borderRadius: 12,
                      }}
                    >
                      {statusIcon}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text className="font-nunito-bold text-base text-fg">
                        {title}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1">
                      <CoinIcon size={18} />
                      <Text
                        style={{ color: tc.secondaryDark }}
                        className="font-nunito-bold text-base"
                      >
                        {quest.reward}
                      </Text>
                    </View>
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
                          <TouchableOpacity
                            onPress={() => {
                              void handleStepAction();
                            }}
                            disabled={stepSync.isSyncing}
                            style={{ borderRadius: 10, overflow: "hidden" }}
                          >
                            <LinearGradient
                              colors={[colors.gradStart, colors.gradEnd]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                minHeight: 40,
                                paddingHorizontal: 14,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text className="font-nunito-bold text-white">
                                {stepSync.isSyncing
                                  ? t("settings.syncing")
                                  : stepActionLabel}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

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
                      {status === "claimed" ? (
                        <View
                          style={{
                            width: `${progressDisplay.progressPct}%`,
                            backgroundColor: tc.muted,
                            height: "100%",
                          }}
                        />
                      ) : (
                        <LinearGradient
                          colors={[colors.gradStart, colors.gradEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            width: `${progressDisplay.progressPct}%`,
                            height: "100%",
                          }}
                        />
                      )}
                    </View>
                    {isWordleQuest(quest.type) && quest.attemptsUsed != null ? (
                      <Text
                        className="font-nunito-bold text-xs text-center mt-1"
                        style={{
                          color:
                            status === "claimed"
                              ? tc.muted
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
                      <View className="mt-2 items-end">
                        {shouldShowDiscreteSyncButton ? (
                          <TouchableOpacity
                            onPress={() => {
                              void handleForceRefresh();
                            }}
                            disabled={
                              stepSync.isSyncing ||
                              stepQuestUiState.isForceRefreshing
                            }
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <Text className="font-nunito-semibold text-xs text-primaryText">
                              {stepSync.isSyncing ||
                              stepQuestUiState.isForceRefreshing
                                ? t("settings.syncing")
                                : t("settings.syncNow")}
                            </Text>
                          </TouchableOpacity>
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
                      <TouchableOpacity
                        onPress={() => void openQuest(quest)}
                        style={{ borderRadius: 12, overflow: "hidden" }}
                      >
                        {status === "claimed" ? (
                          <View
                            style={{
                              backgroundColor: tc.muted,
                              minHeight: 44,
                              paddingHorizontal: 16,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            className="items-center justify-center"
                          >
                            <Text
                              className="font-nunito-bold text-white"
                              style={{ textAlign: "center", lineHeight: 20 }}
                            >
                              {actionLabel}
                            </Text>
                          </View>
                        ) : (
                          <LinearGradient
                            colors={[colors.gradStart, colors.gradEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="items-center justify-center"
                            style={{
                              minHeight: 44,
                              paddingHorizontal: 16,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              className="font-nunito-bold text-white"
                              style={{ textAlign: "center", lineHeight: 20 }}
                            >
                              {actionLabel}
                            </Text>
                          </LinearGradient>
                        )}
                      </TouchableOpacity>
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
                      <TouchableOpacity
                        onPress={() =>
                          void claimQuestMutation.mutateAsync(quest)
                        }
                        disabled={isClaimLoading}
                        style={{ borderRadius: 12, overflow: "hidden" }}
                      >
                        <LinearGradient
                          colors={[tc.success, tc.successDark]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          className="items-center flex-row justify-center gap-2"
                          style={{
                            minHeight: 44,
                            paddingHorizontal: 16,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isClaimLoading ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <>
                              <SparklesIcon size={20} color="white" />
                              <Text
                                className="font-nunito-bold text-white"
                                style={{ textAlign: "center", lineHeight: 20 }}
                              >
                                {t("quests.claim")}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
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
                      style={{
                        position: "absolute",
                        top: -10,
                        right: -10,
                        backgroundColor: tc.surface,
                        borderRadius: 999,
                        borderWidth: 3,
                        borderColor: colors.border,
                        padding: 4,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
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
                    <PrimaryButton
                      onPress={() => setShowDescriptionFor(null)}
                      style={{ marginTop: 8 }}
                      fallbackAppearance={{
                        borderRadius: 12,
                        gradientColors: [
                          colors.gradStart,
                          colors.gradEnd,
                        ] as const,
                        foregroundColor: "#FFFFFF",
                        paddingVertical: 12,
                        textStyle: {
                          fontFamily: "Nunito_700Bold",
                        },
                      }}
                    >
                      {t("common.close")}
                    </PrimaryButton>
                  </View>
                );
              })()
            : null}
        </View>
      </Modal>
    </View>
  );
}
