# Tentacle

A modern PLC (Programmable Logic Controller) implementation in TypeScript/Deno with support for Modbus, OPC UA, and Sparkplug MQTT protocols.

## Features

- 🔌 Multi-protocol support:
  - Modbus TCP/IP
  - OPC UA
  - Sparkplug MQTT
- 🚀 Built with TypeScript and Deno for type safety and modern development
- 📊 GraphQL API for easy integration
- ⚡ High-performance asynchronous I/O
- 🔄 Automatic reconnection handling
- 📝 Comprehensive logging and error handling

## Installation

```bash
# Add to your deps.ts or import_map.json
import * as tentacle from "joyautomation/tentacle@$VERSION";
```

## Quick Start

Here's a simple example that creates a PLC with Modbus and MQTT:

```typescript
import { createPlc } from "joyautomation/tentacle";

// Define your PLC configuration
const config = {
  tasks: {
    readModbus: {
      interval: 1000, // Run every second
      variables: ["temperature", "pressure"],
    },
  },
  variables: {
    temperature: {
      source: {
        type: "modbus",
        register: 40001,
        registerType: "HOLDING_REGISTER",
        format: "FLOAT32",
      },
    },
    pressure: {
      source: {
        type: "modbus",
        register: 40003,
        registerType: "HOLDING_REGISTER",
        format: "FLOAT32",
      },
    },
  },
  mqtt: {
    main: {
      serverUrl: "mqtt://localhost:1883",
      groupId: "Sparkplug B/Group",
      edgeNode: "Node1",
      clientId: "tentacle-plc1",
    },
  },
  sources: {
    modbus1: {
      type: "modbus",
      host: "192.168.1.100",
      port: 502,
      unitId: 1,
    },
  },
};

// Create and start the PLC
const plc = await createPlc(config);

// Access the GraphQL API
const server = await createGraphQLServer(plc);
server.listen(4000);
```

## GraphQL API

The PLC exposes a GraphQL API for monitoring and control. Here are some example queries:

```graphql
# Get PLC status
query {
  plc {
    runtime {
      tasks {
        name
        lastRun
        nextRun
        error
      }
      variables {
        name
        value
        quality
        timestamp
      }
      mqtt {
        connected
        lastMessageSent
      }
      sources {
        name
        connected
        error
      }
    }
  }
}
```

## Configuration

### Tasks

Tasks are periodic operations that read or write variables:

```typescript
tasks: {
  name: string;
  interval: number;
  variables: string[];
  enabled?: boolean;
}
```

### Variables

Variables represent data points that can be read from or written to sources:

```typescript
variables: {
  name: string;
  source: {
    type: "modbus" | "opcua";
    // Modbus-specific config
    register?: number;
    registerType?: ModbusRegisterType;
    format?: ModbusFormat;
    // OPC UA-specific config
    nodeId?: string;
  };
}
```

### Sources

Sources define the connections to external systems:

```typescript
sources: {
  name: string;
  type: "modbus" | "opcua";
  // Modbus-specific config
  host?: string;
  port?: number;
  unitId?: number;
  // OPC UA-specific config
  endpointUrl?: string;
}
```

## Error Handling

Tentacle uses the Result type from @joyautomation/dark-matter for consistent error handling:

```typescript
import { type Result } from "@joyautomation/dark-matter";

const result = await plc.writeVariable("temperature", 23.5);
if (!result.success) {
  console.error(`Failed to write: ${result.error}`);
}
```

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
