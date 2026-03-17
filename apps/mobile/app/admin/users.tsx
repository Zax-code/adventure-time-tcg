import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../src/lib/api";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminField,
  AdminModal,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";

export default function AdminUsersScreen() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [coinDelta, setCoinDelta] = useState("100");
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => apiClient.adminUsers() });
  const emailsQuery = useQuery({ queryKey: ["admin-emails"], queryFn: () => apiClient.adminAllowedEmails() });
  const requestsQuery = useQuery({ queryKey: ["admin-email-requests"], queryFn: () => apiClient.adminEmailRequests() });

  const addEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.addAdminAllowedEmail(email),
    onSuccess: async () => {
      setNewEmail("");
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
    },
  });
  const toggleEmailAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => apiClient.updateAdminAllowedEmail(id, isAdmin),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
    },
  });
  const deleteEmailMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAllowedEmail(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
      setEditingEmailId(null);
    },
  });
  const adjustCoinsMutation = useMutation({
    mutationFn: ({ userId, delta }: { userId: string; delta: number }) => apiClient.adjustAdminUserCoins(userId, delta),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUserId(null);
    },
  });
  const reviewRequestMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => apiClient.reviewAdminEmailRequest(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-emails"] }),
      ]);
    },
  });

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (usersQuery.data?.users ?? []).filter((user) => {
      if (!query) return true;
      return `${user.email} ${user.displayName ?? ""}`.toLowerCase().includes(query);
    });
  }, [searchQuery, usersQuery.data?.users]);

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (emailsQuery.data?.emails ?? []).filter((entry) => {
      if (!query) return true;
      return entry.email.toLowerCase().includes(query);
    });
  }, [emailsQuery.data?.emails, searchQuery]);

  const editingEmail = emailsQuery.data?.emails.find((entry) => entry.id === editingEmailId) ?? null;
  const editingUser = usersQuery.data?.users.find((user) => user.id === editingUserId) ?? null;

  return (
    <>
      <AdminPageScroll>
        <AdminPanel>
          <AdminSectionTitle title="Users" subtitle="Bring allowlist, access review, and coin management into one native page like the PWA." />
          <View style={{ height: 12 }} />
          <AdminSearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by email or display name" />
          <View style={styles.metaRow}>
            <AdminChip label={`${filteredEmails.length} allowed`} tone="accent" />
            <AdminChip label={`${requestsQuery.data?.requests.length ?? 0} requests`} tone="warning" />
            <AdminChip label={`${filteredUsers.length} players`} tone="info" />
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle title="Allowed access" subtitle="Grant or revoke admin access from the same management panel." />
          <View style={{ height: 12 }} />
          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <AdminField label="Email" value={newEmail} keyboardType="email-address" onChangeText={setNewEmail} placeholder="email@example.com" />
            </View>
            <View style={{ width: 112, justifyContent: "flex-end" }}>
              <AdminButton label="Add" icon="add" onPress={() => addEmailMutation.mutate(newEmail)} />
            </View>
          </View>
          <View style={styles.list}>
            {filteredEmails.length ? (
              filteredEmails.map((entry) => (
                <Pressable key={entry.id} style={styles.listCard} onPress={() => setEditingEmailId(entry.id)}>
                  <Text style={styles.title}>{entry.email}</Text>
                  <View style={styles.metaRow}>
                    <AdminChip label={entry.isAdmin ? "Admin" : "Allowed"} tone={entry.isAdmin ? "accent" : "default"} />
                  </View>
                </Pressable>
              ))
            ) : (
              <AdminEmptyState icon="mail-open" title="No allowlist entries" body="Add an email to let someone into the admin flow." />
            )}
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle title="Access requests" subtitle="Review pending requests without leaving the admin shell." />
          <View style={styles.list}>
            {(requestsQuery.data?.requests ?? []).length ? (
              requestsQuery.data?.requests.map((request) => (
                <View key={request.id} style={styles.listCard}>
                  <Text style={styles.title}>{request.email}</Text>
                  <View style={styles.metaRow}>
                    <AdminChip label={request.status} tone={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "danger"} />
                    <AdminChip label={new Date(request.createdAt).toLocaleDateString()} tone="default" />
                  </View>
                  {request.status === "pending" ? (
                    <View style={styles.actionRow}>
                      <AdminButton label="Approve" variant="secondary" onPress={() => reviewRequestMutation.mutate({ id: request.id, status: "approved" })} />
                      <AdminButton label="Reject" variant="danger" onPress={() => reviewRequestMutation.mutate({ id: request.id, status: "rejected" })} />
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <AdminEmptyState icon="checkmark-circle" title="No requests waiting" body="New access requests will appear here." />
            )}
          </View>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle title="Player accounts" subtitle="Use the native modal to inspect balances and grant quick coin adjustments." />
          <View style={styles.list}>
            {filteredUsers.length ? (
              filteredUsers.map((user) => (
                <Pressable key={user.id} style={styles.listCard} onPress={() => setEditingUserId(user.id)}>
                  <Text style={styles.title}>{user.email}</Text>
                  <Text style={styles.subtitle}>{user.displayName ?? "No display name"}</Text>
                  <View style={styles.metaRow}>
                    <AdminChip label={`${user.coins} coins`} tone="warning" />
                    {user.isAdmin ? <AdminChip label="Admin" tone="accent" /> : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <AdminEmptyState icon="people" title="No users found" body="Try a different search term." />
            )}
          </View>
        </AdminPanel>
      </AdminPageScroll>

      <AdminModal visible={Boolean(editingEmail)} title="Manage access" onClose={() => setEditingEmailId(null)}>
        {editingEmail ? (
          <>
            <Text style={styles.title}>{editingEmail.email}</Text>
            <View style={styles.metaRow}>
              <AdminChip label={editingEmail.isAdmin ? "Admin access" : "Basic allowlist access"} tone={editingEmail.isAdmin ? "accent" : "default"} />
            </View>
            <AdminButton
              label={editingEmail.isAdmin ? "Revoke admin" : "Grant admin"}
              variant="ghost"
              onPress={() => toggleEmailAdminMutation.mutate({ id: editingEmail.id, isAdmin: !editingEmail.isAdmin })}
            />
            <AdminButton label="Remove from allowlist" variant="danger" onPress={() => deleteEmailMutation.mutate(editingEmail.id)} />
          </>
        ) : null}
      </AdminModal>

      <AdminModal visible={Boolean(editingUser)} title="Manage player" onClose={() => setEditingUserId(null)}>
        {editingUser ? (
          <>
            <Text style={styles.title}>{editingUser.email}</Text>
            <Text style={styles.subtitle}>{editingUser.displayName ?? "No display name"}</Text>
            <View style={styles.metaRow}>
              <AdminChip label={`${editingUser.coins} coins`} tone="warning" />
              {editingUser.isAdmin ? <AdminChip label="Admin" tone="accent" /> : null}
            </View>
            <AdminField label="Coin delta" value={coinDelta} keyboardType="numeric" onChangeText={setCoinDelta} />
            <AdminButton
              label="Adjust balance"
              onPress={() => adjustCoinsMutation.mutate({ userId: editingUser.id, delta: Number(coinDelta || 0) })}
            />
          </>
        ) : null}
      </AdminModal>
    </>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  listCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.2)",
  },
  title: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
    color: "#4A3728",
  },
  subtitle: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: "#9CA3AF",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
