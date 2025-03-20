import {
  createErrorString,
  createFail,
  createSuccess,
  isSuccess,
  Result,
} from "@joyautomation/dark-matter";
import { logs } from "./log.ts";
const { main: log } = logs;

import { createClient } from "redis";
import {
  PlcVariableRuntime,
  PlcVariables,
  PlcVariablesRuntime,
} from "./types/variables.ts";
import { PlcSources } from "./types/sources.ts";
import { PlcConfig } from "./types/types.ts";

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
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
) {
  const redisUrlResult = validateRedisUrl(config.redisUrl);
  if (isSuccess(redisUrlResult)) {
    log.debug("redis url config valid: ", redisUrlResult.output);
    return redisUrlResult.output;
  }
  log.debug('using default redis url: "redis://localhost:6379"');
  return "redis://localhost:6379";
}

export async function getPublisher<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
) {
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
      `Failed to connect to Redis at ${url}: ${createErrorString(e)}`,
    );
  }
}

export async function getPublisherRetry<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
  maxRetries: number,
  delay: number,
) {
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
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
) {
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
      `Failed to connect to Redis at ${url}: ${createErrorString(e)}`,
    );
  }
}

export async function getSubscriberRetry<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
  maxRetries: number,
  delay: number,
) {
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
  onMessage: (key: string, topic: string) => void,
) {
  const keyPattern = "__keyevent@0__:*"; // Subscribe to all key events
  subscriber.pSubscribe(keyPattern, onMessage);
}

export async function publish(
  publisher: ReturnType<typeof createClient>,
  key: string,
  value: string,
  ttl?: number,
) {
  await publisher.set(key, value);
  if (ttl) {
    await publisher.expire(key, ttl);
  }
}

export async function publishVariable<S extends PlcSources>(
  publisher: ReturnType<typeof createClient>,
  variable: PlcVariableRuntime<S>,
) {
  const valueString = JSON.stringify(variable.value);
  await publish(publisher, variable.id, valueString);
}

export async function publishVariables<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  publisher: ReturnType<typeof createClient>,
  variables: PlcVariablesRuntime<S, V>,
) {
  const keyValuePairs = Object.values(variables).flatMap(
    (
      variable: PlcVariableRuntime<S>,
    ) => [variable.id, JSON.stringify(variable.value)],
  );
  if (keyValuePairs.length > 0) {
    await publisher.mSet(keyValuePairs);
  }
}

export async function getAllValues(redis: ReturnType<typeof createClient>) {
  const keys = await redis.keys("*");
  const values = await redis.mGet(keys);
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
}

export async function setVariableValuesFromRedis<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  redis: ReturnType<typeof createClient>,
  variables: PlcVariablesRuntime<S, V>,
) {
  const values = await getAllValues(redis);
  Object.entries(variables).forEach(([key, variable]) => {
    variable.value = values[key]
      ? JSON.parse(values[key])
      : variable.default || null;
  });
}
