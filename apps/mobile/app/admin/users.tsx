import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

type SortField = "email" | "coins" | "createdAt";
type SortDir = "asc" | "desc";

const SORT_DEFAULTS: Record<SortField, SortDir> = {
  email: "asc",
  coins: "desc",
  createdAt: "desc",
};

const SORT_LABELS: Record<SortField, string> = {
  email: "Email",
  coins: "Coins",
  createdAt: "Joined",
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const currentUserId = useSessionStore((state) => state.user?.id);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.adminUsers(),
  });
  const requestsQuery = useQuery({
    queryKey: ["admin-email-requests"],
    queryFn: () => apiClient.adminEmailRequests(),
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
      await queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] });
    },
  });

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = (usersQuery.data?.users ?? []).filter((user) => {
      if (!query) return true;
      return `${user.email} ${user.displayName ?? ""}`.toLowerCase().includes(query);
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "email") cmp = a.email.localeCompare(b.email);
      else if (sortField === "coins") cmp = a.coins - b.coins;
      else cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });

    if (currentUserId) {
      const idx = list.findIndex((u) => u.id === currentUserId);
      if (idx > 0) list = [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
    }

    return list;
  }, [searchQuery, usersQuery.data?.users, sortField, sortDir, currentUserId]);

  function handleSortPress(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(SORT_DEFAULTS[field]);
    }
  }

  return (
    <AdminPageScroll>
      <AdminPanel>
        <AdminSectionTitle
          title="Users"
          subtitle="Browse player accounts and open the full-screen management sheet for coins, quests, permissions, and deletion."
        />
        <View className="h-3" />
        <AdminSearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by email or display name"
        />
        <View className="mt-3 flex-row flex-wrap gap-2">
          <AdminChip
            label={`${requestsQuery.data?.requests.length ?? 0} requests`}
            tone="warning"
          />
          <AdminChip label={`${filteredUsers.length} users`} tone="info" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 -mx-1">
          <View className="flex-row gap-2 px-1 py-1">
            {(["email", "coins", "createdAt"] as SortField[]).map((field) => {
              const active = sortField === field;
              const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
              return (
                <Pressable key={field} onPress={() => handleSortPress(field)}>
                  <AdminChip
                    label={`${SORT_LABELS[field]}${arrow}`}
                    tone={active ? "accent" : "default"}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle
          title="User accounts"
          subtitle="Tap any user to open the full-screen editor."
        />
        <View className="mt-3 gap-3">
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <Pressable
                key={user.id}
                className="gap-[10px] rounded-[20px] border border-primaryBorder/30 bg-surfaceMuted p-[14px]"
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
                  {user.displayName ?? "No display name"}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {user.id === currentUserId ? (
                    <AdminChip label="You" tone="success" />
                  ) : null}
                  {user.isSuperAdmin ? (
                    <AdminChip label="Super Admin" tone="success" />
                  ) : null}
                  {user.isAdmin ? (
                    <AdminChip label="Admin" tone="accent" />
                  ) : null}
                  <AdminChip label={`${user.coins} coins`} tone="warning" />
                </View>
              </Pressable>
            ))
          ) : (
            <AdminEmptyState
              icon="people"
              title="No users found"
              body="Try a different search term."
            />
          )}
        </View>
      </AdminPanel>

      <AdminPanel>
          <AdminSectionTitle
            title="Access requests"
            subtitle="Approve or reject new sign-in requests. Approved users stay here until they create an account."
          />
          <View className="mt-3 gap-3">
            {(requestsQuery.data?.requests ?? []).length ? (
              requestsQuery.data?.requests.map((request) => (
                <View
                  key={request.id}
                  className="gap-[10px] rounded-[20px] border border-primaryBorder/30 bg-surfaceMuted p-[14px]"
                >
                  <Text className="font-nunito-extrabold text-[15px] text-fg">
                    {request.email}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <AdminChip
                      label={
                        request.status === "approved" && !request.hasAccount
                          ? "Approved - waiting for sign-in"
                          : request.status === "approved"
                            ? "Approved"
                            : request.status
                      }
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
                        <AdminChip label="Account created" tone="info" />
                      ) : null}
                  </View>
                  {request.status === "pending" ? (
                    <View className="flex-row gap-2">
                      <AdminButton
                        label="Approve"
                        variant="secondary"
                        onPress={() =>
                          reviewRequestMutation.mutate({
                            id: request.id,
                            status: "approved",
                          })
                        }
                      />
                      <AdminButton
                        label="Reject"
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
                title="No requests waiting"
                body="New access requests will appear here."
              />
            )}
          </View>
        </AdminPanel>
    </AdminPageScroll>
  );
}
