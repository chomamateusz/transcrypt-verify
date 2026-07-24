#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const usage = `transcrypt-verify — end-to-end recovery test for transcrypt-encrypted repos

Clones the repo into a temp dir, confirms files are ciphertext, unlocks with
your password (interactive prompt), shows decrypted content, cleans up.

Usage:
  npx github:chomamateusz/transcrypt-verify [repo] [cipher]

  repo    URL or owner/name (prompted for when omitted)
  cipher  openssl cipher, default aes-256-cbc

Env:
  TRANSCRYPT_VERIFY_PASSWORD  non-interactive mode (CI): password via env
`;

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help")) {
  console.log(usage);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const repoArg = argv[0] ?? (await rl.question("Repository (URL or owner/name): ")).trim();
if (!repoArg) {
  console.error("No repository given.");
  process.exit(2);
}
const candidates =
  repoArg.includes("://") || repoArg.startsWith("git@")
    ? [repoArg]
    : [`https://github.com/${repoArg}.git`, `git@github.com:${repoArg}.git`];
const cipher = argv[1] ?? "aes-256-cbc";

const tmp = mkdtempSync(join(tmpdir(), "transcrypt-verify-"));
const dir = join(tmp, "repo");
const cleanup = () => rmSync(tmp, { recursive: true, force: true });

const fail = (msg) => {
  console.error(`\n❌ ${msg}`);
  cleanup();
  process.exit(1);
};

let url = null;
for (const candidate of candidates) {
  console.log(`\n== Cloning ${candidate} ...`);
  const env = candidate.startsWith("https://") ? { ...process.env, GIT_TERMINAL_PROMPT: "0" } : process.env;
  if (spawnSync("git", ["clone", "--quiet", candidate, dir], { stdio: "inherit", env }).status === 0) {
    url = candidate;
    break;
  }
  rmSync(dir, { recursive: true, force: true });
  if (candidate !== candidates[candidates.length - 1]) console.log("   clone failed — trying SSH fallback...");
}
if (!url) fail(`git clone failed (tried: ${candidates.join(", ")})`);

const tracked = spawnSync("git", ["-C", dir, "ls-files"], { encoding: "utf8" }).stdout.trim().split("\n");
const sample = existsSync(join(dir, "README.md")) ? "README.md" : tracked.find((f) => f && f !== ".gitattributes");
if (!sample) fail("Repository has no files to check");
const head = (n) => readFileSync(join(dir, sample), "utf8").slice(0, n);

console.log(`\n== BEFORE unlock (${sample}) ==`);
console.log(head(80));
if (!head(12).startsWith("U2FsdGVkX1")) fail(`${sample} does not look like transcrypt ciphertext — repo not encrypted, or clone got plaintext`);
console.log("✓ ciphertext confirmed (U2FsdGVkX1...)");

const envPw = process.env.TRANSCRYPT_VERIFY_PASSWORD;
const args = envPw ? ["-c", cipher, "-p", envPw, "--yes"] : ["-c", cipher];
if (!envPw) {
  console.log("\n== Running transcrypt — answer 'n' to password generation, paste your password, confirm 'y'.");
  console.log("   (a flood of OpenSSL 'deprecated key derivation' warnings is normal)\n");
}
rl.close();
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
if (spawnSync("transcrypt", args, { cwd: dir, stdio: envPw ? ["ignore", "inherit", "inherit"] : "inherit" }).status !== 0)
  fail("transcrypt failed (wrong password?)");

console.log(`\n== AFTER unlock (${sample}) ==`);
console.log(head(300));
if (head(12).startsWith("U2FsdGVkX1")) fail("File is still ciphertext — wrong password or cipher");

const ask2 = createInterface({ input: process.stdin, output: process.stdout });
const ok = envPw ? "y" : (await ask2.question("\nIs the content above readable? [y/n]: ")).trim().toLowerCase();
ask2.close();
cleanup();
if (ok.startsWith("y") || ok.startsWith("t")) {
  console.log("\n✅ TEST OK — the password recovers the repo. Temp clone removed.");
} else {
  console.log("\n❌ Marked unreadable — check password/cipher. Temp clone removed.");
  process.exit(1);
}
