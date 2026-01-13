#!/usr/bin/env bash
set -euo pipefail

# This script is invoked by `make bootstrap` to keep Makefile recipes short.
# Trust anchor pattern: sfetch -> goneat -> foundation tools

BINDIR=${BINDIR:-}
GONEAT_VERSION=${GONEAT_VERSION:-}
SFETCH_INSTALL_URL=${SFETCH_INSTALL_URL:-}

if [ -z "$BINDIR" ]; then
	echo "BINDIR must be set by Makefile" >&2
	exit 1
fi
if [ -z "$GONEAT_VERSION" ]; then
	echo "GONEAT_VERSION must be set by Makefile" >&2
	exit 1
fi
if [ -z "$SFETCH_INSTALL_URL" ]; then
	echo "SFETCH_INSTALL_URL must be set by Makefile" >&2
	exit 1
fi

mkdir -p "$BINDIR"

# Resolve sfetch
SFETCH=""
if [ -x "$BINDIR/sfetch" ]; then
	SFETCH="$BINDIR/sfetch"
fi
if [ -z "$SFETCH" ]; then
	SFETCH="$(command -v sfetch 2>/dev/null || true)"
fi

# Install sfetch if not found (trust anchor bootstrap)
if [ -z "$SFETCH" ]; then
	echo "-> sfetch not found; installing trust anchor via published installer..."
	if command -v curl >/dev/null 2>&1; then
		curl -sSfL "$SFETCH_INSTALL_URL" | bash -s -- --dir "$BINDIR" --yes
	elif command -v wget >/dev/null 2>&1; then
		wget -qO- "$SFETCH_INSTALL_URL" | bash -s -- --dir "$BINDIR" --yes
	else
		echo "Need curl or wget to bootstrap sfetch." >&2
		exit 1
	fi
fi

# Re-resolve sfetch after installation
if [ -x "$BINDIR/sfetch" ]; then
	SFETCH="$BINDIR/sfetch"
fi
if [ -z "$SFETCH" ]; then
	SFETCH="$(command -v sfetch 2>/dev/null || true)"
fi
if [ -z "$SFETCH" ]; then
	echo "sfetch not found after installation" >&2
	exit 1
fi

echo "-> sfetch self-verify (trust anchor):"
"$SFETCH" --self-verify

echo "-> sfetch self-verify (json):"
if command -v jq >/dev/null 2>&1; then
	"$SFETCH" --self-verify --json | jq
else
	"$SFETCH" --self-verify --json
fi

# Install goneat via sfetch
rm -f "$BINDIR/goneat" "$BINDIR/goneat.exe" || true

echo "-> Installing goneat $GONEAT_VERSION to $BINDIR via sfetch..."
"$SFETCH" --repo fulmenhq/goneat --tag "$GONEAT_VERSION" --dest-dir "$BINDIR" --require-minisign

# Handle Windows naming
OS_RAW="$(uname -s 2>/dev/null || echo unknown)"
case "$OS_RAW" in
MINGW* | MSYS* | CYGWIN*)
	if [ -f "$BINDIR/goneat.exe" ] && [ ! -f "$BINDIR/goneat" ]; then
		mv "$BINDIR/goneat.exe" "$BINDIR/goneat"
	fi
	;;
esac

# Resolve goneat
GONEAT=""
if [ -x "$BINDIR/goneat" ]; then
	GONEAT="$BINDIR/goneat"
fi
if [ -z "$GONEAT" ]; then
	GONEAT="$(command -v goneat 2>/dev/null || true)"
fi
if [ -z "$GONEAT" ]; then
	echo "goneat not found after installation" >&2
	exit 1
fi

echo "-> goneat: $($GONEAT --version 2>&1 | head -n1 || true)"

echo "-> Installing foundation tools via goneat doctor..."
"$GONEAT" doctor tools --scope foundation --install --install-package-managers --yes --no-cooling

echo "-> Syncing Bun dependencies..."
if command -v bun >/dev/null 2>&1; then
	bun install
	echo "Bun dependencies synced"
else
	echo "bun not found - install from https://bun.sh"
	exit 1
fi

echo "Bootstrap completed. Ensure '$BINDIR' is on PATH."
