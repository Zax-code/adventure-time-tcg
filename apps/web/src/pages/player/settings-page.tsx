import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import type { NotificationPreferences } from "@adventure-time/api-client";

import { useAuth } from "@/auth";
import { getAccessToken } from "@/auth/session";
import { AuthenticatedProfileImage } from "@/components/game-art";
import {
  CheckCircleIcon,
  GiftHeartIcon,
  SettingsIcon,
  StepQuestIcon,
  UserPlusIcon,
} from "@/components/icons";
import {
  Button,
  Dialog,
  Field,
  FormStatus,
  Notice,
  PageHeader,
  Panel,
  SectionHeader,
  SegmentedControl,
} from "@/components/ui";
import { webApiClient } from "@/lib/api";
import { formValues, readErrorMessage } from "@/lib/form-utils";
import { ThemeSwitcher } from "@/theme/theme-provider";

type SettingsSection = "profile" | "steps" | "notifications" | "security";

const notificationLabels: Record<keyof NotificationPreferences, { title: string; copy: string }> = {
  dailyReset: { title: "Daily reset", copy: "A fresh daily reward and quest set is available." },
  stepGoal: { title: "Step goal", copy: "A step-based quest has reached its target." },
  pvpInvite: { title: "PvP invitation", copy: "A friend invited you to a battle." },
  pvpTurn: { title: "PvP turn", copy: "A live match is waiting for your action." },
  giftReceived: { title: "Gift received", copy: "A friend sent a card to your mailbox." },
};

export function SettingsPage() {
  const { logout, restore, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SettingsSection>("profile");
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const health = useQuery({ queryKey: ["health-steps"], queryFn: () => webApiClient.getHealthSteps() });
  const fitbit = useQuery({ queryKey: ["fitbit"], queryFn: () => webApiClient.fitbitStatus() });

  const preference = useMutation({
    mutationFn: async (command: () => Promise<unknown>) => command(),
    onSuccess: async () => {
      setSuccess(true);
      setMessage("Settings saved.");
      await restore();
      await queryClient.invalidateQueries({ queryKey: ["health-steps"] });
    },
    onError: (error) => { setSuccess(false); setMessage(readErrorMessage(error)); },
  });
  const upload = useMutation({
    mutationFn: (file: File) => { const data = new FormData(); data.append("file", file); return webApiClient.uploadProfileImage(data); },
    onSuccess: async () => { setSuccess(true); setMessage("Profile image updated."); await restore(); },
    onError: (error) => { setSuccess(false); setMessage(readErrorMessage(error)); },
  });
  const fitbitCommand = useMutation({
    mutationFn: async (kind: "connect" | "disconnect") => kind === "connect" ? webApiClient.createFitbitAuthorizeUrl({ redirectUri: `${window.location.origin}/settings` }) : webApiClient.disconnectFitbit(),
    onSuccess: (result, kind) => {
      if (kind === "connect" && "authorizeUrl" in result) window.location.assign(result.authorizeUrl);
      else void queryClient.invalidateQueries({ queryKey: ["fitbit"] });
    },
  });
  const deletion = useMutation({
    mutationFn: () => webApiClient.deleteAccount(),
    onSuccess: async () => {
      setDeleteOpen(false);
      queryClient.clear();
      await logout();
      navigate("/");
    },
  });

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    const commands: Array<Promise<unknown>> = [];
    if (String(values.displayName).trim() !== (user?.displayName ?? "")) commands.push(webApiClient.updateDisplayName(String(values.displayName).trim()));
    if (String(values.language) !== user?.preferredLanguage) commands.push(webApiClient.updateLanguage({ preferredLanguage: String(values.language) as "en" | "fr" }));
    if (String(values.timezone) !== user?.timezone) commands.push(webApiClient.updateTimezone({ timezone: String(values.timezone) }));
    preference.mutate(() => Promise.all(commands));
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    if (String(values.newPassword) !== String(values.confirmPassword)) { setSuccess(false); setMessage("New password and confirmation do not match."); return; }
    preference.mutate(() => webApiClient.changePassword({ currentPassword: String(values.currentPassword || "") || undefined, newPassword: String(values.newPassword) }));
    event.currentTarget.reset();
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) upload.mutate(file);
  }

  const preferences = user?.notificationPreferences;

  return (
    <div className="page-stack settings-page">
      <PageHeader eyebrow="Account and preferences" lede="Profile, step sources, alerts, and security are kept in one transparent place." title="Settings" />
      <SegmentedControl label="Settings section" onChange={setSection} options={[{ label: "Profile", value: "profile" }, { label: "Steps", value: "steps" }, { label: "Alerts", value: "notifications" }, { label: "Security", value: "security" }]} value={section} />
      <FormStatus message={message || (deletion.isError ? readErrorMessage(deletion.error) : undefined)} success={success} />

      {section === "profile" ? <div className="settings-grid"><Panel className="profile-card"><AuthenticatedProfileImage accessToken={getAccessToken() ?? ""} alt={`${user?.displayName || "Player"} profile`} className="settings-avatar-image" fallback={<div className="settings-avatar">{(user?.displayName || user?.email || "A").slice(0, 1).toUpperCase()}</div>} imageAssetId={user?.avatarAssetId} /><div><h2>{user?.displayName || "Adventurer"}</h2><p>{user?.email}</p><span>{user?.isSuperAdmin ? "Super administrator" : user?.isAdmin ? "Administrator" : "Player"}</span></div><label className="button button-secondary file-button"><span>{upload.isPending ? "Uploading…" : "Choose profile image"}</span><input accept="image/png,image/jpeg,image/webp" disabled={upload.isPending} onChange={uploadAvatar} type="file" /></label><div className="profile-theme"><span>Color theme</span><ThemeSwitcher /></div></Panel><Panel><SectionHeader lede="These preferences follow your account across mobile and web." title="Public profile and locale" /><form className="stack-form" onSubmit={saveProfile}><Field label="Display name"><input defaultValue={user?.displayName ?? ""} maxLength={64} name="displayName" required /></Field><Field label="Language"><select defaultValue={user?.preferredLanguage} name="language"><option value="en">English</option><option value="fr">Français</option></select></Field><Field hint="Used for daily resets and date boundaries." label="Timezone"><input defaultValue={user?.timezone} name="timezone" placeholder="America/New_York" required /></Field><Button busy={preference.isPending} type="submit">Save profile</Button></form></Panel></div> : null}

      {section === "steps" ? <div className="settings-grid"><Panel><SectionHeader lede="Your preferred source determines which verified total feeds step quests." title="Step source" /><div className="source-options"><button aria-pressed={user?.preferredStepSource === "fitbit"} disabled={!fitbit.data?.connected} onClick={() => preference.mutate(() => webApiClient.updateStepSource({ preferredStepSource: "fitbit" }))} type="button"><StepQuestIcon /><div><b>Fitbit</b><span>{fitbit.data?.connected ? "Connected and available on web" : "Connect Fitbit first"}</span></div>{user?.preferredStepSource === "fitbit" ? <CheckCircleIcon /> : null}</button><button aria-pressed={user?.preferredStepSource === "device_health"} onClick={() => preference.mutate(() => webApiClient.updateStepSource({ preferredStepSource: "device_health" }))} type="button"><SettingsIcon /><div><b>Device health</b><span>Synced through the iOS or Android app</span></div>{user?.preferredStepSource === "device_health" ? <CheckCircleIcon /> : null}</button></div></Panel><Panel><SectionHeader title="Latest verified total" />{health.data?.latest ? <div className="step-summary"><StepQuestIcon /><strong>{health.data.latest.stepCount.toLocaleString()}</strong><span>steps on {health.data.latest.recordedFor}</span><small>Source: {health.data.latest.source.replace("_", " ")} · updated {new Date(health.data.latest.updatedAt).toLocaleString()}</small></div> : <p className="quiet-copy">No verified step total has been recorded yet.</p>}<Notice title="Browser capability boundary">Safari and Chrome websites cannot read Apple Health or Health Connect. Use Fitbit here, or sync device steps from the native mobile app.</Notice><Button busy={fitbitCommand.isPending} onClick={() => fitbitCommand.mutate(fitbit.data?.connected ? "disconnect" : "connect")} tone={fitbit.data?.connected ? "ghost" : "secondary"}>{fitbit.data?.connected ? "Disconnect Fitbit" : "Connect Fitbit"}</Button></Panel></div> : null}

      {section === "notifications" && preferences ? <div className="settings-grid"><Panel><SectionHeader lede="These choices are stored now and used by registered mobile devices." title="Notification preferences" /><div className="toggle-list">{(Object.keys(notificationLabels) as Array<keyof NotificationPreferences>).map((key) => <label key={key}><div><b>{notificationLabels[key].title}</b><span>{notificationLabels[key].copy}</span></div><input checked={preferences[key]} onChange={(event) => preference.mutate(() => webApiClient.updateNotificationPreferences({ notificationPreferences: { ...preferences, [key]: event.target.checked } }))} type="checkbox" /></label>)}</div></Panel><Panel><GiftHeartIcon /><h2>Browser push is not registered by this app.</h2><p>The current backend device contract is for Expo iOS and Android installations. Your preferences still apply to native notifications, and the website does not pretend it registered a browser endpoint.</p><Notice title="Use the mobile app for push alerts">Install or open the Adventure Time TCG app to register this device for turn, gift, and quest notifications.</Notice></Panel></div> : null}

      {section === "security" ? <div className="settings-grid"><Panel><SectionHeader lede="Changing a password leaves your current browser session signed in." title="Password" /><div className="auth-methods"><span className={user?.authMethods.password ? "active" : ""}>Password</span><span className={user?.authMethods.google ? "active" : ""}>Google</span><span className={user?.authMethods.apple ? "active" : ""}>Apple</span></div><form className="stack-form" onSubmit={savePassword}>{user?.authMethods.password ? <Field label="Current password"><input autoComplete="current-password" name="currentPassword" required type="password" /></Field> : null}<Field label={user?.authMethods.password ? "New password" : "Create a password"}><input autoComplete="new-password" minLength={8} name="newPassword" required type="password" /></Field><Field label="Confirm new password"><input autoComplete="new-password" minLength={8} name="confirmPassword" required type="password" /></Field><Button busy={preference.isPending} type="submit">Update password</Button></form></Panel><Panel className="danger-zone"><UserPlusIcon /><h2>Delete account</h2><p>Permanently remove the account and dependent game records. This cannot be undone.</p><Button onClick={() => setDeleteOpen(true)} tone="danger">Start account deletion</Button></Panel></div> : null}

      <Dialog description="This permanently removes your account and game data. There is no undo." onClose={() => setDeleteOpen(false)} open={deleteOpen} title="Delete your account?">
        <div className="stack-form"><Notice title="Deletion is permanent" tone="danger">Type <b>DELETE MY ACCOUNT</b> below to enable the final action.</Notice><Field label="Confirmation phrase"><input autoComplete="off" onChange={(event) => setDeletePhrase(event.target.value)} value={deletePhrase} /></Field><Button busy={deletion.isPending} disabled={deletePhrase !== "DELETE MY ACCOUNT"} onClick={() => deletion.mutate()} tone="danger">Permanently delete account</Button></div>
      </Dialog>
    </div>
  );
}
