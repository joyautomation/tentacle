# Tentacle UX & DX Analysis

Analysis date: 2026-03-26

---

## Part 1: Web UX (tentacle-web)

### What's Working Well

- **D3 topology as homepage** is immediately orienting — you see the whole system at a glance
- **Heartbeat-driven discovery** means zero manual registration; services just appear
- **Tab-based service detail pages** are a clean information hierarchy
- **Real-time log streaming** with level filters is a strong ops feature
- **Store & Forward visualization** (arc gauge, timeline, drain progress) is polished
- **Theme switching** (system/light/dark) is table-stakes done right
- **Mode badge** (dev/docker/systemd/kubernetes) is a smart affordance for multi-environment awareness

### UX Improvement Suggestions

#### 1. Navigation & Wayfinding

**No global navigation menu.** The header has a logo, mode badge, and theme switch — but no way to navigate except clicking topology nodes or using browser back. A systems integrator with 10+ services running needs quick access to any service without returning to topology every time.

*Suggestion:* Add a lightweight sidebar or dropdown menu listing all discovered services, grouped by type (Scanners, Bridges, Core). Collapsible on mobile. The topology remains the home/overview, but the menu provides direct access.

**Breadcrumbs are shallow.** Currently just "Topology / ServiceName". Deeper pages (e.g., a specific device's variables) don't extend the breadcrumb trail.

*Suggestion:* Extend breadcrumbs to reflect the full path: Topology > EtherNet/IP > Device-10.0.0.1 > Variables. Make each segment clickable.

#### 2. Empty States & Onboarding

**No first-run experience.** A fresh install shows an empty topology with just NATS + GraphQL + Web nodes. There's no guidance on what to do next — connect a scanner, create a PLC project, configure MQTT, etc.

*Suggestion:* Add a "Getting Started" card or checklist that appears when no scanners/bridges are detected. Steps like: "1. Enable a protocol scanner 2. Configure a device 3. Create a PLC project". Dismiss-able, stored in localStorage.

**Empty variable/device pages are terse.** Example: "No variables being polled. Start a PLC project to see variables here." This tells you *what's missing* but not *how to fix it*.

*Suggestion:* Link directly to the relevant action or docs. "No variables being polled. [Create a PLC project →] or [Browse available tags →]"

#### 3. Status & Health Indicators

**Service health is binary.** Services are either present (heartbeat) or gone (60s TTL expires). There's no indication of degraded state — high latency, error rate, reconnecting, etc.

*Suggestion:* Add health metadata to heartbeats (uptime, error count, last error, connection status). Display as colored dot on topology nodes and service overview: green/yellow/red. Even a simple "last restarted 2m ago" is useful.

**No system-wide status summary.** You have to visually scan the topology to notice a missing or disabled service.

*Suggestion:* Add a compact status bar or badge count in the header: "8/10 services online" with a dropdown showing which are down/disabled. Alerts for services that disappear unexpectedly.

#### 4. Variable Management

**Variable browsing is visualization-heavy but interaction-light.** The tree/sunburst views are great for exploring structure, but the workflow for *selecting* variables (for PLC projects, MQTT publishing, history recording) is disconnected from the browse experience.

*Suggestion:* Add inline actions to the variable browser: "Add to PLC project", "Enable history", "View in MQTT". Checkbox multi-select for bulk operations. This connects exploration to action.

**No variable search.** With hundreds of PLC tags, scanning a tree is slow.

*Suggestion:* Add a search/filter input above the variable tree that filters by name, path, or datatype. Highlight matches in the tree.

#### 5. MQTT Settings UX

**MQTT settings page is a flat form.** All config fields listed vertically with section headings. For a systems integrator configuring multiple edge nodes, this is fine but could be streamlined.

*Suggestion:* Add a "Test Connection" button that validates the broker URL, credentials, and Sparkplug group/node before saving. Show connection status inline (connected/refused/timeout). This prevents save-then-debug cycles.

#### 6. Log Viewer

**Log viewer caps at 500 lines with no persistence.** If you navigate away, logs are lost. For debugging intermittent issues, this is limiting.

*Suggestions:*
- Add a "Download logs" button that exports the current buffer as a text file
- Add a search/filter within the log viewer (filter by message content, not just level)
- Consider a "pause" button to freeze auto-scroll for reading

#### 7. Feedback & Confirmation

**Mutations have minimal confirmation.** Save buttons disable during request and show a toast on success/failure, but there's no undo or confirmation for destructive actions.

*Suggestion:* Add confirmation dialogs for destructive operations: disabling a service, removing a variable, deleting a device. Toast notifications are appropriate for success; modals for "are you sure?"

#### 8. Responsive & Mobile

**Tab navigation can overflow on narrow screens.** Services with many tabs (PLC: Config, Variables, Logs; MQTT: Overview, Metrics, Settings, Logs) will push tabs off-screen.

*Suggestion:* Use a scrollable tab bar with overflow indicators, or collapse to a dropdown on narrow viewports. The StoreForward component already has a 640px breakpoint — apply similar patterns to tabs.

#### 9. Accessibility

**Color is sometimes the only differentiator.** Topology node types, log levels, and status indicators rely heavily on color.

*Suggestions:*
- Add shape differentiation to topology nodes (circle=scanner, square=bridge, diamond=core)
- Ensure log level badges have text labels (they do) — this is already good
- Add `aria-label` attributes to interactive D3 elements (nodes, links) for screen readers
- Add `role="status"` or `aria-live` regions for real-time updates (service count, connection status)

#### 10. Performance & Perceived Speed

**Home page polls every 5 seconds with fingerprinting.** This is reasonable, but the initial load can feel slow if many services are running.

*Suggestion:* Show a skeleton/shimmer state for the topology while the first data load completes. Currently the page just shows the header until data arrives.

---

## Part 2: Deployment & DX (Systems Integrator Experience)

### What's Working Well

- **`install.sh` self-extracting installer** with interactive module selection is excellent for edge deployments
- **`dev.sh` multi-service orchestrator** makes local dev a single command
- **Incus container provisioning** (`container-setup.sh`) gives isolated dev environments
- **Heartbeat-driven discovery** eliminates manual service wiring
- **`release.sh` coordinated releases** handle the dependency graph correctly
- **systemd integration** with proper `After=` dependencies and shared env file
- **Modular optional services** — core always installs, scanners are opt-in

### DX Improvement Suggestions

#### 1. First-Time Setup Documentation

**README exists but is sparse on prerequisites.** A systems integrator downloading the installer needs to know: What OS versions are supported? What hardware? How much RAM/disk? What network access is needed?

*Suggestion:* Add a "Requirements" section to the top-level README:
- Supported OS: Ubuntu 22.04+, Debian 12+ (others?)
- Minimum hardware: 1 CPU, 512MB RAM (core), 1GB+ with all scanners
- Network: outbound for MQTT broker, inbound 3012 (web), 4000 (API), 4222 (NATS)
- Optional: PostgreSQL/TimescaleDB for history, libplctag for EtherNet/IP

#### 2. Post-Install Configuration

**After install, configuration requires editing `/opt/tentacle/config/tentacle.env`.** This is a manual text-file edit on a potentially headless edge device. A systems integrator deploying 50 nodes needs a better story.

*Suggestions:*
- Add a **first-run web wizard** at `http://<ip>:3012/setup` that walks through: NATS confirmation, scanner config (device IPs, OIDs, tag paths), MQTT broker connection, and generates the env file. Redirect to this page when no scanners are configured.
- Support **config file provisioning** via a `tentacle.yaml` that can be dropped alongside the installer for unattended deployments. The installer reads it instead of prompting interactively.
- Add `tentacle-cli` commands: `tentacle config set MQTT_BROKER_URL tcp://broker:1883`, `tentacle config show`, `tentacle status`. Wraps env file edits and systemctl calls.

#### 3. Upgrade Path

**No upgrade mechanism.** The installer creates fresh systemd units and copies binaries, but there's no `tentacle upgrade` or `install.sh --upgrade` that preserves config, data, and KV state.

*Suggestion:* Add an upgrade mode to install.sh that:
- Backs up `/opt/tentacle/config/` and `/opt/tentacle/data/`
- Stops services, replaces binaries/source, restarts services
- Preserves NATS JetStream data directory
- Validates version compatibility before proceeding

#### 4. Health Checks & Diagnostics

**No built-in health check or diagnostic command.** When a systems integrator calls support because "it's not working," there's no way to quickly gather system state.

*Suggestion:* Add a `tentacle doctor` or `tentacle diag` command that outputs:
- All service statuses (systemctl is-active)
- NATS connectivity check
- Port availability (3012, 4000, 4222)
- Recent errors from journalctl
- Disk/memory usage
- KV bucket health (service_heartbeats entries)
- Output as a shareable text file

#### 5. Multi-Node Deployment

**Each node is standalone.** There's no built-in way to manage a fleet of tentacle edge nodes from a central location.

*Suggestion (longer-term):* Consider a "tentacle fleet" concept where:
- A central management server (or cloud service) discovers edge nodes
- Config can be pushed to nodes remotely
- Status/health aggregated centrally
- Firmware/software updates rolled out in batches

In the near term, document recommended patterns for fleet management with existing tools (Ansible playbooks, docker-compose templates, Kubernetes DaemonSets).

#### 6. Docker Support

**Docker is listed as a deployment mode (mode badge exists) but no Dockerfiles are in the repo.** This is a gap for cloud-native deployments.

*Suggestion:* Add:
- `Dockerfile` per service (multi-stage build for Go services, Deno slim for Deno services)
- `docker-compose.yml` at root that brings up the full stack (NATS + core + optional scanners via profiles)
- Document which services need host network mode (for PLC scanning) vs bridge mode

#### 7. Secrets Management

**Credentials are in plain text in tentacle.env.** MQTT passwords, DB credentials, etc. are stored unencrypted on disk.

*Suggestion:*
- Support reading secrets from environment variables (already somewhat done)
- Document integration with systemd `LoadCredential=` or `EnvironmentFile=` with restricted permissions
- For docker: support Docker secrets or `.env` file with restrictive permissions
- At minimum, set file permissions on tentacle.env to `600` owned by the service user

#### 8. Logging & Observability

**Service logs go to systemd journal.** This is fine for single-node, but a systems integrator managing multiple nodes needs centralized logging.

*Suggestion:* Document integration patterns:
- journald → Promtail → Loki for centralized logging
- Add Prometheus metrics endpoint to tentacle-graphql (service count, variable count, message rates)
- Support structured JSON log output (coral logger may already do this) for log aggregation

#### 9. Backup & Restore

**No backup/restore tooling.** NATS KV state, PLC project configs, history data, and MQTT settings are all critical state that would be lost on a disk failure.

*Suggestion:* Add `tentacle backup` and `tentacle restore` commands that:
- Export NATS KV buckets to JSON files
- Dump tentacle.env
- Optionally dump TimescaleDB (pg_dump)
- Package into a timestamped archive
- Can be scheduled via cron

#### 10. Dev Environment Parity

**Dev environment (Incus container) doesn't perfectly match production (systemd installer).** Dev uses `dev.sh` with foreground processes; production uses systemd units with different env var resolution.

*Suggestion:*
- Add a `dev.sh --systemd` mode that generates and runs temporary systemd units locally, so developers can test the exact production service management behavior
- Or add a `Vagrantfile` / Incus profile that runs the actual installer, giving a "production-like" local environment for integration testing

---

## Priority Matrix

### Quick Wins (High impact, low effort)
1. Variable search/filter in browser
2. "Test Connection" button for MQTT settings
3. Download logs button
4. Skeleton loading state for topology
5. tentacle.env file permissions (chmod 600)
6. Requirements section in README

### Medium Effort, High Impact
1. Global navigation menu/sidebar
2. First-run onboarding checklist
3. `tentacle diag` diagnostic command
4. Upgrade mode in installer
5. Service health indicators beyond binary up/down
6. Confirmation dialogs for destructive actions

### Strategic (Longer-term)
1. First-run web setup wizard
2. Docker support (Dockerfiles + compose)
3. Fleet management / central dashboard
4. Backup/restore tooling
5. Prometheus metrics endpoint
6. Config provisioning file for unattended installs
