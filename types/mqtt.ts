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

/**
 * Runtime representation of an MQTT connection with an active client.
 * 
 * @extends MqttConnection
 */
export type MqttConnectionRuntime = MqttConnection & {
  /** The active SparkplugNode client instance */
  client: SparkplugNode;
};

/**
 * Record of MQTT connections indexed by their IDs.
 */
export type PlcMqtts = Record<string, MqttConnection>;

/**
 * Configuration for an MQTT-based variable source.
 * 
 * @template M - Type extending PlcMqtts
 */
export type PlcVariableMqttSource<M extends PlcMqtts> = {
  /** The ID of the MQTT connection to use */
  id:
    & keyof { [K in keyof M]: M[K] extends MqttConnection ? K : never }
    & {
      [K in keyof M]: M[K] extends MqttConnection ? K : never;
    }[keyof M];
  /** The type identifier for MQTT sources */
  type: "mqtt";
  /** The MQTT topic to subscribe to */
  topic: string;
  /** Optional callback to transform the received value */
  onResponse?: (value: number | boolean) => number | boolean;
};

/**
 * Runtime representation of an MQTT-based variable source.
 * 
 * @template M - Type extending PlcMqtts
 */
export type PlcVariableMqttSourceRuntime<M extends PlcMqtts> =
  & PlcVariableMqttSource<M>
  & {
    /** Error information if the source encountered an error */
    error: {
      error: string | null;
      message?: string | null;
      stack?: string | null;
      timestamp: Date;
    } | null;
  };

/**
 * Mixin for types that have an MQTT source.
 *
 * @template M - Type extending PlcMqtts
 */
export type WithMqttSource<M extends PlcMqtts> = {
  /** The MQTT source configuration */
  source: PlcVariableMqttSource<M>;
};

/**
 * Runtime mixin for types that have an MQTT source.
 *
 * @template M - Type extending PlcMqtts
 */
export type WithMqttSourceRuntime<M extends PlcMqtts> = WithMqttSource<M>;

/**
 * Type guard function that checks if a given source is an MQTT connection.
 * 
 * @param {unknown} source - The source object to check
 * @returns {source is MqttConnection} - Returns true if the source is a valid MQTT connection, false otherwise
 * 
 * @description
 * This function performs runtime type checking to verify if an object matches the structure
 * of an MQTT connection. It checks for the presence of the type property and validates
 * that it equals "mqtt".
 */
export const isSourceMqtt = (source: unknown): source is MqttConnection =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "mqtt";

/**
 * Type guard function that checks if a given source is a PlcVariableMqttSourceRuntime.
 * 
 * @template M - Type extending PlcMqtts
 * @param {unknown} source - The source object to check
 * @returns {source is PlcVariableMqttSourceRuntime<M>} - Returns true if the source is a valid PlcVariableMqttSourceRuntime, false otherwise
 * 
 * @description
 * This function performs runtime type checking to verify if an object matches the structure
 * of a PlcVariableMqttSourceRuntime. It checks for the presence of required properties
 * and validates that the type property equals "mqtt".
 */
export const isVariableMqttSourceRuntime = <M extends PlcMqtts>(
  source: unknown,
): source is PlcVariableMqttSourceRuntime<M> => {
  if (
    typeof source === "object" &&
    source !== null &&
    "type" in source &&
    "id" in source &&
    "topic" in source &&
    "onResponse" in source
  ) {
    const { type } = source as {
      type: string;
    };
    return type === "mqtt";
  }
  return false;
};
