#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# Tentacle Platform Installer
# ═══════════════════════════════════════════════════════════════════════════════

VERSION="{{VERSION}}"
REPO="joyautomation/tentacle"
INSTALL_DIR="/opt/tentacle"
CONFIG_DIR="${INSTALL_DIR}/config"
DATA_DIR="${INSTALL_DIR}/data"
SERVICES_DIR="${INSTALL_DIR}/services"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# State
BUNDLED=false
BUNDLED_DIR=""
OS=""
ARCH=""
PLATFORM=""
DEPLOY_METHOD=""
SELECTED_MODULES=()
LINUX_SYSTEM_MODULES=()

# Config values (populated by configure())
CFG_NATS_SERVERS=""
CFG_GRAPHQL_PORT=""
CFG_WEB_PORT=""
CFG_MQTT_BROKER=""
CFG_MQTT_CLIENT=""
CFG_MQTT_GROUP=""
CFG_MQTT_NODE=""
CFG_MQTT_USER=""
CFG_MQTT_PASS=""

# ═══════════════════════════════════════════════════════════════════════════════
# Utilities
# ═══════════════════════════════════════════════════════════════════════════════

info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[x]${NC} $*"; }
step()  { echo -e "${CYAN}[>]${NC} ${BOLD}$*${NC}"; }

die() { error "$*"; exit 1; }

confirm() {
  local msg="$1"
  local default="${2:-y}"
  local prompt
  if [ "$default" = "y" ]; then prompt="[Y/n]"; else prompt="[y/N]"; fi
  echo -en "${YELLOW}[?]${NC} ${msg} ${prompt} "
  read -r answer
  answer="${answer:-$default}"
  [[ "${answer,,}" == "y" ]]
}

has_module() {
  local needle="$1"
  for m in "${SELECTED_MODULES[@]}" "${LINUX_SYSTEM_MODULES[@]}"; do
    [[ "$m" == "$needle" ]] && return 0
  done
  return 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# Parse arguments
# ═══════════════════════════════════════════════════════════════════════════════

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundled)
      BUNDLED=true
      BUNDLED_DIR="$(cd "$(dirname "$0")/.." && pwd)"
      shift ;;
    --version)
      VERSION="$2"
      shift 2 ;;
    --install-dir)
      INSTALL_DIR="$2"
      CONFIG_DIR="${INSTALL_DIR}/config"
      DATA_DIR="${INSTALL_DIR}/data"
      SERVICES_DIR="${INSTALL_DIR}/services"
      shift 2 ;;
    --help|-h)
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --bundled        Use bundled binaries (set by .run archive)"
      echo "  --version VER    Override version to install"
      echo "  --install-dir    Override install directory (default: /opt/tentacle)"
      echo "  -h, --help       Show this help"
      exit 0 ;;
    *) shift ;;
  esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════════════════════

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║                                                  ║"
  echo "  ║          TENTACLE PLATFORM  v${VERSION}            ║"
  echo "  ║       Industrial Automation Made Simple          ║"
  echo "  ║                                                  ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Platform detection
# ═══════════════════════════════════════════════════════════════════════════════

detect_platform() {
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$(uname -m)" in
    x86_64|amd64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac
  PLATFORM="${OS}-${ARCH}"
  info "Platform: ${BOLD}${OS}/${ARCH}${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-flight checks
# ═══════════════════════════════════════════════════════════════════════════════

preflight() {
  if [ "$(id -u)" -ne 0 ]; then
    warn "Not running as root. You may need sudo for /opt writes and systemd."
    if ! confirm "Continue anyway?"; then
      die "Re-run with: sudo $0 $*"
    fi
  fi

  if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
    die "curl or wget is required for downloading. Install one and retry."
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Module selection
# ═══════════════════════════════════════════════════════════════════════════════

select_modules() {
  echo ""
  step "Module Selection"
  echo ""
  echo -e "  ${DIM}NATS Server is always installed (required backbone).${NC}"
  echo ""

  # Cross-platform modules
  local modules=(
    "tentacle-graphql:GraphQL API:true"
    "tentacle-web:Web Dashboard:true"
    "tentacle-ethernetip:EtherNet/IP Scanner:false"
    "tentacle-opcua:OPC UA Client:false"
    "tentacle-mqtt:MQTT Sparkplug B Bridge:false"
  )

  # Linux-only modules
  local linux_modules=()
  if [ "$OS" = "linux" ]; then
    linux_modules=(
      "tentacle-network:Network Manager (Linux only):false"
      "tentacle-nftables:Firewall Manager (Linux only):false"
    )
  fi

  echo "  Available modules:"
  local i=1
  local all_modules=("${modules[@]}" "${linux_modules[@]}")
  for entry in "${all_modules[@]}"; do
    IFS=':' read -r name label default <<< "$entry"
    local mark=" "
    if [ "$default" = "true" ]; then mark="x"; fi
    echo -e "    ${BOLD}${i})${NC} [${mark}] ${label} ${DIM}(${name})${NC}"
    ((i++))
  done

  echo ""
  echo -e "  Enter module numbers to toggle, ${BOLD}a${NC} for all, or ${BOLD}Enter${NC} to accept defaults:"
  read -r -p "  > " selection

  # Process selection
  local selected=()
  if [ -z "$selection" ]; then
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r name _ default <<< "$entry"
      if [ "$default" = "true" ]; then selected+=("$name"); fi
    done
  elif [ "$selection" = "a" ] || [ "$selection" = "A" ]; then
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r name _ _ <<< "$entry"
      selected+=("$name")
    done
  else
    local defaults=()
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r _ _ default <<< "$entry"
      defaults+=("$default")
    done

    IFS=',' read -ra nums <<< "$selection"
    for num in "${nums[@]}"; do
      num="$(echo "$num" | tr -d ' ')"
      if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#all_modules[@]}" ]; then
        local idx=$((num - 1))
        if [ "${defaults[$idx]}" = "true" ]; then defaults[$idx]="false"; else defaults[$idx]="true"; fi
      fi
    done

    for idx in "${!all_modules[@]}"; do
      IFS=':' read -r name _ _ <<< "${all_modules[$idx]}"
      if [ "${defaults[$idx]}" = "true" ]; then selected+=("$name"); fi
    done
  fi

  # Separate cross-platform and Linux-only modules
  SELECTED_MODULES=()
  LINUX_SYSTEM_MODULES=()
  for mod in "${selected[@]}"; do
    if [ "$mod" = "tentacle-network" ] || [ "$mod" = "tentacle-nftables" ]; then
      LINUX_SYSTEM_MODULES+=("$mod")
    else
      SELECTED_MODULES+=("$mod")
    fi
  done

  echo ""
  info "Selected modules: ${BOLD}${SELECTED_MODULES[*]}${NC}"
  if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ]; then
    info "Linux system modules: ${BOLD}${LINUX_SYSTEM_MODULES[*]}${NC} (always use systemd)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Deployment method
# ═══════════════════════════════════════════════════════════════════════════════

select_deployment() {
  echo ""
  step "Deployment Method"
  echo ""

  local options=()
  if [ "$OS" = "linux" ] && command -v systemctl &>/dev/null; then
    options+=("systemd:systemd services (recommended for Linux)")
  fi
  if command -v docker &>/dev/null; then
    options+=("docker:Docker Compose")
  fi
  options+=("binary:Binary only (manual management)")

  local i=1
  for entry in "${options[@]}"; do
    IFS=':' read -r key label <<< "$entry"
    echo -e "    ${BOLD}${i})${NC} ${label}"
    ((i++))
  done

  echo ""
  read -r -p "  Select deployment method [1]: " choice
  choice="${choice:-1}"

  local idx=$((choice - 1))
  if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#options[@]}" ]; then
    IFS=':' read -r key _ <<< "${options[$idx]}"
    DEPLOY_METHOD="$key"
  else
    DEPLOY_METHOD="binary"
  fi

  info "Deployment method: ${BOLD}${DEPLOY_METHOD}${NC}"

  if [ "$DEPLOY_METHOD" = "docker" ] && [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ]; then
    echo ""
    info "Linux system modules (${LINUX_SYSTEM_MODULES[*]}) will be installed as systemd services"
    info "alongside Docker Compose for the other services."
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

configure() {
  echo ""
  step "Configuration"
  echo ""

  # Check for existing config
  if [ -f "${CONFIG_DIR}/tentacle.env" ]; then
    warn "Existing configuration found at ${CONFIG_DIR}/tentacle.env"
    if ! confirm "Overwrite configuration?" "n"; then
      info "Keeping existing configuration."
      return
    fi
  fi

  # ── Core ──────────────────────────────────────────────────────────────────
  read -r -p "  NATS server address [nats://localhost:4222]: " CFG_NATS_SERVERS
  CFG_NATS_SERVERS="${CFG_NATS_SERVERS:-nats://localhost:4222}"

  read -r -p "  GraphQL API port [4000]: " CFG_GRAPHQL_PORT
  CFG_GRAPHQL_PORT="${CFG_GRAPHQL_PORT:-4000}"

  read -r -p "  Web dashboard port [3012]: " CFG_WEB_PORT
  CFG_WEB_PORT="${CFG_WEB_PORT:-3012}"

  local graphql_url="http://localhost:${CFG_GRAPHQL_PORT}/graphql"
  if [ "$DEPLOY_METHOD" = "docker" ]; then
    graphql_url="http://graphql:${CFG_GRAPHQL_PORT}/graphql"
  fi

  # ── MQTT (only if selected) ────────────────────────────────────────────────
  if has_module "tentacle-mqtt"; then
    echo ""
    echo -e "  ${BOLD}MQTT / Sparkplug B Configuration${NC}"
    echo ""

    read -r -p "  Broker URL [mqtt://localhost:1883]: " CFG_MQTT_BROKER
    CFG_MQTT_BROKER="${CFG_MQTT_BROKER:-mqtt://localhost:1883}"

    read -r -p "  Group ID [TentacleGroup]: " CFG_MQTT_GROUP
    CFG_MQTT_GROUP="${CFG_MQTT_GROUP:-TentacleGroup}"

    read -r -p "  Edge node ID [EdgeNode1]: " CFG_MQTT_NODE
    CFG_MQTT_NODE="${CFG_MQTT_NODE:-EdgeNode1}"

    read -r -p "  Client ID [tentacle-mqtt]: " CFG_MQTT_CLIENT
    CFG_MQTT_CLIENT="${CFG_MQTT_CLIENT:-tentacle-mqtt}"

    read -r -p "  Username (leave blank if none): " CFG_MQTT_USER
    if [ -n "$CFG_MQTT_USER" ]; then
      read -r -s -p "  Password: " CFG_MQTT_PASS
      echo ""
    fi
  fi

  # ── Write env file ─────────────────────────────────────────────────────────
  mkdir -p "${CONFIG_DIR}"
  cat > "${CONFIG_DIR}/tentacle.env" <<ENVEOF
# Tentacle Platform Configuration
# Generated by install.sh on $(date -Iseconds)

# NATS
NATS_SERVERS=${CFG_NATS_SERVERS}

# Deno dependency cache (pre-populated by installer for air-gapped use)
DENO_DIR=${SERVICES_DIR}/deno-cache

# GraphQL API
GRAPHQL_PORT=${CFG_GRAPHQL_PORT}
GRAPHQL_HOSTNAME=0.0.0.0
TENTACLE_MODE=${DEPLOY_METHOD}

# Web Dashboard
GRAPHQL_URL=${graphql_url}
PORT=${CFG_WEB_PORT}
ENVEOF

  if has_module "tentacle-mqtt"; then
    cat >> "${CONFIG_DIR}/tentacle.env" <<ENVEOF

# MQTT Sparkplug B Bridge
MQTT_BROKER_URL=${CFG_MQTT_BROKER}
MQTT_CLIENT_ID=${CFG_MQTT_CLIENT}
MQTT_GROUP_ID=${CFG_MQTT_GROUP}
MQTT_EDGE_NODE=${CFG_MQTT_NODE}
ENVEOF
    [ -n "$CFG_MQTT_USER" ] && echo "MQTT_USERNAME=${CFG_MQTT_USER}" >> "${CONFIG_DIR}/tentacle.env"
    [ -n "$CFG_MQTT_PASS" ] && echo "MQTT_PASSWORD=${CFG_MQTT_PASS}" >> "${CONFIG_DIR}/tentacle.env"
  fi

  cat >> "${CONFIG_DIR}/tentacle.env" <<ENVEOF

# OPC UA Client
# OPCUA_PKI_DIR=${DATA_DIR}/opcua/pki
# OPCUA_AUTO_ACCEPT_CERTS=true
ENVEOF

  info "Configuration written to ${CONFIG_DIR}/tentacle.env"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Installation
# ═══════════════════════════════════════════════════════════════════════════════

# Map module name → service type: "deno" or "go"
module_type() {
  case "$1" in
    tentacle-opcua) echo "go" ;;
    *) echo "deno" ;;
  esac
}

# For Deno services, the service directory name matches the module name.
# For the web service, the entry point is build/index.js instead of main.ts.
service_entrypoint() {
  case "$1" in
    tentacle-web) echo "build/index.js" ;;
    *) echo "main.ts" ;;
  esac
}

install_files() {
  echo ""
  step "Installing Files"
  echo ""

  mkdir -p "${INSTALL_DIR}/bin" "${SERVICES_DIR}" \
           "${DATA_DIR}/nats" "${DATA_DIR}/opcua/pki"

  local src_dir
  if [ "$BUNDLED" = "true" ]; then
    src_dir="${BUNDLED_DIR}"
  else
    info "Downloading Tentacle v${VERSION} for ${PLATFORM}..."
    local tmpdir
    tmpdir="$(mktemp -d)"
    local url="https://github.com/${REPO}/releases/download/v${VERSION}/tentacle-v${VERSION}-${PLATFORM}.tar.gz"

    if command -v curl &>/dev/null; then
      curl -fSL --progress-bar "$url" -o "${tmpdir}/release.tar.gz"
    else
      wget -q --show-progress -O "${tmpdir}/release.tar.gz" "$url"
    fi

    tar xzf "${tmpdir}/release.tar.gz" -C "${tmpdir}" --strip-components=1
    src_dir="${tmpdir}"
  fi

  # ── Deno runtime ──────────────────────────────────────────────────────────
  if [ -f "${src_dir}/bin/deno" ]; then
    cp "${src_dir}/bin/deno" "${INSTALL_DIR}/bin/deno"
    chmod +x "${INSTALL_DIR}/bin/deno"
    info "  Installed deno runtime"
  fi

  # ── NATS server ──────────────────────────────────────────────────────────
  if [ -f "${src_dir}/bin/nats-server" ]; then
    cp "${src_dir}/bin/nats-server" "${INSTALL_DIR}/bin/nats-server"
    chmod +x "${INSTALL_DIR}/bin/nats-server"
    info "  Installed nats-server"
  fi

  # ── Shared Deno dependency cache ──────────────────────────────────────────
  if [ -d "${src_dir}/services/deno-cache" ]; then
    cp -r "${src_dir}/services/deno-cache" "${SERVICES_DIR}/deno-cache"
    info "  Installed Deno dependency cache"
  fi

  # ── Shared nats-schema ────────────────────────────────────────────────────
  if [ -d "${src_dir}/services/tentacle-nats-schema" ]; then
    cp -r "${src_dir}/services/tentacle-nats-schema" "${SERVICES_DIR}/tentacle-nats-schema"
    info "  Installed tentacle-nats-schema"
  fi

  # ── Per-module installation ───────────────────────────────────────────────
  local all_mods=("${SELECTED_MODULES[@]}" "${LINUX_SYSTEM_MODULES[@]}")
  for mod in "${all_mods[@]}"; do
    if [ "$(module_type "$mod")" = "go" ]; then
      # Go binary: copy to bin/
      if [ -f "${src_dir}/bin/${mod}" ]; then
        cp "${src_dir}/bin/${mod}" "${INSTALL_DIR}/bin/${mod}"
        chmod +x "${INSTALL_DIR}/bin/${mod}"
        info "  Installed ${mod} (binary)"
      else
        warn "  Binary not found: ${mod}"
      fi
    else
      # Deno service: copy source directory to services/
      if [ -d "${src_dir}/services/${mod}" ]; then
        cp -r "${src_dir}/services/${mod}" "${SERVICES_DIR}/${mod}"
        info "  Installed ${mod} (source)"
      else
        warn "  Service source not found: ${mod}"
      fi
    fi
  done

  if [ "$BUNDLED" = "false" ] && [ -n "${tmpdir:-}" ]; then
    rm -rf "${tmpdir}"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Systemd setup
# ═══════════════════════════════════════════════════════════════════════════════

install_systemd() {
  local services=("$@")

  echo ""
  step "Setting up systemd services"
  echo ""

  local source_dir
  if [ "$BUNDLED" = "true" ]; then
    source_dir="${BUNDLED_DIR}/deploy/systemd"
  else
    source_dir="$(dirname "$0")/systemd"
  fi

  # Always install NATS service first
  if [ -f "${source_dir}/tentacle-nats.service" ]; then
    cp "${source_dir}/tentacle-nats.service" /etc/systemd/system/
    info "  Installed tentacle-nats.service"
  fi

  for mod in "${services[@]}"; do
    local svc_file="${source_dir}/${mod}.service"
    if [ -f "$svc_file" ]; then
      cp "$svc_file" /etc/systemd/system/
      info "  Installed ${mod}.service"
    else
      warn "  Service file not found: ${mod}.service"
    fi
  done

  systemctl daemon-reload

  systemctl enable tentacle-nats
  systemctl start tentacle-nats
  info "  Started tentacle-nats"
  sleep 2

  for mod in "${services[@]}"; do
    systemctl enable "${mod}"
    systemctl start "${mod}"
    info "  Started ${mod}"
  done
}

# ═══════════════════════════════════════════════════════════════════════════════
# Docker Compose setup
# ═══════════════════════════════════════════════════════════════════════════════

install_docker() {
  echo ""
  step "Setting up Docker Compose"
  echo ""

  local docker_dir="${INSTALL_DIR}/docker"
  mkdir -p "${docker_dir}"

  local source_dir
  if [ "$BUNDLED" = "true" ]; then
    source_dir="${BUNDLED_DIR}/deploy"
  else
    source_dir="$(dirname "$0")"
  fi

  cp "${source_dir}/docker-compose.yml" "${docker_dir}/"
  for f in "${source_dir}"/Dockerfile.*; do
    [ -f "$f" ] && cp "$f" "${docker_dir}/"
  done

  cp "${CONFIG_DIR}/tentacle.env" "${docker_dir}/.env" 2>/dev/null || true

  info "Docker Compose files installed in ${docker_dir}"

  cd "${docker_dir}"
  if confirm "Start services now with docker compose?"; then
    docker compose up -d --build
    info "Services started!"
  else
    info "To start later: cd ${docker_dir} && docker compose up -d --build"
  fi
  cd - >/dev/null
}

# ═══════════════════════════════════════════════════════════════════════════════
# Binary-only setup
# ═══════════════════════════════════════════════════════════════════════════════

install_binary_only() {
  echo ""
  step "Binary-only installation"
  echo ""

  local start_script="${INSTALL_DIR}/start.sh"
  cat > "${start_script}" << 'STARTEOF'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# Source environment
if [ -f "${DIR}/config/tentacle.env" ]; then
  set -a; source "${DIR}/config/tentacle.env"; set +a
fi

echo "Starting Tentacle services..."

"${DIR}/bin/nats-server" -js -sd "${DIR}/data/nats" &
NATS_PID=$!
echo "  NATS server started (PID: $NATS_PID)"
sleep 2

PIDS=($NATS_PID)

STARTEOF

  local all_mods=("${SELECTED_MODULES[@]}")
  for mod in "${all_mods[@]}"; do
    if [ "$(module_type "$mod")" = "go" ]; then
      cat >> "${start_script}" << SVCEOF
"${INSTALL_DIR}/bin/${mod}" &
PIDS+=(\$!)
echo "  ${mod} started (PID: \${PIDS[-1]})"

SVCEOF
    else
      local ep
      ep="$(service_entrypoint "$mod")"
      cat >> "${start_script}" << SVCEOF
"${INSTALL_DIR}/bin/deno" run --allow-all "${SERVICES_DIR}/${mod}/${ep}" &
PIDS+=(\$!)
echo "  ${mod} started (PID: \${PIDS[-1]})"

SVCEOF
    fi
  done

  cat >> "${start_script}" << 'ENDEOF'
echo ""
echo "All services started. Press Ctrl+C to stop."
echo "Web Dashboard: http://localhost:${PORT:-3012}"

trap 'echo "Stopping..."; kill "${PIDS[@]}" 2>/dev/null; wait; echo "Stopped."' INT TERM
wait
ENDEOF

  chmod +x "${start_script}"
  info "Start script created: ${start_script}"
  info "Run: ${start_script}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Verification
# ═══════════════════════════════════════════════════════════════════════════════

verify_install() {
  echo ""
  step "Verifying Installation"
  echo ""
  sleep 3

  if command -v curl &>/dev/null; then
    if curl -sf http://localhost:8222/healthz >/dev/null 2>&1; then
      info "NATS server: ${GREEN}running${NC}"
    else
      warn "NATS server: not responding on :8222 (may still be starting)"
    fi
  fi

  local gport
  gport="$(grep -oP 'GRAPHQL_PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 4000)"
  if curl -sf "http://localhost:${gport}/graphql" \
      -H "Content-Type: application/json" \
      -d '{"query":"{__typename}"}' >/dev/null 2>&1; then
    info "GraphQL API: ${GREEN}running${NC} on :${gport}"
  else
    warn "GraphQL API: not responding on :${gport} (may still be starting)"
  fi

  local wport
  wport="$(grep -oP 'PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 3012)"
  if curl -sf "http://localhost:${wport}" >/dev/null 2>&1; then
    info "Web Dashboard: ${GREEN}running${NC} on :${wport}"
  else
    warn "Web Dashboard: not responding on :${wport} (may still be starting)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

print_summary() {
  local wport
  wport="$(grep -oP 'PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 3012)"
  local gport
  gport="$(grep -oP 'GRAPHQL_PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 4000)"

  echo ""
  echo -e "${GREEN}${BOLD}"
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║           Installation Complete!                 ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}Version:${NC}          ${VERSION}"
  echo -e "  ${BOLD}Install dir:${NC}      ${INSTALL_DIR}"
  echo -e "  ${BOLD}Config:${NC}           ${CONFIG_DIR}/tentacle.env"
  echo -e "  ${BOLD}Deploy method:${NC}    ${DEPLOY_METHOD}"
  echo ""
  echo -e "  ${BOLD}Services:${NC}"
  echo -e "    Web Dashboard:  ${CYAN}http://localhost:${wport}${NC}"
  echo -e "    GraphQL API:    ${CYAN}http://localhost:${gport}/graphql${NC}"
  echo -e "    NATS:           ${CYAN}nats://localhost:4222${NC}"
  echo ""
  echo -e "  ${BOLD}Upgrade Deno runtime:${NC}  ${INSTALL_DIR}/bin/deno upgrade"
  echo ""

  case "$DEPLOY_METHOD" in
    systemd)
      echo -e "  ${BOLD}Management:${NC}"
      echo "    systemctl status tentacle-*"
      echo "    systemctl restart tentacle-graphql"
      echo "    journalctl -u tentacle-web -f"
      ;;
    docker)
      echo -e "  ${BOLD}Management:${NC}"
      echo "    cd ${INSTALL_DIR}/docker && docker compose ps"
      echo "    cd ${INSTALL_DIR}/docker && docker compose logs -f"
      echo "    cd ${INSTALL_DIR}/docker && docker compose restart"
      if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ]; then
        echo ""
        echo "  Linux system modules (systemd):"
        for mod in "${LINUX_SYSTEM_MODULES[@]}"; do
          echo "    systemctl status ${mod}"
        done
      fi
      ;;
    binary)
      echo -e "  ${BOLD}Management:${NC}"
      echo "    ${INSTALL_DIR}/start.sh"
      ;;
  esac

  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# PLC Project Scaffolding
# ═══════════════════════════════════════════════════════════════════════════════

setup_plc_project() {
  echo ""
  read -r -p "  Would you like to create a PLC project? [y/N]: " plc_answer
  case "$plc_answer" in
    [yY]|[yY][eE][sS]) ;;
    *) return ;;
  esac

  local default_name="my-plc"
  read -r -p "  Project name [${default_name}]: " plc_name
  plc_name="${plc_name:-$default_name}"

  local nats_url="${CFG_NATS_SERVERS:-nats://localhost:4222}"
  local projects_dir="${INSTALL_DIR}/projects"
  local project_dir="${projects_dir}/${plc_name}"

  if [ -d "$project_dir" ]; then
    echo -e "  ${RED}Error: Directory ${project_dir} already exists.${NC}"
    return
  fi

  mkdir -p "$project_dir"

  # deno.json
  cat > "${project_dir}/deno.json" << 'DENOEOF'
{
  "tasks": {
    "dev": "deno run --env-file=.env --allow-all --watch main.ts",
    "start": "deno run --env-file=.env --allow-all main.ts"
  },
  "imports": {
    "@tentacle/plc": "jsr:@joyautomation/tentacle-plc@^0.0.5"
  }
}
DENOEOF

  # .env
  cat > "${project_dir}/.env" << ENVEOF
NATS_SERVERS=${nats_url}
ENVEOF

  # .gitignore
  cat > "${project_dir}/.gitignore" << 'GIEOF'
.env
*.log
GIEOF

  # main.ts
  cat > "${project_dir}/main.ts" << MAINEOF
/**
 * ${plc_name} — Tentacle PLC project
 *
 * Define your variables, tasks, and control logic below.
 * Run with: deno task dev
 */

import {
  createPlc,
  createPlcLogger,
  type PlcVariableBooleanConfig,
  type PlcVariableNumberConfig,
  type PlcVariablesRuntime,
} from "@tentacle/plc";

// ─── To add device sources, import the helpers: ─────────────────────────────
// import { eipTag } from "@tentacle/plc";       // EtherNet/IP
// import { opcuaTag } from "@tentacle/plc";      // OPC UA
// import { modbusTag } from "@tentacle/plc";     // Modbus TCP
//
// Then add a \`source\` field to your variable config:
//   source: eipTag(device, "TagName"),
//   source: opcuaTag(device, "ns=2;s=NodeId"),
//   source: modbusTag(device, "register_name"),
//
// See: https://github.com/joyautomation/tentacle-plc

const log = createPlcLogger("${plc_name}");

// =============================================================================
// Variables
// =============================================================================

const variables = {
  temperature: {
    id: "temperature",
    description: "Temperature sensor reading",
    datatype: "number",
    default: 20,
    deadband: {
      value: 0.5,
      maxTime: 60000,
    },
  } satisfies PlcVariableNumberConfig,

  isRunning: {
    id: "isRunning",
    description: "System running state",
    datatype: "boolean",
    default: false,
    source: { bidirectional: true },
  } satisfies PlcVariableBooleanConfig,
};

type Variables = typeof variables;
type VariablesRuntime = PlcVariablesRuntime<Variables>;

// =============================================================================
// Tasks
// =============================================================================

const tasks = {
  logger: {
    name: "Logger",
    description: "Log variable values periodically",
    scanRate: 5000,
    program: (vars: VariablesRuntime) => {
      log.info(
        \`Temperature: \${vars.temperature.value}°C | Running: \${vars.isRunning.value}\`,
      );
    },
  },
};

// =============================================================================
// Run
// =============================================================================

const plc = await createPlc({
  projectId: "${plc_name}",
  variables,
  tasks,
  nats: {
    servers: Deno.env.get("NATS_SERVERS") || "nats://localhost:4222",
  },
});

Deno.addSignalListener("SIGINT", async () => {
  log.info("Shutting down...");
  await plc.stop();
  Deno.exit(0);
});

log.info("PLC running. Press Ctrl+C to stop.");
log.info("Send values via NATS:");
log.info(\`  nats pub ${plc_name}/temperature 25\`);
log.info(\`  nats pub ${plc_name}/isRunning true\`);
MAINEOF

  echo ""
  echo -e "  ${GREEN}${BOLD}PLC project created at ${project_dir}/${NC}"
  echo ""
  echo -e "  ${BOLD}Get started:${NC}"
  echo "    cd ${project_dir}"
  echo "    ${INSTALL_DIR}/bin/deno task dev"
  echo ""
  echo -e "  ${BOLD}Create more projects anytime:${NC}"
  echo "    deno run -A jsr:@joyautomation/create-tentacle-plc <name>"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  print_banner
  detect_platform
  preflight
  select_modules
  select_deployment
  configure
  install_files

  case "$DEPLOY_METHOD" in
    systemd)
      install_systemd "${SELECTED_MODULES[@]}" "${LINUX_SYSTEM_MODULES[@]}"
      ;;
    docker)
      install_docker
      if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ]; then
        install_systemd "${LINUX_SYSTEM_MODULES[@]}"
      fi
      ;;
    binary)
      install_binary_only
      if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ] && command -v systemctl &>/dev/null; then
        install_systemd "${LINUX_SYSTEM_MODULES[@]}"
      fi
      ;;
  esac

  if [ "$DEPLOY_METHOD" != "binary" ]; then
    verify_install
  fi

  print_summary
  setup_plc_project
}

main "$@"
