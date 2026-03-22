import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ABILITY_TARGET_SELECTORS,
  ABILITY_TARGETS,
  emptyPayloadForm,
  formToPayload,
  PASSIVE_TRIGGERS,
  payloadToForm,
  STATUS_NAMES,
  stripStructuredPayloadKeys,
  TYPE_NAMES,
  type PayloadFormState,
  type StatusName,
  type TypeName,
} from "./ability-payload";
import { AdminButton, AdminField } from "./admin-ui";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

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

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
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
  const initialState = getInitialEditorState(ability);
  const [formKey, setFormKey] = useState(initialState.formKey);
  const [formName, setFormName] = useState(initialState.formName);
  const [formDescription, setFormDescription] = useState(initialState.formDescription);
  const [formType, setFormType] = useState<AbilityType>(initialState.formType);
  const [formCost, setFormCost] = useState(initialState.formCost);
  const [formCooldown, setFormCooldown] = useState(initialState.formCooldown);
  const [formOncePerMatch, setFormOncePerMatch] = useState(initialState.formOncePerMatch);
  const [formPayload, setFormPayload] = useState<PayloadFormState>(initialState.formPayload);
  const [extraPayloadKeys, setExtraPayloadKeys] = useState<Record<string, unknown>>(initialState.extraPayloadKeys);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawPayloadText, setRawPayloadText] = useState(initialState.rawPayloadText);
  const [rawPayloadTouched, setRawPayloadTouched] = useState(false);
  const [rawPayloadError, setRawPayloadError] = useState("");
  const [formError, setFormError] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const nextState = getInitialEditorState(ability);

    setFormKey(nextState.formKey);
    setFormName(nextState.formName);
    setFormDescription(nextState.formDescription);
    setFormType(nextState.formType);
    setFormCost(nextState.formCost);
    setFormCooldown(nextState.formCooldown);
    setFormOncePerMatch(nextState.formOncePerMatch);
    setFormPayload(nextState.formPayload);
    setExtraPayloadKeys(nextState.extraPayloadKeys);
    setRawPayloadText(nextState.rawPayloadText);

    setShowRawJson(false);
    setOpenDropdownId(null);
    setRawPayloadTouched(false);
    setRawPayloadError("");
    setFormError("");
  }, [ability]);

  useEffect(() => {
    if (rawPayloadTouched) {
      return;
    }

    const merged = {
      ...extraPayloadKeys,
      ...formToPayload(formPayload),
    };
    setRawPayloadText(JSON.stringify(merged, null, 2));
  }, [extraPayloadKeys, formPayload, rawPayloadTouched]);

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
      setFormError("Key, name, and description are required.");
      return false;
    }

    let payload: Record<string, unknown>;

    if (rawPayloadTouched) {
      try {
        const parsed = JSON.parse(rawPayloadText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Payload JSON must be an object.");
        }

        payload = parsed as Record<string, unknown>;
      } catch (error) {
        const message = formatError(error);
        setRawPayloadError(message);
        setFormError("Fix the raw payload JSON before saving.");
        return false;
      }
    } else {
      const isPositiveInteger = (value: string) => /^[1-9]\d*$/.test(value.trim());
      const allStatusEntries = [
        ...formPayload.applyStatuses,
        ...formPayload.randomStatuses,
        ...formPayload.applyStatusesToAttacker,
      ];
      const invalidStatusDuration = allStatusEntries.find(
        (entry) => entry.duration.trim() !== "" && !isPositiveInteger(entry.duration),
      );

      if (invalidStatusDuration) {
        setFormError("Status durations must be positive whole numbers.");
        return false;
      }

      if (
        formPayload.adjacentAuraStatusName &&
        formPayload.adjacentAuraStatusDuration.trim() !== "" &&
        !isPositiveInteger(formPayload.adjacentAuraStatusDuration)
      ) {
        setFormError("Adjacent aura duration must be a positive whole number.");
        return false;
      }

      if (formPayload.conditionalRaw.trim()) {
        try {
          JSON.parse(formPayload.conditionalRaw);
        } catch (error) {
          setFormError(`Conditional JSON is invalid. ${formatError(error)}`);
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
      cooldown: formType === "SKILL" ? (formCooldown ? Number(formCooldown) : null) : null,
      oncePerMatch: formType === "ULTIMATE" ? true : formType === "SKILL" ? formOncePerMatch : false,
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
    rawPayloadText,
    rawPayloadTouched,
  ]);

  const footer = (
    <View className="flex-row gap-2 items-center">
      {ability ? (
        <AdminButton
          label="Delete"
          variant="danger"
          onPress={() =>
            Alert.alert("Delete ability", `Delete ${ability.name}?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => void onDelete(ability.id),
              },
            ])
          }
        />
      ) : null}
      <View className="flex-1" />
      <AdminButton label={saving ? "Saving..." : "Save"} onPress={() => void submit()} disabled={saving} />
    </View>
  );

  return (
    <>
      <Section title="Basic info" defaultOpen>
        <AdminField label="Key" value={formKey} onChangeText={setFormKey} placeholder="ability_key" />
        <AdminField label="Name" value={formName} onChangeText={setFormName} placeholder="Ability name" />
        <AdminField
          label="Description"
          value={formDescription}
          onChangeText={setFormDescription}
          placeholder="Describe what the ability does"
          multiline
        />
        <SelectField
          id="type"
          label="Type"
          options={[
            { label: "PASSIVE", value: "PASSIVE" },
            { label: "SKILL", value: "SKILL" },
            { label: "ULTIMATE", value: "ULTIMATE" },
          ]}
          value={formType}
          onChange={(value) => setFormType(value as AbilityType)}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        {formType !== "PASSIVE" ? (
          <View className="flex-row gap-[10]">
            <View className="flex-1">
              <AdminField label="Cost" value={formCost} onChangeText={setFormCost} keyboardType="numeric" />
            </View>
            {formType === "SKILL" ? (
              <View className="flex-1">
                <AdminField label="Cooldown" value={formCooldown} onChangeText={setFormCooldown} keyboardType="numeric" />
              </View>
            ) : null}
          </View>
        ) : null}
        {formType === "SKILL" ? (
          <ToggleRow label="Once per match" value={formOncePerMatch} onChange={setFormOncePerMatch} />
        ) : formType === "ULTIMATE" ? (
          <InfoPill text="Ultimates save as once per match." />
        ) : null}
        <SelectField
          id="target"
          label="Target"
          options={[{ label: "None", value: "" }, ...ABILITY_TARGETS.map((value) => ({ label: value, value }))]}
          value={formPayload.target}
          onChange={(value) => setFormPayload((current) => ({ ...current, target: value as PayloadFormState["target"] }))}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <SelectField
          id="target-selector"
          label="Target selector"
          options={[{ label: "None", value: "" }, ...ABILITY_TARGET_SELECTORS.map((value) => ({ label: value, value }))]}
          value={formPayload.targetSelector}
          onChange={(value) => setFormPayload((current) => ({ ...current, targetSelector: value as PayloadFormState["targetSelector"] }))}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
      </Section>

      {formType === "PASSIVE" ? (
        <Section title="Passive trigger" defaultOpen={sectionDefaults.passiveTrigger}>
          <SelectField
            id="trigger"
            label="Trigger"
            options={[{ label: "None", value: "" }, ...PASSIVE_TRIGGERS.map((value) => ({ label: value, value }))]}
            value={formPayload.trigger}
            onChange={(value) => setFormPayload((current) => ({ ...current, trigger: value as PayloadFormState["trigger"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <GridFields
            fields={[
              { label: "Chance", value: formPayload.chance, onChangeText: (value) => setFormPayload((current) => ({ ...current, chance: value })) },
              { label: "Threshold %", value: formPayload.thresholdPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, thresholdPct: value })) },
              { label: "Below HP threshold", value: formPayload.belowHpThreshold, onChangeText: (value) => setFormPayload((current) => ({ ...current, belowHpThreshold: value })) },
              { label: "Healing bonus", value: formPayload.healingBonus, onChangeText: (value) => setFormPayload((current) => ({ ...current, healingBonus: value })) },
              { label: "Debuff immunity count", value: formPayload.debuffImmunityCount, onChangeText: (value) => setFormPayload((current) => ({ ...current, debuffImmunityCount: value })) },
              { label: "Bonus crit chance basic", value: formPayload.bonusCritChanceBasic, onChangeText: (value) => setFormPayload((current) => ({ ...current, bonusCritChanceBasic: value })) },
              { label: "Battle start energy bonus", value: formPayload.battleStartEnergyBonus, onChangeText: (value) => setFormPayload((current) => ({ ...current, battleStartEnergyBonus: value })) },
              { label: "Redirect incoming chance", value: formPayload.redirectIncomingChance, onChangeText: (value) => setFormPayload((current) => ({ ...current, redirectIncomingChance: value })) },
              { label: "Redirect if self above HP %", value: formPayload.redirectIfSelfAboveHpPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, redirectIfSelfAboveHpPct: value })) },
              { label: "Evasion chance", value: formPayload.evasionChance, onChangeText: (value) => setFormPayload((current) => ({ ...current, evasionChance: value })) },
            ]}
          />
          <ToggleRow label="Once" value={formPayload.once} onChange={(value) => setFormPayload((current) => ({ ...current, once: value }))} />
          <ToggleRow label="On basic only" value={formPayload.onBasicOnly} onChange={(value) => setFormPayload((current) => ({ ...current, onBasicOnly: value }))} />
        </Section>
      ) : null}

      <Section title="Damage" defaultOpen={sectionDefaults.damage}>
        <GridFields
          fields={[
            { label: "Damage multiplier", value: formPayload.damageMul, onChangeText: (value) => setFormPayload((current) => ({ ...current, damageMul: value })) },
            { label: "Ignore defense %", value: formPayload.ignoreDefensePct, onChangeText: (value) => setFormPayload((current) => ({ ...current, ignoreDefensePct: value })) },
            { label: "Splash %", value: formPayload.splashPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, splashPct: value })) },
            { label: "Burn bonus multiplier", value: formPayload.burnBonusMul, onChangeText: (value) => setFormPayload((current) => ({ ...current, burnBonusMul: value })) },
            { label: "Bonus damage vs debuffed %", value: formPayload.bonusDamageVsDebuffedTargetsPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, bonusDamageVsDebuffedTargetsPct: value })) },
            { label: "Instant KO if target below HP %", value: formPayload.instantKoIfTargetBelowHpPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, instantKoIfTargetBelowHpPct: value })) },
            { label: "Apply status chance", value: formPayload.applyStatusChance, onChangeText: (value) => setFormPayload((current) => ({ ...current, applyStatusChance: value })) },
            { label: "Hits", value: formPayload.hits, onChangeText: (value) => setFormPayload((current) => ({ ...current, hits: value })) },
            { label: "Execute damage multiplier", value: formPayload.executeDamageMul, onChangeText: (value) => setFormPayload((current) => ({ ...current, executeDamageMul: value })) },
            { label: "Execute threshold", value: formPayload.executeThreshold, onChangeText: (value) => setFormPayload((current) => ({ ...current, executeThreshold: value })) },
            { label: "Heal % max HP on execute", value: formPayload.healPctOfMaxHpOnExecute, onChangeText: (value) => setFormPayload((current) => ({ ...current, healPctOfMaxHpOnExecute: value })) },
            { label: "Damage reduction", value: formPayload.damageReduction, onChangeText: (value) => setFormPayload((current) => ({ ...current, damageReduction: value })) },
          ]}
        />
        <ToggleRow label="Line only" value={formPayload.lineOnly} onChange={(value) => setFormPayload((current) => ({ ...current, lineOnly: value }))} />
      </Section>

      <Section title="Healing and shield" defaultOpen={sectionDefaults.healing}>
        <SelectField
          id="shield-target"
          label="Shield target"
          options={[
            { label: "None", value: "" },
            { label: "self", value: "self" },
            { label: "target", value: "target" },
            { label: "allAllies", value: "allAllies" },
          ]}
          value={formPayload.shieldTarget}
          onChange={(value) => setFormPayload((current) => ({ ...current, shieldTarget: value as PayloadFormState["shieldTarget"] }))}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <GridFields
          fields={[
            { label: "Shield % max HP", value: formPayload.shieldPctOfMaxHp, onChangeText: (value) => setFormPayload((current) => ({ ...current, shieldPctOfMaxHp: value })) },
            { label: "Heal % of damage", value: formPayload.healPctOfDamage, onChangeText: (value) => setFormPayload((current) => ({ ...current, healPctOfDamage: value })) },
            { label: "Heal lowest ally % of damage", value: formPayload.healLowestAllyPctOfDamage, onChangeText: (value) => setFormPayload((current) => ({ ...current, healLowestAllyPctOfDamage: value })) },
            { label: "Heal % max HP", value: formPayload.healPctOfMaxHp, onChangeText: (value) => setFormPayload((current) => ({ ...current, healPctOfMaxHp: value })) },
            { label: "Lifesteal %", value: formPayload.lifestealPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, lifestealPct: value })) },
            { label: "Heal lowest HP ally % max HP", value: formPayload.healLowestHpAllyPctOfMaxHp, onChangeText: (value) => setFormPayload((current) => ({ ...current, healLowestHpAllyPctOfMaxHp: value })) },
          ]}
        />
      </Section>

      <Section title="Statuses and buffs" defaultOpen={sectionDefaults.statuses}>
        <StatusArrayEditor
          label="Apply statuses"
          entries={formPayload.applyStatuses}
          includeTargeting
          dropdownIdPrefix="apply-statuses"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() => setFormPayload((current) => ({ ...current, applyStatuses: [...current.applyStatuses, defaultStatusEntry()] }))}
          onChange={(entries) => setFormPayload((current) => ({ ...current, applyStatuses: entries as PayloadFormState["applyStatuses"] }))}
        />
        <StatusArrayEditor
          label="Random statuses"
          entries={formPayload.randomStatuses}
          dropdownIdPrefix="random-statuses"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() => setFormPayload((current) => ({ ...current, randomStatuses: [...current.randomStatuses, defaultSimpleStatusEntry()] }))}
          onChange={(entries) => setFormPayload((current) => ({ ...current, randomStatuses: entries as PayloadFormState["randomStatuses"] }))}
        />
        <StatusArrayEditor
          label="Apply statuses to attacker"
          entries={formPayload.applyStatusesToAttacker}
          dropdownIdPrefix="statuses-to-attacker"
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          onAdd={() => setFormPayload((current) => ({ ...current, applyStatusesToAttacker: [...current.applyStatusesToAttacker, defaultSimpleStatusEntry()] }))}
          onChange={(entries) => setFormPayload((current) => ({ ...current, applyStatusesToAttacker: entries as PayloadFormState["applyStatusesToAttacker"] }))}
        />
      </Section>

      <Section title="Utility" defaultOpen={sectionDefaults.utility}>
        <SelectField
          id="cleanse-target"
          label="Cleanse target"
          options={[
            { label: "None", value: "" },
            { label: "self", value: "self" },
            { label: "ally", value: "ally" },
            { label: "allAllies", value: "allAllies" },
            { label: "allEnemies", value: "allEnemies" },
          ]}
          value={formPayload.cleanseTarget}
          onChange={(value) => setFormPayload((current) => ({ ...current, cleanseTarget: value as PayloadFormState["cleanseTarget"] }))}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
        />
        <GridFields
          fields={[
            { label: "Cleanse count", value: formPayload.cleanseCount, onChangeText: (value) => setFormPayload((current) => ({ ...current, cleanseCount: value })) },
            { label: "Revive %", value: formPayload.revivePct, onChangeText: (value) => setFormPayload((current) => ({ ...current, revivePct: value })) },
            { label: "Revive ally on enemy KO %", value: formPayload.reviveAllyOnEnemyKoPct, onChangeText: (value) => setFormPayload((current) => ({ ...current, reviveAllyOnEnemyKoPct: value })) },
            { label: "Reduce cooldowns", value: formPayload.reduceCooldowns, onChangeText: (value) => setFormPayload((current) => ({ ...current, reduceCooldowns: value })) },
            { label: "Increase target cooldowns", value: formPayload.increaseTargetCooldowns, onChangeText: (value) => setFormPayload((current) => ({ ...current, increaseTargetCooldowns: value })) },
            { label: "Reduce enemy cooldowns", value: formPayload.reduceEnemyCooldowns, onChangeText: (value) => setFormPayload((current) => ({ ...current, reduceEnemyCooldowns: value })) },
            { label: "Hit count limit", value: formPayload.hitCountLimit, onChangeText: (value) => setFormPayload((current) => ({ ...current, hitCountLimit: value })) },
            { label: "Self damage %", value: formPayload.selfDamagePct, onChangeText: (value) => setFormPayload((current) => ({ ...current, selfDamagePct: value })) },
            { label: "Steal buff count", value: formPayload.stealBuffCount, onChangeText: (value) => setFormPayload((current) => ({ ...current, stealBuffCount: value })) },
          ]}
        />
        <ToggleRow label="Cleanse all statuses" value={formPayload.cleanseAllStatuses} onChange={(value) => setFormPayload((current) => ({ ...current, cleanseAllStatuses: value }))} />
        <ToggleRow label="Also cleanse all enemies" value={formPayload.alsoCleanseAllEnemies} onChange={(value) => setFormPayload((current) => ({ ...current, alsoCleanseAllEnemies: value }))} />
        <ToggleRow label="Prevent death" value={formPayload.preventDeath} onChange={(value) => setFormPayload((current) => ({ ...current, preventDeath: value }))} />
        <ToggleRow label="Swap HP percentages" value={formPayload.swapHpPercentages} onChange={(value) => setFormPayload((current) => ({ ...current, swapHpPercentages: value }))} />
      </Section>

      {formType === "PASSIVE" ? (
        <Section title="Stat bonuses" defaultOpen={sectionDefaults.statBonuses}>
          <SelectField
            id="stat-bonus-target"
            label="Stat bonus target"
            options={[
              { label: "None", value: "" },
              { label: "self", value: "self" },
              { label: "allAllies", value: "allAllies" },
              { label: "allEnemies", value: "allEnemies" },
            ]}
            value={formPayload.statBonusTarget}
            onChange={(value) => setFormPayload((current) => ({ ...current, statBonusTarget: value as PayloadFormState["statBonusTarget"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <SelectField
            id="stat-duration-mode"
            label="Duration mode"
            options={[
              { label: "None", value: "" },
              { label: "permanent", value: "permanent" },
              { label: "whileSourceActive", value: "whileSourceActive" },
            ]}
            value={formPayload.statBonusDurationMode}
            onChange={(value) => setFormPayload((current) => ({ ...current, statBonusDurationMode: value as PayloadFormState["statBonusDurationMode"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <GridFields
            fields={[
              { label: "HP bonus", value: formPayload.statBonusHp, onChangeText: (value) => setFormPayload((current) => ({ ...current, statBonusHp: value })) },
              { label: "Attack bonus", value: formPayload.statBonusAttack, onChangeText: (value) => setFormPayload((current) => ({ ...current, statBonusAttack: value })) },
              { label: "Defense bonus", value: formPayload.statBonusDefense, onChangeText: (value) => setFormPayload((current) => ({ ...current, statBonusDefense: value })) },
              { label: "Speed bonus", value: formPayload.statBonusSpeed, onChangeText: (value) => setFormPayload((current) => ({ ...current, statBonusSpeed: value })) },
              { label: "Adjacent aura duration", value: formPayload.adjacentAuraStatusDuration, onChangeText: (value) => setFormPayload((current) => ({ ...current, adjacentAuraStatusDuration: value })) },
            ]}
          />
          <SelectField
            id="adjacent-aura-status"
            label="Adjacent aura status"
            options={[{ label: "None", value: "" }, ...STATUS_NAMES.map((value) => ({ label: value, value }))]}
            value={formPayload.adjacentAuraStatusName}
            onChange={(value) => setFormPayload((current) => ({ ...current, adjacentAuraStatusName: value as PayloadFormState["adjacentAuraStatusName"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <MultiSelectRow
            label="Required any ally types"
            values={formPayload.requiredAnyAllyTypes}
            options={TYPE_NAMES}
            onToggle={(value) => setFormPayload((current) => ({ ...current, requiredAnyAllyTypes: toggleListValue(current.requiredAnyAllyTypes, value as TypeName) }))}
          />
          <MultiSelectRow
            label="Apply to ally types"
            values={formPayload.applyToAllyTypes}
            options={TYPE_NAMES}
            onToggle={(value) => setFormPayload((current) => ({ ...current, applyToAllyTypes: toggleListValue(current.applyToAllyTypes, value as TypeName) }))}
          />
        </Section>
      ) : (
        <Section title="Copy ability" defaultOpen={sectionDefaults.copyAbility}>
          <SelectField
            id="copy-ability-type"
            label="Copy ability type"
            options={[
              { label: "None", value: "" },
              { label: "SKILL", value: "SKILL" },
              { label: "ULTIMATE", value: "ULTIMATE" },
            ]}
            value={formPayload.copyAbilityType}
            onChange={(value) => setFormPayload((current) => ({ ...current, copyAbilityType: value as PayloadFormState["copyAbilityType"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <SelectField
            id="copy-source"
            label="Copy source"
            options={[
              { label: "None", value: "" },
              { label: "enemy", value: "enemy" },
              { label: "ally", value: "ally" },
              { label: "either", value: "either" },
            ]}
            value={formPayload.copyAbilitySource}
            onChange={(value) => setFormPayload((current) => ({ ...current, copyAbilitySource: value as PayloadFormState["copyAbilitySource"] }))}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
        </Section>
      )}

      <Section title="Conditional JSON" defaultOpen={sectionDefaults.conditional}>
        <JsonField
          label="Conditional"
          value={formPayload.conditionalRaw}
          onChangeText={(value) => setFormPayload((current) => ({ ...current, conditionalRaw: value }))}
          placeholder='{"when": {...}}'
        />
      </Section>

      <Section title="Raw payload JSON" defaultOpen={showRawJson}>
        <ToggleRow label="Use raw payload editor" value={showRawJson} onChange={setShowRawJson} />
        {showRawJson ? (
          <>
            <JsonField
              label="Payload JSON"
              value={rawPayloadText}
              onChangeText={(value) => {
                setRawPayloadTouched(true);
                setRawPayloadText(value);
              }}
              placeholder="{}"
            />
            {rawPayloadError ? <Text className="font-nunito-bold text-xs text-dangerText">{rawPayloadError}</Text> : null}
          </>
        ) : (
          <Text className="font-nunito-semibold text-xs text-fgMuted">Structured fields stay in sync here until you start editing raw JSON directly.</Text>
        )}
      </Section>

      {formError ? <Text className="font-nunito-bold text-[13px] text-dangerText px-1">{formError}</Text> : null}
      {footer}
    </>
  );
}

function toggleListValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="rounded-[22] overflow-hidden border border-primaryBorder/18 bg-surfaceMuted">
      <Pressable className="px-4 py-[14] flex-row items-center justify-between bg-primaryTint/95" onPress={() => setOpen((current) => !current)}>
        <Text className="font-nunito-extrabold text-[15px] text-primaryStrong">{title}</Text>
        <Text className="font-nunito-bold text-xs text-primaryStrong">{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {open ? <View className="p-[14] gap-[14]">{children}</View> : null}
    </View>
  );
}

function GridFields({
  fields,
}: {
  fields: Array<{ label: string; value: string; onChangeText: (value: string) => void }>;
}) {
  return (
    <View className="flex-row flex-wrap gap-[10]">
      {fields.map((field) => (
        <View key={field.label} className="w-[48%]">
          <AdminField label={field.label} value={field.value} onChangeText={field.onChangeText} keyboardType="numeric" />
        </View>
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      className={`rounded-2xl border px-[14] py-3 flex-row items-center justify-between ${value ? "bg-primaryBg border-primary" : "border-primaryBorder/18 bg-surface/92"}`}
      onPress={() => onChange(!value)}
    >
      <Text className={`font-nunito-bold text-[13px] flex-1 ${value ? "text-primaryStrong" : "text-primaryText"}`}>{label}</Text>
      <View className={`rounded-full px-[10] py-[5] ${value ? "bg-primaryText" : "bg-[#F3F4F6]"}`}>
        <Text className={`font-nunito-extrabold text-[11px] ${value ? "text-white" : "text-fgMuted"}`}>{value ? "ON" : "OFF"}</Text>
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
  const open = openDropdownId === id;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "Select an option";

  return (
    <View className="gap-2">
      <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
      <View className="gap-2">
        <Pressable
          className={`min-h-[46] rounded-2xl border-2 flex-row items-center justify-between gap-3 px-[14] ${open ? "border-primary bg-primaryBg" : "border-primaryBorder bg-surface/95"}`}
          onPress={() => setOpenDropdownId(open ? null : id)}
        >
          <Text className="flex-1 font-nunito-bold text-sm text-fg">{selectedLabel}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={tc.primaryText} />
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
                  <Text className={`flex-1 font-nunito-bold text-[13px] ${selected ? "text-primaryStrong" : "text-primaryText"}`}>{option.label}</Text>
                  {selected ? <Ionicons name="checkmark" size={16} color={tc.primaryStrong} /> : null}
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
              <Text className={`font-nunito-bold text-xs ${selected ? "text-primaryStrong" : "text-primaryText"}`}>{option}</Text>
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
  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center gap-[10]">
        <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
        <AdminButton label="Add" variant="ghost" onPress={onAdd} />
      </View>
      {entries.length === 0 ? <Text className="font-nunito-semibold text-xs text-fgMuted">No entries yet.</Text> : null}
      {entries.map((entry, index) => (
        <View key={`${label}-${index}`} className="rounded-[18] p-3 gap-3 bg-surface/92 border border-primaryBorder/16">
          <View className="flex-row justify-between items-center gap-[10]">
            <Text className="font-nunito-extrabold text-[13px] text-primaryText">Entry {index + 1}</Text>
            <AdminButton
              label="Remove"
              variant="ghost"
              onPress={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            />
          </View>
          <SelectField
            id={`${dropdownIdPrefix}-${index}-status`}
            label="Status"
            options={STATUS_NAMES.map((value) => ({ label: value, value }))}
            value={entry.name}
            onChange={(value) =>
              onChange(
                entries.map((current, entryIndex) =>
                  entryIndex === index ? { ...current, name: value as StatusName } : current,
                ),
              )
            }
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
          />
          <View className="flex-row gap-[10]">
            <View className="flex-1">
              <AdminField
                label="Duration"
                value={entry.duration}
                onChangeText={(value) =>
                  onChange(
                    entries.map((current, entryIndex) =>
                      entryIndex === index ? { ...current, duration: value } : current,
                    ),
                  )
                }
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <AdminField
                label="Magnitude"
                value={entry.magnitude}
                onChangeText={(value) =>
                  onChange(
                    entries.map((current, entryIndex) =>
                      entryIndex === index ? { ...current, magnitude: value } : current,
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
                label="Entry target"
                options={[{ label: "None", value: "" }, ...ABILITY_TARGETS.map((value) => ({ label: value, value }))]}
                value={entry.target ?? ""}
                onChange={(value) =>
                  onChange(
                    entries.map((current, entryIndex) =>
                      entryIndex === index ? { ...current, target: value as PayloadFormState["target"] } : current,
                    ),
                  )
                }
                openDropdownId={openDropdownId}
                setOpenDropdownId={setOpenDropdownId}
              />
              <SelectField
                id={`${dropdownIdPrefix}-${index}-selector`}
                label="Entry selector"
                options={[{ label: "None", value: "" }, ...ABILITY_TARGET_SELECTORS.map((value) => ({ label: value, value }))]}
                value={entry.targetSelector ?? ""}
                onChange={(value) =>
                  onChange(
                    entries.map((current, entryIndex) =>
                      entryIndex === index ? { ...current, targetSelector: value as PayloadFormState["targetSelector"] } : current,
                    ),
                  )
                }
                openDropdownId={openDropdownId}
                setOpenDropdownId={setOpenDropdownId}
              />
            </>
          ) : null}
        </View>
      ))}
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tc.muted}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        className="min-h-[170] rounded-2xl border-2 border-primaryBorder bg-surface/95 px-[14] py-3 text-fg"
        style={{ fontFamily: "monospace", fontSize: 13 }}
      />
    </View>
  );
}

function InfoPill({ text }: { text: string }) {
  return (
    <View className="rounded-[14] bg-secondaryTint px-3 py-[10]">
      <Text className="font-nunito-bold text-xs text-secondaryText">{text}</Text>
    </View>
  );
}
