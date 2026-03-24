#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# Tentacle Platform Installer
#
# Downloads and installs selected tentacle modules from GitHub releases.
# Each module is a standalone binary — no runtime dependencies needed.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/joyautomation/tentacle/main/install.sh | bash
#   ./install.sh [install|update|status|uninstall] [--modules mod1,mod2,...] [--yes]
# ═══════════════════════════════════════════════════════════════════════════════

GH_ORG="joyautomation"
NATS_VERSION="2.10.24"
INSTALL_DIR="/opt/tentacle"
BIN_DIR="${INSTALL_DIR}/bin"
CONFIG_DIR="${INSTALL_DIR}/config"
DATA_DIR="${INSTALL_DIR}/data"
SYSTEMD_DIR="/etc/systemd/system"
ENV_FILE="${CONFIG_DIR}/tentacle.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Module Registry ──────────────────────────────────────────────────────────
# Each module: repo name, binary asset name, description, whether it's core
# Format: "repo|asset|description|core"
# Core modules are always installed and not shown in the picker.

MODULES=(
  "nats-server|nats|NATS message broker (JetStream)|core"
  "tentacle-graphql|tentacle-graphql|GraphQL API gateway|core"
  "tentacle-web|tentacle-web|Web dashboard|core"
  "tentacle-ethernetip-go|tentacle-ethernetip|EtherNet/IP scanner (Allen-Bradley, etc.)|optional"
  "tentacle-opcua-go|tentacle-opcua|OPC UA client|optional"
  "tentacle-snmp|tentacle-snmp|SNMP scanner & trap listener|optional"
  "tentacle-mqtt|tentacle-mqtt|MQTT Sparkplug B bridge|optional"
  "tentacle-modbus|tentacle-modbus|Modbus TCP scanner|optional"
  "tentacle-modbus-server|tentacle-modbus-server|Modbus TCP server|optional"
  "tentacle-network|tentacle-network|Network interface manager|optional"
  "tentacle-nftables|tentacle-nftables|Firewall manager|optional"
)

# ─── Helpers ───────────────────────────────────────────────────────────────────

info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[x]${NC} $*"; }
step()  { echo -e "${CYAN}[>]${NC} ${BOLD}$*${NC}"; }
die()   { error "$*"; exit 1; }

confirm() {
  local msg="$1"
  if [ "${AUTO_YES:-false}" = "true" ]; then return 0; fi
  echo -en "${YELLOW}[?]${NC} ${msg} [Y/n] "
  read -r answer
  [[ "${answer:-y}" =~ ^[Yy]$ ]]
}

check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "This installer must be run as root (sudo ./install.sh)"
  fi
}

check_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  [ "$os" = "linux" ] || die "Only Linux is supported (detected: $os)"
  case "$arch" in
    x86_64|amd64) ARCH="amd64" ;;
    *) die "Unsupported architecture: $arch (only amd64 is currently supported)" ;;
  esac
}

download() {
  local url="$1" dest="$2"
  if command -v curl &>/dev/null; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget &>/dev/null; then
    wget -q "$url" -O "$dest"
  else
    die "Neither curl nor wget found"
  fi
}

get_module_field() {
  local entry="$1" field="$2"
  case "$field" in
    repo)  echo "$entry" | cut -d'|' -f1 ;;
    asset) echo "$entry" | cut -d'|' -f2 ;;
    desc)  echo "$entry" | cut -d'|' -f3 ;;
    type)  echo "$entry" | cut -d'|' -f4 ;;
  esac
}

# ─── Module Selection ─────────────────────────────────────────────────────────

select_modules() {
  # If modules were specified on the command line, use those
  if [ ${#CLI_MODULES[@]} -gt 0 ]; then
    SELECTED_MODULES=("${CLI_MODULES[@]}")
    return
  fi

  echo ""
  echo -e "${BOLD}Select modules to install:${NC}"
  echo ""

  local optional_modules=()
  for entry in "${MODULES[@]}"; do
    local type
    type=$(get_module_field "$entry" "type")
    if [ "$type" = "optional" ]; then
      optional_modules+=("$entry")
    fi
  done

  echo -e "  ${DIM}Core modules (always installed):${NC}"
  for entry in "${MODULES[@]}"; do
    local type desc asset
    type=$(get_module_field "$entry" "type")
    if [ "$type" = "core" ]; then
      desc=$(get_module_field "$entry" "desc")
      asset=$(get_module_field "$entry" "asset")
      echo -e "    ${GREEN}✓${NC} ${asset} — ${desc}"
    fi
  done
  echo ""

  echo -e "  ${BOLD}Optional modules:${NC}"
  for i in "${!optional_modules[@]}"; do
    local desc asset
    desc=$(get_module_field "${optional_modules[$i]}" "desc")
    asset=$(get_module_field "${optional_modules[$i]}" "asset")
    echo -e "    ${CYAN}$((i + 1))${NC}) ${asset} — ${desc}"
  done
  echo ""

  echo -en "${YELLOW}[?]${NC} Enter module numbers (comma-separated), ${BOLD}all${NC}, or ${BOLD}none${NC}: "
  read -r selection

  SELECTED_MODULES=()
  case "$selection" in
    all|ALL)
      for entry in "${optional_modules[@]}"; do
        SELECTED_MODULES+=("$(get_module_field "$entry" "asset")")
      done
      ;;
    none|NONE|"")
      ;;
    *)
      IFS=',' read -ra nums <<< "$selection"
      for num in "${nums[@]}"; do
        num=$(echo "$num" | tr -d ' ')
        if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#optional_modules[@]}" ]; then
          SELECTED_MODULES+=("$(get_module_field "${optional_modules[$((num - 1))]}" "asset")")
        else
          warn "Ignoring invalid selection: $num"
        fi
      done
      ;;
  esac

  echo ""
  info "Will install: core modules + ${SELECTED_MODULES[*]:-none}"
}

# ─── Install NATS ─────────────────────────────────────────────────────────────

install_nats() {
  step "Installing NATS server v${NATS_VERSION}..."
  local url="https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-linux-${ARCH}.tar.gz"
  local tmp
  tmp=$(mktemp -d)
  download "$url" "${tmp}/nats.tar.gz"
  tar xzf "${tmp}/nats.tar.gz" -C "${tmp}" --strip-components=1
  install -m 755 "${tmp}/nats-server" "${BIN_DIR}/nats-server"
  rm -rf "$tmp"
  info "NATS server installed"
}

# ─── Install Module ───────────────────────────────────────────────────────────

install_module() {
  local repo="$1" asset="$2"
  step "Installing ${asset}..."

  local url
  url="https://github.com/${GH_ORG}/${repo}/releases/latest/download/${asset}"
  download "$url" "${BIN_DIR}/${asset}"
  chmod +x "${BIN_DIR}/${asset}"
  info "${asset} installed"
}

# ─── Systemd Units ────────────────────────────────────────────────────────────

install_systemd_unit() {
  local name="$1"
  local extra_env="${2:-}"

  local unit_file="${SYSTEMD_DIR}/tentacle-${name}.service"

  # Special case for NATS
  if [ "$name" = "nats" ]; then
    cat > "$unit_file" <<UNIT
[Unit]
Description=Tentacle NATS Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/nats-server -js -sd ${DATA_DIR}/nats
Restart=always
RestartSec=5
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tentacle-nats

[Install]
WantedBy=multi-user.target
UNIT
    return
  fi

  # All other modules are standalone binaries
  local after="tentacle-nats.service"
  local requires="tentacle-nats.service"
  if [ "$name" = "tentacle-web" ]; then
    after="tentacle-graphql.service"
  fi

  cat > "$unit_file" <<UNIT
[Unit]
Description=Tentacle ${name}
After=${after}
Requires=${requires}

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}${extra_env:+
Environment=${extra_env}}
ExecStart=${BIN_DIR}/${name}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${name}

[Install]
WantedBy=multi-user.target
UNIT
}

# ─── Config ────────────────────────────────────────────────────────────────────

install_config() {
  if [ -f "$ENV_FILE" ]; then
    info "Config file exists, not overwriting: ${ENV_FILE}"
    return
  fi

  step "Writing default config..."
  cat > "$ENV_FILE" <<'CONFIG'
# Tentacle Platform Configuration
# All services read from this shared environment file.

# NATS Server
NATS_SERVERS=nats://localhost:4222

# GraphQL API
GRAPHQL_PORT=4000
GRAPHQL_HOSTNAME=0.0.0.0
TENTACLE_MODE=systemd

# Web Dashboard
GRAPHQL_URL=http://localhost:4000/graphql
PORT=3012

# MQTT Sparkplug B Bridge (uncomment to configure)
# MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_CLIENT_ID=tentacle-mqtt
# MQTT_GROUP_ID=TentacleGroup
# MQTT_EDGE_NODE=EdgeNode1
# MQTT_USERNAME=
# MQTT_PASSWORD=

# OPC UA Client (uncomment to configure)
# OPCUA_PKI_DIR=/opt/tentacle/data/opcua/pki
# OPCUA_AUTO_ACCEPT_CERTS=true
CONFIG
  info "Config written to ${ENV_FILE}"
}

# ─── Commands ──────────────────────────────────────────────────────────────────

do_install() {
  check_root
  check_platform

  echo ""
  echo -e "${BOLD}Tentacle Platform Installer${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  select_modules

  if ! confirm "Install to ${INSTALL_DIR}?"; then
    echo "Aborted."
    exit 0
  fi

  # Create directories
  mkdir -p "${BIN_DIR}" "${CONFIG_DIR}" "${DATA_DIR}/nats"

  # Install config
  install_config

  # Install core: NATS
  install_nats
  install_systemd_unit "nats"

  # Install core: graphql, web
  for entry in "${MODULES[@]}"; do
    local repo asset type
    repo=$(get_module_field "$entry" "repo")
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    [ "$type" = "core" ] || continue
    [ "$asset" = "nats" ] && continue  # already installed above
    install_module "$repo" "$asset"
    install_systemd_unit "$asset"
  done

  # Install selected optional modules
  for asset_name in "${SELECTED_MODULES[@]}"; do
    for entry in "${MODULES[@]}"; do
      local repo asset
      repo=$(get_module_field "$entry" "repo")
      asset=$(get_module_field "$entry" "asset")
      if [ "$asset" = "$asset_name" ]; then
        install_module "$repo" "$asset"
        local extra_env=""
        [ "$asset" = "tentacle-opcua" ] && extra_env="OPCUA_PKI_DIR=${DATA_DIR}/opcua/pki"
        install_systemd_unit "$asset" "$extra_env"
        break
      fi
    done
  done

  # Enable and start services
  systemctl daemon-reload

  step "Enabling services..."
  systemctl enable tentacle-nats.service

  for entry in "${MODULES[@]}"; do
    local asset type
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    if [ "$type" = "core" ] && [ "$asset" != "nats" ]; then
      systemctl enable "tentacle-${asset}.service" 2>/dev/null || \
        systemctl enable "${asset}.service" 2>/dev/null || true
    fi
  done

  for asset_name in "${SELECTED_MODULES[@]}"; do
    systemctl enable "${asset_name}.service" 2>/dev/null || \
      systemctl enable "tentacle-${asset_name}.service" 2>/dev/null || true
  done

  if confirm "Start all services now?"; then
    systemctl start tentacle-nats.service
    sleep 1
    for entry in "${MODULES[@]}"; do
      local asset type
      asset=$(get_module_field "$entry" "asset")
      type=$(get_module_field "$entry" "type")
      if [ "$type" = "core" ] && [ "$asset" != "nats" ]; then
        systemctl start "${asset}.service" 2>/dev/null || true
      fi
    done
    for asset_name in "${SELECTED_MODULES[@]}"; do
      systemctl start "${asset_name}.service" 2>/dev/null || true
    done
    info "Services started"
  fi

  echo ""
  echo -e "${BOLD}${GREEN}Installation complete!${NC}"
  echo ""
  echo -e "  Config:     ${ENV_FILE}"
  echo -e "  Binaries:   ${BIN_DIR}/"
  echo -e "  Data:       ${DATA_DIR}/"
  echo -e "  Dashboard:  http://localhost:3012"
  echo -e "  GraphQL:    http://localhost:4000/graphql"
  echo ""
  echo -e "  ${DIM}Manage: systemctl [start|stop|status] tentacle-*${NC}"
  echo -e "  ${DIM}Logs:   journalctl -u tentacle-graphql -f${NC}"
  echo -e "  ${DIM}Update: ./install.sh update${NC}"
  echo ""
}

do_update() {
  check_root
  check_platform

  step "Updating installed modules..."

  # Find installed modules by checking binaries in BIN_DIR
  local updated=0
  for entry in "${MODULES[@]}"; do
    local repo asset type
    repo=$(get_module_field "$entry" "repo")
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")

    if [ "$asset" = "nats" ]; then
      if [ -f "${BIN_DIR}/nats-server" ]; then
        install_nats
        updated=$((updated + 1))
      fi
    elif [ -f "${BIN_DIR}/${asset}" ]; then
      local service_name="${asset}"
      systemctl stop "${service_name}.service" 2>/dev/null || true
      install_module "$repo" "$asset"
      systemctl start "${service_name}.service" 2>/dev/null || true
      updated=$((updated + 1))
    fi
  done

  info "Updated ${updated} modules"
}

do_status() {
  echo ""
  echo -e "${BOLD}Tentacle Status${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  printf "  %-25s %-12s %s\n" "MODULE" "INSTALLED" "STATUS"
  echo "  ─────────────────────────────────────────────────"

  for entry in "${MODULES[@]}"; do
    local asset type installed status
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")

    if [ "$asset" = "nats" ]; then
      [ -f "${BIN_DIR}/nats-server" ] && installed="${GREEN}yes${NC}" || installed="${DIM}no${NC}"
      status=$(systemctl is-active tentacle-nats.service 2>/dev/null || echo "—")
    else
      [ -f "${BIN_DIR}/${asset}" ] && installed="${GREEN}yes${NC}" || installed="${DIM}no${NC}"
      status=$(systemctl is-active "${asset}.service" 2>/dev/null || echo "—")
    fi

    case "$status" in
      active)   status="${GREEN}${status}${NC}" ;;
      inactive) status="${DIM}${status}${NC}" ;;
      failed)   status="${RED}${status}${NC}" ;;
    esac

    printf "  %-25s " "$asset"
    echo -en "$installed"
    printf "%*s" $((12 - ${#asset} + ${#asset})) ""
    echo -e "$status"
  done
  echo ""
}

do_uninstall() {
  check_root

  echo ""
  warn "This will stop all tentacle services and remove ${INSTALL_DIR}"
  if ! confirm "Continue?"; then
    echo "Aborted."
    exit 0
  fi

  step "Stopping services..."
  for entry in "${MODULES[@]}"; do
    local asset
    asset=$(get_module_field "$entry" "asset")
    if [ "$asset" = "nats" ]; then
      systemctl stop tentacle-nats.service 2>/dev/null || true
      systemctl disable tentacle-nats.service 2>/dev/null || true
      rm -f "${SYSTEMD_DIR}/tentacle-nats.service"
    else
      systemctl stop "${asset}.service" 2>/dev/null || true
      systemctl disable "${asset}.service" 2>/dev/null || true
      rm -f "${SYSTEMD_DIR}/${asset}.service"
    fi
  done
  systemctl daemon-reload

  step "Removing ${INSTALL_DIR}..."
  rm -rf "${INSTALL_DIR}"

  info "Tentacle uninstalled"
}

# ─── Main ──────────────────────────────────────────────────────────────────────

COMMAND="${1:-install}"
AUTO_YES=false
CLI_MODULES=()

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --modules)
      IFS=',' read -ra CLI_MODULES <<< "$2"
      shift 2
      ;;
    --yes|-y)
      AUTO_YES=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

case "$COMMAND" in
  install)   do_install ;;
  update)    do_update ;;
  status)    do_status ;;
  uninstall) do_uninstall ;;
  *)
    echo "Usage: $0 [install|update|status|uninstall] [--modules mod1,mod2,...] [--yes]"
    exit 1
    ;;
esac
