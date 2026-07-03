import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { WordleDefinitionVariant } from "@adventure-time/api-client";

export const WordleDefinitionVariantCard = memo(
  function WordleDefinitionVariantCard({
    definitionSourceLabel,
    expanded,
    expandable,
    onToggle,
    variant,
  }: {
    definitionSourceLabel: string;
    expanded: boolean;
    expandable: boolean;
    onToggle: (displayWord: string, expandable: boolean) => void;
    variant: WordleDefinitionVariant;
  }) {
    return (
      <View className="rounded-2xl border border-primaryTint bg-bg px-3 py-2">
        <Pressable
          onPress={() => onToggle(variant.displayWord, expandable)}
          className="flex-row items-start justify-between gap-3"
        >
          <View className="flex-1">
            <Text className="text-base font-nunito-extrabold text-primaryStrong">
              {variant.displayWord}
            </Text>
            {variant.partOfSpeech ? (
              <Text className="mt-1 text-sm font-nunito text-fgMuted">
                {variant.partOfSpeech}
              </Text>
            ) : null}
          </View>

          {expandable ? (
            <Text className="text-lg font-nunito-extrabold text-primaryStrong">
              {expanded ? "-" : "+"}
            </Text>
          ) : null}
        </Pressable>

        {expanded ? (
          <View className="mt-3 gap-2">
            <Text className="text-sm leading-6 font-nunito text-primaryStrong">
              {variant.definition}
            </Text>

            <Text className="text-xs leading-5 font-nunito text-fgMuted">
              {definitionSourceLabel}
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);
