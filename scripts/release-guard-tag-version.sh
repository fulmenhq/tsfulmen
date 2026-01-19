#!/usr/bin/env bash
set -euo pipefail

# Release guard script for fulmenhq/tsfulmen
# Ensures tag matches VERSION file (CI-friendly)
#
# Environment variables:
#   TSFULMEN_RELEASE_TAG  - Override tag to check
#   TSFULMEN_REQUIRE_TAG  - Set to 1 to enforce tag presence in CI

repo_root() {
	git rev-parse --show-toplevel
}

read_version() {
	if [ ! -f VERSION ]; then
		echo "error: VERSION file not found" >&2
		exit 1
	fi
	tr -d ' \t\r\n' <VERSION
}

normalize_tag() {
	local raw="${1:-}"
	if [ -z "$raw" ]; then
		printf '%s' ""
		return 0
	fi
	if [[ "$raw" == v* ]]; then
		printf '%s' "$raw"
	else
		printf 'v%s' "$raw"
	fi
}

detect_tag() {
	if [ -n "${TSFULMEN_RELEASE_TAG:-}" ]; then
		normalize_tag "${TSFULMEN_RELEASE_TAG}"
		return 0
	fi
	git describe --tags --exact-match 2>/dev/null || true
}

main() {
	local root
	root="$(repo_root)"
	cd "$root"

	local version
	version="$(read_version)"

	local expected="v${version}"
	local tag
	tag="$(detect_tag)"

	if [ -z "$tag" ]; then
		if [ "${TSFULMEN_REQUIRE_TAG:-}" = "1" ]; then
			echo "error: no exact tag found for HEAD and no TSFULMEN_RELEASE_TAG provided" >&2
			exit 1
		fi
		echo "→ release guard: no tag detected (set TSFULMEN_REQUIRE_TAG=1 to enforce in CI)"
		exit 0
	fi

	if [ "$tag" != "$expected" ]; then
		echo "error: release tag/version mismatch" >&2
		echo "  tag:     $tag" >&2
		echo "  VERSION: $version (expected tag: $expected)" >&2
		exit 1
	fi

	echo "✅ release guard: tag matches VERSION ($tag)"
}

main "$@"
