"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
(0, dotenv_1.config)();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    HOCUSPOCUS_PORT: zod_1.z.coerce.number().default(1234),
    FRONTEND_URL: zod_1.z.string().url().default("http://localhost:3000"),
    BACKEND_PUBLIC_URL: zod_1.z.string().url().default("http://localhost:4000"),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    ACCESS_TOKEN_TTL: zod_1.z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().int().positive().default(7),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const details = Object.entries(fieldErrors)
        .map(([key, errors]) => `${key}: ${errors?.join(", ")}`)
        .join("; ");
    console.error("Muhit o'zgaruvchilari tekshiruvi muvaffaqiyatsiz", fieldErrors);
    throw new Error(`Muhit konfiguratsiyasi noto'g'ri${details ? `: ${details}` : ""}`);
}
exports.env = parsed.data;
