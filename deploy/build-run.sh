#!/usr/bin/env bash
set -euo pipefail

# Build a Makeself self-extracting .run installer for Tentacle.
# Usage: build-run.sh <version> <arch>
# Example: build-run.sh 1.0.0 amd64

VERSION="${1:?Usage: build-run.sh <version> <arch>}"
ARCH="${2:?Usage: build-run.sh <version> <arch>}"

PLATFORM="linux-${ARCH}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STAGING="/tmp/tentacle-makeself-${ARCH}"
DIST_DIR="${REPO_ROOT}/dist"

echo "Building Tentacle v${VERSION} .run installer for ${PLATFORM}..."

rm -rf "$STAGING"
mkdir -p "${STAGING}"/{bin,deploy/systemd,config}

# Cross-platform modules
MODULES="tentacle-graphql tentacle-web tentacle-ethernetip tentacle-opcua tentacle-mqtt"
# Linux-only modules
LINUX_MODULES="tentacle-network tentacle-nftables"

# Copy binaries
for MOD in $MODULES $LINUX_MODULES; do
  SRC="${DIST_DIR}/${MOD}-${PLATFORM}"
  if [ -f "$SRC" ]; then
    cp "$SRC" "${STAGING}/bin/${MOD}"
    chmod +x "${STAGING}/bin/${MOD}"
    echo "  Bundled ${MOD}"
  else
    echo "  WARNING: ${SRC} not found, skipping"
  fi
done

# Copy NATS server
NATS_SRC="${DIST_DIR}/nats-server-${PLATFORM}"
if [ -f "$NATS_SRC" ]; then
  cp "$NATS_SRC" "${STAGING}/bin/nats-server"
  chmod +x "${STAGING}/bin/nats-server"
  echo "  Bundled nats-server"
else
  echo "  WARNING: ${NATS_SRC} not found"
fi

# Copy deploy files
cp "${SCRIPT_DIR}/install.sh" "${STAGING}/deploy/"
chmod +x "${STAGING}/deploy/install.sh"
sed -i "s/{{VERSION}}/${VERSION}/g" "${STAGING}/deploy/install.sh"

cp "${SCRIPT_DIR}/systemd/"*.service "${STAGING}/deploy/systemd/"
cp "${SCRIPT_DIR}/docker-compose.yml" "${STAGING}/deploy/" 2>/dev/null || true
cp "${SCRIPT_DIR}"/Dockerfile.* "${STAGING}/deploy/" 2>/dev/null || true
cp "${REPO_ROOT}/config/tentacle.env.example" "${STAGING}/config/"

# Ensure makeself is available
if ! command -v makeself &>/dev/null; then
  echo "Installing makeself..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y -qq makeself
  else
    git clone --depth 1 https://github.com/megastep/makeself.git /tmp/makeself-tool
    export PATH="/tmp/makeself-tool:$PATH"
  fi
fi

# Create the self-extracting archive
mkdir -p "$DIST_DIR"
makeself --gzip --sha256 \
  "$STAGING" \
  "${DIST_DIR}/tentacle-v${VERSION}-${PLATFORM}.run" \
  "Tentacle v${VERSION} Installer (Linux ${ARCH})" \
  ./deploy/install.sh --bundled

echo ""
echo "Created: ${DIST_DIR}/tentacle-v${VERSION}-${PLATFORM}.run"
ls -lh "${DIST_DIR}/tentacle-v${VERSION}-${PLATFORM}.run"

rm -rf "$STAGING"
