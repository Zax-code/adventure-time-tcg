import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminHero,
  AdminLoadingState,
  AdminNotice,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminFilterChip,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

type SortField = "email" | "coins" | "createdAt";
type SortDir = "asc" | "desc";

const SORT_DEFAULTS: Record<SortField, SortDir> = {
  email: "asc",
  coins: "desc",
  createdAt: "desc",
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const currentUser = useSessionStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const isSuperAdmin = currentUser?.isSuperAdmin ?? false;
  const { t } = useTranslation();
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

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = (usersQuery.data?.users ?? []).filter((user) => {
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
  }, [searchQuery, usersQuery.data?.users, sortField, sortDir, currentUserId]);

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
        badge={t("admin.shell.nav.users")}
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
      >
        <View className="flex-row flex-wrap gap-3">
          <AdminStat
            label={t("admin.users.usersLabel")}
            value={String(filteredUsers.length)}
            tone="info"
          />
          <AdminStat
            label={t("admin.users.requestsLabel")}
            value={String(requestsQuery.data?.requests.length ?? 0)}
            tone="warning"
          />
        </View>
        <AdminSearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("admin.users.searchPlaceholder")}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 py-1">
            {(["email", "coins", "createdAt"] as SortField[]).map((field) => {
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
      </AdminHero>

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
      ) : (
        <AdminNotice
          title={t("admin.users.guidanceTitle")}
          body={
            isSuperAdmin
              ? t("admin.users.guidanceBodySuperAdmin")
              : t("admin.users.guidanceBody")
          }
          tone="info"
          icon="shield-checkmark-outline"
        />
      )}

      <AdminPanel>
        <AdminSectionTitle
          title={t("admin.users.accountsTitle")}
          subtitle={t("admin.users.accountsSubtitle")}
        />
        <View className="mt-3 gap-3">
          {usersQuery.isLoading ? null : filteredUsers.length ? (
            filteredUsers.map((user) => (
              <Pressable
                key={user.id}
                className="gap-[10px] rounded-[22px] border border-primaryBorder/30 bg-surfaceMuted p-[14px]"
                onPress={() =>
                  router.push({
                    pathname: "/admin-user-editor",
                    params: { userId: user.id },
                  } as any)
                }
              >
                <Text className="font-nunito-extrabold text-[15px] text-fg">
                  {user.email}
                </Text>
                <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                  {user.displayName ?? t("admin.common.noDisplayName")}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {user.id === currentUserId ? (
                    <AdminChip label={t("admin.common.you")} tone="success" />
                  ) : null}
                  {user.isSuperAdmin ? (
                    <AdminChip
                      label={t("admin.common.superAdmin")}
                      tone="success"
                    />
                  ) : null}
                  {user.isAdmin ? (
                    <AdminChip label={t("admin.common.admin")} tone="accent" />
                  ) : null}
                  <AdminChip
                    label={t("admin.common.coinsCount", { count: user.coins })}
                    tone="warning"
                  />
                </View>
              </Pressable>
            ))
          ) : (
            <AdminEmptyState
              icon="people"
              title={t("admin.users.noUsersTitle")}
              body={t("admin.users.noUsersBody")}
            />
          )}
        </View>
      </AdminPanel>

      {isSuperAdmin ? (
        <AdminPanel tint="secondary">
          <AdminSectionTitle
            title={t("admin.users.accessRequestsTitle")}
            subtitle={t("admin.users.accessRequestsSubtitle")}
          />
          <View className="mt-3 gap-3">
            {requestsQuery.isLoading ? (
              <AdminLoadingState
                title={t("admin.users.loadingRequests")}
                body={t("common.loadingStates.adminBody")}
                icon="mail-open"
              />
            ) : requestsError ? (
              <Text className="font-nunito-bold text-[13px] text-dangerText">
                {requestsError}
              </Text>
            ) : (requestsQuery.data?.requests ?? []).length ? (
              requestsQuery.data?.requests.map((request) => (
                <View
                  key={request.id}
                  className="gap-[10px] rounded-[22px] border border-primaryBorder/30 bg-surfaceMuted p-[14px]"
                >
                  <Text className="font-nunito-extrabold text-[15px] text-fg">
                    {request.email}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <AdminChip
                      label={requestStatusLabel(
                        request.status,
                        request.hasAccount,
                      )}
                      tone={
                        request.status === "pending"
                          ? "warning"
                          : request.status === "approved"
                            ? "success"
                            : "danger"
                      }
                    />
                    <AdminChip
                      label={new Date(request.createdAt).toLocaleDateString()}
                      tone="default"
                    />
                    {request.hasAccount ? (
                      <AdminChip
                        label={t("admin.users.accountCreated")}
                        tone="info"
                      />
                    ) : null}
                  </View>
                  {request.status === "pending" ? (
                    <View className="flex-row gap-2">
                      <AdminButton
                        label={t("admin.users.approve")}
                        variant="secondary"
                        onPress={() =>
                          reviewRequestMutation.mutate({
                            id: request.id,
                            status: "approved",
                          })
                        }
                      />
                      <AdminButton
                        label={t("admin.users.reject")}
                        variant="danger"
                        onPress={() =>
                          reviewRequestMutation.mutate({
                            id: request.id,
                            status: "rejected",
                          })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <AdminEmptyState
                icon="checkmark-circle"
                title={t("admin.users.noRequestsTitle")}
                body={t("admin.users.noRequestsBody")}
              />
            )}
          </View>
        </AdminPanel>
      ) : null}
    </AdminPageScroll>
  );
}
