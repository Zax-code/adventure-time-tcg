import type { ReactNode } from "react";

import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminFilterChip,
  AdminHero,
  AdminLoadingState,
  AdminNotice,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { withAlpha } from "../../src/components/admin/admin-palette";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

type AdminUser = Awaited<ReturnType<typeof apiClient.adminUsers>>["users"][number];
type AdminEmailRequest =
  Awaited<ReturnType<typeof apiClient.adminEmailRequests>>["requests"][number];

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

function AdminUserRow({
  user,
  isCurrentUser,
  currentUserLabel,
  adminLabel,
  superAdminLabel,
  coinsLabel,
  noDisplayNameLabel,
  joinedLabel,
  onPress,
}: {
  user: AdminUser;
  isCurrentUser: boolean;
  currentUserLabel: string;
  adminLabel: string;
  superAdminLabel: string;
  coinsLabel: string;
  noDisplayNameLabel: string;
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

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[16px]"
      style={{
        backgroundColor: withAlpha(accentShell, themeName === "nightosphere" ? "47" : "2B"),
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
            {user.isAdmin ? <AdminChip label={adminLabel} tone="accent" /> : null}
            <AdminChip label={coinsLabel} tone="warning" />
          </View>

          <Text className="font-nunito-semibold text-[12px] text-fgMuted">
            {joinedLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function AdminRequestRow({
  request,
  statusLabel,
  createdLabel,
  accountCreatedLabel,
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
  approveLabel: string;
  rejectLabel: string;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

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

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.adminUsers(),
  });
  const requestsQuery = useQuery({
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

  const requestStatusLabel = (status: string, hasAccount: boolean) => {
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
  };

  const pendingRequests = useMemo(() => {
    return [...(requestsQuery.data?.requests ?? [])]
      .filter((request) => request.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestsQuery.data?.requests]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = (usersQuery.data?.users ?? []).filter((user) => {
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
    usersQuery.data?.users,
  ]);

  const currentUserCard =
    filteredUsers.find((user) => user.id === currentUserId) ?? null;
  const remainingUsers = filteredUsers.filter((user) => user.id !== currentUserId);
  const staffUsers = remainingUsers.filter((user) => user.isAdmin);
  const playerUsers = remainingUsers.filter((user) => !user.isAdmin);
  const showCurrentUserCard = Boolean(currentUserCard) && roleFilter !== "players";
  const hasResults =
    (showCurrentUserCard && currentUserCard !== null) ||
    staffUsers.length > 0 ||
    playerUsers.length > 0;

  const visibleStaffCount = filteredUsers.filter((user) => user.isAdmin).length;
  const visiblePlayerCount = filteredUsers.filter((user) => !user.isAdmin).length;

  function handleSortPress(field: SortField) {
    if (field === sortField) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(SORT_DEFAULTS[field]);
    }
  }

  const usersError =
    usersQuery.error instanceof Error ? usersQuery.error.message : null;
  const requestsError =
    requestsQuery.error instanceof Error ? requestsQuery.error.message : null;

  return (
    <AdminPageScroll>
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
            value={String(visibleStaffCount)}
            tone="accent"
          />
          <AdminStat
            label={
              isSuperAdmin
                ? t("admin.users.requestsLabel")
                : t("admin.users.playersLabel")
            }
            value={String(isSuperAdmin ? pendingRequests.length : visiblePlayerCount)}
            tone={isSuperAdmin ? "warning" : "default"}
          />
        </View>
      </AdminHero>

      <AdminPanel tint={isSuperAdmin && pendingRequests.length ? "secondary" : "default"}>
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
                  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";

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
      ) : usersQuery.isLoading ? (
        <AdminPanel>
          <AdminLoadingState
            title={t("admin.users.loadingUsers")}
            body={t("common.loadingStates.adminBody")}
            icon="people"
          />
        </AdminPanel>
      ) : null}

      {!usersError && !usersQuery.isLoading ? (
        isSuperAdmin ? (
          requestsError ? (
            <AdminPanel tint="secondary">
              <Text className="font-nunito-bold text-[13px] text-dangerText">
                {requestsError}
              </Text>
            </AdminPanel>
          ) : requestsQuery.isLoading ? (
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
                    createdLabel={new Date(request.createdAt).toLocaleDateString()}
                    accountCreatedLabel={t("admin.users.accountCreated")}
                    approveLabel={t("admin.users.approve")}
                    rejectLabel={t("admin.users.reject")}
                    onApprove={() =>
                      reviewRequestMutation.mutate({
                        id: request.id,
                        status: "approved",
                      })
                    }
                    onReject={() =>
                      reviewRequestMutation.mutate({
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

      {!usersError && !usersQuery.isLoading ? (
        <AdminPanel>
          <AdminSectionTitle
            title={t("admin.users.accountsTitle")}
            subtitle={t("admin.users.accountsSubtitle")}
          />

          <View className="mt-4 gap-5">
            {showCurrentUserCard && currentUserCard ? (
              <View className="gap-3">
                <UsersSubsectionHeader
                  title={t("admin.users.yourAccountTitle")}
                  subtitle={t("admin.users.yourAccountSubtitle")}
                />
                <AdminUserRow
                  user={currentUserCard}
                  isCurrentUser
                  currentUserLabel={t("admin.common.you")}
                  adminLabel={t("admin.common.admin")}
                  superAdminLabel={t("admin.common.superAdmin")}
                  coinsLabel={t("admin.common.coinsCount", {
                    count: currentUserCard.coins,
                  })}
                  noDisplayNameLabel={t("admin.common.noDisplayName")}
                  joinedLabel={t("admin.common.joinedDate", {
                    date: new Date(currentUserCard.createdAt).toLocaleDateString(),
                  })}
                  onPress={() =>
                    router.push({
                      pathname: "/admin-user-editor",
                      params: { userId: currentUserCard.id },
                    } as any)
                  }
                />
              </View>
            ) : null}

            {staffUsers.length ? (
              <View className="gap-3">
                <UsersSubsectionHeader
                  title={t("admin.users.staffSectionTitle")}
                  subtitle={t("admin.users.staffSectionSubtitle")}
                  right={
                    <AdminChip
                      label={t("admin.users.usersCount", {
                        count: staffUsers.length,
                      })}
                      tone="accent"
                    />
                  }
                />
                <View className="gap-3">
                  {staffUsers.map((user) => (
                    <AdminUserRow
                      key={user.id}
                      user={user}
                      isCurrentUser={false}
                      currentUserLabel={t("admin.common.you")}
                      adminLabel={t("admin.common.admin")}
                      superAdminLabel={t("admin.common.superAdmin")}
                      coinsLabel={t("admin.common.coinsCount", {
                        count: user.coins,
                      })}
                      noDisplayNameLabel={t("admin.common.noDisplayName")}
                      joinedLabel={t("admin.common.joinedDate", {
                        date: new Date(user.createdAt).toLocaleDateString(),
                      })}
                      onPress={() =>
                        router.push({
                          pathname: "/admin-user-editor",
                          params: { userId: user.id },
                        } as any)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {playerUsers.length ? (
              <View className="gap-3">
                <UsersSubsectionHeader
                  title={t("admin.users.playersSectionTitle")}
                  subtitle={t("admin.users.playersSectionSubtitle")}
                  right={
                    <AdminChip
                      label={t("admin.users.usersCount", {
                        count: playerUsers.length,
                      })}
                      tone="info"
                    />
                  }
                />
                <View className="gap-3">
                  {playerUsers.map((user) => (
                    <AdminUserRow
                      key={user.id}
                      user={user}
                      isCurrentUser={false}
                      currentUserLabel={t("admin.common.you")}
                      adminLabel={t("admin.common.admin")}
                      superAdminLabel={t("admin.common.superAdmin")}
                      coinsLabel={t("admin.common.coinsCount", {
                        count: user.coins,
                      })}
                      noDisplayNameLabel={t("admin.common.noDisplayName")}
                      joinedLabel={t("admin.common.joinedDate", {
                        date: new Date(user.createdAt).toLocaleDateString(),
                      })}
                      onPress={() =>
                        router.push({
                          pathname: "/admin-user-editor",
                          params: { userId: user.id },
                        } as any)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {!hasResults ? (
              <AdminEmptyState
                icon="people"
                title={t("admin.users.noUsersTitle")}
                body={t("admin.users.noUsersBody")}
              />
            ) : null}
          </View>
        </AdminPanel>
      ) : null}
    </AdminPageScroll>
  );
}
