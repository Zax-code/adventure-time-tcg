import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { PrimaryButton } from "../../src/components/button";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-screen-view";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { useTranslation } from "../../src/i18n";

export default function GiftsScreen() {
  const queryClient = useQueryClient();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const bottomTabPadding = useBottomTabBarContentPadding();
  const { t } = useTranslation();
  const [recipientId, setRecipientId] = useState("");
  const [cardId, setCardId] = useState("");
  const [message, setMessage] = useState("");
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.users(),
  });
  const giftsQuery = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
  });
  const sendGiftMutation = useMutation({
    mutationFn: () =>
      apiClient.sendGift({
        cardId,
        toUserId: recipientId,
        quantity: 1,
        message,
      }),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["gifts"] });
    },
  });
  const processGiftMutation = useMutation({
    mutationFn: (payload: { giftId: string; action: "accept" | "reject" }) =>
      apiClient.processGift(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  const localizeGiftStatus = (status: string) => {
    const key = `gifts.statusLabel.${status}`;
    const value = t(key);
    return value === key ? status : value;
  };

  return (
    <ScrollView
      {...KEYBOARD_AWARE_SCROLL_PROPS}
      className="flex-1 bg-bg"
      contentContainerStyle={{
        gap: 16,
        padding: 20,
        paddingBottom: bottomTabPadding,
      }}
    >
      <Text className="font-nunito-extrabold text-2xl text-fg">
        {t("gifts.title")}
      </Text>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-surface p-4">
        <Text className="font-nunito-bold text-lg text-fg">
          {t("gifts.sendSectionTitle")}
        </Text>
        <TextInput
          value={cardId}
          onChangeText={setCardId}
          placeholder={t("gifts.cardId")}
          placeholderTextColor={tc.muted}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <TextInput
          value={recipientId}
          onChangeText={setRecipientId}
          placeholder={t("gifts.recipientUserId")}
          placeholderTextColor={tc.muted}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={t("gifts.message")}
          placeholderTextColor={tc.muted}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <PrimaryButton onPress={() => void sendGiftMutation.mutateAsync()}>
          {t("gifts.sendGiftButton")}
        </PrimaryButton>
        <Text className="font-nunito text-xs text-fgMuted">
          {t("gifts.users")}:{" "}
          {(usersQuery.data?.users ?? [])
            .map((user) => `${user.displayName} (${user.id})`)
            .slice(0, 4)
            .join(", ")}
        </Text>
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-surface p-4">
        <Text className="font-nunito-bold text-lg text-fg">
          {t("gifts.inboxSent")}
        </Text>
        <View className="self-start rounded-full bg-primaryTint px-3 py-1">
          <Text className="font-nunito-bold text-sm text-primaryText">
            {t("gifts.pending", { count: giftsQuery.data?.pendingCount ?? 0 })}
          </Text>
        </View>
        {giftsQuery.data?.gifts.map((gift) => (
          <View key={gift.id} className="gap-2 rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito-semibold text-fg">
              {gift.card.name} x{gift.quantity}
            </Text>
            <Text className="font-nunito text-fgMuted">
              {t("gifts.from")}: {gift.fromUser.displayName}
            </Text>
            <Text className="font-nunito text-fgMuted">
              {t("gifts.to")}: {gift.toUser.displayName}
            </Text>
            <Text className="font-nunito text-fgMuted">
              {t("gifts.status")}: {localizeGiftStatus(gift.status)}
            </Text>
            {gift.message ? (
              <Text className="font-nunito text-fgMuted">
                {t("gifts.message")}: {gift.message}
              </Text>
            ) : null}
            {gift.status === "pending" ? (
              <View className="flex-row gap-2">
                <Pressable
                  className="flex-1 items-center rounded-xl bg-successDark px-4 py-2"
                  onPress={() =>
                    void processGiftMutation.mutateAsync({
                      giftId: gift.id,
                      action: "accept",
                    })
                  }
                >
                  <Text className="font-nunito-bold text-white">
                    {t("gifts.accept")}
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-1 items-center rounded-xl bg-dangerDark px-4 py-2"
                  onPress={() =>
                    void processGiftMutation.mutateAsync({
                      giftId: gift.id,
                      action: "reject",
                    })
                  }
                >
                  <Text className="font-nunito-bold text-white">
                    {t("gifts.reject")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
