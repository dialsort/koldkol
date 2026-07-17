// Provide a deterministic 32-byte key for unit tests.
// This key is NOT used in production — see .env.example for real key generation.
process.env.ENCRYPTION_KEY = "0".repeat(64); // 64 hex chars = 32 zero bytes
