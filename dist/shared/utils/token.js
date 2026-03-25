"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = void 0;
const crypto_1 = require("crypto");
const hashToken = (raw) => {
    return (0, crypto_1.createHash)("sha256").update(raw).digest("hex");
};
exports.hashToken = hashToken;
