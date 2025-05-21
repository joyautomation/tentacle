import EventEmitter from "node:events";
import type { Redis, RedisCreateInput, RedisTransition } from "./types.ts";
import { createClient } from "redis";
import {
  createErrorProperties,
  createErrorString,
} from "@joyautomation/dark-matter";
import { logs } from "../log.ts";

export const _internals = {
  createClient,
};

const log = logs.main;

export const createRedisClient = (url: string) => {
  return createClient({ url });
};

export function createRedisSource(
  config: RedisCreateInput,
  initialState: RedisTransition = "connect"
): Promise<Redis> {
  const publisher = createRedisClient(config.redisUrl);
  const subscriber = createRedisClient(config.redisUrl);
  const redis = {
    ...config,
    publisher,
    subscriber,
    states: {
      connected: false,
      disconnected: true,
      errored: false,
    },
    events: new EventEmitter(),
    lastError: null,
    retryCount: 0,
    retryTimeout: null,
    retryMinDelay: config.retryMinDelay || 1000, // 1 second
    retryMaxDelay: config.retryMaxDelay || 60000, // 1 minute maximum delay
  };
  return initialState === "connect"
    ? connectRedis(redis)
    : Promise.resolve(redis);
}

export const getRedisStateString = (redis: Redis) => {
  if (redis.states.errored) {
    return "errored";
  } else if (redis.states.disconnected) {
    return "disconnected";
  } else if (redis.states.connected) {
    return "connected";
  } else {
    return `unknown state: ${JSON.stringify(redis.states)}`;
  }
};

export const setState = <U extends { states: T }, T>(
  state: Partial<T>,
  entity: U
): U => {
  entity.states = { ...entity.states, ...state };
  return entity;
};

export const setStateCurry =
  <U extends { states: T }, T>(state: Partial<T>) =>
  (entity: U): U =>
    setState(state, entity);

export const redisTransitions = {
  connect: async (redis: Redis) => {
    try {
      await redis.publisher.connect();
      await redis.subscriber.connect();
      setRedisStateConnected(redis);
      redis.events.emit("connect");
      return redis;
    } catch (error) {
      const errorProps = createErrorProperties(error);
      const message = `Error connecting to redis: ${errorProps.message}`;
      log.warn(message);
      return failRedis(redis, errorProps);
    }
  },
  disconnect: async (redis: Redis) => {
    await redis.publisher.disconnect();
    await redis.subscriber.disconnect();
    setRedisStateDisconnected(redis);
    redis.events.emit("disconnect");
    return redis;
  },
  fail: (redis: Redis) => {
    setRedisStateErrored(redis);
    onErrored(redis);
    return redis;
  },
};

const setRedisState = (state: Partial<Redis["states"]>, redis: Redis) => {
  redis.states = {
    connected: false,
    disconnected: false,
    errored: false,
    ...state,
  };
  return redis;
};

const setRedisStateConnected = (redis: Redis) => {
  redis.retryCount = 0;
  return setRedisState({ connected: true }, redis);
};

const setRedisStateDisconnected = (redis: Redis) => {
  return setRedisState({ disconnected: true }, redis);
};

const setRedisStateErrored = (redis: Redis) => {
  return setRedisState({ errored: true }, redis);
};

const onErrored = (redis: Redis) => {
  setRedisStateErrored(redis);
  if (redis.retryTimeout) {
    clearTimeout(redis.retryTimeout);
  }

  const currentRetry = redis.retryCount + 1;
  const delay = Math.min(
    redis.retryMinDelay * Math.pow(2, redis.retryCount),
    redis.retryMaxDelay
  );

  redis.retryTimeout = setTimeout(async () => {
    redis.retryCount = currentRetry;
    log.info(
      `Attempting reconnection (attempt ${currentRetry}, delay was: ${delay}ms)`
    );
    try {
      await connectRedis(redis);
    } catch (error) {
      log.warn(`Reconnection attempt failed: ${createErrorString(error)}`);
      // Recursively call setRedisStateErrored to continue retrying
      failRedis(redis, createErrorProperties(error));
    }
  }, delay);

  return redis;
};

async function changeRedisState(
  inRequiredState: (redis: Redis) => boolean,
  notInRequiredStateLogText: string,
  transition: RedisTransition,
  redis: Redis
) {
  if (!inRequiredState(redis)) {
    log.warn(
      `${notInRequiredStateLogText}, it is currently: ${getRedisStateString(
        redis
      )}`
    );
  } else {
    log.info(
      `Node ${
        redis.id
      } making ${transition} transition from ${getRedisStateString(redis)}`
    );
    await redisTransitions[transition](redis);
  }
  return redis;
}

const changeRedisStateCurry =
  (
    inRequiredState: (redis: Redis) => boolean,
    notInRequiredStateLogText: string,
    transition: RedisTransition
  ) =>
  (redis: Redis) =>
    changeRedisState(
      inRequiredState,
      notInRequiredStateLogText,
      transition,
      redis
    );

const connectRedis = changeRedisStateCurry(
  (redis: Redis) => redis.states.disconnected || redis.states.errored,
  "Redis needs to be disconnected or errored to be connected",
  "connect"
);

const disconnectRedis = changeRedisStateCurry(
  (redis: Redis) => redis.states.connected,
  "Redis needs to be connected to be disconnected",
  "disconnect"
);

/**
 * Errors a Sparkplug Modbus.
 * @param {Modbus} Modbus - The Sparkplug Modbus to error.
 * @returns {Modbus} The errored Modbus.
 */
export const failRedis = (
  redis: Redis,
  error: ReturnType<typeof createErrorProperties>
) => {
  redis.lastError = {
    ...error,
    timestamp: new Date(),
  };
  redis.events.emit("fail", error);
  return changeRedisStateCurry(
    () => true,
    "Redis can fail from any state",
    "fail"
  )(redis);
};
