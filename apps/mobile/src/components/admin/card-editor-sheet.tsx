import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  cardTypeValues,
  type AdminAbilitiesResponse,
  type AdminCardDetail,
  type AdminCardsResponse,
  type CardType,
  type RaritiesResponse,
} from "@adventure-time/api-client";

import { CardTile } from "../card-tile";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminField,
  AdminModal,
  AdminNotice,
  AdminPanel,
  AdminSectionTitle,
} from "./admin-ui";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { pickReadableTextColor, withAlpha } from "./admin-palette";

type EditableCard = AdminCardsResponse["cards"][number] | AdminCardDetail;
type Ability = AdminAbilitiesResponse["abilities"][number];
type Rarity = RaritiesResponse["rarities"][number];

export type CardDraft = {
  name: string;
  character: string;
  description: string;
  hp: string;
  attack: string;
  defense: string;
  speed: string;
  type: CardType;
  rarityId: string;
};

export type AssignmentDraft = {
  passiveId: string;
  skillId: string;
  ultimateId: string;
};

type PickerRole = "passive" | "skill" | "ultimate";

type CardEditorSheetProps = {
  card: EditableCard | null;
  draft: CardDraft;
  rarities: Rarity[];
  abilities: Ability[];
  assignmentDraft: AssignmentDraft;
  uploadPending: boolean;
  onUploadImage: () => void;
  onDraftChange: (key: keyof CardDraft, value: string) => void;
  onAssignmentChange: (role: PickerRole, value: string) => void;
  onAssignmentClear: () => void;
};

export const BLANK_CARD_DRAFT: CardDraft = {
  name: "",
  character: "",
  description: "",
  hp: "100",
  attack: "20",
  defense: "20",
  speed: "40",
  type: "Hero",
  rarityId: "",
};

const STAT_FIELDS: Array<{
  key: keyof CardDraft;
  keyboardType?: "default" | "numeric";
}> = [
  { key: "hp", keyboardType: "numeric" },
  { key: "attack", keyboardType: "numeric" },
  { key: "defense", keyboardType: "numeric" },
  { key: "speed", keyboardType: "numeric" },
];

const CARD_TYPES = [...cardTypeValues];

export function toCardDraft(card: EditableCard): CardDraft {
  return {
    name: card.name,
    character: card.character,
    description: card.description,
    hp: String(card.hp),
    attack: String(card.attack),
    defense: String(card.defense),
    speed: String(card.speed),
    type: card.type,
    rarityId: card.rarityId,
  };
}

export function toCardSavePayload(draft: CardDraft) {
  return {
    name: draft.name.trim(),
    character: draft.character.trim(),
    description: draft.description.trim(),
    hp: Number(draft.hp),
    attack: Number(draft.attack),
    defense: Number(draft.defense),
    speed: Number(draft.speed),
    type: draft.type,
    rarityId: draft.rarityId,
  };
}

function getPreviewCard(
  card: EditableCard | null,
  draft: CardDraft,
  rarities: Rarity[],
  strings: {
    previewName: string;
    previewCharacter: string;
    previewDescription: string;
  },
) {
  const fallbackRarity = rarities[0];
  const selectedRarity =
    rarities.find((rarity) => rarity.id === draft.rarityId) ?? fallbackRarity;

  return {
    id: card?.id ?? "preview",
    name: draft.name || strings.previewName,
    character: draft.character || strings.previewCharacter,
    description: draft.description || strings.previewDescription,
    hp: Number(draft.hp) || 0,
    attack: Number(draft.attack) || 0,
    defense: Number(draft.defense) || 0,
    speed: Number(draft.speed) || 0,
    type: draft.type || "Hero",
    rarityId: selectedRarity?.id ?? "",
    rarityName: selectedRarity?.name ?? card?.rarityName ?? "Common",
    isArchived: card?.isArchived ?? false,
    isFeatured: card?.isFeatured ?? false,
    imageAssetId: card?.imageAssetId ?? null,
  };
}

function SelectionChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl border px-3 py-2"
      style={{
        borderColor: active ? tc.primary : withAlpha(tc.primaryBorder, "4D"),
        backgroundColor: active ? tc.primaryText : tc.surface,
      }}
    >
      <Text
        className="font-nunito-extrabold text-xs"
        style={{
          color: active
            ? pickReadableTextColor(tc.primaryText, tc.fg, tc.surface)
            : tc.primaryStrong,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CardEditorSheet({
  card,
  draft,
  rarities,
  abilities,
  assignmentDraft,
  uploadPending,
  onUploadImage,
  onDraftChange,
  onAssignmentChange,
  onAssignmentClear,
}: CardEditorSheetProps) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [pickerRole, setPickerRole] = useState<PickerRole | null>(null);
  const { t } = useTranslation();
  const statLabel = (
    key: keyof Pick<CardDraft, "hp" | "attack" | "defense" | "speed">,
  ) => t(`admin.cardEditor.${key}`);

  const previewCard = useMemo(
    () =>
      getPreviewCard(card, draft, rarities, {
        previewName: t("admin.cardEditor.previewName"),
        previewCharacter: t("admin.cardEditor.previewCharacter"),
        previewDescription: t("admin.cardEditor.previewDescription"),
      }),
    [card, draft, rarities, t],
  );
  const selectedRarity =
    rarities.find((rarity) => rarity.id === previewCard.rarityId) ?? null;
  const defaultSkill = useMemo(
    () =>
      abilities.find((ability) => ability.key === "default.focusedStrike") ??
      null,
    [abilities],
  );
  const defaultUltimate = useMemo(
    () =>
      abilities.find((ability) => ability.key === "default.battleCry") ?? null,
    [abilities],
  );

  const currentPassive = assignmentDraft.passiveId
    ? (abilities.find((ability) => ability.id === assignmentDraft.passiveId) ??
      null)
    : null;
  const currentSkill = assignmentDraft.skillId
    ? (abilities.find((ability) => ability.id === assignmentDraft.skillId) ??
      null)
    : defaultSkill;
  const currentUltimate = assignmentDraft.ultimateId
    ? (abilities.find((ability) => ability.id === assignmentDraft.ultimateId) ??
      null)
    : defaultUltimate;
  const hasCustomAssignments = Boolean(
    assignmentDraft.passiveId ||
    assignmentDraft.skillId ||
    assignmentDraft.ultimateId,
  );

  const pickerOptions = useMemo(() => {
    if (!pickerRole) {
      return [] as Ability[];
    }

    return abilities.filter(
      (ability) => ability.type === pickerRole.toUpperCase(),
    );
  }, [abilities, pickerRole]);

  return (
    <>
      <View className="gap-4">
        <AdminNotice
          title={t("admin.cardEditor.workflowTitle")}
          body={t("admin.cardEditor.workflowBody")}
          icon="sparkles"
        />

        <AdminPanel tint="primary">
          <AdminSectionTitle
            title={t("admin.cardEditor.livePreview")}
            subtitle={t("admin.cardEditor.previewPanelDescription")}
          />
          <View className="mt-4 items-center gap-4">
            <CardTile card={previewCard} size="medium" />
            <View className="flex-row flex-wrap justify-center gap-2">
              <AdminChip
                label={`${t("admin.cardEditor.type")}: ${draft.type}`}
                tone="accent"
              />
              {selectedRarity ? (
                <AdminChip
                  label={`${t("admin.cardEditor.rarity")}: ${selectedRarity.name}`}
                  tone="warning"
                />
              ) : null}
              <AdminChip
                label={
                  card?.imageAssetId
                    ? t("admin.cardEditor.artworkReady")
                    : t("admin.cardEditor.artworkMissing")
                }
                tone={card?.imageAssetId ? "success" : "info"}
              />
              <AdminChip
                label={
                  hasCustomAssignments
                    ? t("admin.cardEditor.customOverride")
                    : t("admin.cardEditor.inheritedDefault")
                }
                tone={hasCustomAssignments ? "accent" : "info"}
              />
            </View>
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title={t("admin.cardEditor.basics")}
            subtitle={t("admin.cardEditor.basicsDescription")}
          />
          <View className="mt-4 gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <AdminField
                  label={t("admin.cardEditor.name")}
                  value={draft.name}
                  onChangeText={(value) => onDraftChange("name", value)}
                  placeholder={t("admin.cardEditor.namePlaceholder")}
                />
              </View>
              <View className="flex-1">
                <AdminField
                  label={t("admin.cardEditor.character")}
                  value={draft.character}
                  onChangeText={(value) => onDraftChange("character", value)}
                  placeholder={t("admin.cardEditor.characterPlaceholder")}
                />
              </View>
            </View>

            <AdminField
              label={t("admin.cardEditor.description")}
              value={draft.description}
              onChangeText={(value) => onDraftChange("description", value)}
              placeholder={t("admin.cardEditor.descriptionPlaceholder")}
              multiline
            />
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title={t("admin.cardEditor.setupTitle")}
            subtitle={t("admin.cardEditor.setupDescription")}
          />
          <View className="mt-4 gap-4">
            <View className="gap-3">
              <Text className="font-nunito-bold text-xs text-primaryText">
                {t("admin.cardEditor.type")}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {CARD_TYPES.map((type) => (
                  <SelectionChip
                    key={type}
                    label={type}
                    active={draft.type === type}
                    onPress={() => onDraftChange("type", type)}
                  />
                ))}
              </View>
            </View>

            <View className="gap-3">
              <Text className="font-nunito-bold text-xs text-primaryText">
                {t("admin.cardEditor.rarity")}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {rarities.map((rarity) => (
                  <Pressable
                    key={rarity.id}
                    onPress={() => onDraftChange("rarityId", rarity.id)}
                    className="min-w-[102px] rounded-xl border px-3 py-2"
                    style={{
                      borderColor:
                        draft.rarityId === rarity.id
                          ? tc.primary
                          : withAlpha(tc.primaryBorder, "4D"),
                      backgroundColor:
                        draft.rarityId === rarity.id
                          ? tc.primaryText
                          : tc.surface,
                    }}
                  >
                    <Text
                      className="font-nunito-extrabold text-xs"
                      style={
                        draft.rarityId === rarity.id
                          ? {
                              color: pickReadableTextColor(
                                tc.primaryText,
                                tc.fg,
                                tc.surface,
                              ),
                            }
                          : { color: rarity.color }
                      }
                    >
                      {rarity.name}
                    </Text>
                    <Text
                      className="mt-1 font-nunito-bold text-[11px]"
                      style={{
                        color:
                          draft.rarityId === rarity.id
                            ? withAlpha(
                                pickReadableTextColor(
                                  tc.primaryText,
                                  tc.fg,
                                  tc.surface,
                                ),
                                "CC",
                              )
                            : tc.fgMuted,
                      }}
                    >
                      {rarity.dropRate}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </AdminPanel>

        <AdminPanel tint="secondary">
          <AdminSectionTitle
            title={t("admin.cardEditor.statsTitle")}
            subtitle={t("admin.cardEditor.statsDescription")}
          />
          <View className="mt-4 flex-row flex-wrap gap-3">
            {STAT_FIELDS.map((field) => (
              <View key={field.key} className="w-[48%]">
                <AdminField
                  label={statLabel(
                    field.key as "hp" | "attack" | "defense" | "speed",
                  )}
                  value={draft[field.key]}
                  onChangeText={(value) => onDraftChange(field.key, value)}
                  keyboardType={field.keyboardType}
                />
              </View>
            ))}
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title={t("admin.cardEditor.image")}
            subtitle={t("admin.cardEditor.imageDescription")}
          />
          {card ? (
            <View className="mt-5 gap-3">
              <AdminButton
                label={
                  uploadPending
                    ? t("admin.common.uploading")
                    : t("admin.cardEditor.uploadImage")
                }
                variant="secondary"
                onPress={onUploadImage}
                disabled={uploadPending}
                style={{ alignSelf: "flex-start" }}
              />
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                {card.imageAssetId
                  ? t("admin.cardEditor.artworkReady")
                  : t("admin.cardEditor.artworkMissing")}
              </Text>
            </View>
          ) : (
            <View className="mt-5">
              <AdminNotice
                title={t("admin.cardEditor.saveBeforeUploadTitle")}
                body={t("admin.cardEditor.saveBeforeUpload")}
                tone="warning"
                icon="alert-circle-outline"
              />
            </View>
          )}
        </AdminPanel>

        <AdminPanel tint="accent">
          <AdminSectionTitle
            title={t("admin.cardEditor.abilitiesTitle")}
            subtitle={t("admin.cardEditor.abilitiesDescription")}
            right={
              <AdminChip
                label={
                  hasCustomAssignments
                    ? t("admin.cardEditor.customOverride")
                    : t("admin.cardEditor.inheritedDefault")
                }
                tone={hasCustomAssignments ? "accent" : "info"}
              />
            }
          />
          <View className="mt-4 gap-3">
            {(
              [
                ["passive", t("admin.cardEditor.passive"), currentPassive],
                ["skill", t("admin.cardEditor.skill"), currentSkill],
                ["ultimate", t("admin.cardEditor.ultimate"), currentUltimate],
              ] as const
            ).map(([role, label, selected]) => {
              const isCustom =
                role === "passive"
                  ? Boolean(assignmentDraft.passiveId)
                  : role === "skill"
                    ? Boolean(assignmentDraft.skillId)
                    : Boolean(assignmentDraft.ultimateId);

              return (
                <Pressable
                  key={role}
                  onPress={() => setPickerRole(role)}
                  className="rounded-2xl border px-4 py-4"
                  style={{
                    borderColor: withAlpha(tc.primaryBorder, "33"),
                    backgroundColor: tc.surface,
                  }}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="font-nunito-bold text-[11px] uppercase tracking-[0.8px] text-fgMuted">
                      {label}
                    </Text>
                    <AdminChip
                      label={
                        isCustom
                          ? t("admin.cardEditor.customOverride")
                          : t("admin.cardEditor.inheritedDefault")
                      }
                      tone={isCustom ? "accent" : "info"}
                    />
                  </View>
                  <Text className="mt-2 font-nunito-extrabold text-sm text-fg">
                    {selected?.name ?? t("admin.common.useDefault")}
                  </Text>
                  <Text className="mt-1 font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
                    {selected?.description ?? t("admin.common.useDefault")}
                  </Text>
                  {selected ? (
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <AbilityTypeChip type={selected.type} />
                      <AdminChip
                        label={`${t("admin.abilityEditor.cost")} ${selected.cost}`}
                        tone="info"
                      />
                      {selected.cooldown ? (
                        <AdminChip
                          label={`${t("admin.abilityEditor.cooldown")} ${selected.cooldown}`}
                          tone="warning"
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <Text className="mt-3 font-nunito-extrabold text-xs text-primaryStrong">
                    {t("admin.common.manage")}
                  </Text>
                </Pressable>
              );
            })}

            {hasCustomAssignments ? (
              <AdminButton
                label={t("admin.cardEditor.clearAssignments")}
                variant="ghost"
                onPress={onAssignmentClear}
              />
            ) : null}
          </View>
        </AdminPanel>
      </View>

      {pickerRole ? (
        <AdminModal
          visible
          title={t("admin.abilities.assignTitle")}
          onClose={() => setPickerRole(null)}
        >
          <AdminButton
            label={t("admin.common.useDefault")}
            variant="ghost"
            onPress={() => {
              onAssignmentChange(pickerRole, "");
              setPickerRole(null);
            }}
          />
          {pickerOptions.map((ability) => (
            <Pressable
              key={ability.id}
              onPress={() => {
                onAssignmentChange(pickerRole, ability.id);
                setPickerRole(null);
              }}
              className="gap-2 rounded-[18px] border border-primaryBorder/18 bg-surfaceMuted p-[14px]"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-nunito-extrabold text-sm text-fg">
                  {ability.name}
                </Text>
                <AbilityTypeChip type={ability.type} />
              </View>
              <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                {ability.description}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <AdminChip label={ability.key} tone="accent" />
                <AdminChip
                  label={`${t("admin.abilityEditor.cost")} ${ability.cost}`}
                  tone="info"
                />
                {ability.cooldown ? (
                  <AdminChip
                    label={`${t("admin.abilityEditor.cooldown")} ${ability.cooldown}`}
                    tone="warning"
                  />
                ) : null}
              </View>
            </Pressable>
          ))}
        </AdminModal>
      ) : null}
    </>
  );
}
