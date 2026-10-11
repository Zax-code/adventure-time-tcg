import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Clock from "lucide-react-native/icons/clock";
import Gift from "lucide-react-native/icons/gift";
import Package from "lucide-react-native/icons/package";
import Send from "lucide-react-native/icons/send";
import UserPlus from "lucide-react-native/icons/user-plus";

import type { GiftsResponse } from "@adventure-time/api-client";

import { CardTile } from "../../src/components/card-tile";
import type { CardTileCard } from "../../src/components/card-tile";
import { PageErrorState } from "../../src/components/error-state";
import { Button } from "../../src/components/ui/button";
import { Card } from "../../src/components/ui/card";
import { Chip, type ChipTone } from "../../src/components/ui/chip";
import { IconTile } from "../../src/components/ui/icon-tile";
import { Notice } from "../../src/components/ui/notice";
import { SectionHeader } from "../../src/components/ui/section-header";
import { SegmentedControl } from "../../src/components/ui/segmented-control";
import { StatePanel } from "../../src/components/ui/state-panel";
import { StatTile } from "../../src/components/ui/stat-tile";
import { PageLoadingState } from "../../src/components/loading-state";
import { useFocusedRefetchInterval } from "../../src/hooks/use-focused-refetch-interval";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { PageTitle } from "../../src/components/ui/page-title";

type GiftFilter = "received" | "sent" | "all";
type GiftItem = GiftsResponse["gifts"][number];
type GiftDecision = "accept" | "reject";

export default function GiftsScreen() {
  return useGiftsScreenView();
}

function useGiftsScreenView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const currentUserId = useSessionStore((state) => state.user?.id ?? "");
  const { t, locale } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<GiftFilter>("received");
  const [activeDecision, setActiveDecision] = useState<{
    giftId: string;
    action: GiftDecision;
  } | null>(null);

  const giftsRefetchInterval = useFocusedRefetchInterval(30_000);
  const { data: giftsQueryData, error: giftsQueryError, isError: giftsQueryIsError, isLoading: giftsQueryIsLoading, refetch: giftsQueryRefetch } = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
    refetchInterval: giftsRefetchInterval,
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
        padding: 16,
        paddingBottom: 20,
      }}
      contentInset={{ bottom: bottomTabPadding }}
      scrollIndicatorInsets={{ bottom: bottomTabPadding }}
    >
      <View className="gap-ds-3" style={{ paddingTop: headerHeight }}>
        <PageTitle title={t("gifts.title")} subtitle={t("gifts.subtitle")} />
        <View className="flex-row items-start gap-ds-3">
          <StatTile
            className="flex-1"
            tone="secondary"
            label={t("gifts.summary.pending")}
            value={pendingIncoming.length}
          />
          <StatTile
            className="flex-1"
            tone="primary"
            label={t("gifts.summary.received")}
            value={receivedGifts.length}
          />
          <StatTile
            className="flex-1"
            tone="accent"
            label={t("gifts.summary.sent")}
            value={sentGifts.length}
          />
        </View>

        <View className="gap-ds-3">
          <SectionHeader
            title={t("gifts.activityTitle")}
            subtitle={t("gifts.activitySubtitle")}
          />
          <SegmentedControl<GiftFilter>
            options={filterOptions.map((option) => ({
              value: option.key,
              label: option.label,
              count: option.count,
              accessibilityLabel: `${option.label}, ${t("gifts.filterCount", { count: option.count })}`,
              testID: `gifts-filter-${option.key}`,
            }))}
            value={activeFilter}
            onChange={setActiveFilter}
          />
        </View>

        {processGiftMutation.isError ? (
          <Notice tone="danger" title={processGiftMutation.error.message} />
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
                    processGiftMutation.mutate({
                      giftId: gift.id,
                      action,
                    });
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {showPendingSection && activityGifts.length > 0 ? (
          <SectionHeading
            title={t("gifts.recentTitle")}
            subtitle={
              activeFilter === "received"
                ? t("gifts.recentSubtitle.received")
                : t("gifts.recentSubtitle.all")
            }
          />
        ) : null}

        {activityGifts.length === 0 ? (
          showPendingSection ? null : <GiftEmptyState filter={activeFilter} />
        ) : (
          <View className="gap-ds-3">
            {activityGifts.map((gift) => (
              <GiftCard
                key={gift.id}
                gift={gift}
                currentUserId={currentUserId}
                locale={locale}
                activeDecision={activeDecision}
                onDecision={(action) => {
                  setActiveDecision({ giftId: gift.id, action });
                  processGiftMutation.mutate({
                    giftId: gift.id,
                    action,
                  });
                }}
              />
            ))}
          </View>
        )}

        <Card>
          <View className="flex-row items-center gap-ds-3">
            <IconTile icon={Send} />
            <View className="flex-1 gap-[2px]">
              <Text className="font-nunito-extrabold text-ds-h3 text-fg">
                {t("gifts.quickSendTitle")}
              </Text>
              <Text className="font-nunito text-ds-sm text-fgMuted">
                {t("gifts.quickSendBody")}
              </Text>
            </View>
          </View>
          <Button
            icon={Gift}
            onPress={() => router.push("/(tabs)/collection")}
            testID="gifts-choose-card"
          >
            {t("gifts.chooseCard")}
          </Button>
        </Card>
      </View>
    </ScrollView>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return <SectionHeader title={title} subtitle={subtitle} />;
}

const GiftEmptyState = useGiftEmptyStateView;

function useGiftEmptyStateView({ filter }: { filter: GiftFilter }) {
  const { t } = useTranslation();
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

  return <StatePanel icon={Gift} title={title} body={body} />;
}

const GiftCard = useGiftCardView;

function useGiftCardView({
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
  const { t } = useTranslation();
  const isIncoming = gift.toUser.id === currentUserId;
  const isPending = gift.status === "pending";
  const canAct = isIncoming && isPending;
  const isAccepting =
    activeDecision?.giftId === gift.id && activeDecision.action === "accept";
  const isRejecting =
    activeDecision?.giftId === gift.id && activeDecision.action === "reject";

  const cardTile = toCardTileCard(gift);
  const createdDate = formatGiftDate(gift.createdAt, locale);
  const expiryText =
    gift.status === "pending" && gift.expiresAt
      ? formatGiftExpiry(gift.expiresAt, locale, t)
      : null;
  const statusPalette = getStatusPalette(gift.status, t);

  return (
    <Card>
        <View className="flex-row items-center justify-between gap-ds-3">
          <Chip
            tone={isIncoming ? "primary" : "accent"}
            icon={isIncoming ? Gift : UserPlus}
            label={isIncoming ? t("gifts.receivedBadge") : t("gifts.sentBadge")}
          />
          <Chip
            tone={statusPalette.tone}
            icon={statusPalette.icon}
            label={statusPalette.label}
          />
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
                className="font-nunito-extrabold text-ds-h2 text-fg"
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {gift.card.name}
              </Text>
              <Text className="font-nunito text-ds-sm text-fgMuted">
                {gift.card.character}
              </Text>
              <View className="flex-row flex-wrap gap-ds-2 pt-ds-1">
                <Chip
                  tone="primary"
                  label={`${t("gifts.cardMeta.rarity")}: ${gift.card.rarity.name}`}
                />
                <Chip
                  tone="accent"
                  label={`${t("gifts.cardMeta.type")}: ${gift.card.type}`}
                />
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-ds-3 rounded-ds-md bg-primaryBg px-ds-3 py-ds-3">
          <IconTile
            size={32}
            tone={isIncoming ? "primary" : "accent"}
            icon={isIncoming ? Package : UserPlus}
          />
          <View className="flex-1 gap-[2px]">
            <Text className="font-nunito-bold text-ds-sm text-fg">
              {isIncoming
                ? t("gifts.receivedFrom", { name: gift.fromUser.displayName })
                : t("gifts.sentTo", { name: gift.toUser.displayName })}
            </Text>
            <Text className="font-nunito text-ds-caption text-fgMuted">
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
          <View className="rounded-ds-md border border-primaryTint bg-primaryBg px-ds-3 py-ds-3">
            <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-primaryText">
              {t("gifts.messageLabel")}
            </Text>
            <Text className="mt-ds-1 font-nunito text-ds-sm text-fg">
              {gift.message}
            </Text>
          </View>
        ) : null}

        {canAct ? (
          <View className="flex-row gap-ds-3">
            <Button
              tone="primary"
              style={{ flex: 1 }}
              disabled={Boolean(activeDecision)}
              onPress={() => onDecision("accept")}
            >
              {isAccepting ? t("gifts.accepting") : t("gifts.accept")}
            </Button>
            <Button
              tone="danger"
              style={{ flex: 1 }}
              disabled={Boolean(activeDecision)}
              onPress={() => onDecision("reject")}
            >
              {isRejecting ? t("gifts.rejecting") : t("gifts.reject")}
            </Button>
          </View>
        ) : null}
    </Card>
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
  t: (key: string, params?: Record<string, string | number>) => string,
): { tone: ChipTone; icon: LucideIcon; label: string } {
  const label = localizeGiftStatus(status, t);

  switch (status) {
    case "accepted":
      return { tone: "success", icon: CircleCheck, label };
    case "rejected":
      return { tone: "danger", icon: CircleX, label };
    case "expired":
      return { tone: "neutral", icon: CircleX, label };
    default:
      return { tone: "secondary", icon: Clock, label };
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
