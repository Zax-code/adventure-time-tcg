import { Client } from "minio";

import { env } from "../lib/env";

const minio = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function putPrivateObject(objectKey: string, buffer: Buffer, mimeType: string) {
  await minio.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, { "Content-Type": mimeType });
}

export async function getPrivateObject(objectKey: string) {
  const stream = await minio.getObject(env.MINIO_BUCKET, objectKey);
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function ensureBucketExists() {
  const exists = await minio.bucketExists(env.MINIO_BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(env.MINIO_BUCKET);
  }
}
