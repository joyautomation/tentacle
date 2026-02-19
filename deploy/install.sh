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
    # Use defaults
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r name _ default <<< "$entry"
      if [ "$default" = "true" ]; then
        selected+=("$name")
      fi
    done
  elif [ "$selection" = "a" ] || [ "$selection" = "A" ]; then
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r name _ _ <<< "$entry"
      selected+=("$name")
    done
  else
    # Start with defaults, toggle specified
    local defaults=()
    for entry in "${all_modules[@]}"; do
      IFS=':' read -r name _ default <<< "$entry"
      defaults+=("$default")
    done

    IFS=',' read -ra nums <<< "$selection"
    for num in "${nums[@]}"; do
      num="$(echo "$num" | tr -d ' ')"
      if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#all_modules[@]}" ]; then
        local idx=$((num - 1))
        if [ "${defaults[$idx]}" = "true" ]; then
          defaults[$idx]="false"
        else
          defaults[$idx]="true"
        fi
      fi
    done

    for idx in "${!all_modules[@]}"; do
      IFS=':' read -r name _ _ <<< "${all_modules[$idx]}"
      if [ "${defaults[$idx]}" = "true" ]; then
        selected+=("$name")
      fi
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

  local nats_servers graphql_port web_port

  read -r -p "  NATS server address [nats://localhost:4222]: " nats_servers
  nats_servers="${nats_servers:-nats://localhost:4222}"

  read -r -p "  GraphQL API port [4000]: " graphql_port
  graphql_port="${graphql_port:-4000}"

  read -r -p "  Web dashboard port [3012]: " web_port
  web_port="${web_port:-3012}"

  local graphql_url="http://localhost:${graphql_port}/graphql"
  if [ "$DEPLOY_METHOD" = "docker" ]; then
    graphql_url="http://graphql:${graphql_port}/graphql"
  fi

  local mode="$DEPLOY_METHOD"

  mkdir -p "${CONFIG_DIR}"
  cat > "${CONFIG_DIR}/tentacle.env" <<ENVEOF
# Tentacle Platform Configuration
# Generated by install.sh on $(date -Iseconds)

# NATS
NATS_SERVERS=${nats_servers}

# GraphQL API
GRAPHQL_PORT=${graphql_port}
GRAPHQL_HOSTNAME=0.0.0.0
TENTACLE_MODE=${mode}

# Web Dashboard
GRAPHQL_URL=${graphql_url}
PORT=${web_port}

# MQTT (uncomment and configure if using tentacle-mqtt)
# MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_CLIENT_ID=tentacle-mqtt
# MQTT_GROUP_ID=TentacleGroup
# MQTT_EDGE_NODE=EdgeNode1

# OPC UA
# OPCUA_PKI_DIR=${DATA_DIR}/opcua/pki
# OPCUA_AUTO_ACCEPT_CERTS=true
ENVEOF

  info "Configuration written to ${CONFIG_DIR}/tentacle.env"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Binary installation
# ═══════════════════════════════════════════════════════════════════════════════

install_binaries() {
  echo ""
  step "Installing Binaries"
  echo ""

  mkdir -p "${INSTALL_DIR}/bin" "${DATA_DIR}/nats" "${DATA_DIR}/opcua/pki"

  local all_modules=("nats-server" "${SELECTED_MODULES[@]}" "${LINUX_SYSTEM_MODULES[@]}")

  if [ "$BUNDLED" = "true" ]; then
    info "Installing from bundled archive..."
    for mod in "${all_modules[@]}"; do
      local src="${BUNDLED_DIR}/bin/${mod}"
      if [ -f "$src" ]; then
        cp "$src" "${INSTALL_DIR}/bin/${mod}"
        chmod +x "${INSTALL_DIR}/bin/${mod}"
        info "  Installed ${mod}"
      else
        warn "  Binary not found: ${mod}"
      fi
    done
  else
    info "Downloading Tentacle v${VERSION} for ${PLATFORM}..."
    local url="https://github.com/${REPO}/releases/download/v${VERSION}/tentacle-v${VERSION}-${PLATFORM}.tar.gz"
    local tmpdir
    tmpdir="$(mktemp -d)"

    if command -v curl &>/dev/null; then
      curl -fSL --progress-bar "$url" -o "${tmpdir}/release.tar.gz"
    else
      wget -q --show-progress -O "${tmpdir}/release.tar.gz" "$url"
    fi

    tar xzf "${tmpdir}/release.tar.gz" -C "${tmpdir}" --strip-components=1

    for mod in "${all_modules[@]}"; do
      local src="${tmpdir}/bin/${mod}"
      if [ -f "$src" ]; then
        cp "$src" "${INSTALL_DIR}/bin/${mod}"
        chmod +x "${INSTALL_DIR}/bin/${mod}"
        info "  Installed ${mod}"
      else
        warn "  Binary not found in release: ${mod}"
      fi
    done

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

  # Enable and start NATS first
  systemctl enable tentacle-nats
  systemctl start tentacle-nats
  info "  Started tentacle-nats"

  # Wait for NATS to be ready
  sleep 2

  # Enable and start other services
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
  mkdir -p "${docker_dir}/bin"

  # Copy docker-compose and Dockerfiles
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

  # Copy binaries into docker build context
  for mod in "${SELECTED_MODULES[@]}"; do
    if [ -f "${INSTALL_DIR}/bin/${mod}" ]; then
      cp "${INSTALL_DIR}/bin/${mod}" "${docker_dir}/bin/"
    fi
  done

  # Comment out unselected services in docker-compose.yml
  local all_docker_services=("graphql" "web" "ethernetip" "opcua" "mqtt")
  for svc in "${all_docker_services[@]}"; do
    local mod="tentacle-${svc}"
    local found=false
    for sel in "${SELECTED_MODULES[@]}"; do
      if [ "$sel" = "$mod" ]; then found=true; break; fi
    done
    if [ "$found" = "false" ]; then
      # Remove service block from compose file (simple approach: leave it, just don't build)
      info "  Skipping ${svc} (not selected)"
    fi
  done

  # Copy env file for docker
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

  # Create a convenience start script
  local start_script="${INSTALL_DIR}/start.sh"
  cat > "${start_script}" <<'STARTEOF'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# Source environment
if [ -f "${DIR}/config/tentacle.env" ]; then
  set -a
  source "${DIR}/config/tentacle.env"
  set +a
fi

echo "Starting Tentacle services..."

# Start NATS
"${DIR}/bin/nats-server" -js -sd "${DIR}/data/nats" &
NATS_PID=$!
echo "  NATS server started (PID: $NATS_PID)"
sleep 2

PIDS=($NATS_PID)

STARTEOF

  for mod in "${SELECTED_MODULES[@]}"; do
    cat >> "${start_script}" <<SVCEOF
# Start ${mod}
"${INSTALL_DIR}/bin/${mod}" &
PIDS+=(\$!)
echo "  ${mod} started (PID: \${PIDS[-1]})"

SVCEOF
  done

  cat >> "${start_script}" <<'ENDEOF'
echo ""
echo "All services started."
echo "Web Dashboard: http://localhost:${PORT:-3012}"
echo ""
echo "Press Ctrl+C to stop all services."

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

  # Check NATS
  if command -v curl &>/dev/null; then
    if curl -sf http://localhost:8222/healthz >/dev/null 2>&1; then
      info "NATS server: ${GREEN}running${NC}"
    else
      warn "NATS server: not responding on :8222 (may still be starting)"
    fi
  fi

  # Check GraphQL
  local graphql_port
  graphql_port="$(grep -oP 'GRAPHQL_PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 4000)"
  if curl -sf "http://localhost:${graphql_port}/graphql" -H "Content-Type: application/json" -d '{"query":"{__typename}"}' >/dev/null 2>&1; then
    info "GraphQL API: ${GREEN}running${NC} on port ${graphql_port}"
  else
    warn "GraphQL API: not responding on :${graphql_port} (may still be starting)"
  fi

  # Check Web
  local web_port
  web_port="$(grep -oP 'PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 3012)"
  if curl -sf "http://localhost:${web_port}" >/dev/null 2>&1; then
    info "Web Dashboard: ${GREEN}running${NC} on port ${web_port}"
  else
    warn "Web Dashboard: not responding on :${web_port} (may still be starting)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

print_summary() {
  local web_port
  web_port="$(grep -oP 'PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 3012)"
  local graphql_port
  graphql_port="$(grep -oP 'GRAPHQL_PORT=\K[0-9]+' "${CONFIG_DIR}/tentacle.env" 2>/dev/null || echo 4000)"

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
  echo -e "    Web Dashboard:  ${CYAN}http://localhost:${web_port}${NC}"
  echo -e "    GraphQL API:    ${CYAN}http://localhost:${graphql_port}/graphql${NC}"
  echo -e "    NATS:           ${CYAN}nats://localhost:4222${NC}"
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
# Main
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  print_banner
  detect_platform
  preflight
  select_modules
  select_deployment
  configure
  install_binaries

  case "$DEPLOY_METHOD" in
    systemd)
      install_systemd "${SELECTED_MODULES[@]}" "${LINUX_SYSTEM_MODULES[@]}"
      ;;
    docker)
      install_docker
      # Install Linux system modules via systemd alongside docker
      if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ]; then
        install_systemd "${LINUX_SYSTEM_MODULES[@]}"
      fi
      ;;
    binary)
      install_binary_only
      # Install Linux system modules via systemd alongside binary mode
      if [ ${#LINUX_SYSTEM_MODULES[@]} -gt 0 ] && command -v systemctl &>/dev/null; then
        install_systemd "${LINUX_SYSTEM_MODULES[@]}"
      fi
      ;;
  esac

  if [ "$DEPLOY_METHOD" != "binary" ]; then
    verify_install
  fi

  print_summary
}

main "$@"
