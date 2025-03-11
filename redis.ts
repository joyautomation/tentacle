import { Args } from "@std/cli";
import {
  isSuccess,
  createErrorString,
  createFail,
  createSuccess,
  Result,
} from "@joyautomation/dark-matter";
import { logs } from "./log.ts";
const { main: log } = logs;

import { createClient } from "redis";

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

function createRedisConnectionString(args: Args) {
  const argsRedisUrlResult = validateRedisUrl(args["redis-url"]);
  if (isSuccess(argsRedisUrlResult)) {
    log.debug("redis url arg valid: ", argsRedisUrlResult.output);
    return argsRedisUrlResult.output;
  } else {
    log.debug("redis url arg invalid: ", argsRedisUrlResult.error);
  }
  const mantleRedisUrlResult = validateRedisUrl(
    Deno.env.get("MANTLE_REDIS_URL")
  );
  if (isSuccess(mantleRedisUrlResult)) {
    log.debug(
      "redis url environment variable valid: ",
      mantleRedisUrlResult.output
    );
    return mantleRedisUrlResult.output;
  } else {
    log.debug(
      "redis url environment variable invalid: ",
      mantleRedisUrlResult.error
    );
  }
  log.debug('using default redis url: "redis://localhost:6379"');
  return "redis://localhost:6379";
}

export async function getPublisher(args: Args) {
  const url = createRedisConnectionString(args);
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

export async function getPublisherRetry(
  args: Args,
  maxRetries: number,
  delay: number
) {
  let retries = 0;
  while (retries < maxRetries) {
    const publisherResult = await getPublisher(args);
    if (isSuccess(publisherResult)) {
      return publisherResult;
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return createFail(`Failed to connect to Redis after ${maxRetries} retries`);
}

export async function getSubscriber(args: Args) {
  const url = createRedisConnectionString(args);
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

export async function getSubscriberRetry(
  args: Args,
  maxRetries: number,
  delay: number
) {
  let retries = 0;
  while (retries < maxRetries) {
    const subscriberResult = await getSubscriber(args);
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
