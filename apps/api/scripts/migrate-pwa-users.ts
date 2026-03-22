import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { parse } from "dotenv";
import { Client as MinioClient } from "minio";
import { Pool } from "pg";

type Mode = "audit" | "migrate" | "verify";
type StepSource = "device_health" | "fitbit";

interface SourceAllowedEmailRow {
  id: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
}

interface SourceUserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  coins: number;
  dust: number;
  createdAt: Date;
  updatedAt: Date;
  settingsDisplayName: string | null;
  settingsProfilePicture: string | null;
  settingsLanguage: string | null;
  settingsTheme: string | null;
  settingsPushNotificationsEnabled: boolean | null;
  settingsQuestNotificationsEnabled: boolean | null;
  settingsGiftNotificationsEnabled: boolean | null;
  settingsDailyClaimNotificationsEnabled: boolean | null;
  hasFitbit: boolean;
}

interface SourceOwnedCardRow {
  id: string;
  cardId: string;
  userId: string;
  quantity: number;
  obtainedAt: Date;
}

interface SourceImageAssetRow {
  id: string;
  kind: string;
  userId: string | null;
  bucket: string;
  objectKey: string;
  mimeType: string;
  uploadStatus: string;
  createdAt: Date;
}

interface TargetUserRow {
  id: string;
  email: string;
  avatarAssetId: string | null;
}

interface AllowedUserRecord {
  sourceAllowedEmail: SourceAllowedEmailRow;
  sourceUser: SourceUserRow | null;
  targetUser: TargetUserRow | null;
  targetUserId: string | null;
  displayName: string | null;
  preferredStepSource: StepSource;
  profilePictureUrl: string | null;
}

interface AvatarMigrationResult {
  userEmail: string;
  source: string;
  status: "copied" | "skipped" | "failed";
  reason?: string;
  targetAssetId?: string;
  targetObjectKey?: string;
}

interface AuditReport {
  mode: Mode;
  generatedAt: string;
  sourceEnvFile: string;
  nativeEnvFile: string;
  summary: Record<string, number>;
  adminDetails: Array<{
    email: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    hasSourceUser: boolean;
    targetUserId: string | null;
  }>;
  unsupportedSettings: Array<{
    email: string;
    language: string | null;
    theme: string | null;
    pushNotificationsEnabled: boolean | null;
    questNotificationsEnabled: boolean | null;
    giftNotificationsEnabled: boolean | null;
    dailyClaimNotificationsEnabled: boolean | null;
  }>;
  skippedUsers: Array<{ email: string; reason: string }>;
  skippedProfilePictures: AvatarMigrationResult[];
  cardMismatches: string[];
  idCollisions: Array<{ sourceId: string; sourceEmail: string; targetEmail: string }>;
}

function expandHome(inputPath: string) {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const mode = (args[0] as Mode | undefined) ?? "audit";
  const apply = args.includes("--apply");
  const reportDirArg = args.find((arg) => arg.startsWith("--report-dir="));
  const defaultReportDir = path.resolve(process.cwd(), "../../.migration-reports");

  if (!["audit", "migrate", "verify"].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  return {
    mode,
    apply,
    reportDir: expandHome(reportDirArg?.slice("--report-dir=".length) ?? defaultReportDir),
  };
}

async function loadEnvFile(filePath: string) {
  const absolutePath = expandHome(filePath);
  const raw = await readFile(absolutePath, "utf8");
  return { path: absolutePath, values: parse(raw) };
}

function parseEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    useSSL: url.protocol === "https:",
  };
}

function toBool(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function chooseDisplayName(user: SourceUserRow) {
  return user.settingsDisplayName?.trim() || user.name?.trim() || null;
}

function chooseProfilePicture(user: SourceUserRow) {
  return user.settingsProfilePicture?.trim() || user.image?.trim() || null;
}

function inferMimeTypeFromUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function parseManagedProfileUrl(url: string | null) {
  const prefix = "/api/media/profile/";
  if (!url?.startsWith(prefix)) {
    return null;
  }

  return url.slice(prefix.length);
}

async function fetchSourceAllowedEmails(sourcePool: Pool) {
  const result = await sourcePool.query<SourceAllowedEmailRow>(`
    select
      id,
      email,
      "isAdmin" as "isAdmin",
      "isSuperAdmin" as "isSuperAdmin",
      "createdAt" as "createdAt"
    from "AllowedEmail"
    order by email asc
  `);
  return result.rows.map((row) => ({ ...row, email: normalizeEmail(row.email) }));
}

async function fetchSourceUsers(sourcePool: Pool) {
  const result = await sourcePool.query<SourceUserRow>(`
    select
      u.id,
      u.email,
      u.name,
      u.image,
      u.coins,
      u.dust,
      u."createdAt" as "createdAt",
      u."updatedAt" as "updatedAt",
      s."displayName" as "settingsDisplayName",
      s."profilePicture" as "settingsProfilePicture",
      s.language as "settingsLanguage",
      s.theme as "settingsTheme",
      s."pushNotificationsEnabled" as "settingsPushNotificationsEnabled",
      s."questNotificationsEnabled" as "settingsQuestNotificationsEnabled",
      s."giftNotificationsEnabled" as "settingsGiftNotificationsEnabled",
      s."dailyClaimNotificationsEnabled" as "settingsDailyClaimNotificationsEnabled",
      case when f.id is null then false else true end as "hasFitbit"
    from "User" u
    left join "UserSettings" s on s."userId" = u.id
    left join "FitbitAccount" f on f."userId" = u.id
  `);
  return result.rows.map((row) => ({ ...row, email: normalizeEmail(row.email) }));
}

async function fetchSourceOwnedCards(sourcePool: Pool, userIds: string[]) {
  if (userIds.length === 0) {
    return [] as SourceOwnedCardRow[];
  }

  const result = await sourcePool.query<SourceOwnedCardRow>(`
    select id, "cardId" as "cardId", "userId" as "userId", quantity, "obtainedAt" as "obtainedAt"
    from "OwnedCard"
    where "userId" = any($1::text[])
  `, [userIds]);
  return result.rows;
}

async function fetchSourceImageAssets(sourcePool: Pool, assetIds: string[]) {
  if (assetIds.length === 0) {
    return [] as SourceImageAssetRow[];
  }

  const result = await sourcePool.query<SourceImageAssetRow>(`
    select
      id,
      kind,
      "userId" as "userId",
      bucket,
      "objectKey" as "objectKey",
      "mimeType" as "mimeType",
      "uploadStatus" as "uploadStatus",
      "createdAt" as "createdAt"
    from "ImageAsset"
    where id = any($1::text[])
  `, [assetIds]);
  return result.rows;
}

async function fetchTargetUsers(targetPool: Pool) {
  const result = await targetPool.query<TargetUserRow>(`select id, email, avatar_asset_id as "avatarAssetId" from users`);
  return result.rows.map((row) => ({ ...row, email: normalizeEmail(row.email) }));
}

async function fetchTargetCardIds(targetPool: Pool) {
  const result = await targetPool.query<{ id: string }>(`select id from cards`);
  return new Set(result.rows.map((row) => row.id));
}

function buildAllowedUserRecords(sourceAllowedEmails: SourceAllowedEmailRow[], sourceUsers: SourceUserRow[], targetUsers: TargetUserRow[]) {
  const sourceUsersByEmail = new Map(sourceUsers.map((user) => [user.email, user]));
  const targetUsersByEmail = new Map(targetUsers.map((user) => [user.email, user]));
  const targetUsersById = new Map(targetUsers.map((user) => [user.id, user]));
  const idCollisions: Array<{ sourceId: string; sourceEmail: string; targetEmail: string }> = [];

  const records: AllowedUserRecord[] = sourceAllowedEmails.map((allowedEmail) => {
    const sourceUser = sourceUsersByEmail.get(allowedEmail.email) ?? null;
    const targetByEmail = targetUsersByEmail.get(allowedEmail.email) ?? null;

    if (sourceUser) {
      const targetById = targetUsersById.get(sourceUser.id);
      if (targetById && targetById.email !== sourceUser.email) {
        idCollisions.push({
          sourceId: sourceUser.id,
          sourceEmail: sourceUser.email,
          targetEmail: targetById.email,
        });
      }
    }

    const targetUser = targetByEmail;

    return {
      sourceAllowedEmail: allowedEmail,
      sourceUser,
      targetUser,
      targetUserId: sourceUser ? targetUser?.id ?? sourceUser.id : targetUser?.id ?? null,
      displayName: sourceUser ? chooseDisplayName(sourceUser) : null,
      preferredStepSource: sourceUser?.hasFitbit ? "fitbit" : "device_health",
      profilePictureUrl: sourceUser ? chooseProfilePicture(sourceUser) : null,
    };
  });

  return { records, idCollisions };
}

async function ensureTargetBucket(minio: MinioClient, bucket: string) {
  const exists = await minio.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await minio.makeBucket(bucket);
  }
}

async function readMinioObject(minio: MinioClient, bucket: string, objectKey: string) {
  const stream = await minio.getObject(bucket, objectKey);
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function writeReport(reportDir: string, name: string, report: unknown) {
  await mkdir(reportDir, { recursive: true });
  const filePath = path.join(reportDir, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const { mode, apply, reportDir } = parseArgs(process.argv);
  const sourceEnv = await loadEnvFile(process.env.PWA_ENV_FILE ?? "~/adventure-time-tcg/.env.postgres.production.local");
  const nativeEnv = await loadEnvFile(process.env.NATIVE_ENV_FILE ?? path.join(process.cwd(), ".env"));

  const sourcePool = new Pool({ connectionString: sourceEnv.values.DATABASE_URL });
  const targetPool = new Pool({ connectionString: nativeEnv.values.DATABASE_URL });

  try {
    const [sourceAllowedEmails, sourceUsers, targetUsers, targetCardIds] = await Promise.all([
      fetchSourceAllowedEmails(sourcePool),
      fetchSourceUsers(sourcePool),
      fetchTargetUsers(targetPool),
      fetchTargetCardIds(targetPool),
    ]);

    const allowedEmailsSet = new Set(sourceAllowedEmails.map((row) => row.email));
    const scopedSourceUsers = sourceUsers.filter((user) => allowedEmailsSet.has(user.email));
    const skippedUsers = sourceUsers
      .filter((user) => !allowedEmailsSet.has(user.email))
      .map((user) => ({ email: user.email, reason: "Not allowlisted in PWA" }));

    const sourceOwnedCards = await fetchSourceOwnedCards(sourcePool, scopedSourceUsers.map((user) => user.id));
    const cardMismatches = [...new Set(sourceOwnedCards.map((row) => row.cardId).filter((cardId) => !targetCardIds.has(cardId)))];
    const managedAssetIds = [...new Set(scopedSourceUsers.map((user) => parseManagedProfileUrl(chooseProfilePicture(user))).filter((value): value is string => Boolean(value)))];
    const sourceImageAssets = await fetchSourceImageAssets(sourcePool, managedAssetIds);
    const sourceImageAssetsById = new Map(sourceImageAssets.map((asset) => [asset.id, asset]));

    const { records, idCollisions } = buildAllowedUserRecords(sourceAllowedEmails, scopedSourceUsers, targetUsers);
    const unsupportedSettings = records
      .filter((record) => record.sourceUser)
      .map((record) => ({
        email: record.sourceAllowedEmail.email,
        language: record.sourceUser?.settingsLanguage ?? null,
        theme: record.sourceUser?.settingsTheme ?? null,
        pushNotificationsEnabled: record.sourceUser?.settingsPushNotificationsEnabled ?? null,
        questNotificationsEnabled: record.sourceUser?.settingsQuestNotificationsEnabled ?? null,
        giftNotificationsEnabled: record.sourceUser?.settingsGiftNotificationsEnabled ?? null,
        dailyClaimNotificationsEnabled: record.sourceUser?.settingsDailyClaimNotificationsEnabled ?? null,
      }))
      .filter((row) => row.language || row.theme || row.pushNotificationsEnabled !== null || row.questNotificationsEnabled !== null || row.giftNotificationsEnabled !== null || row.dailyClaimNotificationsEnabled !== null);

    const skippedProfilePictures: AvatarMigrationResult[] = [];
    for (const record of records) {
      if (!record.profilePictureUrl) {
        continue;
      }
      const managedAssetId = parseManagedProfileUrl(record.profilePictureUrl);
      if (managedAssetId && !sourceImageAssetsById.has(managedAssetId)) {
        skippedProfilePictures.push({
          userEmail: record.sourceAllowedEmail.email,
          source: record.profilePictureUrl,
          status: "skipped",
          reason: "Managed profile image asset missing from source database",
        });
      }
    }

    const auditReport: AuditReport = {
      mode,
      generatedAt: new Date().toISOString(),
      sourceEnvFile: sourceEnv.path,
      nativeEnvFile: nativeEnv.path,
      summary: {
        sourceAllowedEmails: sourceAllowedEmails.length,
        scopedAllowedUsers: records.filter((record) => record.sourceUser).length,
        scopedOwnedCards: sourceOwnedCards.length,
        managedProfilePictures: managedAssetIds.length,
        externalProfilePictures: records.filter((record) => record.profilePictureUrl && !parseManagedProfileUrl(record.profilePictureUrl)).length,
      },
      adminDetails: records.map((record) => ({
        email: record.sourceAllowedEmail.email,
        isAdmin: record.sourceAllowedEmail.isAdmin,
        isSuperAdmin: record.sourceAllowedEmail.isSuperAdmin,
        hasSourceUser: Boolean(record.sourceUser),
        targetUserId: record.targetUserId,
      })),
      unsupportedSettings,
      skippedUsers,
      skippedProfilePictures,
      cardMismatches,
      idCollisions,
    };

    if (cardMismatches.length > 0) {
      throw new Error(`Cannot migrate owned cards; missing native card IDs: ${cardMismatches.join(", ")}`);
    }

    if (idCollisions.length > 0) {
      throw new Error(`Cannot migrate due to user ID collisions: ${idCollisions.map((row) => `${row.sourceId}:${row.sourceEmail}->${row.targetEmail}`).join(", ")}`);
    }

    if (mode === "audit") {
      const reportPath = await writeReport(reportDir, "pwa-user-migration-audit", auditReport);
      console.log(`Audit complete. Report written to ${reportPath}`);
      return;
    }

    if (mode === "verify") {
      const verifyRows = await targetPool.query<{
        email: string;
        coins: number;
        dust: number;
        displayName: string | null;
        preferredStepSource: StepSource;
        avatarAssetId: string | null;
      }>(`select email, coins, dust, display_name as "displayName", preferred_step_source as "preferredStepSource", avatar_asset_id as "avatarAssetId" from users where email = any($1::text[])`, [records.map((record) => record.sourceAllowedEmail.email)]);
      const verifyByEmail = new Map(verifyRows.rows.map((row) => [normalizeEmail(row.email), row]));
      const mismatches = records.flatMap((record) => {
        if (!record.sourceUser) return [] as Array<{ email: string; field: string; expected: unknown; actual: unknown }>;
        const target = verifyByEmail.get(record.sourceAllowedEmail.email);
        if (!target) {
          return [{ email: record.sourceAllowedEmail.email, field: "user", expected: "present", actual: "missing" }];
        }
        const problems: Array<{ email: string; field: string; expected: unknown; actual: unknown }> = [];
        if (target.coins !== record.sourceUser.coins) problems.push({ email: record.sourceAllowedEmail.email, field: "coins", expected: record.sourceUser.coins, actual: target.coins });
        if (target.dust !== record.sourceUser.dust) problems.push({ email: record.sourceAllowedEmail.email, field: "dust", expected: record.sourceUser.dust, actual: target.dust });
        if ((target.displayName ?? null) !== (record.displayName ?? null)) problems.push({ email: record.sourceAllowedEmail.email, field: "displayName", expected: record.displayName, actual: target.displayName });
        if (target.preferredStepSource !== record.preferredStepSource) problems.push({ email: record.sourceAllowedEmail.email, field: "preferredStepSource", expected: record.preferredStepSource, actual: target.preferredStepSource });
        if (record.profilePictureUrl && !target.avatarAssetId) problems.push({ email: record.sourceAllowedEmail.email, field: "avatarAssetId", expected: "present", actual: null });
        return problems;
      });
      const reportPath = await writeReport(reportDir, "pwa-user-migration-verify", { ...auditReport, mismatches });
      console.log(`Verification complete. Report written to ${reportPath}`);
      if (mismatches.length > 0) {
        throw new Error(`Verification failed with ${mismatches.length} mismatch(es).`);
      }
      return;
    }

    if (!apply) {
      const reportPath = await writeReport(reportDir, "pwa-user-migration-dry-run", auditReport);
      console.log(`Dry run complete. Report written to ${reportPath}`);
      console.log("Re-run with --apply to perform the migration.");
      return;
    }

    const targetClient = await targetPool.connect();
    try {
      await targetClient.query("begin");

      for (const allowedEmail of sourceAllowedEmails) {
        await targetClient.query(
          `
            insert into allowed_emails (id, email, is_admin, is_super_admin, created_at)
            values ($1, $2, $3, $4, $5)
            on conflict (email) do update
              set is_admin = excluded.is_admin,
                  is_super_admin = excluded.is_super_admin
          `,
          [
            allowedEmail.id,
            allowedEmail.email,
            allowedEmail.isAdmin || allowedEmail.isSuperAdmin,
            allowedEmail.isSuperAdmin,
            allowedEmail.createdAt,
          ],
        );
      }

      const sourceUserIdToTargetUserId = new Map<string, string>();
      for (const record of records) {
        if (!record.sourceUser) {
          continue;
        }

        const result = await targetClient.query<{ id: string }>(
          `
            insert into users (
              id,
              email,
              display_name,
              coins,
              dust,
              is_admin,
              preferred_step_source,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            on conflict (email) do update
              set display_name = excluded.display_name,
                  coins = excluded.coins,
                  dust = excluded.dust,
                  is_admin = excluded.is_admin,
                  preferred_step_source = excluded.preferred_step_source,
                  updated_at = excluded.updated_at
            returning id
          `,
          [
            record.targetUserId,
            record.sourceUser.email,
            record.displayName,
            record.sourceUser.coins,
            record.sourceUser.dust,
            record.sourceAllowedEmail.isAdmin || record.sourceAllowedEmail.isSuperAdmin,
            record.preferredStepSource,
            record.sourceUser.createdAt,
            record.sourceUser.updatedAt,
          ],
        );
        sourceUserIdToTargetUserId.set(record.sourceUser.id, result.rows[0].id);
      }

      for (const ownedCard of sourceOwnedCards) {
        const targetUserId = sourceUserIdToTargetUserId.get(ownedCard.userId);
        if (!targetUserId) {
          continue;
        }

        await targetClient.query(
          `
            insert into owned_cards (id, card_id, user_id, quantity, obtained_at)
            values ($1, $2, $3, $4, $5)
            on conflict (card_id, user_id) do update
              set quantity = excluded.quantity,
                  obtained_at = excluded.obtained_at
          `,
          [ownedCard.id, ownedCard.cardId, targetUserId, ownedCard.quantity, ownedCard.obtainedAt],
        );
      }

      await targetClient.query("commit");

      const sourceMinioConfig = parseEndpoint(sourceEnv.values.S3_ENDPOINT);
      const sourceMinio = new MinioClient({
        endPoint: sourceMinioConfig.endPoint,
        port: sourceMinioConfig.port,
        useSSL: sourceMinioConfig.useSSL,
        accessKey: sourceEnv.values.S3_ACCESS_KEY_ID,
        secretKey: sourceEnv.values.S3_SECRET_ACCESS_KEY,
      });
      const targetMinio = new MinioClient({
        endPoint: nativeEnv.values.MINIO_ENDPOINT,
        port: Number(nativeEnv.values.MINIO_PORT ?? 9100),
        useSSL: toBool(nativeEnv.values.MINIO_USE_SSL, false),
        accessKey: nativeEnv.values.MINIO_ACCESS_KEY,
        secretKey: nativeEnv.values.MINIO_SECRET_KEY,
      });
      const targetBucket = nativeEnv.values.MINIO_BUCKET;
      await ensureTargetBucket(targetMinio, targetBucket);

      const avatarResults: AvatarMigrationResult[] = [];
      for (const record of records) {
        if (!record.sourceUser || !record.profilePictureUrl) {
          continue;
        }

        const targetUserId = sourceUserIdToTargetUserId.get(record.sourceUser.id);
        if (!targetUserId) {
          avatarResults.push({
            userEmail: record.sourceAllowedEmail.email,
            source: record.profilePictureUrl,
            status: "skipped",
            reason: "No mapped target user id",
          });
          continue;
        }

        const targetAssetId = `pwa-profile-${record.sourceUser.id}`;
        const targetObjectKey = `profile/${targetUserId}/${targetAssetId}`;

        try {
          let buffer: Buffer;
          let mimeType: string;
          const managedAssetId = parseManagedProfileUrl(record.profilePictureUrl);

          if (managedAssetId) {
            const sourceAsset = sourceImageAssetsById.get(managedAssetId);
            if (!sourceAsset) {
              avatarResults.push({
                userEmail: record.sourceAllowedEmail.email,
                source: record.profilePictureUrl,
                status: "skipped",
                reason: "Managed source asset missing",
              });
              continue;
            }

            if (sourceAsset.kind !== "profile" || sourceAsset.uploadStatus === "deleted") {
              avatarResults.push({
                userEmail: record.sourceAllowedEmail.email,
                source: record.profilePictureUrl,
                status: "skipped",
                reason: `Unsupported source asset state: ${sourceAsset.kind}/${sourceAsset.uploadStatus}`,
              });
              continue;
            }

            buffer = await readMinioObject(sourceMinio, sourceAsset.bucket, sourceAsset.objectKey);
            mimeType = sourceAsset.mimeType;
          } else {
            const sourceUrl = record.profilePictureUrl.startsWith("http")
              ? record.profilePictureUrl
              : new URL(record.profilePictureUrl, sourceEnv.values.AUTH_URL).toString();
            const response = await fetch(sourceUrl);
            if (!response.ok) {
              avatarResults.push({
                userEmail: record.sourceAllowedEmail.email,
                source: record.profilePictureUrl,
                status: "failed",
                reason: `Failed to fetch source image (${response.status})`,
              });
              continue;
            }

            buffer = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get("content-type") ?? inferMimeTypeFromUrl(sourceUrl);
          }

          await targetMinio.putObject(targetBucket, targetObjectKey, buffer, buffer.length, { "Content-Type": mimeType });
          await targetPool.query(
            `
              insert into image_assets (id, kind, mime_type, object_key, created_at)
              values ($1, 'profile', $2, $3, $4)
              on conflict (id) do update
                set mime_type = excluded.mime_type,
                    object_key = excluded.object_key
            `,
            [targetAssetId, mimeType, targetObjectKey, record.sourceUser.updatedAt],
          );
          await targetPool.query(`update users set avatar_asset_id = $1, updated_at = $2 where id = $3`, [targetAssetId, new Date(), targetUserId]);
          avatarResults.push({
            userEmail: record.sourceAllowedEmail.email,
            source: record.profilePictureUrl,
            status: "copied",
            targetAssetId,
            targetObjectKey,
          });
        } catch (error) {
          avatarResults.push({
            userEmail: record.sourceAllowedEmail.email,
            source: record.profilePictureUrl,
            status: "failed",
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const reportPath = await writeReport(reportDir, "pwa-user-migration-apply", { ...auditReport, avatarResults });
      console.log(`Migration complete. Report written to ${reportPath}`);
    } catch (error) {
      await targetClient.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      targetClient.release();
    }
  } finally {
    await Promise.allSettled([sourcePool.end(), targetPool.end()]);
  }
}

await main();
