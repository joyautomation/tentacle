#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# Tentacle Platform Installer
#
# Downloads and installs selected tentacle modules from GitHub releases.
# Go modules run as compiled binaries. Deno/TypeScript modules run via a
# shared Deno runtime installed alongside them.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/joyautomation/tentacle/main/install.sh | bash
#   ./install.sh [install|update|status|uninstall] [--modules mod1,mod2,...] [--yes]
# ═══════════════════════════════════════════════════════════════════════════════

GH_ORG="joyautomation"
NATS_VERSION="2.10.24"
DENO_VERSION="2.7.4"
INSTALL_DIR="/opt/tentacle"
BIN_DIR="${INSTALL_DIR}/bin"
SERVICES_DIR="${INSTALL_DIR}/services"
CONFIG_DIR="${INSTALL_DIR}/config"
DATA_DIR="${INSTALL_DIR}/data"
CACHE_DIR="${INSTALL_DIR}/cache"
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
# Format: "repo|asset|description|core/optional|runtime"
#
# Runtimes:
#   binary   — standalone binary (NATS)
#   go       — compiled Go binary, release asset: {asset}-linux-{ARCH}
#   deno     — Deno/TS source tarball, release asset: {repo}-src.tar.gz
#   deno-web — Deno/SvelteKit build tarball, release asset: {repo}-build.tar.gz

MODULES=(
  "nats-server|nats|NATS message broker (JetStream)|core|binary"
  "tentacle-graphql|tentacle-graphql|GraphQL API gateway|core|deno"
  "tentacle-web|tentacle-web|Web dashboard|core|deno-web"
  "tentacle-orchestrator-go|tentacle-orchestrator|Service orchestrator|core|go"
  "tentacle-ethernetip-go|tentacle-ethernetip|EtherNet/IP scanner (Allen-Bradley, etc.)|optional|go"
  "tentacle-opcua-go|tentacle-opcua|OPC UA client|optional|go"
  "tentacle-snmp|tentacle-snmp|SNMP scanner & trap listener|optional|go"
  "tentacle-mqtt|tentacle-mqtt|MQTT Sparkplug B bridge|optional|deno"
  "tentacle-history|tentacle-history|Edge historian (TimescaleDB)|optional|deno"
  "tentacle-modbus|tentacle-modbus|Modbus TCP scanner|optional|deno"
  "tentacle-modbus-server|tentacle-modbus-server|Modbus TCP server|optional|deno"
  "tentacle-network|tentacle-network|Network interface manager|optional|deno"
  "tentacle-nftables|tentacle-nftables|Firewall manager|optional|deno"
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
    x86_64|amd64)  ARCH="amd64"; DENO_ARCH="x86_64" ;;
    aarch64|arm64) ARCH="arm64"; DENO_ARCH="aarch64" ;;
    *) die "Unsupported architecture: $arch" ;;
  esac
}

check_and_install_utilities() {
  step "Checking system utilities..."

  # Detect package manager
  local pkg_manager install_cmd
  if command -v apt-get &>/dev/null; then
    pkg_manager="apt"
    install_cmd="apt-get update && apt-get install -y"
  elif command -v yum &>/dev/null; then
    pkg_manager="yum"
    install_cmd="yum install -y"
  elif command -v dnf &>/dev/null; then
    pkg_manager="dnf"
    install_cmd="dnf install -y"
  elif command -v pacman &>/dev/null; then
    pkg_manager="pacman"
    install_cmd="pacman -S --noconfirm"
  elif command -v apk &>/dev/null; then
    pkg_manager="apk"
    install_cmd="apk add"
  else
    warn "Unknown package manager; skipping utility installation"
    return 0
  fi

  # List of required utilities and their package names (format: "binary|apt|yum|dnf|pacman|apk")
  local utilities=(
    "curl|curl|curl|curl|curl|curl"
    "unzip|unzip|unzip|unzip|unzip|unzip"
    "tar|tar|tar|tar|tar|tar"
    "sed|sed|sed|sed|sed|sed"
    "awk|gawk|gawk|gawk|gawk|gawk"
    "gzip|gzip|gzip|gzip|gzip|gzip"
  )

  local missing=()
  for util in "${utilities[@]}"; do
    local binary
    binary=$(echo "$util" | cut -d'|' -f1)
    if ! command -v "$binary" &>/dev/null; then
      missing+=("$binary")
    fi
  done

  if [ ${#missing[@]} -eq 0 ]; then
    info "All required utilities found"
    return 0
  fi

  # Map missing binaries to package names based on detected package manager
  local packages=()
  for binary in "${missing[@]}"; do
    for util in "${utilities[@]}"; do
      local bin pkg_apt pkg_yum pkg_dnf pkg_pacman pkg_apk
      IFS='|' read -r bin pkg_apt pkg_yum pkg_dnf pkg_pacman pkg_apk <<< "$util"
      if [ "$bin" = "$binary" ]; then
        case "$pkg_manager" in
          apt)     packages+=("$pkg_apt") ;;
          yum)     packages+=("$pkg_yum") ;;
          dnf)     packages+=("$pkg_dnf") ;;
          pacman)  packages+=("$pkg_pacman") ;;
          apk)     packages+=("$pkg_apk") ;;
        esac
        break
      fi
    done
  done

  warn "Installing missing utilities: ${missing[*]}"
  step "Running: $install_cmd ${packages[*]}"
  if eval "$install_cmd" "${packages[@]}" 2>/dev/null; then
    info "Utilities installed successfully"
  else
    warn "Failed to install some utilities; attempting to continue"
  fi
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
    repo)    echo "$entry" | cut -d'|' -f1 ;;
    asset)   echo "$entry" | cut -d'|' -f2 ;;
    desc)    echo "$entry" | cut -d'|' -f3 ;;
    type)    echo "$entry" | cut -d'|' -f4 ;;
    runtime) echo "$entry" | cut -d'|' -f5 ;;
  esac
}

needs_deno() {
  # Check if any installed/selected module requires the Deno runtime
  for entry in "${MODULES[@]}"; do
    local asset type runtime
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    runtime=$(get_module_field "$entry" "runtime")
    if [[ "$runtime" == deno* ]]; then
      if [ "$type" = "core" ]; then
        return 0
      fi
      for sel in "${SELECTED_MODULES[@]}"; do
        [ "$sel" = "$asset" ] && return 0
      done
    fi
  done
  return 1
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
    local type desc asset runtime
    type=$(get_module_field "$entry" "type")
    if [ "$type" = "core" ]; then
      desc=$(get_module_field "$entry" "desc")
      asset=$(get_module_field "$entry" "asset")
      runtime=$(get_module_field "$entry" "runtime")
      echo -e "    ${GREEN}✓${NC} ${asset} — ${desc} ${DIM}[${runtime}]${NC}"
    fi
  done
  echo ""

  echo -e "  ${BOLD}Optional modules:${NC}"
  for i in "${!optional_modules[@]}"; do
    local desc asset runtime
    desc=$(get_module_field "${optional_modules[$i]}" "desc")
    asset=$(get_module_field "${optional_modules[$i]}" "asset")
    runtime=$(get_module_field "${optional_modules[$i]}" "runtime")
    echo -e "    ${CYAN}$((i + 1))${NC}) ${asset} — ${desc} ${DIM}[${runtime}]${NC}"
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

# ─── Install Deno Runtime ────────────────────────────────────────────────────

install_deno() {
  step "Installing Deno v${DENO_VERSION}..."
  local url="https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-${DENO_ARCH}-unknown-linux-gnu.zip"
  local tmp
  tmp=$(mktemp -d)
  download "$url" "${tmp}/deno.zip"
  unzip -q -o "${tmp}/deno.zip" -d "${tmp}"
  install -m 755 "${tmp}/deno" "${BIN_DIR}/deno"
  rm -rf "$tmp"
  info "Deno ${DENO_VERSION} installed → ${BIN_DIR}/deno"
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

# ─── Install Go Module ───────────────────────────────────────────────────────

install_go_module() {
  local repo="$1" asset="$2"
  step "Installing ${asset} (Go binary)..."

  local url="https://github.com/${GH_ORG}/${repo}/releases/latest/download/${asset}-linux-${ARCH}"
  download "$url" "${BIN_DIR}/${asset}"
  chmod +x "${BIN_DIR}/${asset}"
  info "${asset} installed → ${BIN_DIR}/${asset}"
}

# ─── Install Deno Module ─────────────────────────────────────────────────────

install_deno_module() {
  local repo="$1" asset="$2" tarball_suffix="$3"
  step "Installing ${asset} (Deno service)..."

  local url="https://github.com/${GH_ORG}/${repo}/releases/latest/download/${repo}-${tarball_suffix}.tar.gz"
  local tmp
  tmp=$(mktemp -d)
  download "$url" "${tmp}/pkg.tar.gz"
  tar xzf "${tmp}/pkg.tar.gz" -C "${tmp}"

  # Remove old version if present
  rm -rf "${SERVICES_DIR:?}/${repo}"

  # Source tarballs contain repo-name/ dir; build tarballs contain build/ dir
  if [ -d "${tmp}/${repo}" ]; then
    mv "${tmp}/${repo}" "${SERVICES_DIR}/${repo}"
  elif [ -d "${tmp}/build" ]; then
    mkdir -p "${SERVICES_DIR}/${repo}"
    mv "${tmp}/build" "${SERVICES_DIR}/${repo}/build"
  else
    die "Unexpected tarball layout for ${repo}"
  fi
  rm -rf "$tmp"

  # Pre-cache Deno dependencies
  if [ -f "${SERVICES_DIR}/${repo}/deno.json" ]; then
    step "Caching dependencies for ${asset}..."
    DENO_DIR="${CACHE_DIR}/deno" "${BIN_DIR}/deno" install \
      --entrypoint "${SERVICES_DIR}/${repo}/main.ts" 2>/dev/null || true
  fi

  info "${asset} installed → ${SERVICES_DIR}/${repo}/"
}

# ─── Install Module (dispatcher) ─────────────────────────────────────────────

install_module() {
  local repo="$1" asset="$2" runtime="$3"

  case "$runtime" in
    go)
      install_go_module "$repo" "$asset"
      ;;
    deno)
      install_deno_module "$repo" "$asset" "src"
      ;;
    deno-web)
      install_deno_module "$repo" "$asset" "build"
      ;;
    *)
      die "Unknown runtime: $runtime for $asset"
      ;;
  esac
}

# ─── Systemd Units ────────────────────────────────────────────────────────────

install_systemd_unit() {
  local name="$1" runtime="$2" repo="$3"
  local extra_env="${4:-}"

  # For NATS, name="nats" so unit is "tentacle-nats"; for others, name already
  # includes "tentacle-" prefix (e.g. "tentacle-graphql").
  local unit_name
  if [ "$name" = "nats" ]; then
    unit_name="tentacle-nats"
  else
    unit_name="$name"
  fi
  local unit_file="${SYSTEMD_DIR}/${unit_name}.service"

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

  local after="tentacle-nats.service"
  local requires="tentacle-nats.service"
  if [ "$name" = "tentacle-web" ]; then
    after="tentacle-graphql.service"
  fi

  local exec_start working_dir=""
  case "$runtime" in
    go)
      exec_start="${BIN_DIR}/${name}"
      ;;
    deno)
      exec_start="${BIN_DIR}/deno run -A main.ts"
      working_dir="${SERVICES_DIR}/${repo}"
      ;;
    deno-web)
      exec_start="${BIN_DIR}/deno run -A build/index.js"
      working_dir="${SERVICES_DIR}/${repo}"
      ;;
  esac

  cat > "$unit_file" <<UNIT
[Unit]
Description=Tentacle ${name}
After=${after}
Requires=${requires}

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
Environment=DENO_DIR=${CACHE_DIR}/deno${extra_env:+
Environment=${extra_env}}${working_dir:+
WorkingDirectory=${working_dir}}
ExecStart=${exec_start}
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
  check_and_install_utilities

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
  mkdir -p "${BIN_DIR}" "${SERVICES_DIR}" "${CONFIG_DIR}" "${DATA_DIR}/nats" "${CACHE_DIR}/deno"

  # Install config
  install_config

  # Install Deno runtime if any Deno modules are selected
  if needs_deno; then
    install_deno
  fi

  # Install core: NATS
  install_nats
  install_systemd_unit "nats" "binary" ""

  # Install core: graphql, web
  for entry in "${MODULES[@]}"; do
    local repo asset type runtime
    repo=$(get_module_field "$entry" "repo")
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    runtime=$(get_module_field "$entry" "runtime")
    [ "$type" = "core" ] || continue
    [ "$asset" = "nats" ] && continue  # already installed above
    install_module "$repo" "$asset" "$runtime"
    install_systemd_unit "$asset" "$runtime" "$repo"
  done

  # Install selected optional modules
  for asset_name in "${SELECTED_MODULES[@]}"; do
    for entry in "${MODULES[@]}"; do
      local repo asset runtime
      repo=$(get_module_field "$entry" "repo")
      asset=$(get_module_field "$entry" "asset")
      runtime=$(get_module_field "$entry" "runtime")
      if [ "$asset" = "$asset_name" ]; then
        install_module "$repo" "$asset" "$runtime"
        local extra_env=""
        [ "$asset" = "tentacle-opcua" ] && extra_env="OPCUA_PKI_DIR=${DATA_DIR}/opcua/pki"
        install_systemd_unit "$asset" "$runtime" "$repo" "$extra_env"
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
      systemctl enable "${asset}.service" 2>/dev/null || true
    fi
  done

  for asset_name in "${SELECTED_MODULES[@]}"; do
    systemctl enable "${asset_name}.service" 2>/dev/null || true
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
  echo -e "  Go bins:    ${BIN_DIR}/"
  echo -e "  Deno svcs:  ${SERVICES_DIR}/"
  echo -e "  Deno:       ${BIN_DIR}/deno"
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
  check_and_install_utilities

  step "Updating installed modules..."

  local updated=0

  # Update Deno runtime if any Deno services are installed
  local has_deno_svc=false
  for entry in "${MODULES[@]}"; do
    local repo runtime
    repo=$(get_module_field "$entry" "repo")
    runtime=$(get_module_field "$entry" "runtime")
    if [[ "$runtime" == deno* ]] && [ -d "${SERVICES_DIR}/${repo}" ]; then
      has_deno_svc=true
      break
    fi
  done
  if [ "$has_deno_svc" = "true" ] && [ -f "${BIN_DIR}/deno" ]; then
    install_deno
  fi

  # Update each installed module
  for entry in "${MODULES[@]}"; do
    local repo asset type runtime
    repo=$(get_module_field "$entry" "repo")
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    runtime=$(get_module_field "$entry" "runtime")

    if [ "$asset" = "nats" ]; then
      if [ -f "${BIN_DIR}/nats-server" ]; then
        install_nats
        updated=$((updated + 1))
      fi
      continue
    fi

    # Check if module is installed
    local is_installed=false
    case "$runtime" in
      go)       [ -f "${BIN_DIR}/${asset}" ] && is_installed=true ;;
      deno*)    [ -d "${SERVICES_DIR}/${repo}" ] && is_installed=true ;;
    esac

    if [ "$is_installed" = "true" ]; then
      local service_name="${asset}"
      systemctl stop "${service_name}.service" 2>/dev/null || true
      install_module "$repo" "$asset" "$runtime"
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

  # Show Deno version if installed
  if [ -f "${BIN_DIR}/deno" ]; then
    local deno_ver
    deno_ver=$("${BIN_DIR}/deno" --version 2>/dev/null | head -1 || echo "unknown")
    echo -e "  Deno: ${GREEN}${deno_ver}${NC}"
  else
    echo -e "  Deno: ${DIM}not installed${NC}"
  fi
  echo ""

  printf "  %-25s %-10s %-12s %s\n" "MODULE" "RUNTIME" "INSTALLED" "STATUS"
  echo "  ──────────────────────────────────────────────────────────────"

  for entry in "${MODULES[@]}"; do
    local asset type runtime installed status
    asset=$(get_module_field "$entry" "asset")
    type=$(get_module_field "$entry" "type")
    runtime=$(get_module_field "$entry" "runtime")
    local repo
    repo=$(get_module_field "$entry" "repo")

    # Check installed
    if [ "$asset" = "nats" ]; then
      [ -f "${BIN_DIR}/nats-server" ] && installed="${GREEN}yes${NC}" || installed="${DIM}no${NC}"
      status=$(systemctl is-active tentacle-nats.service 2>/dev/null || echo "—")
    elif [ "$runtime" = "go" ]; then
      [ -f "${BIN_DIR}/${asset}" ] && installed="${GREEN}yes${NC}" || installed="${DIM}no${NC}"
      status=$(systemctl is-active "${asset}.service" 2>/dev/null || echo "—")
    else
      [ -d "${SERVICES_DIR}/${repo}" ] && installed="${GREEN}yes${NC}" || installed="${DIM}no${NC}"
      status=$(systemctl is-active "${asset}.service" 2>/dev/null || echo "—")
    fi

    case "$status" in
      active)   status="${GREEN}${status}${NC}" ;;
      inactive) status="${DIM}${status}${NC}" ;;
      failed)   status="${RED}${status}${NC}" ;;
    esac

    printf "  %-25s %-10s " "$asset" "$runtime"
    echo -en "$installed"
    printf "          "
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
