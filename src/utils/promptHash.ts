import crypto from "node:crypto";

export function generatePromptHash(prompt: string) {
  return crypto
    .createHash("sha256")
    .update(prompt.trim().toLowerCase())
    .digest("hex");
}
