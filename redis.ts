import {
  createErrorString,
  createFail,
  createSuccess,
  isSuccess,
  type Result,
} from "@joyautomation/dark-matter";
import { logs } from "./log.ts";
const { main: log } = logs;

import { createClient } from "redis";
import type {
  PlcVariableRuntime,
  PlcVariables,
  PlcVariablesRuntime,
} from "./types/variables.ts";
import type { PlcSourceRuntime, PlcSources } from "./types/sources.ts";
import type { PlcConfig } from "./types/types.ts";
import type { PlcMqtts } from "./types/mqtt.ts";

let publisher: ReturnType<typeof createClient> | undefined;
let subscriber: ReturnType<typeof createClient> | undefined;

export function validateRedisUrl(url: string | undefined): Result<string> {
  if (!url) return createFail("Invalid URL");
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "redis:" || parsedUrl.protocol === "rediss:") {
      return createSuccess(url);
    } else {
      return createFail("Invalid protocol");
    }
  } catch (e) {
    return createFail(createErrorString(e));
  }
}

function createRedisConnectionString<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>) {
  const redisUrlResult = validateRedisUrl(config.redisUrl);
  if (isSuccess(redisUrlResult)) {
    log.debug("redis url config valid: ", redisUrlResult.output);
    return redisUrlResult.output;
  }
  log.debug('using default redis url: "redis://localhost:6379"');
  return "redis://localhost:6379";
}

export async function getPublisher<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>) {
  const url = createRedisConnectionString(config);
  try {
    if (!publisher) {
      publisher = createClient({ url });
      await publisher.connect();
      log.info(`Publisher connected to Redis at ${url}`);
    }
    return createSuccess(publisher);
  } catch (e) {
    publisher = undefined;
    return createFail(
      `Failed to connect to Redis at ${url}: ${createErrorString(e)}`
    );
  }
}

export async function getPublisherRetry<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>, maxRetries: number, delay: number) {
  let retries = 0;
  while (retries < maxRetries) {
    const publisherResult = await getPublisher(config);
    if (isSuccess(publisherResult)) {
      return publisherResult;
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return createFail(`Failed to connect to Redis after ${maxRetries} retries`);
}

export async function getSubscriber<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>) {
  const url = createRedisConnectionString(config);
  try {
    if (!subscriber) {
      subscriber = createClient({ url });
      await subscriber.connect();
      subscriber.configSet("notify-keyspace-events", "KEA");
      log.info(`Subscriber connected to Redis at ${url}`);
    }
    return createSuccess(subscriber);
  } catch (e) {
    subscriber = undefined;
    return createFail(
      `Failed to connect to Redis at ${url}: ${createErrorString(e)}`
    );
  }
}

export async function getSubscriberRetry<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>, maxRetries: number, delay: number) {
  let retries = 0;
  while (retries < maxRetries) {
    const subscriberResult = await getSubscriber(config);
    if (isSuccess(subscriberResult)) {
      return subscriberResult;
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return createFail(`Failed to connect to Redis after ${maxRetries} retries`);
}

export function subscribeToKeys(
  subscriber: ReturnType<typeof createClient>,
  onMessage: (key: string, topic: string) => void
) {
  const keyPattern = "__keyevent@0__:*"; // Subscribe to all key events
  subscriber.pSubscribe(keyPattern, onMessage);
}

export async function publish(
  publisher: ReturnType<typeof createClient>,
  key: string,
  value: string,
  ttl?: number
) {
  await publisher.set(key, value);
  if (ttl) {
    await publisher.expire(key, ttl);
  }
}

export async function publishVariable<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  publisher: ReturnType<typeof createClient>,
  variable: PlcVariableRuntime<M, S>
) {
  const valueString = JSON.stringify(variable.value);
  await publish(publisher, `plc.variables.${variable.id}`, valueString);
}

let lastPublished = performance.now();
const rateLimit = Deno.env.get("TENTACLE_REDIS_RATE_LIMIT") || 1000;

export function publishVariables<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  publisher: ReturnType<typeof createClient>,
  variables: PlcVariablesRuntime<M, S, V>
) {
  const now = performance.now();
  if (now - lastPublished < Number(rateLimit)) return;
  lastPublished = now;
  const keyValuePairs = Object.values(variables).flatMap(
    (variable: PlcVariableRuntime<M, S>) => [
      `plc.variables.${variable.id}`,
      JSON.stringify(variable.value),
    ]
  );
  if (keyValuePairs.length > 0) {
    publisher.mSet(keyValuePairs);
  }
}

export async function getAllValues(redis: ReturnType<typeof createClient>) {
  const keys = await redis.keys("plc.variables.*");
  if (keys.length === 0) return {};
  const values = await redis.mGet(keys);
  return Object.fromEntries(
    keys.map((key, index) => [key.replace("plc.variables.", ""), values[index]])
  );
}

export async function setVariableValuesFromRedis<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  redis: ReturnType<typeof createClient>,
  variables: PlcVariablesRuntime<M, S, V>
) {
  const values = await getAllValues(redis);
  Object.entries(variables).forEach(([key, variable]) => {
    const value = values[key] ? JSON.parse(values[key]) : null;
    if (value != null) {
      variable.value = value;
    } else {
      variable.value = variable.default != null ? variable.default : null;
    }
  });
}

export async function getSourceEnablesFromRedis(
  redis: ReturnType<typeof createClient>
) {
  const keys = await redis.keys("plc.sources.*");
  if (keys.length === 0) return {};
  const values = await redis.mGet(keys);
  return Object.fromEntries(
    keys.map((key, index) => [key.replace("plc.sources.", ""), values[index]])
  );
}

export async function setSourceEnable(
  publisher: ReturnType<typeof createClient>,
  source: PlcSourceRuntime,
  enable: boolean
) {
  await publisher.set(
    `plc.sources.${source.id}.enable`,
    enable ? "true" : "false"
  );
}
