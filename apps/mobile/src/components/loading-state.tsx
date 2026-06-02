import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";

import type { IoniconName } from "../lib/ionicons";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

type LoadingVariant = "page" | "section";

function LoadingDots({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
      anim.setValue(0);
    };
  }, [anim]);

  return (
    <View className="mt-4 flex-row items-center justify-center gap-2">
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: color,
            opacity: anim.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange:
                index === 0
                  ? [1, 0.35, 0.35, 0.35, 1]
                  : index === 1
                    ? [0.35, 1, 0.35, 0.35, 0.35]
                    : [0.35, 0.35, 1, 0.35, 0.35],
            }),
            transform: [
              {
                scale: anim.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange:
                    index === 0
                      ? [1.15, 0.9, 0.9, 0.9, 1.15]
                      : index === 1
                        ? [0.9, 1.15, 0.9, 0.9, 0.9]
                        : [0.9, 0.9, 1.15, 0.9, 0.9],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function LoadingPanel({
  title,
  message,
  icon = "sparkles",
  variant = "section",
}: {
  title: string;
  message?: string;
  icon?: IoniconName;
  variant?: LoadingVariant;
}) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const isPage = variant === "page";

  return (
    <View
      className="w-full overflow-hidden border bg-surfaceMuted/95"
      style={{
        maxWidth: isPage ? 380 : undefined,
        borderRadius: isPage ? 32 : 24,
        borderColor: tc.primaryBorder + "55",
        shadowColor: tc.primaryStrong,
        shadowOpacity: isPage ? 0.22 : 0.14,
        shadowRadius: isPage ? 18 : 12,
        shadowOffset: { width: 0, height: isPage ? 10 : 6 },
        elevation: isPage ? 10 : 5,
      }}
    >
      <LinearGradient
        colors={[tc.surface, tc.primaryBg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: isPage ? 24 : 18,
          paddingVertical: isPage ? 24 : 18,
        }}
      >
        <View
          className="self-center items-center justify-center rounded-[22px]"
          style={{
            width: isPage ? 76 : 58,
            height: isPage ? 76 : 58,
            backgroundColor: tc.primaryTint,
          }}
        >
          <LinearGradient
            colors={[tc.secondary, tc.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: isPage ? 60 : 46,
              height: isPage ? 60 : 46,
              borderRadius: isPage ? 18 : 14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={icon}
              size={isPage ? 30 : 22}
              color={tc.secondaryText}
            />
          </LinearGradient>
        </View>

        <Text
          className="mt-4 text-center font-nunito-extrabold text-fg"
          style={{ fontSize: isPage ? 24 : 18, lineHeight: isPage ? 28 : 22 }}
        >
          {title}
        </Text>

        {message ? (
          <Text
            className="mt-2 text-center font-nunito text-fgMuted"
            style={{
              fontSize: isPage ? 15 : 13,
              lineHeight: isPage ? 22 : 18,
            }}
          >
            {message}
          </Text>
        ) : null}

        <LoadingDots color={tc.primaryDark} />
      </LinearGradient>
    </View>
  );
}

export function PageLoadingState({
  title,
  message,
  icon = "sparkles",
}: {
  title: string;
  message?: string;
  icon?: IoniconName;
}) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-bg px-6">
      <View
        className="absolute rounded-full"
        style={{
          top: 96,
          left: -48,
          width: 168,
          height: 168,
          backgroundColor: tc.secondaryTint,
          opacity: 0.55,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          top: 180,
          right: -26,
          width: 118,
          height: 118,
          backgroundColor: tc.accentTint,
          opacity: 0.48,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          bottom: 92,
          right: 24,
          width: 148,
          height: 148,
          backgroundColor: tc.primaryTint,
          opacity: 0.5,
        }}
      />
      <LoadingPanel
        title={title}
        message={message}
        icon={icon}
        variant="page"
      />
    </View>
  );
}
