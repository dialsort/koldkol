import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

// ENCRYPTION_KEY is set to all-zeros by vitest.setup.ts before this file loads.

describe("crypto — AES-256-GCM", () => {
  it("encrypt→decrypt restores the original value", () => {
    const plaintext = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("handles unicode and special characters", () => {
    const plaintext = 'secret 🔑 <value> & "quoted"';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const plaintext = "same-input";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("throws on tampered ciphertext (authTag verification)", () => {
    const ct = encrypt("secret");
    const parts = ct.split(":");
    // Corrupt the ciphertext part (last segment)
    const corrupt = Buffer.from(parts[2], "base64");
    corrupt[0] ^= 0xff;
    parts[2] = corrupt.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on wrong number of segments", () => {
    expect(() => decrypt("not:valid")).toThrow("Invalid ciphertext format");
    expect(() => decrypt("plaintext")).toThrow("Invalid ciphertext format");
  });
});
