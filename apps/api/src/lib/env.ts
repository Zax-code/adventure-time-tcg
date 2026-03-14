import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  MINIO_ENDPOINT: z.string().default("127.0.0.1"),
  MINIO_PORT: z.coerce.number().default(9100),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true")
    .default(false),
  MINIO_ACCESS_KEY: z.string().default("minio"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("private-images"),
});

export const env = envSchema.parse(process.env);
