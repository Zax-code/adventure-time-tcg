import { useCallback, useRef, useState, type ReactNode } from "react";
import { Text, View, type GestureResponderEvent } from "react-native";
import Check from "lucide-react-native/icons/check";

import { Button } from "../../../components/ui/button";
import { glyphCenterStyle, KEYPAD_KEY_CLASS } from "../../../components/ui/game/game-state";
import { useTranslation } from "../../../i18n";
import { KEYPAD_ROWS, type KeypadKey } from "./constants";
import {
  getChangedTouchIdentifiers,
  getKeyPressesForChangedTouches,
  type KeyBounds,
} from "./keypad-touch";

type InteractiveKeyId = KeypadKey | "CLEAR" | "SUBMIT";

// Board 04: 3-column Keypad Key grid (8 between columns, 12 between rows)
// and a Clear / Submit Button row. Touches within half a row gap of a key
// still land on the nearest key.
const ROW_GAP = 12;
const KEY_HIT_SLOP = ROW_GAP / 2;

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

type KeyButtonProps = {
  keyId: InteractiveKeyId;
  testID: string;
  disabled: boolean;
  pressed: boolean;
  className: string;
  children: ReactNode;
  onPress: () => void;
  onBoundsChange: (
    keyId: InteractiveKeyId,
    bounds: KeyBounds<InteractiveKeyId>,
  ) => void;
  // Buttons dim themselves when disabled.
  dimWhenDisabled?: boolean;
  scalePressed?: number;
  pressedOpacity?: number;
};

// A visual key. It never receives touches itself (the keypad container
// routes every pointer), it only reports its bounds and shows the pressed
// state.
function KeyButton({
  keyId,
  testID,
  disabled,
  pressed,
  className,
  children,
  onPress,
  onBoundsChange,
  dimWhenDisabled = true,
  scalePressed = 0.95,
  pressedOpacity = 0.7,
}: KeyButtonProps) {
  const viewRef = useRef<View>(null);
  const showPressed = pressed && !disabled;

  const measureBounds = useCallback(() => {
    viewRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      onBoundsChange(keyId, {
        keyId,
        left: pageX,
        top: pageY,
        right: pageX + width,
        bottom: pageY + height,
      });
    });
  }, [keyId, onBoundsChange]);

  return (
    <View
      ref={viewRef}
      testID={testID}
      accessibilityLabel={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessible
      onAccessibilityTap={() => {
        if (!disabled) onPress();
      }}
      onLayout={measureBounds}
      pointerEvents="none"
      className={className}
      style={{
        opacity:
          disabled && dimWhenDisabled ? 0.45 : showPressed ? pressedOpacity : 1,
        transform: [{ scale: showPressed ? scalePressed : 1 }],
      }}
    >
      {children}
    </View>
  );
}

function keyTestID(keyId: InteractiveKeyId) {
  if (keyId === "±") return "speed-calculus-key-sign";
  if (keyId === "DEL") return "speed-calculus-key-delete";
  return `speed-calculus-key-${keyId.toLowerCase()}`;
}

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
  const keyBoundsRef = useRef(
    new Map<InteractiveKeyId, KeyBounds<InteractiveKeyId>>(),
  );
  const activeTouchesRef = useRef(new Map<number | string, InteractiveKeyId>());
  const [pressedKeys, setPressedKeys] = useState<Set<InteractiveKeyId>>(
    () => new Set(),
  );

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

  const updateKeyBounds = useCallback(
    (keyId: InteractiveKeyId, bounds: KeyBounds<InteractiveKeyId>) => {
      keyBoundsRef.current.set(keyId, bounds);
    },
    [],
  );

  const syncPressedKeys = useCallback(() => {
    setPressedKeys(new Set(activeTouchesRef.current.values()));
  }, []);

  const handleKeypadTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const presses = getKeyPressesForChangedTouches(
        event,
        [...keyBoundsRef.current.values()],
        KEY_HIT_SLOP,
      );
      let pressedStateChanged = false;

      for (const press of presses) {
        if (activeTouchesRef.current.has(press.identifier) || keypadLocked) {
          continue;
        }

        activeTouchesRef.current.set(press.identifier, press.keyId);
        activateKey(press.keyId);
        pressedStateChanged = true;
      }

      if (pressedStateChanged) syncPressedKeys();
    },
    [activateKey, keypadLocked, syncPressedKeys],
  );

  const releaseKeypadTouches = useCallback(
    (event: GestureResponderEvent) => {
      let pressedStateChanged = false;
      for (const identifier of getChangedTouchIdentifiers(event)) {
        pressedStateChanged =
          activeTouchesRef.current.delete(identifier) || pressedStateChanged;
      }

      if (pressedStateChanged) syncPressedKeys();
    },
    [syncPressedKeys],
  );

  return (
    <View
      className="gap-ds-3"
      onTouchStart={handleKeypadTouchStart}
      onTouchEnd={releaseKeypadTouches}
      onTouchCancel={releaseKeypadTouches}
    >
      {KEYPAD_ROWS.map((row) => (
        <View key={row.join("")} className="flex-row gap-ds-2">
          {row.map((key) => {
            const k = key as KeypadKey;
            const isDisabled =
              k === "DEL" ? keypadLocked || !answer : keypadLocked;
            const isAction = k === "DEL" || k === "±";
            const classes = KEYPAD_KEY_CLASS[isAction ? "action" : "default"];
            const label =
              k === "±"
                ? t("quests.speedCalculusToggleNegative")
                : k === "DEL"
                  ? t("quests.speedCalculusDelete")
                  : k;

            return (
              <KeyButton
                key={k}
                keyId={k}
                testID={keyTestID(k)}
                disabled={isDisabled}
                pressed={pressedKeys.has(k)}
                className={`h-[56px] min-w-0 flex-1 items-center justify-center rounded-ds-md border ${classes.container}`}
                onPress={() => activateKey(k)}
                onBoundsChange={updateKeyBounds}
              >
                <Text
                  className={`text-center font-nunito-extrabold ${
                    isAction ? "text-ds-body" : "text-[24px] leading-[29px]"
                  } ${classes.text}`}
                  style={isAction ? undefined : glyphCenterStyle(24)}
                >
                  {label}
                </Text>
              </KeyButton>
            );
          })}
        </View>
      ))}

      <View className="flex-row gap-ds-3">
        <KeyButton
          keyId="CLEAR"
          testID={keyTestID("CLEAR")}
          disabled={keypadLocked || !answer}
          pressed={pressedKeys.has("CLEAR")}
          className="w-[120px]"
          dimWhenDisabled={false}
          onPress={() => activateKey("CLEAR")}
          onBoundsChange={updateKeyBounds}
        >
          <Button tone="ghost" size="lg" disabled={keypadLocked || !answer}>
            {t("quests.speedCalculusClear")}
          </Button>
        </KeyButton>

        <KeyButton
          keyId="SUBMIT"
          testID={keyTestID("SUBMIT")}
          disabled={submitDisabled}
          pressed={pressedKeys.has("SUBMIT")}
          className="min-w-0 flex-1"
          dimWhenDisabled={false}
          onPress={() => activateKey("SUBMIT")}
          onBoundsChange={updateKeyBounds}
          scalePressed={0.99}
          pressedOpacity={0.9}
        >
          <Button
            size="lg"
            icon={Check}
            disabled={submitDisabled}
            loading={submitting}
          >
            {t("quests.speedCalculusSubmit")}
          </Button>
        </KeyButton>
      </View>
    </View>
  );
}
