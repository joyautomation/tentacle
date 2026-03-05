# Tentacle

Industrial automation platform built on [Deno](https://deno.land/) and [NATS](https://nats.io/). Connects PLCs and industrial devices to GraphQL, MQTT (Sparkplug B), and a real-time web dashboard.

## Architecture

```
                  ┌─────────────────────────────────────────────┐
                  │                  NATS Bus                   │
                  └──┬────────┬────────┬────────┬────────┬──────┘
                     │        │        │        │        │
              ┌──────┴──┐ ┌───┴────┐ ┌─┴──────┐ │   ┌────┴────┐
              │ GraphQL │ │  MQTT  │ │  Web   │ │   │   PLC   │
              │  API    │ │Sparkplug│ │Dashboard│ │   │ Runtime │
              └─────────┘ └────────┘ └────────┘ │   └─────────┘
                                                │
                     ┌──────────────────────────┤
                     │              │           │
              ┌──────┴──┐   ┌──────┴──┐  ┌─────┴───┐
              │  EIP    │   │ OPC UA  │  │ Modbus  │
              │ Scanner │   │ Client  │  │ Scanner │
              └────┬────┘   └────┬────┘  └────┬────┘
                   │             │            │
            Allen-Bradley    OPC UA       Modbus TCP
               PLCs          Servers       Devices
```

## Install

Download the latest release from [Releases](https://github.com/joyautomation/tentacle/releases):

```bash
# Linux (amd64)
curl -fSL https://github.com/joyautomation/tentacle/releases/latest/download/tentacle-v0.0.2-linux-amd64.run -o tentacle.run
chmod +x tentacle.run
sudo ./tentacle.run
```

The interactive installer lets you choose deployment mode (systemd, Docker, or binary-only), select which modules to enable, and optionally scaffold a PLC project.

## Create a PLC Project

After installing (or standalone with Deno):

```bash
deno run -A jsr:@joyautomation/create-tentacle-plc my-plc
cd my-plc
deno task dev
```

This creates a project with example variables, tasks, and NATS integration. See [tentacle-plc](https://github.com/joyautomation/tentacle-plc) for the full API.

## Services

| Service | Description | Runtime |
|---------|-------------|---------|
| [tentacle-graphql](https://github.com/joyautomation/tentacle-graphql) | GraphQL API with real-time subscriptions (SSE) | Deno |
| [tentacle-web](https://github.com/joyautomation/tentacle-web) | SvelteKit dashboard with topology view | Node.js |
| [tentacle-ethernetip](https://github.com/joyautomation/tentacle-ethernetip) | Allen-Bradley PLC scanner (EtherNet/IP) | Deno |
| [tentacle-opcua-go](https://github.com/joyautomation/tentacle-opcua-go) | OPC UA client | Go |
| [tentacle-modbus](https://github.com/joyautomation/tentacle-modbus) | Modbus TCP scanner with block reads | Deno |
| [tentacle-mqtt](https://github.com/joyautomation/tentacle-mqtt) | NATS to MQTT bridge (Sparkplug B) | Deno |
| [tentacle-network](https://github.com/joyautomation/tentacle-network) | Network interface monitoring (Linux) | Deno |
| [tentacle-nftables](https://github.com/joyautomation/tentacle-nftables) | Firewall and NAT management (Linux) | Deno |

## Libraries

| Package | Description | Registry |
|---------|-------------|----------|
| [tentacle-plc](https://github.com/joyautomation/tentacle-plc) | PLC runtime library for defining variables and tasks | [JSR](https://jsr.io/@joyautomation/tentacle-plc) |
| [tentacle-nats-schema](https://github.com/joyautomation/tentacle-nats-schema) | Shared NATS topic and message type definitions | [JSR](https://jsr.io/@joyautomation/tentacle-nats-schema) |
| [create-tentacle-plc](https://github.com/joyautomation/create-tentacle-plc) | Project scaffolding tool | [JSR](https://jsr.io/@joyautomation/create-tentacle-plc) |

## Documentation

See [tentacle-docs](https://github.com/joyautomation/tentacle-docs) for:
- [Architecture Overview](https://github.com/joyautomation/tentacle-docs/blob/main/architecture.md)
- [Getting Started](https://github.com/joyautomation/tentacle-docs/blob/main/getting-started.md)
- [Service Documentation](https://github.com/joyautomation/tentacle-docs/tree/main/services)
- [NATS Topics & KV](https://github.com/joyautomation/tentacle-docs/blob/main/protocols/nats.md)
- [Troubleshooting](https://github.com/joyautomation/tentacle-docs/blob/main/troubleshooting.md)

## Development

Clone all repos as siblings under a common directory, then use `dev.sh`:

```bash
./dev.sh        # Start all services with live reload
./dev.sh stop   # Stop all services
./dev.sh logs   # Tail all logs
```

Requires NATS running locally (`docker run -d --name nats -p 4222:4222 nats -js`).

## License

MIT
