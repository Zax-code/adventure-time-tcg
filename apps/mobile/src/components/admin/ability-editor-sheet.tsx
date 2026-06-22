import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import {
  ABILITY_TARGET_SELECTORS,
  ABILITY_TARGETS,
  emptyPayloadForm,
  formToPayload,
  isConsumptionOnlyStatus,
  PASSIVE_TRIGGERS,
  payloadToForm,
  STATUS_NAMES,
  stripStructuredPayloadKeys,
  TYPE_NAMES,
  type PayloadFormState,
  type StatusName,
  type TypeName,
} from "./ability-payload";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminField,
  AdminNotice,
} from "./admin-ui";
import { ThemedExpoSwitch } from "../expo-ui/themed-switch";
import { ThemedExpoTextInput } from "../expo-ui/themed-text-input";
import { useTranslation } from "../../i18n";
import type { IoniconName } from "../../lib/ionicons";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { withAlpha } from "./admin-palette";

type AbilityType = "PASSIVE" | "SKILL" | "ULTIMATE";

export type EditableAbility = {
  id: string;
  key: string;
  name: string;
  description: string;
  type: AbilityType;
  cost: number;
  cooldown: number | null;
  oncePerMatch: boolean;
  payload: Record<string, unknown>;
};

type AbilitySubmitInput = {
  key: string;
  name: string;
  description: string;
  type: AbilityType;
  cost: number;
  cooldown: number | null;
  oncePerMatch: boolean;
  payload: Record<string, unknown>;
};

type AbilityEditorFormProps = {
  ability: EditableAbility | null;
  saving: boolean;
  onSubmit: (input: AbilitySubmitInput) => Promise<void> | void;
  onDelete: (abilityId: string) => Promise<void> | void;
};

const ABILITY_TYPE_OPTIONS: Array<{
  value: AbilityType;
  icon: IoniconName;
}> = [
  { value: "PASSIVE", icon: "sparkles-outline" },
  { value: "SKILL", icon: "flash-outline" },
  { value: "ULTIMATE", icon: "flame-outline" },
];

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function defaultStatusEntry() {
  return {
    name: "Burn" as StatusName,
    duration: "",
    magnitude: "",
    target: "" as PayloadFormState["target"],
    targetSelector: "" as PayloadFormState["targetSelector"],
  };
}

function defaultSimpleStatusEntry() {
  return {
    name: "Burn" as StatusName,
    duration: "",
    magnitude: "",
  };
}

function getInitialEditorState(ability: EditableAbility | null) {
  if (ability) {
    return {
      formKey: ability.key,
      formName: ability.name,
      formDescription: ability.description,
      formType: ability.type,
      formCost: String(ability.cost),
      formCooldown: ability.cooldown == null ? "" : String(ability.cooldown),
      formOncePerMatch: ability.oncePerMatch,
      formPayload: payloadToForm(ability.payload ?? {}),
      extraPayloadKeys: stripStructuredPayloadKeys(ability.payload ?? {}),
      rawPayloadText: JSON.stringify(ability.payload ?? {}, null, 2),
    };
  }

  return {
    formKey: "",
    formName: "",
    formDescription: "",
    formType: "SKILL" as AbilityType,
    formCost: "2",
    formCooldown: "2",
    formOncePerMatch: false,
    formPayload: { ...emptyPayloadForm },
    extraPayloadKeys: {},
    rawPayloadText: "{}",
  };
}

export function AbilityEditorForm({
  ability,
  saving,
  onSubmit,
  onDelete,
}: AbilityEditorFormProps) {
  const { t } = useTranslation();
  const fieldLabel = (key: string) =>
    t(`admin.abilityEditor.fieldLabels.${key}`);
  const toggleLabel = (key: string) =>
    t(`admin.abilityEditor.toggleLabels.${key}`);
  const optionLabel = (key: string) =>
    t(`admin.abilityEditor.optionLabels.${key}`);
  const initialState = getInitialEditorState(ability);
  const [formKey, setFormKey] = useState(initialState.formKey);
  const [formName, setFormName] = useState(initialState.formName);
  const [formDescription, setFormDescription] = useState(
    initialState.formDescription,
  );
  const [formType, setFormType] = useState<AbilityType>(initialState.formType);
  const [formCost, setFormCost] = useState(initialState.formCost);
  const [formCooldown, setFormCooldown] = useState(initialState.formCooldown);
  const [formOncePerMatch, setFormOncePerMatch] = useState(
    initialState.formOncePerMatch,
  );
  const [formPayload, setFormPayload] = useState<PayloadFormState>(
    initialState.formPayload,
  );
  const [extraPayloadKeys, setExtraPayloadKeys] = useState<
    Record<string, unknown>
  >(initialState.extraPayloadKeys);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawPayloadText, setRawPayloadText] = useState(
    initialState.rawPayloadText,
  );
  const rawPayloadTouchedRef = useRef(false);
  const [rawPayloadError, setRawPayloadError] = useState("");
  const [formError, setFormError] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const syncedRawPayloadText = useMemo(
    () =>
      JSON.stringify(
        {
          ...extraPayloadKeys,
          ...formToPayload(formPayload),
        },
        null,
        2,
      ),
    [extraPayloadKeys, formPayload],
  );
  const activeRawPayloadText = rawPayloadTouchedRef.current
    ? rawPayloadText
    : syncedRawPayloadText;

  useEffect(() => {
    if (!rawPayloadTouchedRef.current) {
      setRawPayloadText(syncedRawPayloadText);
    }
  }, [syncedRawPayloadText]);

  const resetRawPayloadEditor = useCallback(() => {
    rawPayloadTouchedRef.current = false;
    setRawPayloadText(syncedRawPayloadText);
  }, [syncedRawPayloadText]);

  const markRawPayloadTouched = useCallback((value: string) => {
    rawPayloadTouchedRef.current = true;
    setRawPayloadText(value);
  }, []);

  const sectionDefaults = useMemo(
    () => ({
      passiveTrigger: !!(
        formPayload.trigger ||
        formPayload.chance ||
        formPayload.healingBonus ||
        formPayload.debuffImmunityCount ||
        formPayload.bonusCritChanceBasic ||
        formPayload.battleStartEnergyBonus ||
        formPayload.redirectIncomingChance ||
        formPayload.evasionChance ||
        formPayload.once ||
        formPayload.onBasicOnly
      ),
      damage: !!(
        formPayload.damageMul ||
        formPayload.ignoreDefensePct ||
        formPayload.splashPct ||
        formPayload.burnBonusMul ||
        formPayload.hits ||
        formPayload.executeDamageMul ||
        formPayload.lineOnly ||
        formPayload.applyStatusChance ||
        formPayload.damageReduction ||
        formPayload.instantKoIfTargetBelowHpPct ||
        formPayload.bonusDamageVsDebuffedTargetsPct
      ),
      healing: !!(
        formPayload.shieldPctOfMaxHp ||
        formPayload.shieldTarget ||
        formPayload.healPctOfDamage ||
        formPayload.healPctOfMaxHp ||
        formPayload.healLowestAllyPctOfDamage ||
        formPayload.healLowestHpAllyPctOfMaxHp ||
        formPayload.healPctOfMaxHpOnExecute ||
        formPayload.lifestealPct
      ),
      statuses:
        formPayload.applyStatuses.length > 0 ||
        formPayload.randomStatuses.length > 0 ||
        formPayload.applyStatusesToAttacker.length > 0,
      utility: !!(
        formPayload.cleanseCount ||
        formPayload.revivePct ||
        formPayload.reduceCooldowns ||
        formPayload.increaseTargetCooldowns ||
        formPayload.reduceEnemyCooldowns ||
        formPayload.selfDamagePct ||
        formPayload.stealBuffCount ||
        formPayload.swapHpPercentages ||
        formPayload.preventDeath ||
        formPayload.cleanseAllStatuses ||
        formPayload.hitCountLimit
      ),
      statBonuses: !!(
        formPayload.statBonusHp ||
        formPayload.statBonusAttack ||
        formPayload.statBonusDefense ||
        formPayload.statBonusSpeed ||
        formPayload.statBonusTarget ||
        formPayload.statBonusDurationMode ||
        formPayload.adjacentAuraStatusName ||
        formPayload.requiredAnyAllyTypes.length ||
        formPayload.applyToAllyTypes.length
      ),
      copyAbility: !!formPayload.copyAbilityType,
      conditional: !!formPayload.conditionalRaw.trim(),
    }),
    [formPayload],
  );

  const submit = useCallback(async () => {
    setFormError("");
    setRawPayloadError("");

    if (!formKey.trim() || !formName.trim() || !formDescription.trim()) {
      setFormError(t("admin.abilityEditor.requiredFields"));
      return false;
    }

    let payload: Record<string, unknown>;

    if (rawPayloadTouchedRef.current) {
      try {
        const parsed = JSON.parse(activeRawPayloadText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(t("admin.abilityEditor.payloadObjectError"));
        }

        payload = parsed as Record<string, unknown>;
      } catch (error) {
        const message = formatError(
          error,
          t("admin.abilityEditor.genericError"),
        );
        setRawPayloadError(message);
        setFormError(t("admin.abilityEditor.fixRawPayload"));
        return false;
      }
    } else {
      const isPositiveInteger = (value: string) =>
        /^[1-9]\d*$/.test(value.trim());
      const allStatusEntries = [
        ...formPayload.applyStatuses,
        ...formPayload.randomStatuses,
        ...formPayload.applyStatusesToAttacker,
      ];
      const invalidStatusDuration = allStatusEntries.find(
        (entry) =>
          !isConsumptionOnlyStatus(entry.name) &&
          entry.duration.trim() !== "" && !isPositiveInteger(entry.duration),
      );

      if (invalidStatusDuration) {
        setFormError(t("admin.abilityEditor.statusDurationError"));
        return false;
      }

      if (
        formPayload.adjacentAuraStatusName &&
        formPayload.adjacentAuraStatusDuration.trim() !== "" &&
        !isPositiveInteger(formPayload.adjacentAuraStatusDuration)
      ) {
        setFormError(t("admin.abilityEditor.auraDurationError"));
        return false;
      }

      if (formPayload.conditionalRaw.trim()) {
        try {
          JSON.parse(formPayload.conditionalRaw);
        } catch (error) {
          setFormError(
            t("admin.abilityEditor.conditionalInvalid", {
              error: formatError(error, t("admin.abilityEditor.genericError")),
            }),
          );
          return false;
        }
      }

      payload = {
        ...extraPayloadKeys,
        ...formToPayload(formPayload),
      };
    }

    await onSubmit({
      key: formKey.trim(),
      name: formName.trim(),
      description: formDescription.trim(),
      type: formType,
      cost: formType === "PASSIVE" ? 0 : Number(formCost || 0),
      cooldown:
        formType === "SKILL"
          ? formCooldown
            ? Number(formCooldown)
            : null
          : null,
      oncePerMatch:
        formType === "ULTIMATE"
          ? true
          : formType === "SKILL"
            ? formOncePerMatch
            : false,
      payload,
    });

    return true;
  }, [
    extraPayloadKeys,
    formCooldown,
    formCost,
    formDescription,
    formKey,
    formName,
    formOncePerMatch,
    formPayload,
    formType,
    onSubmit,
    activeRawPayloadText,
    t,
  ]);

  const footer = (
    <View className="flex-row gap-2 items-center">
      {ability ? (
        <AdminButton
          label={t("admin.abilityEditor.delete")}
          variant="danger"
          onPress={() =>
            Alert.alert(
              t("admin.abilityEditor.deleteAbilityTitle"),
              t("admin.abilityEditor.deleteAbilityBody", {
                name: ability.name,
              }),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("admin.abilityEditor.delete"),
                  style: "destructive",
                  onPress: () => void onDelete(ability.id),
                },
              ],
            )
          }
        />
      ) : null}
      <View className="flex-1" />
      <AdminButton
        label={
          saving
            ? t("admin.abilityEditor.saving")
            : t("admin.abilityEditor.save")
        }
        onPress={() => void submit()}
        disabled={saving}
      />
    </View>
  );

  return (
    <>
      <AdminNotice
        title={t("admin.abilityEditor.workflowTitle")}
        body={t("admin.abilityEditor.workflowBody")}
        tone="info"
        icon="sparkles"
      />

      <Section
        title={t("admin.abilityEditor.basicInfo")}
        subtitle={t("admin.abilityEditor.basicInfoDescription")}
        badgeLabel={t("admin.abilityEditor.sectionBadges.required")}
        badgeTone="accent"
        icon="create-outline"
        defaultOpen
      >
        <AbilityTypeSelector value={formType} onChange={setFormType} />
        <InfoPill
          tone="info"
          text={t(`admin.abilityEditor.typeDescriptions.${formType}`)}
        />
        <AdminField
          label={t("admin.abilityEditor.key")}
          value={formKey}
          onChangeText={setFormKey}
          placeholder={t("admin.abilityEditor.keyPlaceholder")}
        />
        <AdminField
          label={t("admin.abilityEditor.name")}
          value={formName}
          onChangeText={setFormName}
          placeholder={t("admin.abilityEditor.namePlaceholder")}
        />
        <AdminField
          label={t("admin.abilityEditor.description")}
          value={formDescription}
          onChangeText={setFormDescription}
          placeholder={t("admin.abilityEditor.descriptionPlaceholder")}
          multiline
        />
      </Section>

      <Section
        title={t("admin.abilityEditor.battleRules")}
        subtitle={t("admin.abilityEditor.battleRulesDescription")}
        badgeLabel={t("admin.abilityEditor.sectionBadges.guided")}
        badgeTone="warning"
        icon="options-outline"
        defaultOpen
      >
        {formType !== "PASSIVE" ? (
          <GridFields
            fields={[
              {
                label: t("admin.abilityEditor.cost"),
                value: formCost,
                onChangeText: setFormCost,
              },
              ...(formType === "SKILL"
                ? [
                    {
                      label: t("admin.abilityEditor.cooldown"),
                      value: formCooldown,
                      onChangeText: setFormCooldown,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
        {formType === "SKILL" ? (
          <ToggleRow
            label={t("admin.abilityEditor.oncePerMatch")}
            value={formOncePerMatch}
            onChange={setFormOncePerMatch}
          />
        ) : formType === "PASSIVE" ? (
          <InfoPill
            tone="accent"
            text={t("admin.abilityEditor.passiveRulesHint")}
          />
        ) : formType === "ULTIMATE" ? (
          <InfoPill
            tone="accent"
            text={t("admin.abilityEditor.ultimatesOncePerMatch")}
          />
        ) : null}
        <SelectField
          id="target"
          label={t("admin.abilityEditor.target")}
          options={[
            { label: t("admin.abilityEditor.none"), value: "" },
            ...ABILITY_TARGETS.map((value) => ({ label: value, value })),
          ]}
          value={formPayload.target}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              target: value as PayloadFormState["target"],
            }))
          }
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <SelectField
          id="target-selector"
          label={t("admin.abilityEditor.targetSelector")}
          options={[
            { label: t("admin.abilityEditor.none"), value: "" },
            ...ABILITY_TARGET_SELECTORS.map((value) => ({
              label: value,
              value,
            })),
          ]}
          value={formPayload.targetSelector}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              targetSelector: value as PayloadFormState["targetSelector"],
            }))
          }
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
      </Section>

      {formType === "PASSIVE" ? (
        <Section
          title={t("admin.abilityEditor.passiveTrigger")}
          subtitle={t("admin.abilityEditor.passiveTriggerDescription")}
          badgeLabel={
            sectionDefaults.passiveTrigger
              ? t("admin.abilityEditor.sectionBadges.configured")
              : t("admin.abilityEditor.sectionBadges.optional")
          }
          badgeTone={sectionDefaults.passiveTrigger ? "success" : "default"}
          icon="sparkles-outline"
          defaultOpen={sectionDefaults.passiveTrigger}
        >
          <SelectField
            id="trigger"
            label={t("admin.abilityEditor.trigger")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              ...PASSIVE_TRIGGERS.map((value) => ({ label: value, value })),
            ]}
            value={formPayload.trigger}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                trigger: value as PayloadFormState["trigger"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <GridFields
            fields={[
              {
                label: fieldLabel("chance"),
                value: formPayload.chance,
                onChangeText: (value) =>
                  setFormPayload((current) => ({ ...current, chance: value })),
              },
              {
                label: fieldLabel("thresholdPct"),
                value: formPayload.thresholdPct,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    thresholdPct: value,
                  })),
              },
              {
                label: fieldLabel("belowHpThreshold"),
                value: formPayload.belowHpThreshold,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    belowHpThreshold: value,
                  })),
              },
              {
                label: fieldLabel("healingBonus"),
                value: formPayload.healingBonus,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    healingBonus: value,
                  })),
              },
              {
                label: fieldLabel("debuffImmunityCount"),
                value: formPayload.debuffImmunityCount,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    debuffImmunityCount: value,
                  })),
              },
              {
                label: fieldLabel("bonusCritChanceBasic"),
                value: formPayload.bonusCritChanceBasic,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    bonusCritChanceBasic: value,
                  })),
              },
              {
                label: fieldLabel("battleStartEnergyBonus"),
                value: formPayload.battleStartEnergyBonus,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    battleStartEnergyBonus: value,
                  })),
              },
              {
                label: fieldLabel("redirectIncomingChance"),
                value: formPayload.redirectIncomingChance,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    redirectIncomingChance: value,
                  })),
              },
              {
                label: fieldLabel("redirectIfSelfAboveHpPct"),
                value: formPayload.redirectIfSelfAboveHpPct,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    redirectIfSelfAboveHpPct: value,
                  })),
              },
              {
                label: fieldLabel("evasionChance"),
                value: formPayload.evasionChance,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    evasionChance: value,
                  })),
              },
            ]}
          />
          <ToggleRow
            label={toggleLabel("once")}
            value={formPayload.once}
            onChange={(value) =>
              setFormPayload((current) => ({ ...current, once: value }))
            }
          />
          <ToggleRow
            label={toggleLabel("onBasicOnly")}
            value={formPayload.onBasicOnly}
            onChange={(value) =>
              setFormPayload((current) => ({ ...current, onBasicOnly: value }))
            }
          />
        </Section>
      ) : null}

      <Section
        title={t("admin.abilityEditor.damage")}
        subtitle={t("admin.abilityEditor.damageDescription")}
        badgeLabel={
          sectionDefaults.damage
            ? t("admin.abilityEditor.sectionBadges.configured")
            : t("admin.abilityEditor.sectionBadges.optional")
        }
        badgeTone={sectionDefaults.damage ? "success" : "default"}
        icon="flash-outline"
        defaultOpen={sectionDefaults.damage}
      >
        <GridFields
          fields={[
            {
              label: fieldLabel("damageMul"),
              value: formPayload.damageMul,
              onChangeText: (value) =>
                setFormPayload((current) => ({ ...current, damageMul: value })),
            },
            {
              label: fieldLabel("ignoreDefensePct"),
              value: formPayload.ignoreDefensePct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  ignoreDefensePct: value,
                })),
            },
            {
              label: fieldLabel("splashPct"),
              value: formPayload.splashPct,
              onChangeText: (value) =>
                setFormPayload((current) => ({ ...current, splashPct: value })),
            },
            {
              label: fieldLabel("burnBonusMul"),
              value: formPayload.burnBonusMul,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  burnBonusMul: value,
                })),
            },
            {
              label: fieldLabel("bonusDamageVsDebuffedTargetsPct"),
              value: formPayload.bonusDamageVsDebuffedTargetsPct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  bonusDamageVsDebuffedTargetsPct: value,
                })),
            },
            {
              label: fieldLabel("instantKoIfTargetBelowHpPct"),
              value: formPayload.instantKoIfTargetBelowHpPct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  instantKoIfTargetBelowHpPct: value,
                })),
            },
            {
              label: fieldLabel("applyStatusChance"),
              value: formPayload.applyStatusChance,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  applyStatusChance: value,
                })),
            },
            {
              label: fieldLabel("hits"),
              value: formPayload.hits,
              onChangeText: (value) =>
                setFormPayload((current) => ({ ...current, hits: value })),
            },
            {
              label: fieldLabel("executeDamageMul"),
              value: formPayload.executeDamageMul,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  executeDamageMul: value,
                })),
            },
            {
              label: fieldLabel("executeThreshold"),
              value: formPayload.executeThreshold,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  executeThreshold: value,
                })),
            },
            {
              label: fieldLabel("healPctOfMaxHpOnExecute"),
              value: formPayload.healPctOfMaxHpOnExecute,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  healPctOfMaxHpOnExecute: value,
                })),
            },
            {
              label: fieldLabel("damageReduction"),
              value: formPayload.damageReduction,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  damageReduction: value,
                })),
            },
          ]}
        />
        <ToggleRow
          label={toggleLabel("lineOnly")}
          value={formPayload.lineOnly}
          onChange={(value) =>
            setFormPayload((current) => ({ ...current, lineOnly: value }))
          }
        />
      </Section>

      <Section
        title={t("admin.abilityEditor.healingAndShield")}
        subtitle={t("admin.abilityEditor.healingAndShieldDescription")}
        badgeLabel={
          sectionDefaults.healing
            ? t("admin.abilityEditor.sectionBadges.configured")
            : t("admin.abilityEditor.sectionBadges.optional")
        }
        badgeTone={sectionDefaults.healing ? "success" : "default"}
        icon="medkit-outline"
        defaultOpen={sectionDefaults.healing}
      >
        <SelectField
          id="shield-target"
          label={fieldLabel("shieldTarget")}
          options={[
            { label: t("admin.abilityEditor.none"), value: "" },
            { label: optionLabel("self"), value: "self" },
            { label: optionLabel("target"), value: "target" },
            { label: optionLabel("allAllies"), value: "allAllies" },
          ]}
          value={formPayload.shieldTarget}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              shieldTarget: value as PayloadFormState["shieldTarget"],
            }))
          }
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <GridFields
          fields={[
            {
              label: fieldLabel("shieldPctOfMaxHp"),
              value: formPayload.shieldPctOfMaxHp,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  shieldPctOfMaxHp: value,
                })),
            },
            {
              label: fieldLabel("healPctOfDamage"),
              value: formPayload.healPctOfDamage,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  healPctOfDamage: value,
                })),
            },
            {
              label: fieldLabel("healLowestAllyPctOfDamage"),
              value: formPayload.healLowestAllyPctOfDamage,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  healLowestAllyPctOfDamage: value,
                })),
            },
            {
              label: fieldLabel("healPctOfMaxHp"),
              value: formPayload.healPctOfMaxHp,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  healPctOfMaxHp: value,
                })),
            },
            {
              label: fieldLabel("lifestealPct"),
              value: formPayload.lifestealPct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  lifestealPct: value,
                })),
            },
            {
              label: fieldLabel("healLowestHpAllyPctOfMaxHp"),
              value: formPayload.healLowestHpAllyPctOfMaxHp,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  healLowestHpAllyPctOfMaxHp: value,
                })),
            },
          ]}
        />
      </Section>

      <Section
        title={t("admin.abilityEditor.statusesAndBuffs")}
        subtitle={t("admin.abilityEditor.statusesAndBuffsDescription")}
        badgeLabel={
          sectionDefaults.statuses
            ? t("admin.abilityEditor.sectionBadges.configured")
            : t("admin.abilityEditor.sectionBadges.optional")
        }
        badgeTone={sectionDefaults.statuses ? "success" : "default"}
        icon="pulse-outline"
        defaultOpen={sectionDefaults.statuses}
      >
        <StatusArrayEditor
          label={t("admin.abilityEditor.groups.applyStatuses")}
          entries={formPayload.applyStatuses}
          includeTargeting
          dropdownIdPrefix="apply-statuses"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() =>
            setFormPayload((current) => ({
              ...current,
              applyStatuses: [...current.applyStatuses, defaultStatusEntry()],
            }))
          }
          onChange={(entries) =>
            setFormPayload((current) => ({
              ...current,
              applyStatuses: entries as PayloadFormState["applyStatuses"],
            }))
          }
        />
        <StatusArrayEditor
          label={t("admin.abilityEditor.groups.randomStatuses")}
          entries={formPayload.randomStatuses}
          dropdownIdPrefix="random-statuses"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() =>
            setFormPayload((current) => ({
              ...current,
              randomStatuses: [
                ...current.randomStatuses,
                defaultSimpleStatusEntry(),
              ],
            }))
          }
          onChange={(entries) =>
            setFormPayload((current) => ({
              ...current,
              randomStatuses: entries as PayloadFormState["randomStatuses"],
            }))
          }
        />
        <StatusArrayEditor
          label={t("admin.abilityEditor.groups.applyStatusesToAttacker")}
          entries={formPayload.applyStatusesToAttacker}
          dropdownIdPrefix="statuses-to-attacker"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() =>
            setFormPayload((current) => ({
              ...current,
              applyStatusesToAttacker: [
                ...current.applyStatusesToAttacker,
                defaultSimpleStatusEntry(),
              ],
            }))
          }
          onChange={(entries) =>
            setFormPayload((current) => ({
              ...current,
              applyStatusesToAttacker:
                entries as PayloadFormState["applyStatusesToAttacker"],
            }))
          }
        />
      </Section>

      <Section
        title={t("admin.abilityEditor.utility")}
        subtitle={t("admin.abilityEditor.utilityDescription")}
        badgeLabel={
          sectionDefaults.utility
            ? t("admin.abilityEditor.sectionBadges.configured")
            : t("admin.abilityEditor.sectionBadges.optional")
        }
        badgeTone={sectionDefaults.utility ? "success" : "default"}
        icon="construct-outline"
        defaultOpen={sectionDefaults.utility}
      >
        <SelectField
          id="cleanse-target"
          label={fieldLabel("cleanseTarget")}
          options={[
            { label: t("admin.abilityEditor.none"), value: "" },
            { label: optionLabel("self"), value: "self" },
            { label: optionLabel("ally"), value: "ally" },
            { label: optionLabel("allAllies"), value: "allAllies" },
            { label: optionLabel("allEnemies"), value: "allEnemies" },
          ]}
          value={formPayload.cleanseTarget}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              cleanseTarget: value as PayloadFormState["cleanseTarget"],
            }))
          }
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <GridFields
          fields={[
            {
              label: fieldLabel("cleanseCount"),
              value: formPayload.cleanseCount,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  cleanseCount: value,
                })),
            },
            {
              label: fieldLabel("revivePct"),
              value: formPayload.revivePct,
              onChangeText: (value) =>
                setFormPayload((current) => ({ ...current, revivePct: value })),
            },
            {
              label: fieldLabel("reviveAllyOnEnemyKoPct"),
              value: formPayload.reviveAllyOnEnemyKoPct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  reviveAllyOnEnemyKoPct: value,
                })),
            },
            {
              label: fieldLabel("reduceCooldowns"),
              value: formPayload.reduceCooldowns,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  reduceCooldowns: value,
                })),
            },
            {
              label: fieldLabel("increaseTargetCooldowns"),
              value: formPayload.increaseTargetCooldowns,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  increaseTargetCooldowns: value,
                })),
            },
            {
              label: fieldLabel("reduceEnemyCooldowns"),
              value: formPayload.reduceEnemyCooldowns,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  reduceEnemyCooldowns: value,
                })),
            },
            {
              label: fieldLabel("hitCountLimit"),
              value: formPayload.hitCountLimit,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  hitCountLimit: value,
                })),
            },
            {
              label: fieldLabel("selfDamagePct"),
              value: formPayload.selfDamagePct,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  selfDamagePct: value,
                })),
            },
            {
              label: fieldLabel("stealBuffCount"),
              value: formPayload.stealBuffCount,
              onChangeText: (value) =>
                setFormPayload((current) => ({
                  ...current,
                  stealBuffCount: value,
                })),
            },
          ]}
        />
        <ToggleRow
          label={toggleLabel("cleanseAllStatuses")}
          value={formPayload.cleanseAllStatuses}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              cleanseAllStatuses: value,
            }))
          }
        />
        <ToggleRow
          label={toggleLabel("alsoCleanseAllEnemies")}
          value={formPayload.alsoCleanseAllEnemies}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              alsoCleanseAllEnemies: value,
            }))
          }
        />
        <ToggleRow
          label={toggleLabel("preventDeath")}
          value={formPayload.preventDeath}
          onChange={(value) =>
            setFormPayload((current) => ({ ...current, preventDeath: value }))
          }
        />
        <ToggleRow
          label={toggleLabel("swapHpPercentages")}
          value={formPayload.swapHpPercentages}
          onChange={(value) =>
            setFormPayload((current) => ({
              ...current,
              swapHpPercentages: value,
            }))
          }
        />
      </Section>

      {formType === "PASSIVE" ? (
        <Section
          title={t("admin.abilityEditor.statBonuses")}
          subtitle={t("admin.abilityEditor.statBonusesDescription")}
          badgeLabel={
            sectionDefaults.statBonuses
              ? t("admin.abilityEditor.sectionBadges.configured")
              : t("admin.abilityEditor.sectionBadges.optional")
          }
          badgeTone={sectionDefaults.statBonuses ? "success" : "default"}
          icon="barbell-outline"
          defaultOpen={sectionDefaults.statBonuses}
        >
          <SelectField
            id="stat-bonus-target"
            label={fieldLabel("statBonusTarget")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              { label: optionLabel("self"), value: "self" },
              { label: optionLabel("allAllies"), value: "allAllies" },
              { label: optionLabel("allEnemies"), value: "allEnemies" },
            ]}
            value={formPayload.statBonusTarget}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                statBonusTarget: value as PayloadFormState["statBonusTarget"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <SelectField
            id="stat-duration-mode"
            label={fieldLabel("statBonusDurationMode")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              { label: optionLabel("permanent"), value: "permanent" },
              {
                label: optionLabel("whileSourceActive"),
                value: "whileSourceActive",
              },
            ]}
            value={formPayload.statBonusDurationMode}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                statBonusDurationMode:
                  value as PayloadFormState["statBonusDurationMode"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <GridFields
            fields={[
              {
                label: fieldLabel("statBonusHp"),
                value: formPayload.statBonusHp,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    statBonusHp: value,
                  })),
              },
              {
                label: fieldLabel("statBonusAttack"),
                value: formPayload.statBonusAttack,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    statBonusAttack: value,
                  })),
              },
              {
                label: fieldLabel("statBonusDefense"),
                value: formPayload.statBonusDefense,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    statBonusDefense: value,
                  })),
              },
              {
                label: fieldLabel("statBonusSpeed"),
                value: formPayload.statBonusSpeed,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    statBonusSpeed: value,
                  })),
              },
              {
                label: fieldLabel("adjacentAuraStatusDuration"),
                value: formPayload.adjacentAuraStatusDuration,
                onChangeText: (value) =>
                  setFormPayload((current) => ({
                    ...current,
                    adjacentAuraStatusDuration: value,
                  })),
              },
            ]}
          />
          <SelectField
            id="adjacent-aura-status"
            label={fieldLabel("adjacentAuraStatusName")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              ...STATUS_NAMES.map((value) => ({ label: value, value })),
            ]}
            value={formPayload.adjacentAuraStatusName}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                adjacentAuraStatusName:
                  value as PayloadFormState["adjacentAuraStatusName"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <MultiSelectRow
            label={fieldLabel("requiredAnyAllyTypes")}
            values={formPayload.requiredAnyAllyTypes}
            options={TYPE_NAMES}
            onToggle={(value) =>
              setFormPayload((current) => ({
                ...current,
                requiredAnyAllyTypes: toggleListValue(
                  current.requiredAnyAllyTypes,
                  value as TypeName,
                ),
              }))
            }
          />
          <MultiSelectRow
            label={fieldLabel("applyToAllyTypes")}
            values={formPayload.applyToAllyTypes}
            options={TYPE_NAMES}
            onToggle={(value) =>
              setFormPayload((current) => ({
                ...current,
                applyToAllyTypes: toggleListValue(
                  current.applyToAllyTypes,
                  value as TypeName,
                ),
              }))
            }
          />
        </Section>
      ) : (
        <Section
          title={t("admin.abilityEditor.copyAbility")}
          subtitle={t("admin.abilityEditor.copyAbilityDescription")}
          badgeLabel={
            sectionDefaults.copyAbility
              ? t("admin.abilityEditor.sectionBadges.configured")
              : t("admin.abilityEditor.sectionBadges.optional")
          }
          badgeTone={sectionDefaults.copyAbility ? "success" : "default"}
          icon="copy-outline"
          defaultOpen={sectionDefaults.copyAbility}
        >
          <SelectField
            id="copy-ability-type"
            label={fieldLabel("copyAbilityType")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              { label: t("admin.abilities.type.SKILL"), value: "SKILL" },
              { label: t("admin.abilities.type.ULTIMATE"), value: "ULTIMATE" },
            ]}
            value={formPayload.copyAbilityType}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                copyAbilityType: value as PayloadFormState["copyAbilityType"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <SelectField
            id="copy-source"
            label={fieldLabel("copyAbilitySource")}
            options={[
              { label: t("admin.abilityEditor.none"), value: "" },
              { label: optionLabel("enemy"), value: "enemy" },
              { label: optionLabel("ally"), value: "ally" },
              { label: optionLabel("either"), value: "either" },
            ]}
            value={formPayload.copyAbilitySource}
            onChange={(value) =>
              setFormPayload((current) => ({
                ...current,
                copyAbilitySource:
                  value as PayloadFormState["copyAbilitySource"],
              }))
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
        </Section>
      )}

      <Section
        title={t("admin.abilityEditor.conditionalJson")}
        subtitle={t("admin.abilityEditor.conditionalJsonDescription")}
        badgeLabel={
          sectionDefaults.conditional
            ? t("admin.abilityEditor.sectionBadges.configured")
            : t("admin.abilityEditor.sectionBadges.optional")
        }
        badgeTone={sectionDefaults.conditional ? "success" : "default"}
        icon="git-branch-outline"
        defaultOpen={sectionDefaults.conditional}
      >
        <JsonField
          label={t("admin.abilityEditor.conditional")}
          value={formPayload.conditionalRaw}
          onChangeText={(value) =>
            setFormPayload((current) => ({ ...current, conditionalRaw: value }))
          }
          placeholder='{"when": {...}}'
        />
      </Section>

      <Section
        title={t("admin.abilityEditor.rawPayloadJson")}
        subtitle={t("admin.abilityEditor.rawPayloadJsonDescription")}
        badgeLabel={t("admin.abilityEditor.sectionBadges.advanced")}
        badgeTone="warning"
        icon="code-slash-outline"
        defaultOpen={showRawJson}
      >
        <AdminNotice
          title={t("admin.abilityEditor.rawPayloadNoticeTitle")}
          body={t("admin.abilityEditor.rawPayloadNoticeBody")}
          tone="warning"
          icon="code-slash"
        />
        <ToggleRow
          label={t("admin.abilityEditor.useRawPayloadEditor")}
          value={showRawJson}
          onChange={setShowRawJson}
        />
        {showRawJson ? (
          <>
            <JsonField
              label={t("admin.abilityEditor.payloadJson")}
              value={activeRawPayloadText}
              onChangeText={markRawPayloadTouched}
              placeholder="{}"
            />
            {rawPayloadError ? (
              <Text className="font-nunito-bold text-xs text-dangerText">
                {rawPayloadError}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="font-nunito-semibold text-xs text-fgMuted">
            {t("admin.abilityEditor.rawPayloadSyncHint")}
          </Text>
        )}
        {showRawJson ? (
          <AdminButton
            label={t("admin.abilityEditor.resetRawPayload")}
            variant="ghost"
            onPress={resetRawPayloadEditor}
          />
        ) : null}
      </Section>

      {formError ? (
        <Text className="font-nunito-bold text-[13px] text-dangerText px-1">
          {formError}
        </Text>
      ) : null}
      {footer}
    </>
  );
}

function toggleListValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function Section({
  title,
  subtitle,
  badgeLabel,
  badgeTone = "default",
  icon = "albums-outline",
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeTone?: "default" | "success" | "info" | "accent" | "danger" | "warning";
  icon?: IoniconName;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  return (
    <View className="rounded-[22] overflow-hidden border border-primaryBorder/18 bg-surfaceMuted">
      <Pressable
        className="px-4 py-[14] flex-row items-center gap-3 bg-primaryTint/95"
        onPress={() => setOpen((current) => !current)}
      >
        <View
          className="size-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: withAlpha(tc.primaryStrong, "12") }}
        >
          <Ionicons name={icon} size={18} color={tc.primaryStrong} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="font-nunito-extrabold text-[15px] text-primaryStrong">
              {title}
            </Text>
            {badgeLabel ? <AdminChip label={badgeLabel} tone={badgeTone} /> : null}
          </View>
          {subtitle ? (
            <Text className="font-nunito-semibold text-[12px] leading-[18px] text-fgMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Text className="font-nunito-bold text-xs text-primaryStrong">
          {open ? t("admin.abilityEditor.hide") : t("admin.abilityEditor.show")}
        </Text>
      </Pressable>
      {open ? <View className="p-[14] gap-[14]">{children}</View> : null}
    </View>
  );
}

function GridFields({
  fields,
}: {
  fields: Array<{
    label: string;
    value: string;
    onChangeText: (value: string) => void;
  }>;
}) {
  return (
    <View className="flex-row flex-wrap gap-[10]">
      {fields.map((field) => (
        <View key={field.label} className="min-w-[48%] flex-1">
          <AdminField
            label={field.label}
            value={field.value}
            onChangeText={field.onChangeText}
            keyboardType="numeric"
          />
        </View>
      ))}
    </View>
  );
}

function AbilityTypeSelector({
  value,
  onChange,
}: {
  value: AbilityType;
  onChange: (value: AbilityType) => void;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="font-nunito-bold text-xs text-primaryText">
          {t("admin.abilityEditor.type")}
        </Text>
        <Text className="font-nunito-semibold text-xs leading-[18px] text-fgMuted">
          {t("admin.abilityEditor.typeSelectorHint")}
        </Text>
      </View>
      <View className="gap-2">
        {ABILITY_TYPE_OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              className="rounded-[20] border px-4 py-3 flex-row items-center gap-3"
              style={{
                backgroundColor: selected
                  ? withAlpha(tc.primaryTint, "9C")
                  : withAlpha(tc.surface, "F0"),
                borderColor: selected
                  ? withAlpha(tc.primaryStrong, "6B")
                  : withAlpha(tc.primaryBorder, "45"),
              }}
              onPress={() => onChange(option.value)}
            >
              <View
                className="size-11 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: selected
                    ? withAlpha(tc.primaryStrong, "18")
                    : withAlpha(tc.surfaceMuted, "E6"),
                }}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={selected ? tc.primaryStrong : tc.primaryText}
                />
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <AbilityTypeChip type={option.value} />
                  {selected ? (
                    <AdminChip
                      label={t("admin.abilityEditor.sectionBadges.selected")}
                      tone="accent"
                    />
                  ) : null}
                </View>
                <Text className="font-nunito-semibold text-[12px] leading-[18px] text-fgMuted">
                  {t(`admin.abilityEditor.typeDescriptions.${option.value}`)}
                </Text>
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={selected ? tc.primaryStrong : tc.primaryBorder}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className="min-h-[58] rounded-[22] border px-[14] py-3 flex-row items-center gap-3"
      style={{
        backgroundColor: value
          ? withAlpha(tc.primaryTint, "99")
          : withAlpha(tc.surface, "EB"),
        borderColor: value
          ? withAlpha(tc.primary, "8A")
          : withAlpha(tc.primaryBorder, "45"),
      }}
      onPress={() => onChange(!value)}
    >
      <View className="flex-1 gap-1">
        <Text
          className="font-nunito-bold text-[13px]"
          style={{ color: value ? tc.primaryStrong : tc.primaryText }}
        >
          {label}
        </Text>
        <Text
          className="font-nunito-semibold text-[12px]"
          style={{ color: value ? tc.primaryText : tc.fgMuted }}
        >
          {value ? t("admin.abilityEditor.on") : t("admin.abilityEditor.off")}
        </Text>
      </View>
      <View pointerEvents="none">
        <ThemedExpoSwitch
          value={value}
          onValueChange={onChange}
          themeName={themeName}
        />
      </View>
    </Pressable>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  openDropdownId,
  setOpenDropdownId,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const open = openDropdownId === id;
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    t("admin.abilityEditor.selectOption");

  return (
    <View className="gap-2">
      <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
      <View className="gap-2">
        <Pressable
          className={`min-h-[46] rounded-2xl border-2 flex-row items-center justify-between gap-3 px-[14] ${open ? "border-primary bg-primaryBg" : "border-primaryBorder bg-surface/95"}`}
          onPress={() => setOpenDropdownId(open ? null : id)}
        >
          <Text className="flex-1 font-nunito-bold text-sm text-fg">
            {selectedLabel}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={18}
            color={tc.primaryText}
          />
        </Pressable>
        {open ? (
          <View className="rounded-[18] border border-primaryBorder/18 bg-surface/96 overflow-hidden">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={`${label}-${option.value || "empty"}`}
                  className={`min-h-[42] px-[14] py-[10] flex-row items-center justify-between border-b border-primaryBorder/12 ${selected ? "bg-primaryBg" : ""}`}
                  onPress={() => {
                    onChange(option.value);
                    setOpenDropdownId(null);
                  }}
                >
                  <Text
                    className={`flex-1 font-nunito-bold text-[13px] ${selected ? "text-primaryStrong" : "text-primaryText"}`}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={tc.primaryStrong}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MultiSelectRow({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <Pressable
              key={`${label}-${option}`}
              className={`px-3 py-[9] rounded-full border ${selected ? "bg-primaryTint border-primary" : "border-primaryBorder/20 bg-surface/95"}`}
              onPress={() => onToggle(option)}
            >
              <Text
                className={`font-nunito-bold text-xs ${selected ? "text-primaryStrong" : "text-primaryText"}`}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StatusArrayEditor({
  label,
  entries,
  includeTargeting,
  dropdownIdPrefix,
  openDropdownId,
  setOpenDropdownId,
  onAdd,
  onChange,
}: {
  label: string;
  entries: Array<{
    name: StatusName;
    duration: string;
    magnitude: string;
    target?: PayloadFormState["target"];
    targetSelector?: PayloadFormState["targetSelector"];
  }>;
  includeTargeting?: boolean;
  dropdownIdPrefix: string;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  onAdd: () => void;
  onChange: (
    entries: Array<{
      name: StatusName;
      duration: string;
      magnitude: string;
      target?: PayloadFormState["target"];
      targetSelector?: PayloadFormState["targetSelector"];
    }>,
  ) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center gap-[10]">
        <Text className="font-nunito-bold text-xs text-primaryText">
          {label}
        </Text>
        <AdminButton
          label={t("admin.abilityEditor.add")}
          variant="ghost"
          onPress={onAdd}
        />
      </View>
      {entries.length === 0 ? (
        <Text className="font-nunito-semibold text-xs text-fgMuted">
          {t("admin.abilityEditor.noEntriesYet")}
        </Text>
      ) : null}
      {entries.map((entry, index) => {
        const isConsumptionOnly = isConsumptionOnlyStatus(entry.name);

        return (
          <View
            key={`${label}-${index}`}
            className="rounded-[18] p-3 gap-3 bg-surface/92 border border-primaryBorder/16"
          >
            <View className="flex-row justify-between items-center gap-[10]">
              <Text className="font-nunito-extrabold text-[13px] text-primaryText">
                {t("admin.abilityEditor.entry", { index: index + 1 })}
              </Text>
              <AdminButton
                label={t("admin.abilityEditor.remove")}
                variant="ghost"
                onPress={() =>
                  onChange(
                    entries.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              />
            </View>
            <SelectField
              id={`${dropdownIdPrefix}-${index}-status`}
              label={t("admin.abilityEditor.status")}
              options={STATUS_NAMES.map((value) => ({ label: value, value }))}
              value={entry.name}
              onChange={(value) =>
                onChange(
                  entries.map((current, entryIndex) =>
                    entryIndex === index
                      ? {
                          ...current,
                          name: value as StatusName,
                          duration: isConsumptionOnlyStatus(value)
                            ? ""
                            : current.duration,
                        }
                      : current,
                  ),
                )
              }
              openDropdownId={openDropdownId}
              setOpenDropdownId={setOpenDropdownId}
            />
            <View className="flex-row gap-[10]">
              {isConsumptionOnly ? (
                <View className="flex-1 justify-center rounded-[14] border border-primaryBorder/20 bg-surfaceMuted/70 px-3 py-2">
                  <Text className="font-nunito-bold text-[11px] text-fgMuted">
                    {t("admin.abilityEditor.duration")}
                  </Text>
                  <Text className="font-nunito-semibold text-xs text-primaryText">
                    {t("admin.abilityEditor.consumedOnAction")}
                  </Text>
                </View>
              ) : (
                <View className="flex-1">
                  <AdminField
                    label={t("admin.abilityEditor.duration")}
                    value={entry.duration}
                    onChangeText={(value) =>
                      onChange(
                        entries.map((current, entryIndex) =>
                          entryIndex === index
                            ? { ...current, duration: value }
                            : current,
                        ),
                      )
                    }
                    keyboardType="numeric"
                  />
                </View>
              )}
              <View className="flex-1">
                <AdminField
                  label={t("admin.abilityEditor.magnitude")}
                  value={entry.magnitude}
                  onChangeText={(value) =>
                    onChange(
                      entries.map((current, entryIndex) =>
                        entryIndex === index
                          ? { ...current, magnitude: value }
                          : current,
                      ),
                    )
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            {includeTargeting ? (
              <>
                <SelectField
                  id={`${dropdownIdPrefix}-${index}-target`}
                  label={t("admin.abilityEditor.entryTarget")}
                  options={[
                    { label: t("admin.abilityEditor.none"), value: "" },
                    ...ABILITY_TARGETS.map((value) => ({
                      label: value,
                      value,
                    })),
                  ]}
                  value={entry.target ?? ""}
                  onChange={(value) =>
                    onChange(
                      entries.map((current, entryIndex) =>
                        entryIndex === index
                          ? {
                              ...current,
                              target: value as PayloadFormState["target"],
                            }
                          : current,
                      ),
                    )
                  }
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                />
                <SelectField
                  id={`${dropdownIdPrefix}-${index}-selector`}
                  label={t("admin.abilityEditor.entrySelector")}
                  options={[
                    { label: t("admin.abilityEditor.none"), value: "" },
                    ...ABILITY_TARGET_SELECTORS.map((value) => ({
                      label: value,
                      value,
                    })),
                  ]}
                  value={entry.targetSelector ?? ""}
                  onChange={(value) =>
                    onChange(
                      entries.map((current, entryIndex) =>
                        entryIndex === index
                          ? {
                              ...current,
                              targetSelector:
                                value as PayloadFormState["targetSelector"],
                            }
                          : current,
                      ),
                    )
                  }
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                />
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function JsonField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <View className="gap-2">
      <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
      <ThemedExpoTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        hostStyle={{ minHeight: 170, width: "100%" }}
        style={{
          backgroundColor: tc.surface,
          borderColor: tc.primaryBorder,
          borderRadius: 16,
          borderWidth: 2,
          paddingHorizontal: 14,
          paddingVertical: 12,
          width: "100%",
        }}
        textStyle={{ color: tc.fg, fontFamily: "monospace", fontSize: 13 }}
        numberOfLines={8}
      />
    </View>
  );
}

function InfoPill({
  text,
  tone = "warning",
}: {
  text: string;
  tone?: "info" | "warning" | "accent";
}) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const palette = {
    info: {
      bg: withAlpha(tc.infoTint, "D9"),
      text: tc.infoText,
    },
    warning: {
      bg: withAlpha(tc.secondaryTint, "D9"),
      text: tc.secondaryText,
    },
    accent: {
      bg: withAlpha(tc.accentTint, "D9"),
      text: tc.accentText,
    },
  }[tone];

  return (
    <View
      className="rounded-[16] px-3 py-[10]"
      style={{ backgroundColor: palette.bg }}
    >
      <Text className="font-nunito-bold text-xs" style={{ color: palette.text }}>
        {text}
      </Text>
    </View>
  );
}
