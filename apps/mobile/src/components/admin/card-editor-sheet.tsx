import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { AdminAbilitiesResponse, AdminCardDetail, AdminCardsResponse, RaritiesResponse } from "@adventure-time/shared";

import { AdminCardTile } from "./admin-card-tile";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminField,
  AdminModal,
  AdminPanel,
} from "./admin-ui";

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
  type: string;
  rarityId: string;
};

export type AssignmentDraft = {
  passiveId: string;
  skillId: string;
  ultimateId: string;
};

type PickerRole = "passive" | "skill" | "ultimate";

type CardEditorSheetProps = {
  mode: "create" | "edit";
  card: EditableCard | null;
  draft: CardDraft;
  rarities: Rarity[];
  abilities: Ability[];
  assignmentDraft: AssignmentDraft;
  savePending: boolean;
  archivePending: boolean;
  uploadPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onUploadImage: () => void;
  onToggleArchive: () => void;
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
  label: string;
  keyboardType?: "default" | "numeric";
}> = [
  { key: "hp", label: "HP", keyboardType: "numeric" },
  { key: "attack", label: "Attack", keyboardType: "numeric" },
  { key: "defense", label: "Defense", keyboardType: "numeric" },
  { key: "speed", label: "Speed", keyboardType: "numeric" },
];

const CARD_TYPES = ["Hero", "Villain", "Candy", "Earth", "Wizard", "Beast"];

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
    type: draft.type.trim(),
    rarityId: draft.rarityId,
  };
}

function getPreviewCard(card: EditableCard | null, draft: CardDraft, rarities: Rarity[]) {
  const fallbackRarity = rarities[0];
  const selectedRarity = rarities.find((rarity) => rarity.id === draft.rarityId) ?? fallbackRarity;

  return {
    id: card?.id ?? "preview",
    name: draft.name || "Card Name",
    character: draft.character || "Character",
    description: draft.description || "Card description goes here.",
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
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl border px-3 py-2 ${active ? "border-primary bg-primaryText" : "border-primaryBorder/30 bg-white"}`}
    >
      <Text
        className={`font-nunito-extrabold text-xs ${active ? "text-white" : "text-primaryStrong"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CardEditorSheet({
  mode,
  card,
  draft,
  rarities,
  abilities,
  assignmentDraft,
  savePending,
  archivePending,
  uploadPending,
  onClose,
  onSubmit,
  onUploadImage,
  onToggleArchive,
  onDraftChange,
  onAssignmentChange,
  onAssignmentClear,
}: CardEditorSheetProps) {
  const [showAbilitiesSection, setShowAbilitiesSection] = useState(false);
  const [pickerRole, setPickerRole] = useState<PickerRole | null>(null);

  const previewCard = useMemo(() => getPreviewCard(card, draft, rarities), [card, draft, rarities]);
  const defaultSkill = useMemo(
    () => abilities.find((ability) => ability.key === "default.focusedStrike") ?? null,
    [abilities],
  );
  const defaultUltimate = useMemo(
    () => abilities.find((ability) => ability.key === "default.battleCry") ?? null,
    [abilities],
  );

  const currentPassive = assignmentDraft.passiveId
    ? abilities.find((ability) => ability.id === assignmentDraft.passiveId) ?? null
    : null;
  const currentSkill = assignmentDraft.skillId
    ? abilities.find((ability) => ability.id === assignmentDraft.skillId) ?? null
    : defaultSkill;
  const currentUltimate = assignmentDraft.ultimateId
    ? abilities.find((ability) => ability.id === assignmentDraft.ultimateId) ?? null
    : defaultUltimate;
  const hasCustomAssignments = Boolean(
    assignmentDraft.passiveId || assignmentDraft.skillId || assignmentDraft.ultimateId,
  );

  const pickerOptions = useMemo(() => {
    if (!pickerRole) {
      return [] as Ability[];
    }

    return abilities.filter((ability) => ability.type === pickerRole.toUpperCase());
  }, [abilities, pickerRole]);

  return (
    <>
      <View className="gap-4">
        <AdminPanel>
          <View className="items-center gap-3">
            <Text className="font-nunito-extrabold text-lg text-primaryStrong">Live preview</Text>
            <AdminCardTile card={previewCard} size="large" />
          </View>
        </AdminPanel>

        <AdminPanel>
          <Text className="font-nunito-extrabold text-[20px] text-primaryStrong">Card basics</Text>
          <View className="mt-4 gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <AdminField
                  label="Name"
                  value={draft.name}
                  onChangeText={(value) => onDraftChange("name", value)}
                  placeholder="Finn the Human"
                />
              </View>
              <View className="flex-1">
                <AdminField
                  label="Character"
                  value={draft.character}
                  onChangeText={(value) => onDraftChange("character", value)}
                  placeholder="Finn"
                />
              </View>
            </View>

            <AdminField
              label="Description"
              value={draft.description}
              onChangeText={(value) => onDraftChange("description", value)}
              placeholder="Short flavor text or gameplay summary"
              multiline
            />

            <View className="flex-row flex-wrap gap-3">
              {STAT_FIELDS.map((field) => (
                <View key={field.key} className="w-[48%]">
                  <AdminField
                    label={field.label}
                    value={draft[field.key]}
                    onChangeText={(value) => onDraftChange(field.key, value)}
                    keyboardType={field.keyboardType}
                  />
                </View>
              ))}
            </View>
          </View>
        </AdminPanel>

        <AdminPanel>
          <Text className="font-nunito-extrabold text-[20px] text-primaryStrong">Card image</Text>
          <View className="mt-4 gap-3">
            <AdminButton
              label={uploadPending ? "Uploading..." : card ? "Upload image" : "Save card before upload"}
              variant="secondary"
              onPress={onUploadImage}
              disabled={uploadPending || !card}
            />
            <Text className="font-nunito-semibold text-xs text-fgMuted">
              {card
                ? "Pick a new card image from the device library."
                : "Create the card first, then reopen it to upload artwork."}
            </Text>
          </View>
        </AdminPanel>

        <AdminPanel>
          <Text className="font-nunito-extrabold text-[20px] text-primaryStrong">Rarity</Text>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {rarities.map((rarity) => (
              <Pressable
                key={rarity.id}
                onPress={() => onDraftChange("rarityId", rarity.id)}
                className={`min-w-[102px] rounded-xl border px-3 py-2 ${draft.rarityId === rarity.id ? "border-primary bg-primaryText" : "border-primaryBorder/30 bg-white"}`}
              >
                <Text
                  className={`font-nunito-extrabold text-xs ${draft.rarityId === rarity.id ? "text-white" : "text-primaryStrong"}`}
                  style={draft.rarityId === rarity.id ? undefined : { color: rarity.color }}
                >
                  {rarity.name}
                </Text>
                <Text className={`mt-1 font-nunito-bold text-[11px] ${draft.rarityId === rarity.id ? "text-white/80" : "text-fgMuted"}`}>
                  {rarity.dropRate}% drop rate
                </Text>
              </Pressable>
            ))}
          </View>
        </AdminPanel>

        <AdminPanel>
          <Text className="font-nunito-extrabold text-[20px] text-primaryStrong">Type</Text>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {CARD_TYPES.map((type) => (
              <SelectionChip
                key={type}
                label={type}
                active={draft.type === type}
                onPress={() => onDraftChange("type", type)}
              />
            ))}
          </View>
        </AdminPanel>

        <AdminPanel>
          <Pressable
            onPress={() => setShowAbilitiesSection((current) => !current)}
            className="rounded-2xl bg-accentTint px-4 py-3"
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-2">
                <Text className="font-nunito-extrabold text-base text-accentText">Abilities</Text>
                {hasCustomAssignments ? <AdminChip label="Custom" tone="accent" /> : null}
              </View>
              <Text className="font-nunito-bold text-xs text-accentText">
                {showAbilitiesSection ? "Hide" : "Manage"}
              </Text>
            </View>
          </Pressable>

          {!showAbilitiesSection ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {currentPassive ? <AdminChip label={`Passive: ${currentPassive.name}`} tone="success" /> : null}
              {currentSkill ? <AdminChip label={`Skill: ${currentSkill.name}`} tone="info" /> : null}
              {currentUltimate ? <AdminChip label={`Ultimate: ${currentUltimate.name}`} tone="warning" /> : null}
              {!currentPassive && !currentSkill && !currentUltimate ? (
                <Text className="font-nunito-semibold text-xs italic text-fgMuted">Uses default ability kit.</Text>
              ) : null}
            </View>
          ) : (
            <View className="mt-4 gap-3 rounded-2xl bg-surface/70 p-4">
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                Leave a slot on default to use the app's fallback combat kit.
              </Text>
              {([
                ["passive", "Passive", currentPassive],
                ["skill", "Skill", currentSkill],
                ["ultimate", "Ultimate", currentUltimate],
              ] as const).map(([role, label, selected]) => (
                <Pressable
                  key={role}
                  onPress={() => setPickerRole(role)}
                  className="rounded-2xl border border-primaryBorder/20 bg-white px-4 py-4"
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-nunito-bold text-[11px] uppercase tracking-[0.8px] text-fgMuted">
                        {label}
                      </Text>
                      <Text className="font-nunito-extrabold text-sm text-fg">
                        {selected?.name ?? `Choose ${label.toLowerCase()} ability`}
                      </Text>
                      {selected ? (
                        <View className="flex-row flex-wrap gap-2">
                          <AbilityTypeChip type={selected.type} />
                          <AdminChip label={`Cost ${selected.cost}`} tone="info" />
                          {selected.cooldown ? <AdminChip label={`CD ${selected.cooldown}`} tone="warning" /> : null}
                        </View>
                      ) : null}
                    </View>
                    <Text className="font-nunito-extrabold text-xs text-primaryStrong">Change</Text>
                  </View>
                </Pressable>
              ))}

              {hasCustomAssignments ? (
                <AdminButton label="Clear custom abilities" variant="ghost" onPress={onAssignmentClear} />
              ) : null}
            </View>
          )}
        </AdminPanel>

        <AdminPanel>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <AdminButton label="Cancel" variant="ghost" onPress={onClose} />
              </View>
              <View className="flex-1">
                <AdminButton
                  label={savePending ? "Saving..." : mode === "create" ? "Create card" : "Save card"}
                  onPress={onSubmit}
                  disabled={savePending || !draft.rarityId}
                />
              </View>
            </View>

            {mode === "edit" && card ? (
              <AdminButton
                label={archivePending ? "Working..." : card.isArchived ? "Restore card" : "Archive card"}
                variant="danger"
                onPress={onToggleArchive}
                disabled={archivePending}
              />
            ) : null}
          </View>
        </AdminPanel>
      </View>

      {pickerRole ? (
        <AdminModal visible title="Choose ability" onClose={() => setPickerRole(null)}>
          <AdminButton
            label="Use default / none"
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
                <Text className="flex-1 font-nunito-extrabold text-sm text-fg">{ability.name}</Text>
                <AbilityTypeChip type={ability.type} />
              </View>
              <Text className="font-nunito-semibold text-[13px] text-fgMuted">{ability.description}</Text>
              <View className="flex-row flex-wrap gap-2">
                <AdminChip label={ability.key} tone="accent" />
                <AdminChip label={`Cost ${ability.cost}`} tone="info" />
                {ability.cooldown ? <AdminChip label={`Cooldown ${ability.cooldown}`} tone="warning" /> : null}
              </View>
            </Pressable>
          ))}
        </AdminModal>
      ) : null}
    </>
  );
}
