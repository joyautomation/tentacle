import type { SparkplugNode } from "@joyautomation/synapse";

/**
 * MQTT connection configuration.
 *
 * @property {boolean} enabled - Whether the connection is enabled
 * @property {string} name - Connection name
 * @property {string} description - Connection description
 * @property {string} serverUrl - MQTT server URL
 * @property {string} groupId - Group ID
 * @property {string} nodeId - Node ID
 * @property {string} deviceId - Device ID
 * @property {string} clientId - Client ID
 * @property {string} username - Username
 * @property {string} password - Password
 * @property {"spBv1.0"} [version] - Version
 */
export type MqttConnection = {
  enabled: boolean;
  name: string;
  description: string;
  serverUrl: string;
  groupId: string;
  nodeId: string;
  deviceId: string;
  clientId: string;
  username: string;
  password: string;
  version?: "spBv1.0";
};

export type MqttConnectionRuntime = MqttConnection & {
  client: SparkplugNode;
}
  
export type PlcMqtts = Record<string, MqttConnection>;

export type PlcVariableMqttSource<M extends PlcMqtts> = {
  id:
    & keyof { [K in keyof M]: M[K] extends MqttConnection ? K : never }
    & {
      [K in keyof M]: M[K] extends MqttConnection ? K : never;
    }[keyof M];
  type: "mqtt";
  topic: string;
  onResponse?: (value: number | boolean) => number | boolean;
}

export type PlcVariableMqttSourceRuntime<M extends PlcMqtts> = PlcVariableMqttSource<M> & {
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
    timestamp: Date;
  } | null;
}

/**
 * Mixin for types that have a Modbus source.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableMqttSource<S>} source - MQTT source configuration
 * @public
 */
export type WithMqttSource<M extends PlcMqtts> = {
  source: PlcVariableMqttSource<M>;
};

export type WithMqttSourceRuntime<M extends PlcMqtts> = WithMqttSource<M>;
  
export const isSourceMqtt = (source: unknown): source is MqttConnection =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "mqtt";