import { useCallback, useMemo, useRef, useState, type ElementRef } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { KEYPAD_ROWS, type KeypadKey } from "./constants";
import { withAlpha } from "./palette";

type InteractiveKeyId = KeypadKey | "CLEAR" | "SUBMIT";
type KeyLayout = { x: number; y: number; width: number; height: number };

type KeypadProps = {
  answer: string;
  keypadLocked: boolean;
  submitDisabled: boolean;
  submitting: boolean;
  onDigit: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onToggleSign: () => void;
  onSubmit: () => void;
};

export function Keypad({
  answer,
  keypadLocked,
  submitDisabled,
  submitting,
  onDigit,
  onDelete,
  onClear,
  onToggleSign,
  onSubmit,
}: KeypadProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const [activeKeys, setActiveKeys] = useState<InteractiveKeyId[]>([]);
  const keyLayoutsRef = useRef<Partial<Record<InteractiveKeyId, KeyLayout>>>(
    {},
  );
  const keyRefs = useRef<
    Partial<Record<InteractiveKeyId, ElementRef<typeof View> | null>>
  >({});
  const activeTouchesRef = useRef<Record<number, InteractiveKeyId>>({});
  const touchCountSV = useSharedValue(0);

  const syncActiveKeys = useCallback(() => {
    setActiveKeys(Array.from(new Set(Object.values(activeTouchesRef.current))));
  }, []);

  const clearActiveTouches = useCallback(() => {
    activeTouchesRef.current = {};
    setActiveKeys([]);
  }, []);

  const updateKeyLayout = useCallback((keyId: InteractiveKeyId) => {
    const keyRef = keyRefs.current[keyId];
    keyRef?.measureInWindow((x, y, width, height) => {
      keyLayoutsRef.current[keyId] = { x, y, width, height };
    });
  }, []);

  const findKeyAtPoint = useCallback((x: number, y: number) => {
    const layoutEntries = Object.entries(keyLayoutsRef.current) as Array<
      [InteractiveKeyId, KeyLayout]
    >;
    return (
      layoutEntries.find(([, layout]) => {
        return (
          x >= layout.x &&
          x <= layout.x + layout.width &&
          y >= layout.y &&
          y <= layout.y + layout.height
        );
      })?.[0] ?? null
    );
  }, []);

  const activateKey = useCallback(
    (keyId: InteractiveKeyId) => {
      if (keyId === "CLEAR") onClear();
      else if (keyId === "SUBMIT") onSubmit();
      else if (keyId === "±") onToggleSign();
      else if (keyId === "DEL") onDelete();
      else onDigit(keyId);
    },
    [onClear, onDelete, onDigit, onSubmit, onToggleSign],
  );

  const releaseTouches = useCallback(
    (touches: Array<{ id: number }>) => {
      let changed = false;
      touches.forEach((touch) => {
        if (activeTouchesRef.current[touch.id]) {
          delete activeTouchesRef.current[touch.id];
          changed = true;
        }
      });
      if (changed) syncActiveKeys();
    },
    [syncActiveKeys],
  );

  const handleTouchesDown = useCallback(
    (touches: Array<{ id: number; x: number; y: number }>) => {
      let changed = false;
      touches.forEach((touch) => {
        if (activeTouchesRef.current[touch.id]) return;
        const keyId = findKeyAtPoint(touch.x, touch.y);
        if (!keyId) return;
        activeTouchesRef.current[touch.id] = keyId;
        activateKey(keyId);
        changed = true;
      });
      if (changed) syncActiveKeys();
    },
    [findKeyAtPoint, activateKey, syncActiveKeys],
  );

  const handleTouchesMove = useCallback(
    (touches: Array<{ id: number; x: number; y: number }>) => {
      let changed = false;
      touches.forEach((touch) => {
        const activeKeyId = activeTouchesRef.current[touch.id];
        if (!activeKeyId) return;
        const currentKeyId = findKeyAtPoint(touch.x, touch.y);
        if (currentKeyId === activeKeyId) return;
        delete activeTouchesRef.current[touch.id];
        changed = true;
      });
      if (changed) syncActiveKeys();
    },
    [findKeyAtPoint, syncActiveKeys],
  );

  const handleTouchesUp = useCallback(
    (ids: number[]) => {
      let changed = false;
      ids.forEach((id) => {
        if (activeTouchesRef.current[id]) {
          delete activeTouchesRef.current[id];
          changed = true;
        }
      });
      if (changed) syncActiveKeys();
    },
    [syncActiveKeys],
  );

  const keypadGesture = useMemo(
    () =>
      Gesture.Manual()
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event, manager) => {
          "worklet";
          if (touchCountSV.value === 0) manager.activate();
          touchCountSV.value += event.changedTouches.length;
          runOnJS(handleTouchesDown)(
            event.changedTouches.map((t) => ({
              id: t.id,
              x: t.absoluteX,
              y: t.absoluteY,
            })),
          );
        })
        .onTouchesMove((event) => {
          "worklet";
          runOnJS(handleTouchesMove)(
            event.changedTouches.map((t) => ({
              id: t.id,
              x: t.absoluteX,
              y: t.absoluteY,
            })),
          );
        })
        .onTouchesUp((event, manager) => {
          "worklet";
          touchCountSV.value = Math.max(
            0,
            touchCountSV.value - event.changedTouches.length,
          );
          runOnJS(handleTouchesUp)(event.changedTouches.map((t) => t.id));
          if (touchCountSV.value === 0) manager.end();
        })
        .onTouchesCancelled((event, manager) => {
          "worklet";
          touchCountSV.value = Math.max(
            0,
            touchCountSV.value - event.changedTouches.length,
          );
          runOnJS(handleTouchesUp)(event.changedTouches.map((t) => t.id));
          if (touchCountSV.value === 0) manager.end();
        })
        .onFinalize(() => {
          "worklet";
          touchCountSV.value = 0;
          runOnJS(clearActiveTouches)();
        }),
    [
      handleTouchesDown,
      handleTouchesMove,
      handleTouchesUp,
      clearActiveTouches,
      touchCountSV,
    ],
  );

  return (
    <GestureDetector gesture={keypadGesture}>
      <View
        className="mx-4 mt-3 rounded-3xl border-2 border-primaryTint p-2"
        style={{
          backgroundColor: tc.surface,
          shadowColor: withAlpha(tc.primaryDark, "24"),
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View className="gap-2">
          {KEYPAD_ROWS.map((row) => (
            <View key={row.join("")} className="flex-row gap-2">
              {row.map((key) => {
                const k = key as KeypadKey;
                const isDisabled =
                  k === "DEL" ? keypadLocked || !answer : keypadLocked;
                const isPressed = activeKeys.includes(k);
                const isDigit = /^\d$/.test(k);
                const fontSizeClass = isDigit
                  ? "text-[28px]"
                  : k === "±"
                    ? "text-[20px]"
                    : "text-sm";

                const label =
                  k === "±"
                    ? t("quests.speedCalculusToggleNegative")
                    : k === "DEL"
                      ? t("quests.speedCalculusDelete")
                      : k;

                const keyClassName =
                  k === "DEL"
                    ? "flex-1 h-[58px] rounded-2xl border-2 border-dangerBorder bg-dangerTint items-center justify-center"
                    : k === "±"
                      ? "flex-1 h-[58px] rounded-2xl border-2 border-accentBorder bg-accentTint items-center justify-center"
                      : "flex-1 h-[58px] rounded-2xl border-2 border-primaryBorder bg-primaryTint items-center justify-center";

                const keyTextClass =
                  k === "DEL"
                    ? `font-nunito-extrabold text-center text-dangerDark ${fontSizeClass}`
                    : k === "±"
                      ? `font-nunito-extrabold text-center text-accentDark ${fontSizeClass}`
                      : `font-nunito-extrabold text-center text-primaryDark ${fontSizeClass}`;

                return (
                  <View
                    key={k}
                    ref={(node) => {
                      keyRefs.current[k] = node;
                    }}
                    onLayout={() => {
                      requestAnimationFrame(() => updateKeyLayout(k));
                    }}
                    className={keyClassName}
                    pointerEvents="none"
                    style={{
                      opacity: isDisabled ? 0.45 : isPressed ? 0.7 : 1,
                      transform: [
                        { scale: isPressed && !isDisabled ? 0.95 : 1 },
                      ],
                    }}
                  >
                    <Text className={keyTextClass}>{label}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Action row: Clear + Submit — same height/radius as grid keys */}
        <View className="flex-row gap-2 mt-2">
          <View
            ref={(node) => {
              keyRefs.current.CLEAR = node;
            }}
            onLayout={() => {
              requestAnimationFrame(() => updateKeyLayout("CLEAR"));
            }}
            pointerEvents="none"
            className="flex-1 h-[58px] rounded-2xl border-2 border-primaryBorder bg-primaryTint items-center justify-center"
            style={{
              opacity:
                keypadLocked || !answer
                  ? 0.45
                  : activeKeys.includes("CLEAR")
                    ? 0.7
                    : 1,
              transform: [
                {
                  scale:
                    activeKeys.includes("CLEAR") && !keypadLocked && !!answer
                      ? 0.95
                      : 1,
                },
              ],
            }}
          >
            <Text className="text-sm font-nunito-extrabold text-primaryDark">
              {t("quests.speedCalculusClear")}
            </Text>
          </View>

          <View
            ref={(node) => {
              keyRefs.current.SUBMIT = node;
            }}
            onLayout={() => {
              requestAnimationFrame(() => updateKeyLayout("SUBMIT"));
            }}
            pointerEvents="none"
            className="flex-[2] h-[58px] rounded-2xl overflow-hidden"
            style={{
              opacity: submitDisabled
                ? 0.45
                : activeKeys.includes("SUBMIT")
                  ? 0.9
                  : 1,
              transform: [
                {
                  scale:
                    activeKeys.includes("SUBMIT") && !submitDisabled ? 0.99 : 1,
                },
              ],
            }}
          >
            <LinearGradient
              colors={[tc.secondary, tc.secondaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
              }}
            >
              <Text className="text-base font-nunito-extrabold text-secondaryText">
                {submitting ? "···" : t("quests.speedCalculusSubmit")}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}
