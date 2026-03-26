import { config } from "dotenv";
import { z } from "zod";

config();

const normalizeEnvValue = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^['"]|['"]$/g, "");
};

const normalizeNodeEnv = (
  value: string | undefined,
): "development" | "test" | "production" | undefined => {
  const normalized = normalizeEnvValue(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }

  if (normalized.startsWith("prod")) {
    return "production";
  }

  if (normalized.startsWith("dev")) {
    return "development";
  }

  if (normalized.startsWith("test")) {
    return "test";
  }

  // Invalid custom values should not crash production boot.
  return "production";
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOCUSPOCUS_PORT: z.coerce.number().default(1234),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URLS: z.string().optional(),
  BACKEND_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

const rawEnv = {
  ...process.env,
  NODE_ENV: normalizeNodeEnv(process.env.NODE_ENV),
  FRONTEND_URL: normalizeEnvValue(process.env.FRONTEND_URL),
  FRONTEND_URLS: normalizeEnvValue(process.env.FRONTEND_URLS),
  BACKEND_PUBLIC_URL: normalizeEnvValue(process.env.BACKEND_PUBLIC_URL),
  DATABASE_URL:
    normalizeEnvValue(process.env.DATABASE_URL) ??
    normalizeEnvValue(process.env.POSTGRES_URL) ??
    normalizeEnvValue(process.env.POSTGRES_PRISMA_URL),
  JWT_ACCESS_SECRET: normalizeEnvValue(process.env.JWT_ACCESS_SECRET) ?? normalizeEnvValue(process.env.JWT_SECRET),
  JWT_REFRESH_SECRET:
    normalizeEnvValue(process.env.JWT_REFRESH_SECRET) ?? normalizeEnvValue(process.env.JWT_SECRET),
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  const details = Object.entries(fieldErrors)
    .map(([key, errors]) => `${key}: ${errors?.join(", ")}`)
    .join("; ");

  console.error("Muhit o'zgaruvchilari tekshiruvi muvaffaqiyatsiz", fieldErrors);
  throw new Error(
    `Muhit konfiguratsiyasi noto'g'ri${details ? `: ${details}` : ""}. Render uchun Environment bo'limida kamida DATABASE_URL va JWT_* secretlarni sozlang.`,
  );
}

export const env = parsed.data;
