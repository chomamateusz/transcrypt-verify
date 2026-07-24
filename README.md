# transcrypt-verify

End-to-end recovery test for git repos encrypted with [transcrypt](https://github.com/elasticdog/transcrypt).

Your encrypted repo is only as safe as your ability to decrypt it *from scratch* — with the password you actually saved, not the one cached in your local `.git/config`. This tool proves that recovery works:

1. clones the repo into a temp directory,
2. confirms the files are ciphertext (`U2FsdGVkX1...`),
3. runs `transcrypt` so you can paste the password from your password manager,
4. shows the decrypted content and asks you to confirm it's readable,
5. removes the temp clone.

It fails loudly when the repo isn't actually encrypted, or when the password doesn't decrypt it.

## Usage

```sh
npx github:chomamateusz/transcrypt-verify owner/repo
```

Or interactively (prompts for the repo):

```sh
npx github:chomamateusz/transcrypt-verify
```

Optional second argument is the openssl cipher (default `aes-256-cbc`):

```sh
npx github:chomamateusz/transcrypt-verify owner/repo aes-256-cbc
```

The tool asks for the password itself (hidden input) and runs transcrypt non-interactively — you can also pass it explicitly with `-p '<password>'`. A flood of OpenSSL `deprecated key derivation` warnings during unlock is normal (one per file).

### Non-interactive (CI)

```sh
TRANSCRYPT_VERIFY_PASSWORD='...' npx github:chomamateusz/transcrypt-verify owner/repo
```

Exit code `0` = recovery verified, `1` = failed, `2` = bad invocation.

## Requirements

- `git`, `transcrypt` (`brew install transcrypt`) and Node.js >= 18
- read access to the repo (private repos: authenticated git, e.g. `gh auth login`)
