import type { ReactNode } from "react";

import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminFilterChip,
  AdminHero,
  AdminLoadingState,
  AdminNotice,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { withAlpha } from "../../src/components/admin/admin-palette";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

type AdminUser = Awaited<
  ReturnType<typeof apiClient.adminUsers>
>["users"][number];
type AdminEmailRequest = Awaited<
  ReturnType<typeof apiClient.adminEmailRequests>
>["requests"][number];

type AttributionLabels = {
  provider: string;
  googleName: string;
  userAgent: string;
  app: string;
  attestation: string;
  requestId: string;
  lastSeen: string;
  attempts: string;
  recentEvents: string;
  assessmentTitle: string;
  assessing: string;
  unavailable: string;
  testLab: string;
  googleNetwork: string;
  confidence: string;
  coverage: string;
  heuristic: string;
  missingEvidence: string;
  positiveEvidence: string;
  negativeEvidence: string;
  hardFailures: string;
  model: string;
  age: string;
  testLabRange: string;
  rangeVersion: string;
  rangeStale: string;
  testLabWarning: string;
  bandStronger: string;
  bandMixed: string;
  bandConcerning: string;
  networkDetails: string;
  networkFlags: string;
  networkFlagsNone: string;
  asn: string;
  country: string;
  connectionType: string;
  connectionMobile: string;
  connectionResidential: string;
  connectionCorporate: string;
  connectionDatacenter: string;
  connectionOther: string;
  flagVpn: string;
  flagProxy: string;
  flagHosting: string;
  flagTor: string;
  showEvidence: string;
  hideEvidence: string;
  revealIp: string;
  revealedIp: string;
};

type AttributionDetailRow = {
  label: string;
  value: string | null | undefined;
  lines?: number;
};

type VisibleAttributionDetailRow = AttributionDetailRow & {
  value: string;
};

type SortField = "email" | "coins" | "createdAt";
type SortDir = "asc" | "desc";
type RoleFilter = "all" | "staff" | "players" | "me";

const SORT_DEFAULTS: Record<SortField, SortDir> = {
  email: "asc",
  coins: "desc",
  createdAt: "desc",
};

const ROLE_FILTER_KEYS: RoleFilter[] = ["all", "staff", "players", "me"];
const SORT_OPTIONS: SortField[] = ["email", "coins", "createdAt"];

const ASSESSMENT_REASON_KEYS = {
  "assessment.rescore_pending":
    "admin.users.assessmentReasons.assessmentRescorePending",
  "client.browser_request_shape":
    "admin.users.assessmentReasons.clientBrowserRequestShape",
  "client.installation_changed":
    "admin.users.assessmentReasons.clientInstallationChanged",
  "client.installation_continuous":
    "admin.users.assessmentReasons.clientInstallationContinuous",
  "client.installation_malformed":
    "admin.users.assessmentReasons.clientInstallationMalformed",
  "client.integrity_build_corroborated":
    "admin.users.assessmentReasons.clientIntegrityBuildCorroborated",
  "client.platform_agrees":
    "admin.users.assessmentReasons.clientPlatformAgrees",
  "client.platform_conflict":
    "admin.users.assessmentReasons.clientPlatformConflict",
  "client.released_build": "admin.users.assessmentReasons.clientReleasedBuild",
  "client.same_site_origin":
    "admin.users.assessmentReasons.clientSameSiteOrigin",
  "client.unrecognized_build":
    "admin.users.assessmentReasons.clientUnrecognizedBuild",
  "continuity.installation_many_identities":
    "admin.users.assessmentReasons.continuityInstallationManyIdentities",
  "continuity.installation_repeated":
    "admin.users.assessmentReasons.continuityInstallationRepeated",
  "continuity.ip_many_identities":
    "admin.users.assessmentReasons.continuityIpManyIdentities",
  "continuity.low_attempt_volume":
    "admin.users.assessmentReasons.continuityLowAttemptVolume",
  "continuity.provider_identity_repeated":
    "admin.users.assessmentReasons.continuityProviderIdentityRepeated",
  "continuity.recent_attempt_burst":
    "admin.users.assessmentReasons.continuityRecentAttemptBurst",
  "continuity.request_attempts_high":
    "admin.users.assessmentReasons.continuityRequestAttemptsHigh",
  "identity.email_verification_pending":
    "admin.users.assessmentReasons.identityEmailVerificationPending",
  "identity.email_verified":
    "admin.users.assessmentReasons.identityEmailVerified",
  "identity.provider_email_unverified":
    "admin.users.assessmentReasons.identityProviderEmailUnverified",
  "identity.provider_mapping_conflict":
    "admin.users.assessmentReasons.identityProviderMappingConflict",
  "identity.provider_mapping_repeated":
    "admin.users.assessmentReasons.identityProviderMappingRepeated",
  "identity.provider_verified":
    "admin.users.assessmentReasons.identityProviderVerified",
  "integrity.certificate_mismatch":
    "admin.users.assessmentReasons.integrityCertificateMismatch",
  "integrity.licensed": "admin.users.assessmentReasons.integrityLicensed",
  "integrity.meets_basic_integrity":
    "admin.users.assessmentReasons.integrityMeetsBasic",
  "integrity.meets_device_integrity":
    "admin.users.assessmentReasons.integrityMeetsDevice",
  "integrity.meets_strong_integrity":
    "admin.users.assessmentReasons.integrityMeetsStrong",
  "integrity.no_device_integrity":
    "admin.users.assessmentReasons.integrityNoDevice",
  "integrity.not_submitted":
    "admin.users.assessmentReasons.integrityNotSubmitted",
  "integrity.package_mismatch":
    "admin.users.assessmentReasons.integrityPackageMismatch",
  "integrity.play_recognized":
    "admin.users.assessmentReasons.integrityPlayRecognized",
  "integrity.provider_auth_unavailable":
    "admin.users.assessmentReasons.integrityProviderAuthUnavailable",
  "integrity.provider_invalid_response":
    "admin.users.assessmentReasons.integrityProviderInvalidResponse",
  "integrity.provider_network_error":
    "admin.users.assessmentReasons.integrityProviderNetworkError",
  "integrity.provider_quota_exhausted":
    "admin.users.assessmentReasons.integrityProviderQuotaExhausted",
  "integrity.provider_timeout":
    "admin.users.assessmentReasons.integrityProviderTimeout",
  "integrity.provider_unavailable":
    "admin.users.assessmentReasons.integrityProviderUnavailable",
  "integrity.released_build_verified":
    "admin.users.assessmentReasons.integrityReleasedBuildVerified",
  "integrity.request_hash_mismatch":
    "admin.users.assessmentReasons.integrityRequestHashMismatch",
  "integrity.unevaluated": "admin.users.assessmentReasons.integrityUnevaluated",
  "integrity.unlicensed": "admin.users.assessmentReasons.integrityUnlicensed",
  "integrity.unrecognized_version":
    "admin.users.assessmentReasons.integrityUnrecognizedVersion",
  "integrity.version_mismatch":
    "admin.users.assessmentReasons.integrityVersionMismatch",
  "ip.active_tor": "admin.users.assessmentReasons.ipActiveTor",
  "ip.bot_status": "admin.users.assessmentReasons.ipBotStatus",
  "ip.canonical_address_unavailable":
    "admin.users.assessmentReasons.ipCanonicalUnavailable",
  "ip.confirmed_high_risk_attacks":
    "admin.users.assessmentReasons.ipHighRiskAttacks",
  "ip.enrichment_pending": "admin.users.assessmentReasons.ipEnrichmentPending",
  "ip.frequent_abuser": "admin.users.assessmentReasons.ipFrequentAbuser",
  "ip.hosting": "admin.users.assessmentReasons.ipHosting",
  "ip.provider_unavailable":
    "admin.users.assessmentReasons.ipProviderUnavailable",
  "ip.proxy": "admin.users.assessmentReasons.ipProxy",
  "ip.public_access_point": "admin.users.assessmentReasons.ipPublicAccessPoint",
  "ip.recent_abuse": "admin.users.assessmentReasons.ipRecentAbuse",
  "ip.shared_connection": "admin.users.assessmentReasons.ipSharedConnection",
  "ip.vpn": "admin.users.assessmentReasons.ipVpn",
} as const;

function assessmentReasonKey(reason: string) {
  return (
    ASSESSMENT_REASON_KEYS[reason as keyof typeof ASSESSMENT_REASON_KEYS] ??
    "admin.users.assessmentReasons.unknown"
  );
}

type UserListItem =
  | { id: "current-section"; type: "current-section" }
  | { id: string; type: "current-user"; user: AdminUser; joinedLabel: string }
  | { id: "staff-section"; type: "staff-section"; count: number }
  | { id: string; type: "staff-user"; user: AdminUser; joinedLabel: string }
  | { id: "players-section"; type: "players-section"; count: number }
  | { id: string; type: "player-user"; user: AdminUser; joinedLabel: string }
  | { id: "empty"; type: "empty" };

type UserRowItem = Extract<
  UserListItem,
  { type: "current-user" | "staff-user" | "player-user" }
>;

const keyExtractor = (item: UserListItem) => item.id;

type AuthMethodLabels = {
  password: string;
  google: string;
  apple: string;
};

type UserRowLabels = {
  currentUser: string;
  admin: string;
  superAdmin: string;
  noDisplayName: string;
  authMethods: AuthMethodLabels;
};

function UsersSubsectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1 gap-1">
        <Text className="font-nunito-extrabold text-[17px] text-fg">
          {title}
        </Text>
        <Text className="font-nunito-semibold text-[12px] leading-[18px] text-fgMuted">
          {subtitle}
        </Text>
      </View>
      {right}
    </View>
  );
}

const adminUserRow = memo(function useAdminUserRowView({
  user,
  isCurrentUser,
  currentUserLabel,
  adminLabel,
  authMethodLabels,
  superAdminLabel,
  coinsLabel,
  noDisplayNameLabel,
  questCompletionLabel,
  joinedLabel,
  onPress,
}: {
  user: AdminUser;
  isCurrentUser: boolean;
  currentUserLabel: string;
  adminLabel: string;
  authMethodLabels: AuthMethodLabels;
  superAdminLabel: string;
  coinsLabel: string;
  noDisplayNameLabel: string;
  questCompletionLabel: string;
  joinedLabel: string;
  onPress: () => void;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const displayName = user.displayName?.trim();
  const title = displayName || user.email;
  const subtitle = displayName ? user.email : noDisplayNameLabel;
  const iconName = user.isSuperAdmin
    ? "shield-checkmark-outline"
    : user.isAdmin
      ? "shield-outline"
      : "person-outline";
  const tint = user.isSuperAdmin
    ? tc.successText
    : user.isAdmin
      ? tc.accentText
      : tc.infoText;
  const accentShell = user.isSuperAdmin
    ? withAlpha(tc.successBorder, "CC")
    : user.isAdmin
      ? withAlpha(tc.accentBorder, "CC")
      : withAlpha(tc.primaryBorder, "85");
  const cardFill = user.isSuperAdmin
    ? withAlpha(tc.successTint, themeName === "nightosphere" ? "55" : "D9")
    : user.isAdmin
      ? withAlpha(tc.accentTint, themeName === "nightosphere" ? "52" : "D9")
      : withAlpha(tc.primaryBg, themeName === "nightosphere" ? "78" : "F0");
  const railColor = withAlpha(tint, themeName === "nightosphere" ? "AD" : "70");
  const authMethodBadges = [
    user.authMethods.password
      ? {
          key: "password",
          label: authMethodLabels.password,
          tone: "default" as const,
        }
      : null,
    user.authMethods.google
      ? { key: "google", label: authMethodLabels.google, tone: "info" as const }
      : null,
    user.authMethods.apple
      ? { key: "apple", label: authMethodLabels.apple, tone: "accent" as const }
      : null,
  ].filter(
    (
      item,
    ): item is {
      key: string;
      label: string;
      tone: "default" | "info" | "accent";
    } => item !== null,
  );

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[16px]"
      style={{
        backgroundColor: withAlpha(
          accentShell,
          themeName === "nightosphere" ? "47" : "2B",
        ),
        boxShadow: `0px 10px 18px ${withAlpha(
          tint,
          themeName === "nightosphere" ? "2E" : "1A",
        )}`,
      }}
    >
      <View
        className="relative gap-4 rounded-[15px] px-4 py-4"
        style={{ backgroundColor: cardFill }}
      >
        <View
          className="absolute bottom-0 left-0 top-0 w-[6px] rounded-l-[15px]"
          style={{ backgroundColor: railColor }}
        />
        <View className="flex-row items-start gap-3 pl-2">
          <View
            className="h-12 w-12 items-center justify-center rounded-[18]"
            style={{ backgroundColor: withAlpha(tint, "18") }}
          >
            <Ionicons name={iconName} size={22} color={tint} />
          </View>
          <View className="flex-1 gap-3">
            <View className="flex-row items-start gap-3">
              <View className="flex-1 gap-1">
                <Text className="font-nunito-extrabold text-[16px] text-fg">
                  {title}
                </Text>
                <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                  {subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={withAlpha(tc.fgMuted, "C7")}
              />
            </View>
          </View>
        </View>

        <View className="ml-2 gap-3 px-1 pb-1">
          <View className="flex-row flex-wrap gap-2">
            {isCurrentUser ? (
              <AdminChip label={currentUserLabel} tone="success" />
            ) : null}
            {user.isSuperAdmin ? (
              <AdminChip label={superAdminLabel} tone="success" />
            ) : null}
            {user.isAdmin ? (
              <AdminChip label={adminLabel} tone="accent" />
            ) : null}
            <AdminChip label={coinsLabel} tone="warning" />
            <AdminChip label={questCompletionLabel} tone="info" />
            {authMethodBadges.map((badge) => (
              <AdminChip
                key={badge.key}
                label={badge.label}
                tone={badge.tone}
              />
            ))}
          </View>

          <Text className="font-nunito-semibold text-[12px] text-fgMuted">
            {joinedLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const AdminUserRow = adminUserRow;

const adminUserListRow = memo(function useAdminUserListRowView({
  item,
  labels,
  onOpenUser,
  coinsLabel,
  questCompletionLabel,
}: {
  item: UserRowItem;
  labels: UserRowLabels;
  onOpenUser: (userId: string) => void;
  coinsLabel: string;
  questCompletionLabel: string;
}) {
  const handlePress = useCallback(
    () => onOpenUser(item.user.id),
    [item.user.id, onOpenUser],
  );

  return (
    <AdminUserRow
      user={item.user}
      isCurrentUser={item.type === "current-user"}
      currentUserLabel={labels.currentUser}
      adminLabel={labels.admin}
      authMethodLabels={labels.authMethods}
      superAdminLabel={labels.superAdmin}
      coinsLabel={coinsLabel}
      noDisplayNameLabel={labels.noDisplayName}
      questCompletionLabel={questCompletionLabel}
      joinedLabel={item.joinedLabel}
      onPress={handlePress}
    />
  );
});

const AdminUserListRow = adminUserListRow;

function formatAssessmentAge(assessedAt: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(assessedAt).getTime()) / 1000),
  );

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function EvidenceReasonList({
  title,
  reasons,
}: {
  title: string;
  reasons: string[];
}) {
  return (
    <View className="gap-1">
      <Text className="font-nunito-extrabold text-[11px] uppercase tracking-wide text-fgMuted">
        {title}
      </Text>
      {reasons.map((reason) => (
        <Text
          key={`${title}-${reason}`}
          className="font-nunito-semibold text-[12px] text-fg"
        >
          · {reason}
        </Text>
      ))}
    </View>
  );
}

const AdminRequestRow = useAdminRequestRowView;

function useAdminRequestRowView({
  request,
  statusLabel,
  createdLabel,
  accountCreatedLabel,
  attributionLabels,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
  disabled,
}: {
  request: AdminEmailRequest;
  statusLabel: string;
  createdLabel: string;
  accountCreatedLabel: string;
  attributionLabels: AttributionLabels;
  approveLabel: string;
  rejectLabel: string;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const revealIp = useMutation({
    mutationFn: () => apiClient.revealAdminEmailRequestIp(request.id),
  });
  const revealedIp = revealIp.data?.ipAddress ?? null;
  const appVersion = [
    request.lastClientPlatform,
    request.lastClientAppVersion,
    request.lastClientBuildNumber,
  ]
    .filter(Boolean)
    .join(" / ");
  const detailRows: AttributionDetailRow[] = [
    { label: attributionLabels.provider, value: request.provider },
    { label: attributionLabels.googleName, value: request.googleName },
    {
      label: attributionLabels.userAgent,
      value: request.lastUserAgent,
      lines: 2,
    },
    { label: attributionLabels.app, value: appVersion || null },
    {
      label: attributionLabels.attestation,
      value: request.lastAttestationStatus,
    },
    {
      label: attributionLabels.requestId,
      value: request.lastRequestId,
      lines: 1,
    },
    {
      label: attributionLabels.lastSeen,
      value: request.lastSeenAt
        ? new Date(request.lastSeenAt).toLocaleString()
        : null,
    },
    {
      label: attributionLabels.attempts,
      value: String(request.attemptCount ?? 0),
    },
  ].filter(
    (row): row is VisibleAttributionDetailRow =>
      typeof row.value === "string" && row.value.length > 0,
  );
  const assessment = request.assessment;
  const bandLabel =
    assessment?.state === "complete" || assessment?.state === "partial"
      ? assessment.band === "stronger"
        ? attributionLabels.bandStronger
        : assessment.band === "mixed"
          ? attributionLabels.bandMixed
          : attributionLabels.bandConcerning
      : null;
  const assessmentStatus = !assessment
    ? null
    : assessment.state === "test_lab"
      ? attributionLabels.testLab
      : assessment.state === "assessing"
        ? attributionLabels.assessing
        : assessment.state === "unavailable"
          ? attributionLabels.unavailable
          : `${attributionLabels.confidence}: ${assessment.confidence}% · ${attributionLabels.coverage}: ${assessment.coverage}% · ${bandLabel}`;
  const scoredAssessment =
    assessment?.state === "complete" || assessment?.state === "partial"
      ? assessment
      : null;
  const positiveContributions =
    scoredAssessment?.contributions.filter(
      (contribution) => (contribution.effectFromNeutral ?? 0) > 0,
    ) ?? [];
  const negativeContributions =
    scoredAssessment?.contributions.filter(
      (contribution) =>
        (contribution.effectFromNeutral ?? 0) < 0 || contribution.hardFailure,
    ) ?? [];
  const assessmentAge = assessment?.assessedAt
    ? formatAssessmentAge(assessment.assessedAt)
    : null;
  const connectionType = assessment?.network.connectionType?.toLowerCase();
  const localizedConnectionType = !connectionType
    ? null
    : connectionType === "mobile"
      ? attributionLabels.connectionMobile
      : connectionType === "residential"
        ? attributionLabels.connectionResidential
        : connectionType === "corporate"
          ? attributionLabels.connectionCorporate
          : connectionType === "data center" || connectionType === "datacenter"
            ? attributionLabels.connectionDatacenter
            : attributionLabels.connectionOther;

  return (
    <View
      className="gap-3 rounded-[24px] border px-4 py-4"
      style={{
        backgroundColor: withAlpha(tc.secondaryTint, "E8"),
        borderColor: withAlpha(tc.secondaryBorder, "D9"),
      }}
    >
      <View className="gap-1">
        <Text className="font-nunito-extrabold text-[16px] text-fg">
          {request.email}
        </Text>
        <Text className="font-nunito-semibold text-[12px] text-fgMuted">
          {createdLabel}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <AdminChip label={statusLabel} tone="warning" />
        {request.hasAccount ? (
          <AdminChip label={accountCreatedLabel} tone="info" />
        ) : null}
      </View>

      {assessment ? (
        <View className="gap-2 rounded-[16px] border border-infoBorder bg-infoTint px-3 py-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-nunito-extrabold text-[13px] text-infoText">
              {attributionLabels.assessmentTitle}
            </Text>
            <AdminChip label={attributionLabels.heuristic} tone="info" />
          </View>
          <Text className="font-nunito-bold text-[13px] text-fg">
            {assessmentStatus}
          </Text>
          <Text className="font-nunito-semibold text-[12px] text-fgMuted">
            {attributionLabels.model}: {assessment.modelVersion}
            {assessmentAge
              ? ` · ${attributionLabels.age}: ${assessmentAge}`
              : ""}
          </Text>
          {assessment.state === "test_lab" ? (
            <View className="gap-1">
              <Text className="font-nunito-bold text-[12px] text-dangerDark">
                {attributionLabels.testLabWarning}
              </Text>
              <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                {attributionLabels.testLabRange}:{" "}
                {assessment.network.testLabMatchedCidr ?? "—"}
              </Text>
              <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                {attributionLabels.rangeVersion}:{" "}
                {assessment.network.testLabRangeVersion ?? "—"}
              </Text>
              {assessment.network.testLabRangeStale ? (
                <Text className="font-nunito-bold text-[12px] text-dangerDark">
                  {attributionLabels.rangeStale}
                </Text>
              ) : null}
            </View>
          ) : null}
          {assessment.network.googleNetwork === "matched" &&
          assessment.network.testLab !== "matched" ? (
            <Text className="font-nunito-semibold text-[12px] text-fgMuted">
              {attributionLabels.googleNetwork}
            </Text>
          ) : null}
          {assessment.network.maskedIpAddress ? (
            <View className="gap-1">
              <Text className="font-nunito-bold text-[12px] text-fg">
                {attributionLabels.networkDetails}
              </Text>
              <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                {[
                  assessment.network.maskedIpAddress,
                  assessment.network.organization,
                  assessment.network.asn
                    ? `${attributionLabels.asn} ${assessment.network.asn}`
                    : null,
                  assessment.network.countryCode
                    ? `${attributionLabels.country} ${assessment.network.countryCode}`
                    : null,
                  localizedConnectionType
                    ? `${attributionLabels.connectionType} ${localizedConnectionType}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                {attributionLabels.networkFlags}:{" "}
                {[
                  assessment.network.vpn && attributionLabels.flagVpn,
                  assessment.network.proxy && attributionLabels.flagProxy,
                  assessment.network.hosting && attributionLabels.flagHosting,
                  assessment.network.tor && attributionLabels.flagTor,
                ]
                  .filter(Boolean)
                  .join(", ") || attributionLabels.networkFlagsNone}
              </Text>
              {assessment.network.googleRangeStale ? (
                <Text className="font-nunito-bold text-[12px] text-dangerDark">
                  {attributionLabels.rangeStale}
                </Text>
              ) : null}
            </View>
          ) : null}
          {assessment.state !== "test_lab" ? (
            <AdminButton
              label={
                evidenceExpanded
                  ? attributionLabels.hideEvidence
                  : attributionLabels.showEvidence
              }
              variant="ghost"
              icon={evidenceExpanded ? "chevron-up" : "chevron-down"}
              onPress={() => setEvidenceExpanded((expanded) => !expanded)}
            />
          ) : null}
          {evidenceExpanded && assessment.state !== "test_lab" ? (
            <View className="gap-2 rounded-xl bg-surface/70 px-3 py-2">
              {positiveContributions.length ? (
                <EvidenceReasonList
                  title={attributionLabels.positiveEvidence}
                  reasons={positiveContributions.flatMap((contribution) =>
                    contribution.reasonCodes.map((reason) =>
                      t(assessmentReasonKey(reason)),
                    ),
                  )}
                />
              ) : null}
              {negativeContributions.length ? (
                <EvidenceReasonList
                  title={attributionLabels.negativeEvidence}
                  reasons={negativeContributions.flatMap((contribution) =>
                    contribution.reasonCodes.map((reason) =>
                      t(assessmentReasonKey(reason)),
                    ),
                  )}
                />
              ) : null}
              {assessment.hardFailureReasons.length ? (
                <EvidenceReasonList
                  title={attributionLabels.hardFailures}
                  reasons={assessment.hardFailureReasons.map((reason) =>
                    t(assessmentReasonKey(reason)),
                  )}
                />
              ) : null}
              {assessment.missingReasons.length ? (
                <EvidenceReasonList
                  title={attributionLabels.missingEvidence}
                  reasons={assessment.missingReasons.map((reason) =>
                    t(assessmentReasonKey(reason)),
                  )}
                />
              ) : null}
            </View>
          ) : null}
          {revealedIp ? (
            <Text className="font-nunito-bold text-[12px] text-dangerText">
              {attributionLabels.revealedIp}: {revealedIp}
            </Text>
          ) : (
            <AdminButton
              label={attributionLabels.revealIp}
              variant="ghost"
              icon="eye-outline"
              disabled={revealIp.isPending}
              onPress={() => revealIp.mutate()}
            />
          )}
        </View>
      ) : null}

      <View className="gap-2 rounded-[16px] border border-primaryBorder/20 bg-surface/70 px-3 py-3">
        {detailRows.map((row) => (
          <View key={row.label} className="gap-0.5">
            <Text className="font-nunito-bold text-[11px] uppercase tracking-wide text-fgMuted">
              {row.label}
            </Text>
            <Text
              className="font-nunito-semibold text-[12px] text-fg"
              numberOfLines={row.lines}
              ellipsizeMode={row.lines === 1 ? "middle" : "tail"}
            >
              {row.value}
            </Text>
          </View>
        ))}
        {request.authEvents?.length ? (
          <View className="mt-1 gap-1">
            <Text className="font-nunito-bold text-[11px] uppercase tracking-wide text-fgMuted">
              {attributionLabels.recentEvents}
            </Text>
            {request.authEvents.map((event) => (
              <Text
                key={event.id}
                className="font-nunito-semibold text-[12px] leading-[17px] text-fg"
                numberOfLines={2}
              >
                {new Date(event.createdAt).toLocaleString()} - {event.eventType}
                {event.statusCode ? ` (${event.statusCode})` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View className="flex-row gap-2">
        <AdminButton
          label={approveLabel}
          variant="secondary"
          onPress={onApprove}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <AdminButton
          label={rejectLabel}
          variant="danger"
          onPress={onReject}
          disabled={disabled}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

export default function AdminUsersScreen() {
  return useAdminUsersScreenView();
}

function useAdminUsersScreenView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const currentUser = useSessionStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const isSuperAdmin = currentUser?.isSuperAdmin ?? false;
  const { t } = useTranslation();

  const {
    data: usersQueryData,
    error: usersQueryError,
    isLoading: usersQueryIsLoading,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.adminUsers(),
  });
  const {
    data: requestsQueryData,
    error: requestsQueryError,
    isLoading: requestsQueryIsLoading,
  } = useQuery({
    queryKey: ["admin-email-requests"],
    queryFn: () => apiClient.adminEmailRequests(),
    enabled: isSuperAdmin,
  });

  const reviewRequestMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => apiClient.reviewAdminEmailRequest(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-email-requests"],
      });
    },
  });
  const reviewEmailRequest = reviewRequestMutation.mutate;

  const requestStatusLabel = useCallback(
    (status: string, hasAccount: boolean) => {
      if (status === "approved" && !hasAccount) {
        return t("admin.users.approvedWaiting");
      }
      if (status === "approved") {
        return t("admin.users.approved");
      }
      if (status === "pending") {
        return t("admin.users.pending");
      }
      if (status === "rejected") {
        return t("admin.users.rejected");
      }
      return status;
    },
    [t],
  );

  const pendingRequests = useMemo(() => {
    return [...(requestsQueryData?.requests ?? [])]
      .filter((request) => request.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestsQueryData?.requests]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = (usersQueryData?.users ?? []).filter((user) => {
      if (roleFilter === "staff" && !user.isAdmin) {
        return false;
      }

      if (roleFilter === "players" && user.isAdmin) {
        return false;
      }

      if (roleFilter === "me" && user.id !== currentUserId) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${user.email} ${user.displayName ?? ""}`
        .toLowerCase()
        .includes(query);
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "email") {
        cmp = a.email.localeCompare(b.email);
      } else if (sortField === "coins") {
        cmp = a.coins - b.coins;
      } else {
        cmp = a.createdAt.localeCompare(b.createdAt);
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    if (currentUserId) {
      const idx = list.findIndex((user) => user.id === currentUserId);
      if (idx > 0) {
        list = [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
      }
    }

    return list;
  }, [
    currentUserId,
    roleFilter,
    searchQuery,
    sortDir,
    sortField,
    usersQueryData?.users,
  ]);

  const userGroups = useMemo(() => {
    const currentUserCard =
      filteredUsers.find((user) => user.id === currentUserId) ?? null;
    const remainingUsers = filteredUsers.filter(
      (user) => user.id !== currentUserId,
    );
    const staffUsers = remainingUsers.filter((user) => user.isAdmin);
    const playerUsers = remainingUsers.filter((user) => !user.isAdmin);
    const showCurrentUserCard =
      Boolean(currentUserCard) && roleFilter !== "players";
    const visibleStaffCount = filteredUsers.filter(
      (user) => user.isAdmin,
    ).length;
    const visiblePlayerCount = filteredUsers.filter(
      (user) => !user.isAdmin,
    ).length;

    return {
      currentUserCard,
      hasResults:
        (showCurrentUserCard && currentUserCard !== null) ||
        staffUsers.length > 0 ||
        playerUsers.length > 0,
      playerUsers,
      showCurrentUserCard,
      staffUsers,
      visiblePlayerCount,
      visibleStaffCount,
    };
  }, [currentUserId, filteredUsers, roleFilter]);

  const formatJoinedLabel = useCallback(
    (createdAt: string) =>
      t("admin.common.joinedDate", {
        date: new Date(createdAt).toLocaleDateString(),
      }),
    [t],
  );

  const usersError =
    usersQueryError instanceof Error ? usersQueryError.message : null;
  const requestsError =
    requestsQueryError instanceof Error ? requestsQueryError.message : null;

  const listData = useMemo(() => {
    if (usersError || usersQueryIsLoading) {
      return [];
    }

    const items: UserListItem[] = [];

    if (userGroups.showCurrentUserCard && userGroups.currentUserCard) {
      items.push({ id: "current-section", type: "current-section" });
      items.push({
        id: `current-${userGroups.currentUserCard.id}`,
        type: "current-user",
        user: userGroups.currentUserCard,
        joinedLabel: formatJoinedLabel(userGroups.currentUserCard.createdAt),
      });
    }

    if (userGroups.staffUsers.length) {
      items.push({
        id: "staff-section",
        type: "staff-section",
        count: userGroups.staffUsers.length,
      });
      userGroups.staffUsers.forEach((user) => {
        items.push({
          id: `staff-${user.id}`,
          type: "staff-user",
          user,
          joinedLabel: formatJoinedLabel(user.createdAt),
        });
      });
    }

    if (userGroups.playerUsers.length) {
      items.push({
        id: "players-section",
        type: "players-section",
        count: userGroups.playerUsers.length,
      });
      userGroups.playerUsers.forEach((user) => {
        items.push({
          id: `player-${user.id}`,
          type: "player-user",
          user,
          joinedLabel: formatJoinedLabel(user.createdAt),
        });
      });
    }

    if (!userGroups.hasResults) {
      items.push({ id: "empty", type: "empty" });
    }

    return items;
  }, [formatJoinedLabel, userGroups, usersError, usersQueryIsLoading]);

  const handleSortPress = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(SORT_DEFAULTS[field]);
      }
    },
    [sortField],
  );

  const openUserEditor = useCallback(
    (userId: string) =>
      router.push({
        pathname: "/admin-user-editor",
        params: { userId },
      } as any),
    [router],
  );

  const rowLabels = useMemo<UserRowLabels>(
    () => ({
      currentUser: t("admin.common.you"),
      admin: t("admin.common.admin"),
      superAdmin: t("admin.common.superAdmin"),
      noDisplayName: t("admin.common.noDisplayName"),
      authMethods: {
        password: t("admin.common.authPassword"),
        google: t("admin.common.authGoogle"),
        apple: t("admin.common.authApple"),
      },
    }),
    [t],
  );

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <AdminHero
          title={t("admin.users.title")}
          subtitle={
            isSuperAdmin
              ? t("admin.users.heroSubtitleSuperAdmin")
              : t("admin.users.heroSubtitle")
          }
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.users.usersLabel")}
              value={String(filteredUsers.length)}
              tone="info"
            />
            <AdminStat
              label={t("admin.users.staffLabel")}
              value={String(userGroups.visibleStaffCount)}
              tone="accent"
            />
            <AdminStat
              label={
                isSuperAdmin
                  ? t("admin.users.requestsLabel")
                  : t("admin.users.playersLabel")
              }
              value={String(
                isSuperAdmin
                  ? pendingRequests.length
                  : userGroups.visiblePlayerCount,
              )}
              tone={isSuperAdmin ? "warning" : "default"}
            />
          </View>
        </AdminHero>

        <AdminPanel
          tint={
            isSuperAdmin && pendingRequests.length ? "secondary" : "default"
          }
        >
          <AdminSectionTitle
            title={t("admin.users.workspaceTitle")}
            subtitle={t("admin.users.workspaceSubtitle")}
          />
          <View className="mt-4 gap-4">
            <AdminSearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("admin.users.searchPlaceholder")}
            />

            <View className="gap-2">
              <Text className="font-nunito-bold text-[12px] uppercase tracking-[0.7px] text-primaryText">
                {t("admin.users.focusLabel")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 py-1">
                  {ROLE_FILTER_KEYS.map((option) => (
                    <AdminFilterChip
                      key={option}
                      label={t(`admin.users.filters.${option}`)}
                      selected={roleFilter === option}
                      onPress={() => setRoleFilter(option)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="gap-2">
              <Text className="font-nunito-bold text-[12px] uppercase tracking-[0.7px] text-primaryText">
                {t("admin.users.sortLabel")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 py-1">
                  {SORT_OPTIONS.map((field) => {
                    const active = sortField === field;
                    const arrow = active
                      ? sortDir === "asc"
                        ? " ↑"
                        : " ↓"
                      : "";

                    return (
                      <AdminFilterChip
                        key={field}
                        label={`${t(`admin.users.sort.${field}`)}${arrow}`}
                        selected={active}
                        onPress={() => handleSortPress(field)}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </AdminPanel>

        {usersError ? (
          <AdminPanel>
            <Text className="font-nunito-bold text-[13px] text-dangerText">
              {usersError}
            </Text>
          </AdminPanel>
        ) : usersQueryIsLoading ? (
          <AdminPanel>
            <AdminLoadingState
              title={t("admin.users.loadingUsers")}
              body={t("common.loadingStates.adminBody")}
              icon="people"
            />
          </AdminPanel>
        ) : null}

        {!usersError && !usersQueryIsLoading ? (
          isSuperAdmin ? (
            requestsError ? (
              <AdminPanel tint="secondary">
                <Text className="font-nunito-bold text-[13px] text-dangerText">
                  {requestsError}
                </Text>
              </AdminPanel>
            ) : requestsQueryIsLoading ? (
              <AdminPanel tint="secondary">
                <AdminLoadingState
                  title={t("admin.users.loadingRequests")}
                  body={t("common.loadingStates.adminBody")}
                  icon="mail-open"
                />
              </AdminPanel>
            ) : pendingRequests.length ? (
              <AdminPanel tint="secondary">
                <AdminSectionTitle
                  title={t("admin.users.moderationTitle")}
                  subtitle={t("admin.users.moderationSubtitle")}
                  right={
                    <AdminChip
                      label={t("admin.users.requestsCount", {
                        count: pendingRequests.length,
                      })}
                      tone="warning"
                    />
                  }
                />
                <View className="mt-4 gap-3">
                  {pendingRequests.map((request) => (
                    <AdminRequestRow
                      key={request.id}
                      request={request}
                      statusLabel={requestStatusLabel(
                        request.status,
                        request.hasAccount,
                      )}
                      createdLabel={new Date(
                        request.createdAt,
                      ).toLocaleDateString()}
                      accountCreatedLabel={t("admin.users.accountCreated")}
                      attributionLabels={{
                        provider: t("admin.users.requestProvider"),
                        googleName: t("admin.users.requestGoogleName"),
                        userAgent: t("admin.users.requestUserAgent"),
                        app: t("admin.users.requestApp"),
                        attestation: t("admin.users.requestAttestation"),
                        requestId: t("admin.users.requestId"),
                        lastSeen: t("admin.users.requestLastSeen"),
                        attempts: t("admin.users.requestAttempts"),
                        recentEvents: t("admin.users.requestRecentEvents"),
                        assessmentTitle: t("admin.users.assessmentTitle"),
                        assessing: t("admin.users.assessmentAssessing"),
                        unavailable: t("admin.users.assessmentUnavailable"),
                        testLab: t("admin.users.assessmentTestLab"),
                        googleNetwork: t("admin.users.assessmentGoogleNetwork"),
                        confidence: t("admin.users.assessmentConfidence"),
                        coverage: t("admin.users.assessmentCoverage"),
                        heuristic: t("admin.users.assessmentHeuristic"),
                        missingEvidence: t("admin.users.assessmentMissing"),
                        positiveEvidence: t("admin.users.assessmentPositive"),
                        negativeEvidence: t("admin.users.assessmentNegative"),
                        hardFailures: t("admin.users.assessmentHardFailures"),
                        model: t("admin.users.assessmentModel"),
                        age: t("admin.users.assessmentAge"),
                        testLabRange: t("admin.users.assessmentTestLabRange"),
                        rangeVersion: t("admin.users.assessmentRangeVersion"),
                        rangeStale: t("admin.users.assessmentRangeStale"),
                        testLabWarning: t(
                          "admin.users.assessmentTestLabWarning",
                        ),
                        bandStronger: t("admin.users.assessmentBandStronger"),
                        bandMixed: t("admin.users.assessmentBandMixed"),
                        bandConcerning: t(
                          "admin.users.assessmentBandConcerning",
                        ),
                        networkDetails: t(
                          "admin.users.assessmentNetworkDetails",
                        ),
                        networkFlags: t("admin.users.assessmentNetworkFlags"),
                        networkFlagsNone: t(
                          "admin.users.assessmentNetworkFlagsNone",
                        ),
                        asn: t("admin.users.assessmentAsn"),
                        country: t("admin.users.assessmentCountry"),
                        connectionType: t(
                          "admin.users.assessmentConnectionType",
                        ),
                        connectionMobile: t(
                          "admin.users.assessmentConnectionMobile",
                        ),
                        connectionResidential: t(
                          "admin.users.assessmentConnectionResidential",
                        ),
                        connectionCorporate: t(
                          "admin.users.assessmentConnectionCorporate",
                        ),
                        connectionDatacenter: t(
                          "admin.users.assessmentConnectionDatacenter",
                        ),
                        connectionOther: t(
                          "admin.users.assessmentConnectionOther",
                        ),
                        flagVpn: t("admin.users.assessmentFlagVpn"),
                        flagProxy: t("admin.users.assessmentFlagProxy"),
                        flagHosting: t("admin.users.assessmentFlagHosting"),
                        flagTor: t("admin.users.assessmentFlagTor"),
                        showEvidence: t("admin.users.assessmentShowEvidence"),
                        hideEvidence: t("admin.users.assessmentHideEvidence"),
                        revealIp: t("admin.users.assessmentRevealIp"),
                        revealedIp: t("admin.users.assessmentRevealedIp"),
                      }}
                      approveLabel={t("admin.users.approve")}
                      rejectLabel={t("admin.users.reject")}
                      onApprove={() =>
                        reviewEmailRequest({
                          id: request.id,
                          status: "approved",
                        })
                      }
                      onReject={() =>
                        reviewEmailRequest({
                          id: request.id,
                          status: "rejected",
                        })
                      }
                      disabled={reviewRequestMutation.isPending}
                    />
                  ))}
                </View>
              </AdminPanel>
            ) : (
              <AdminNotice
                title={t("admin.users.noPendingTitle")}
                body={t("admin.users.noPendingBody")}
                tone="success"
                icon="mail-open-outline"
              />
            )
          ) : (
            <AdminNotice
              title={t("admin.users.guidanceTitle")}
              body={t("admin.users.guidanceBody")}
              tone="info"
              icon="shield-checkmark-outline"
            />
          )
        ) : null}

        {!usersError && !usersQueryIsLoading ? (
          <AdminPanel>
            <AdminSectionTitle
              title={t("admin.users.accountsTitle")}
              subtitle={t("admin.users.accountsSubtitle")}
            />
          </AdminPanel>
        ) : null}
      </View>
    ),
    [
      filteredUsers.length,
      isSuperAdmin,
      pendingRequests,
      requestsError,
      requestsQueryIsLoading,
      requestStatusLabel,
      reviewEmailRequest,
      reviewRequestMutation.isPending,
      handleSortPress,
      roleFilter,
      searchQuery,
      sortDir,
      sortField,
      t,
      userGroups.visiblePlayerCount,
      userGroups.visibleStaffCount,
      usersError,
      usersQueryIsLoading,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: UserListItem }) => {
      if (item.type === "current-section") {
        return (
          <UsersSubsectionHeader
            title={t("admin.users.yourAccountTitle")}
            subtitle={t("admin.users.yourAccountSubtitle")}
          />
        );
      }

      if (item.type === "staff-section") {
        return (
          <UsersSubsectionHeader
            title={t("admin.users.staffSectionTitle")}
            subtitle={t("admin.users.staffSectionSubtitle")}
            right={
              <AdminChip
                label={t("admin.users.usersCount", { count: item.count })}
                tone="accent"
              />
            }
          />
        );
      }

      if (item.type === "players-section") {
        return (
          <UsersSubsectionHeader
            title={t("admin.users.playersSectionTitle")}
            subtitle={t("admin.users.playersSectionSubtitle")}
            right={
              <AdminChip
                label={t("admin.users.usersCount", { count: item.count })}
                tone="info"
              />
            }
          />
        );
      }

      if (item.type === "empty") {
        return (
          <AdminPanel>
            <AdminEmptyState
              icon="people"
              title={t("admin.users.noUsersTitle")}
              body={t("admin.users.noUsersBody")}
            />
          </AdminPanel>
        );
      }

      return (
        <AdminUserListRow
          item={item}
          labels={rowLabels}
          onOpenUser={openUserEditor}
          coinsLabel={t("admin.common.coinsCount", {
            count: item.user.coins,
          })}
          questCompletionLabel={t("admin.users.questCompletion", {
            percentage: item.user.dailyQuestCompletion.percentage,
          })}
        />
      );
    },
    [openUserEditor, rowLabels, t],
  );

  return (
    <FlatList
      {...KEYBOARD_AWARE_SCROLL_PROPS}
      data={listData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 132,
        gap: 16,
      }}
      ListHeaderComponent={listHeader}
      removeClippedSubviews
      windowSize={5}
      maxToRenderPerBatch={8}
      initialNumToRender={8}
    />
  );
}
