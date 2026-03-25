"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAvatar = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const http_error_1 = require("../errors/http-error");
const uploadsRoot = path_1.default.resolve(process.cwd(), "uploads", "avatars");
if (!fs_1.default.existsSync(uploadsRoot)) {
    fs_1.default.mkdirSync(uploadsRoot, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsRoot);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname || "").toLowerCase() || ".jpg";
        cb(null, `${Date.now()}-${(0, crypto_1.randomUUID)()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 3 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype.startsWith("image/");
        if (!isImage) {
            cb(new http_error_1.HttpError(400, "Faqat rasm fayllariga ruxsat beriladi"));
            return;
        }
        cb(null, true);
    },
});
const uploadAvatar = (req, res, next) => {
    upload.single("avatar")(req, res, (error) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer_1.default.MulterError && error.code === "LIMIT_FILE_SIZE") {
            next(new http_error_1.HttpError(400, "Rasm hajmi 3MB dan oshmasligi kerak"));
            return;
        }
        next(error);
    });
};
exports.uploadAvatar = uploadAvatar;
