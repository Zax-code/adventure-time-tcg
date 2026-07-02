import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, Text, View } from "react-native";

import type { GiftsResponse } from "@adventure-time/api-client";

import { PrimaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";
import type { CardTileCard } from "../../src/components/card-tile";
import { PageErrorState } from "../../src/components/error-state";
import { ThemedExpoButton } from "../../src/components/expo-ui/themed-button";
import {
  BoxIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  GiftHeartIcon,
  SparklesIcon,
  UserPlusIcon,
  XCircleIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-screen-view";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

type GiftFilter = "received" | "sent" | "all";
type GiftItem = GiftsResponse["gifts"][number];
type GiftDecision = "accept" | "reject";

export default function GiftsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const currentUserId = useSessionStore((state) => state.user?.id ?? "");
  const { t, locale } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<GiftFilter>("received");
  const [activeDecision, setActiveDecision] = useState<{
    giftId: string;
    action: GiftDecision;
  } | null>(null);

  const { data: giftsQueryData, error: giftsQueryError, isError: giftsQueryIsError, isLoading: giftsQueryIsLoading, refetch: giftsQueryRefetch } = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
  });

  const processGiftMutation = useMutation({
    mutationFn: (payload: { giftId: string; action: GiftDecision }) =>
      apiClient.processGift(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
    onSettled: () => {
      setActiveDecision(null);
    },
  });

  if (giftsQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("gifts.title")}
        message={t("common.loadingStates.pageBody")}
        icon="gift-outline"
      />
    );
  }

  if (giftsQueryIsError) {
    return (
      <PageErrorState
        error={giftsQueryError}
        onRetry={() => {
          void giftsQueryRefetch();
        }}
      />
    );
  }

  if (!giftsQueryData) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("gifts.emptyAllBody")}
        </Text>
      </View>
    );
  }

  const allGifts = [...giftsQueryData.gifts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const receivedGifts = allGifts.filter(
    (gift) => gift.toUser.id === currentUserId,
  );
  const sentGifts = allGifts.filter(
    (gift) => gift.fromUser.id === currentUserId,
  );
  const pendingIncoming = receivedGifts.filter(
    (gift) => gift.status === "pending",
  );
  const pendingIncomingIds = new Set(pendingIncoming.map((gift) => gift.id));

  const activityGifts =
    activeFilter === "received"
      ? receivedGifts.filter((gift) => !pendingIncomingIds.has(gift.id))
      : activeFilter === "sent"
        ? sentGifts
        : allGifts.filter((gift) => !pendingIncomingIds.has(gift.id));

  const heroBadgeLabel =
    pendingIncoming.length > 0
      ? t("gifts.heroBadge.pending", { count: pendingIncoming.length })
      : t("gifts.heroBadge.clear");

  const filterOptions: Array<{
    key: GiftFilter;
    label: string;
    count: number;
  }> = [
    {
      key: "received",
      label: t("gifts.filters.received"),
      count: receivedGifts.length,
    },
    {
      key: "sent",
      label: t("gifts.filters.sent"),
      count: sentGifts.length,
    },
    {
      key: "all",
      label: t("gifts.filters.all"),
      count: allGifts.length,
    },
  ];

  const showPendingSection =
    activeFilter !== "sent" && pendingIncoming.length > 0;

  return (
    <ScrollView
      {...KEYBOARD_AWARE_SCROLL_PROPS}
      className="flex-1 bg-bg"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: bottomTabPadding,
      }}
    >
      <View className="gap-5" style={{ paddingTop: headerHeight }}>
        <View className="overflow-hidden rounded-[32px] border border-primaryBorder bg-surface">
          <LinearGradient
            colors={[tc.surfaceMuted, tc.surface, tc.primaryBg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View className="gap-5">
              <View className="flex-row items-start gap-4">
                <View
                  className="size-16 items-center justify-center rounded-[24px]"
                  style={{ backgroundColor: tc.primaryBg }}
                >
                  <GiftHeartIcon size={28} color={tc.primaryText} />
                </View>
                <View className="flex-1 gap-2">
                  <Text className="font-nunito-extrabold text-[30px] leading-[34px] text-fg">
                    {t("gifts.title")}
                  </Text>
                  <Text className="font-nunito text-sm leading-5 text-fgMuted">
                    {t("gifts.subtitle")}
                  </Text>
                </View>
              </View>

              <View
                className="self-start rounded-full border px-4 py-2"
                style={{
                  backgroundColor:
                    pendingIncoming.length > 0
                      ? tc.secondaryTint
                      : tc.successTint,
                  borderColor:
                    pendingIncoming.length > 0
                      ? tc.secondaryBorder
                      : tc.successBorder,
                }}
              >
                <Text
                  className="font-nunito-bold text-sm"
                  style={{
                    color:
                      pendingIncoming.length > 0
                        ? tc.secondaryText
                        : tc.successText,
                  }}
                >
                  {heroBadgeLabel}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <SummaryCard
                  title={t("gifts.summary.pending")}
                  value={pendingIncoming.length}
                  tint={tc.secondaryTint}
                  border={tc.secondaryBorder}
                  textColor={tc.secondaryText}
                />
                <SummaryCard
                  title={t("gifts.summary.received")}
                  value={receivedGifts.length}
                  tint={tc.primaryTint}
                  border={tc.primaryBorder}
                  textColor={tc.primaryText}
                />
                <SummaryCard
                  title={t("gifts.summary.sent")}
                  value={sentGifts.length}
                  tint={tc.accentTint}
                  border={tc.accentBorder}
                  textColor={tc.accentText}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="gap-3">
          <View className="gap-1">
            <Text className="font-nunito-bold text-lg text-fg">
              {t("gifts.manageTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fgMuted">
              {t("gifts.manageSubtitle")}
            </Text>
          </View>

          <View className="flex-row gap-2">
            {filterOptions.map((option) => {
              const selected = option.key === activeFilter;
              return (
                <ThemedExpoButton
                  key={option.key}
                  preferFallback
                  fallbackLayout="stretch"
                  testID={`gifts-filter-${option.key}`}
                  variant="ghost"
                  fallbackAppearance={{
                    backgroundColor: selected ? tc.primaryTint : tc.surface,
                    borderColor: selected ? tc.primaryBorder : tc.primaryTint,
                    borderRadius: 16,
                    foregroundColor: selected ? tc.primaryText : tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textStyle: {
                      fontFamily: "Nunito_700Bold",
                      fontSize: 14,
                    },
                  }}
                  style={{
                    flex: 1,
                  }}
                  onPress={() => setActiveFilter(option.key)}
                >
                  <Text
                    className="text-center font-nunito-bold text-sm"
                    style={{ color: selected ? tc.primaryText : tc.fg }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    className="mt-1 text-center font-nunito text-xs"
                    style={{ color: selected ? tc.primaryText : tc.fgMuted }}
                  >
                    {t("gifts.filterCount", { count: option.count })}
                  </Text>
                </ThemedExpoButton>
              );
            })}
          </View>
        </View>

        {processGiftMutation.isError ? (
          <View className="rounded-2xl border border-dangerBorder bg-dangerTint px-4 py-3">
            <Text className="font-nunito text-sm text-dangerText">
              {processGiftMutation.error.message}
            </Text>
          </View>
        ) : null}

        {showPendingSection ? (
          <View className="gap-3">
            <SectionHeading
              title={t("gifts.needsActionTitle")}
              subtitle={t("gifts.needsActionSubtitle")}
            />
            <View className="gap-3">
              {pendingIncoming.map((gift) => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  currentUserId={currentUserId}
                  locale={locale}
                  activeDecision={activeDecision}
                  onDecision={(action) => {
                    setActiveDecision({ giftId: gift.id, action });
                    void processGiftMutation.mutateAsync({
                      giftId: gift.id,
                      action,
                    });
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <SectionHeading
            title={t("gifts.activityTitle")}
            subtitle={
              activeFilter === "received"
                ? t("gifts.activitySubtitle.received")
                : activeFilter === "sent"
                  ? t("gifts.activitySubtitle.sent")
                  : t("gifts.activitySubtitle.all")
            }
          />

          {activityGifts.length === 0 ? (
            <GiftEmptyState filter={activeFilter} />
          ) : (
            <View className="gap-3">
              {activityGifts.map((gift) => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  currentUserId={currentUserId}
                  locale={locale}
                  activeDecision={activeDecision}
                  onDecision={(action) => {
                    setActiveDecision({ giftId: gift.id, action });
                    void processGiftMutation.mutateAsync({
                      giftId: gift.id,
                      action,
                    });
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View className="gap-4 rounded-[28px] border border-primaryBorder bg-surface p-5">
          <View className="flex-row items-start gap-4">
            <View
              className="size-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: tc.primaryTint }}
            >
              <SparklesIcon size={20} color={tc.primaryText} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("gifts.quickSendTitle")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("gifts.quickSendBody")}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <InstructionStep
              index="1"
              text={t("gifts.quickSendSteps.openCollection")}
            />
            <InstructionStep
              index="2"
              text={t("gifts.quickSendSteps.pickCard")}
            />
            <InstructionStep
              index="3"
              text={t("gifts.quickSendSteps.choosePlayer")}
            />
          </View>

          <PrimaryButton onPress={() => router.push("/(tabs)/collection")}>
            {t("gifts.openCollection")}
          </PrimaryButton>
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryCard({
  title,
  value,
  tint,
  border,
  textColor,
}: {
  title: string;
  value: number;
  tint: string;
  border: string;
  textColor: string;
}) {
  return (
    <View
      className="flex-1 rounded-3xl border px-3 py-4"
      style={{ backgroundColor: tint, borderColor: border }}
    >
      <Text className="font-nunito text-xs text-fgMuted">{title}</Text>
      <Text
        className="mt-1 font-nunito-extrabold text-2xl"
        style={{ color: textColor }}
      >
        {value}
      </Text>
    </View>
  );
}

function InstructionStep({ index, text }: { index: string; text: string }) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-primaryBg px-3 py-3">
      <View
        className="size-7 items-center justify-center rounded-full"
        style={{ backgroundColor: tc.primaryBorder }}
      >
        <Text
          className="font-nunito-bold text-xs"
          style={{ color: tc.primaryStrong }}
        >
          {index}
        </Text>
      </View>
      <Text className="flex-1 font-nunito text-sm text-fg">{text}</Text>
      <ChevronRightIcon size={16} color={tc.primaryText} />
    </View>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View className="gap-1">
      <Text className="font-nunito-bold text-lg text-fg">{title}</Text>
      <Text className="font-nunito text-sm text-fgMuted">{subtitle}</Text>
    </View>
  );
}

function GiftEmptyState({ filter }: { filter: GiftFilter }) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const title =
    filter === "received"
      ? t("gifts.emptyReceivedTitle")
      : filter === "sent"
        ? t("gifts.emptySentTitle")
        : t("gifts.emptyAllTitle");
  const body =
    filter === "received"
      ? t("gifts.emptyReceivedBody")
      : filter === "sent"
        ? t("gifts.emptySentBody")
        : t("gifts.emptyAllBody");

  return (
    <View className="items-center gap-3 rounded-[28px] border border-primaryBorder bg-surface px-6 py-8">
      <View
        className="size-14 items-center justify-center rounded-[20px]"
        style={{ backgroundColor: tc.primaryTint }}
      >
        <GiftHeartIcon size={22} color={tc.primaryText} />
      </View>
      <Text className="text-center font-nunito-bold text-lg text-fg">
        {title}
      </Text>
      <Text className="text-center font-nunito text-sm leading-5 text-fgMuted">
        {body}
      </Text>
    </View>
  );
}

function GiftCard({
  gift,
  currentUserId,
  locale,
  activeDecision,
  onDecision,
}: {
  gift: GiftItem;
  currentUserId: string;
  locale: string;
  activeDecision: { giftId: string; action: GiftDecision } | null;
  onDecision: (action: GiftDecision) => void;
}) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const { t } = useTranslation();
  const isIncoming = gift.toUser.id === currentUserId;
  const isPending = gift.status === "pending";
  const canAct = isIncoming && isPending;
  const isAccepting =
    activeDecision?.giftId === gift.id && activeDecision.action === "accept";
  const isRejecting =
    activeDecision?.giftId === gift.id && activeDecision.action === "reject";

  const statusPalette = getStatusPalette(gift.status, tc, t);
  const cardTile = toCardTileCard(gift);
  const createdDate = formatGiftDate(gift.createdAt, locale);
  const expiryText =
    gift.status === "pending" && gift.expiresAt
      ? formatGiftExpiry(gift.expiresAt, locale, t)
      : null;
  const directionPalette = isIncoming
    ? {
        bg: tc.primaryTint,
        border: tc.primaryBorder,
        text: tc.primaryText,
        icon: <GiftHeartIcon size={16} color={tc.primaryText} />,
        label: t("gifts.receivedBadge"),
      }
    : {
        bg: tc.accentTint,
        border: tc.accentBorder,
        text: tc.accentText,
        icon: <UserPlusIcon size={16} color={tc.accentText} />,
        label: t("gifts.sentBadge"),
      };

  return (
    <View className="overflow-hidden rounded-[28px] border border-primaryBorder bg-surface">
      <View className="gap-4 p-4">
        <View className="flex-row items-center gap-3">
          <View
            className="rounded-full border px-3 py-1.5"
            style={{
              backgroundColor: directionPalette.bg,
              borderColor: directionPalette.border,
            }}
          >
            <View className="flex-row items-center gap-2">
              {directionPalette.icon}
              <Text
                className="font-nunito-bold text-xs"
                style={{ color: directionPalette.text }}
              >
                {directionPalette.label}
              </Text>
            </View>
          </View>

          <View className="flex-1 items-end">
            <View
              className="rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: statusPalette.bg,
                borderColor: statusPalette.border,
              }}
            >
              <View className="flex-row items-center gap-2">
                {statusPalette.icon}
                <Text
                  className="font-nunito-bold text-xs"
                  style={{ color: statusPalette.text }}
                >
                  {statusPalette.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row gap-3">
          <View>
            <CardTile
              card={cardTile}
              quantity={gift.quantity}
              testID={`gifts-card-preview-${gift.id}`}
            />
          </View>

          <View className="flex-1 justify-center gap-3">
            <View className="gap-1">
              <Text
                className="font-nunito-extrabold text-2xl leading-7 text-fg"
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {gift.card.name}
              </Text>
              <Text className="font-nunito-semibold text-sm text-fgMuted">
                {gift.card.character}
              </Text>
              <View className="flex-row flex-wrap gap-2 pt-1">
                <InfoPill
                  label={t("gifts.cardMeta.rarity")}
                  value={gift.card.rarity.name}
                  bg={tc.primaryTint}
                  border={tc.primaryBorder}
                  text={tc.primaryText}
                />
                <InfoPill
                  label={t("gifts.cardMeta.type")}
                  value={gift.card.type}
                  bg={tc.accentTint}
                  border={tc.accentBorder}
                  text={tc.accentText}
                />
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-3 rounded-2xl bg-primaryBg px-3 py-3">
          <View
            className="size-10 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: isIncoming ? tc.primaryTint : tc.accentTint,
            }}
          >
            {isIncoming ? (
              <BoxIcon size={18} color={tc.primaryText} />
            ) : (
              <UserPlusIcon size={18} color={tc.accentText} />
            )}
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-nunito-bold text-sm text-fg">
              {isIncoming
                ? t("gifts.receivedFrom", { name: gift.fromUser.displayName })
                : t("gifts.sentTo", { name: gift.toUser.displayName })}
            </Text>
            <Text className="font-nunito text-xs text-fgMuted">
              {expiryText
                ? t("gifts.timelineWithExpiry", {
                    created: createdDate,
                    expiry: expiryText,
                  })
                : t("gifts.timeline", { created: createdDate })}
            </Text>
          </View>
        </View>

        {gift.message ? (
          <View className="rounded-2xl border border-primaryTint bg-primaryBg px-3 py-3">
            <Text className="font-nunito-bold text-xs uppercase tracking-[0.6px] text-primaryText">
              {t("gifts.messageLabel")}
            </Text>
            <Text className="mt-1 font-nunito text-sm leading-5 text-fg">
              {gift.message}
            </Text>
          </View>
        ) : null}

        {canAct ? (
          <View className="flex-row gap-3">
            <ThemedExpoButton
              preferFallback
              variant="primary"
              fallbackAppearance={{
                backgroundColor: tc.successDark,
                borderColor: tc.successDark,
                borderRadius: 16,
                foregroundColor: "#FFFFFF",
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
              style={{
                flex: 1,
                opacity: activeDecision ? 0.65 : 1,
              }}
              disabled={Boolean(activeDecision)}
              onPress={() => onDecision("accept")}
            >
              {isAccepting ? t("gifts.accepting") : t("gifts.accept")}
            </ThemedExpoButton>
            <ThemedExpoButton
              preferFallback
              variant="danger"
              fallbackAppearance={{
                backgroundColor: tc.dangerDark,
                borderColor: tc.dangerDark,
                borderRadius: 16,
                foregroundColor: "#FFFFFF",
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
              style={{
                flex: 1,
                opacity: activeDecision ? 0.65 : 1,
              }}
              disabled={Boolean(activeDecision)}
              onPress={() => onDecision("reject")}
            >
              {isRejecting ? t("gifts.rejecting") : t("gifts.reject")}
            </ThemedExpoButton>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfoPill({
  label,
  value,
  bg,
  border,
  text,
}: {
  label: string;
  value: string;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <View
      className="rounded-full border px-2.5 py-1"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <Text
        className="font-nunito-bold text-[11px] leading-4"
        numberOfLines={1}
        style={{ color: text }}
      >
        {label}: {value}
      </Text>
    </View>
  );
}

function toCardTileCard(gift: GiftItem): CardTileCard {
  return {
    id: gift.card.id,
    name: gift.card.name,
    character: gift.card.character,
    description: gift.card.description,
    hp: gift.card.hp,
    attack: gift.card.attack,
    defense: gift.card.defense,
    speed: gift.card.speed,
    type: gift.card.type,
    rarityName: gift.card.rarity.name,
    imageAssetId: gift.card.imageAssetId,
  };
}

function getStatusPalette(
  status: string,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const label = localizeGiftStatus(status, t);

  switch (status) {
    case "accepted":
      return {
        bg: tc.successTint,
        border: tc.successBorder,
        text: tc.successText,
        icon: <CheckCircleIcon size={15} color={tc.successText} />,
        label,
      };
    case "rejected":
      return {
        bg: tc.dangerTint,
        border: tc.dangerBorder,
        text: tc.dangerText,
        icon: <XCircleIcon size={15} color={tc.dangerText} />,
        label,
      };
    case "expired":
      return {
        bg: tc.surfaceMuted,
        border: tc.primaryTint,
        text: tc.fgMuted,
        icon: <XCircleIcon size={15} color={tc.fgMuted} />,
        label,
      };
    default:
      return {
        bg: tc.secondaryTint,
        border: tc.secondaryBorder,
        text: tc.secondaryText,
        icon: <ClockIcon size={15} color={tc.secondaryText} />,
        label,
      };
  }
}

function localizeGiftStatus(
  status: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const key = `gifts.statusLabel.${status}`;
  const value = t(key);
  return value === key ? status : value;
}

function formatGiftDate(value: string, locale: string) {
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatGiftExpiry(
  value: string,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) {
    return t("gifts.expiresExpired");
  }

  if (diffMs < 24 * 60 * 60 * 1000) {
    return t("gifts.expiresToday");
  }

  return t("gifts.expiresOn", { date: formatGiftDate(value, locale) });
}
