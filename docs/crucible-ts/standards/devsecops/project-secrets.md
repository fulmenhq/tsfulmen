# DevSecOps Project Secrets Standard

**Status:** Stable (v1.0.0)
**Schema:** `schemas/devsecops/secrets/v1.0.0/secrets.schema.json`
**Config:** `config/devsecops/secrets/v1.0.0/defaults.yaml`
**Last Reviewed:** 2025-11-15

---

## Overview

The DevSecOps Project Secrets standard provides a canonical schema and workflow for managing environment-specific secrets across projects. It solves the "how do I safely store and load environment variables" problem with:

1. **Schema-validated YAML/JSON files** conforming to Crucible standards
2. **Dual-mode support:** Plaintext (development) and Encrypted (production)
3. **Project scoping:** Multiple projects in a single file with slug-based filtering
4. **Encryption metadata:** Track encryption method, keys, and timestamps
5. **Policy enforcement:** `allow_plain_secrets: false` for compliance workflows

**Primary Tool:** [`fulmen-secrets` (fulsecrets)](https://github.com/fulmenhq/fulmen-secrets) - CLI tool for encrypt/decrypt/exec workflows

**Use Cases:**

- Development: Local plaintext secrets for rapid iteration
- Staging/Production: Encrypted secrets with GPG/age/passphrase
- CI/CD: Subprocess wrapping for secure environment variable injection
- Compliance: Policy-enforced encryption ("FIPS mode")

---

## Schema Structure

### Core Fields

| Field            | Type   | Required      | Description                                    |
| ---------------- | ------ | ------------- | ---------------------------------------------- |
| `schema_version` | string | Yes           | Schema version (`v1.0.0`)                      |
| `projects`       | array  | Conditional\* | Array of project configs (plaintext mode only) |
| `encryption`     | object | Conditional\* | Encryption metadata (encrypted mode only)      |
| `ciphertext`     | string | Conditional\* | Encrypted payload (encrypted mode only)        |
| `policies`       | object | No            | Policy enforcement configuration               |

**Conditional Requirements:**

- **Plaintext mode:** `projects` required, `encryption` and `ciphertext` must NOT be present
- **Encrypted mode:** `encryption` and `ciphertext` required, `projects` must NOT be present

### Project Configuration

Each project in the `projects` array has:

| Field          | Type   | Required | Description                                                                    |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------ |
| `project_slug` | string | Yes      | Slugified identifier (lowercase, hyphens, alphanumeric). Example: `myapp-prod` |
| `secrets`      | object | Yes      | Key-value map of environment variables (UPPER_SNAKE_CASE → string values)      |
| `env_prefix`   | string | No       | Optional prefix for all env vars. Example: `APP_` → `APP_DATABASE_URL`         |

**Constraints:**

- `project_slug`: Must match `^[a-z0-9]+(-[a-z0-9]+)*$` (1-64 chars)
- `secrets` keys: Must match `^[A-Z_][A-Z0-9_]*$` (UPPER_SNAKE_CASE env var names)
- `secrets` values: **Flat strings only** - no nested objects in v1.0.0

### Encryption Metadata

When file is encrypted, the `encryption` object contains:

| Field          | Type   | Required | Description                                                           |
| -------------- | ------ | -------- | --------------------------------------------------------------------- |
| `method`       | enum   | Yes      | Encryption method: `gpg`, `age`, or `passphrase`                      |
| `encrypted_at` | string | Yes      | ISO 8601 timestamp when encrypted                                     |
| `key_id`       | string | No       | GPG fingerprint or age public key (omit for passphrase)               |
| `cipher`       | string | No       | Cipher algorithm (e.g., `AES-256-GCM`) - recommended for auditability |

### Policy Configuration

| Field                 | Type    | Default | Description                                                                           |
| --------------------- | ------- | ------- | ------------------------------------------------------------------------------------- |
| `allow_plain_secrets` | boolean | `true`  | Whether to allow plaintext secrets. Set `false` for production to enforce encryption. |

---

## Usage Patterns

### Pattern 1: Development (Plaintext)

**File:** `secrets.yaml`

```yaml
schema_version: v1.0.0

projects:
  - project_slug: myapp-dev
    env_prefix: APP_
    secrets:
      DATABASE_URL: postgres://localhost:5432/myapp_dev
      API_KEY: dev_key_12345
      LOG_LEVEL: debug

policies:
  allow_plain_secrets: true
```

**Usage:**

```bash
# Run app with dev secrets
fulsecrets exec -p myapp-dev -- npm run dev

# Or use specific file
fulsecrets exec -p myapp-dev -f secrets.yaml -- python app.py
```

**Security Note:** Plaintext files are OK for local development but should NEVER contain real production credentials.

### Pattern 2: Production (Encrypted - GPG)

**Workflow:**

```bash
# 1. Create plaintext file with real secrets
cat > secrets-plain.yaml <<EOF
schema_version: v1.0.0
projects:
  - project_slug: myapp-prod
    secrets:
      DATABASE_URL: postgres://prod.example.com/myapp
      API_KEY: sk_live_real_key_xyz
EOF

# 2. Encrypt with GPG
fulsecrets encrypt secrets-plain.yaml --gpg-key team@example.com -o secrets.yaml

# 3. Verify encryption
fulsecrets validate secrets.yaml
cat secrets.yaml  # Shows encryption metadata, not secrets

# 4. Clean up plaintext
rm secrets-plain.yaml

# 5. Commit encrypted file
git add secrets.yaml
git commit -m "Add production secrets (encrypted)"
```

**Encrypted File:** `secrets.yaml`

```yaml
schema_version: v1.0.0

encryption:
  method: gpg
  key_id: 7A8B9C0D1E2F3A4B
  encrypted_at: "2025-11-15T10:00:00Z"
  cipher: AES-256-GCM

ciphertext: |
  -----BEGIN PGP MESSAGE-----
  hQIMA3xQvBF2g8NSAQ//ZQWJRW8F...
  -----END PGP MESSAGE-----

policies:
  allow_plain_secrets: false
```

**Usage:**

```bash
# Run app with encrypted secrets (prompts for GPG passphrase)
fulsecrets exec -p myapp-prod -- npm start

# Decrypt to stdout for inspection (careful!)
fulsecrets decrypt secrets.yaml
```

### Pattern 3: Multi-Project Deployment

**File:** `secrets.yaml` (plaintext for example)

```yaml
schema_version: v1.0.0

projects:
  - project_slug: api-staging
    secrets:
      DATABASE_URL: postgres://staging-db.internal/api
      JWT_SECRET: staging_jwt_secret_abc

  - project_slug: worker-staging
    secrets:
      DATABASE_URL: postgres://staging-db.internal/api # Shared
      QUEUE_URL: amqp://staging-queue.internal:5672

  - project_slug: frontend-staging
    env_prefix: VITE_
    secrets:
      API_URL: https://api-staging.example.com
```

**Usage:**

```bash
# Run specific project
fulsecrets exec -p api-staging -- node api-server.js
fulsecrets exec -p worker-staging -- python worker.py

# Future: Multi-project merge (v0.2.0+)
fulsecrets exec -p api-staging -p worker-staging -- ./deploy.sh
# Merges both projects' secrets into single env (last wins on conflicts)
```

### Pattern 4: CI/CD Integration

**GitHub Actions Example:**

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Install fulsecrets
      - name: Install fulsecrets
        run: |
          curl -L https://github.com/fulmenhq/fulmen-secrets/releases/download/v0.1.0/fulsecrets-linux-amd64 -o /usr/local/bin/fulsecrets
          chmod +x /usr/local/bin/fulsecrets

      # Deploy with secrets (passphrase from GitHub Secrets)
      - name: Deploy production
        env:
          FULSECRETS_PASSPHRASE: ${{ secrets.FULSECRETS_PASSPHRASE }}
        run: |
          # No prompt - reads passphrase from env var
          fulsecrets exec -p myapp-prod -f secrets.yaml --passphrase -- ./deploy.sh
```

**Security:** Passphrase stored in GitHub Secrets, never logged or exposed.

---

## Encryption Methods

### GPG (GNU Privacy Guard)

**When to use:** Teams with existing GPG infrastructure, multi-recipient encryption needed

**Setup:**

```bash
# Generate GPG key (if needed)
gpg --full-generate-key

# Encrypt secrets
fulsecrets encrypt secrets.yaml --gpg-key your-email@example.com

# Multi-recipient (future v0.2.0)
fulsecrets encrypt secrets.yaml --gpg-key alice@example.com --gpg-key bob@example.com
```

**Pros:**

- Industry standard, widely supported
- Multi-recipient encryption (team access)
- Key rotation workflows established

**Cons:**

- Complex key management (web of trust)
- Larger ciphertext
- Requires GPG tooling

### Age (Modern Alternative)

**When to use:** Greenfield projects, simpler key management desired

**Setup:**

```bash
# Generate age keypair
age-keygen -o ~/.config/fulsecrets/key.txt
# Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p

# Encrypt secrets
fulsecrets encrypt secrets.yaml --age-recipient age1ql3z...

# Decrypt with private key
fulsecrets exec -p myapp-prod --age-identity ~/.config/fulsecrets/key.txt -- npm start
```

**Pros:**

- Modern, simple design
- Smaller ciphertext
- Easy key management

**Cons:**

- Newer standard (less ecosystem support)
- Requires age tooling

### Passphrase (Symmetric)

**When to use:** Solo developers, simplest setup, no key management

**Setup:**

```bash
# Encrypt with passphrase
fulsecrets encrypt secrets.yaml --passphrase
# Prompts: Enter passphrase: ********

# Use with passphrase
fulsecrets exec -p myapp-prod --passphrase -- npm start
# Prompts: Enter passphrase: ********
```

**Pros:**

- Simplest setup (no keys)
- Works everywhere (no external tools)

**Cons:**

- Passphrase must be shared (no per-user access)
- Password manager required for strong passphrase
- No key rotation (must re-encrypt with new passphrase)

---

## Security Recommendations

### 1. Never Commit Plaintext Production Secrets

```bash
# ❌ BAD - plaintext production secrets in git
git add secrets-prod.yaml  # Contains real credentials

# ✅ GOOD - encrypted secrets in git
fulsecrets encrypt secrets-prod.yaml --gpg-key team@example.com
git add secrets-prod.yaml  # Contains ciphertext only
```

**Enforcement:** Use `.gitignore` patterns:

```
*-plain.yaml
*-decrypted.yaml
secrets-*.txt
```

### 2. Use Policy Enforcement for Production

```yaml
# Production secrets file
policies:
  allow_plain_secrets: false  # Reject plaintext

# Validation fails if file is not encrypted
fulsecrets validate secrets-prod.yaml --strict
# Error: Policy violation: allow_plain_secrets is false but file is not encrypted
```

### 3. Subprocess Wrapping (Not Shell Export)

```bash
# ❌ DANGEROUS - secrets exposed in shell
eval $(fulsecrets load myapp-prod)  # Secrets in history, ps aux
export DATABASE_URL="postgres://..."
npm start

# ✅ SAFE - secrets isolated to subprocess
fulsecrets exec -p myapp-prod -- npm start
# Secrets only in npm process memory, never touch shell
```

### 4. Secure Temporary Files

When editing encrypted files:

```bash
# fulsecrets edit workflow:
# 1. Decrypts to /dev/shm (RAM disk) or temp dir with 0600 perms
# 2. Opens $EDITOR
# 3. Re-encrypts on save
# 4. Shreds temp file (overwrite + delete)

fulsecrets edit secrets.yaml
```

**Manual workflow:**

```bash
fulsecrets decrypt secrets.yaml -o /tmp/secrets-plain.yaml
chmod 600 /tmp/secrets-plain.yaml
vim /tmp/secrets-plain.yaml
fulsecrets encrypt /tmp/secrets-plain.yaml -o secrets.yaml
shred -u /tmp/secrets-plain.yaml  # Secure delete
```

### 5. CI/CD Best Practices

```yaml
# GitHub Actions
- name: Deploy
  env:
    # Store passphrase in GitHub Secrets
    FULSECRETS_PASSPHRASE: ${{ secrets.FULSECRETS_PASSPHRASE }}
  run: |
    # Never log/echo secrets
    set +x  # Disable command echoing
    fulsecrets exec -p myapp-prod --passphrase -- ./deploy.sh
```

**Never:**

- Echo secrets in CI logs
- Use `--dry-run` output in CI (contains plaintext secrets)
- Commit decrypted files in CI workspace

### 6. Key Rotation

```bash
# Scenario: Developer leaves team, rotate GPG key

# 1. Decrypt with old key
fulsecrets decrypt secrets.yaml --gpg-key old-dev@example.com -o plain.yaml

# 2. Re-encrypt with new key
fulsecrets encrypt plain.yaml --gpg-key new-team-key@example.com -o secrets.yaml

# 3. Verify and clean up
fulsecrets validate secrets.yaml
rm plain.yaml

# 4. Commit rotation
git add secrets.yaml
git commit -m "Rotate GPG key to new-team-key"
```

**Audit Trail:** `encryption.encrypted_at` updates automatically, providing rotation timestamp.

---

## CLI Tool Integration

### fulmen-secrets (fulsecrets)

**Installation:**

```bash
# macOS / Linux
curl -L https://github.com/fulmenhq/fulmen-secrets/releases/download/v0.1.0/fulsecrets-$(uname -s)-$(uname -m) -o /usr/local/bin/fulsecrets
chmod +x /usr/local/bin/fulsecrets

# Verify installation
fulsecrets --version
```

**Common Commands:**

```bash
# Initialize new secrets file
fulsecrets init secrets.yaml

# Validate schema compliance
fulsecrets validate secrets.yaml
fulsecrets validate secrets.yaml --strict  # Fail on warnings

# Encrypt file
fulsecrets encrypt secrets.yaml --gpg-key team@example.com
fulsecrets encrypt secrets.yaml --age-recipient age1ql3z...
fulsecrets encrypt secrets.yaml --passphrase

# Decrypt to stdout
fulsecrets decrypt secrets.yaml

# Execute command with secrets
fulsecrets exec -p myapp-prod -- npm start
fulsecrets exec -p api-prod -f secrets.yaml --passphrase -- python api.py

# List projects (doesn't show secret values)
fulsecrets list secrets.yaml

# Interactive edit (decrypt → edit → re-encrypt)
fulsecrets edit secrets.yaml
```

### L'Orage Central Integration

**Future integration (v0.3.0+):**

```yaml
# L'Orage Central can reference secrets files for credential loading
credentials:
  source: fulsecrets
  file: config/secrets.yaml
  project_slug: lorage-prod
```

### Etknow Microtool Integration

**Future integration:**

```bash
# Etknow can use secrets schema for credential management
etknow load-credentials --from-fulsecrets secrets.yaml -p etknow-prod
```

---

## Schema Evolution

### Current Version: v1.0.0

**Included:**

- ✅ Project scoping via `project_slug`
- ✅ Simple key-value secrets (string → string)
- ✅ Encryption metadata (method, key_id, encrypted_at, cipher)
- ✅ Dual-mode schema (plaintext OR encrypted)
- ✅ Policy hook (`allow_plain_secrets`)

**Explicitly Out of Scope:**

- ❌ Nested secret values (complex objects) - values must be flat strings
- ❌ Reference-based secrets (`{ref: "vault://..."}`) - deferred to v1.1.0
- ❌ Expiry/rotation metadata - deferred to v1.1.0
- ❌ Audit tags and telemetry - deferred to v1.1.0+

### Future: v1.1.0 (Planned)

**Expected Additions:**

- Expiry metadata per secret (`expires_at`, `rotation_interval`)
- Reference-based secrets (vault integration, e.g., `{ref: "vault://secret/path"}`)
- Secret metadata (type, source, audit tags)

**Migration:** `fulsecrets migrate secrets.yaml --to v1.1.0` command will upgrade files.

### Future: v1.2.0+ (Exploratory)

- Multi-environment fields (`environment: staging|prod`)
- Telemetry integration (decrypt events to L'Orage Central)
- Secret templates (e.g., `${DATABASE_URL}/api` interpolation)

---

## Compliance & FIPS Mode

### Production Enforcement

```yaml
# Production secrets MUST be encrypted
schema_version: v1.0.0

policies:
  allow_plain_secrets: false # Reject plaintext

encryption:
  method: gpg
  key_id: FIPS_VALIDATED_KEY_ID
  cipher: AES-256-GCM
ciphertext: "..."
```

**Validation:**

```bash
# Strict validation fails on policy violations
fulsecrets validate secrets-prod.yaml --strict
# ✅ Pass: File is encrypted, policy satisfied

# If someone commits plaintext with policy=false
fulsecrets validate secrets-bad.yaml --strict
# ❌ Error: Policy violation: allow_plain_secrets is false but file is not encrypted
```

### Pre-Commit Hook Example

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Validate all secrets files
for file in $(git diff --cached --name-only | grep 'secrets.*\.yaml$'); do
  # Validate schema compliance
  if ! fulsecrets validate "$file" --strict; then
    echo "❌ Secrets validation failed: $file"
    exit 1
  fi

  # Ensure production files are encrypted
  if [[ "$file" =~ prod ]]; then
    if ! grep -q "^encryption:" "$file"; then
      echo "❌ Production secrets must be encrypted: $file"
      exit 1
    fi
  fi
done

echo "✅ Secrets validation passed"
```

---

## Examples

### Example 1: Solo Developer (Passphrase)

```yaml
schema_version: v1.0.0

encryption:
  method: passphrase
  encrypted_at: "2025-11-15T16:00:00Z"
  cipher: AES-256-GCM

ciphertext: "U2FsdGVkX1+abcd..."
```

**Workflow:**

```bash
# Day 1: Create + encrypt
fulsecrets init secrets.yaml
vim secrets.yaml  # Add secrets
fulsecrets encrypt secrets.yaml --passphrase
git add secrets.yaml && git commit -m "Add secrets"

# Day 2: Use secrets
fulsecrets exec -p myapp-prod --passphrase -- npm start
# Prompts once for passphrase, runs app
```

### Example 2: Team with GPG

```yaml
schema_version: v1.0.0

encryption:
  method: gpg
  key_id: 7A8B9C0D1E2F3A4B # Team GPG key
  encrypted_at: "2025-11-15T10:00:00Z"
  cipher: AES-256-GCM

ciphertext: "-----BEGIN PGP MESSAGE-----\n..."

policies:
  allow_plain_secrets: false
```

**Team Workflow:**

```bash
# Alice (admin): Create encrypted file
fulsecrets encrypt secrets.yaml --gpg-key team@example.com
git add secrets.yaml && git commit -m "Add prod secrets"

# Bob (dev): Clone and use
git clone repo && cd repo
fulsecrets exec -p myapp-prod -- npm start
# Uses Bob's GPG key (if added to team key), prompts for passphrase

# Charlie (new dev): Key rotation
fulsecrets decrypt secrets.yaml --gpg-key team@example.com -o plain.yaml
fulsecrets encrypt plain.yaml --gpg-key new-team@example.com -o secrets.yaml
rm plain.yaml
git add secrets.yaml && git commit -m "Rotate team GPG key"
```

### Example 3: Monorepo with Multiple Services

```yaml
schema_version: v1.0.0

projects:
  - project_slug: api-prod
    secrets:
      DATABASE_URL: postgres://prod-db/api
      REDIS_URL: redis://prod-cache:6379
      JWT_SECRET: prod_jwt_abc

  - project_slug: worker-prod
    secrets:
      DATABASE_URL: postgres://prod-db/api # Shared
      QUEUE_URL: amqp://prod-queue:5672
      WORKER_TOKEN: prod_worker_xyz

  - project_slug: frontend-prod
    env_prefix: VITE_
    secrets:
      API_URL: https://api.example.com
```

**Deployment:**

```bash
# Deploy API
fulsecrets exec -p api-prod -- node api-server.js

# Deploy worker
fulsecrets exec -p worker-prod -- python worker.py

# Build frontend (injects VITE_API_URL)
fulsecrets exec -p frontend-prod -- npm run build
```

---

## Troubleshooting

### Issue: "Policy violation: allow_plain_secrets is false"

**Cause:** Attempting to use plaintext file with `allow_plain_secrets: false`

**Solution:**

```bash
# Encrypt the file
fulsecrets encrypt secrets.yaml --gpg-key your-key@example.com
```

### Issue: "GPG decryption failed: No secret key"

**Cause:** GPG key used for encryption is not in your keyring

**Solution:**

```bash
# Import the correct key
gpg --import team-key.asc

# Or decrypt with specific key
fulsecrets decrypt secrets.yaml --gpg-key other-dev@example.com
```

### Issue: "Schema validation failed: project_slug must be lowercase"

**Cause:** Project slug contains uppercase letters or invalid characters

**Solution:**

```yaml
# ❌ Invalid
projects:
  - project_slug: MyApp-Prod  # Uppercase

# ✅ Valid
projects:
  - project_slug: myapp-prod  # Lowercase, hyphens only
```

### Issue: "Encrypted file but no encryption method in CI"

**Cause:** CI doesn't have passphrase/key to decrypt

**Solution:**

```yaml
# Add to GitHub Secrets / GitLab CI Variables
FULSECRETS_PASSPHRASE: your-passphrase

# Use in workflow
env:
  FULSECRETS_PASSPHRASE: ${{ secrets.FULSECRETS_PASSPHRASE }}
run: fulsecrets exec -p myapp-prod --passphrase -- ./deploy.sh
```

---

## References

- **Schema:** [`schemas/devsecops/secrets/v1.0.0/secrets.schema.json`](../../../schemas/devsecops/secrets/v1.0.0/secrets.schema.json)
- **Config Examples:** [`config/devsecops/secrets/v1.0.0/defaults.yaml`](../../../config/devsecops/secrets/v1.0.0/defaults.yaml)
- **fulsecrets Tool:** [github.com/fulmenhq/fulmen-secrets](https://github.com/fulmenhq/fulmen-secrets)
- **Implementation Notes:** [`.plans/memos/fulmenhq/20251115-notes-on-fulsecrets.md`](../.plans/memos/fulmenhq/20251115-notes-on-fulsecrets.md) (Crucible repo)

---

**Maintained by:** Schema Cartographer
**Issues:** [github.com/fulmenhq/crucible/issues](https://github.com/fulmenhq/crucible/issues)
