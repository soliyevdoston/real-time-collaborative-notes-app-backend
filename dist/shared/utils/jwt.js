"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.signRefreshToken = exports.verifyAccessToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const signAccessToken = (payload) => {
    const expiresIn = env_1.env.ACCESS_TOKEN_TTL;
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_ACCESS_SECRET, {
        expiresIn,
    });
};
exports.signAccessToken = signAccessToken;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const signRefreshToken = (payload) => {
    const expiresIn = `${env_1.env.REFRESH_TOKEN_TTL_DAYS}d`;
    return jsonwebtoken_1.default.sign({ ...payload, jti: (0, crypto_1.randomUUID)() }, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn,
    });
};
exports.signRefreshToken = signRefreshToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
