import type { ResultFail } from "@joyautomation/dark-matter";
import type EventEmitter from "node:events";
import type { createClient } from "redis";

export type Redis = {
  id: string;
  publisher: ReturnType<typeof createClient>;
  subscriber: ReturnType<typeof createClient>;
  states: {
    connected: boolean;
    disconnected: boolean;
    errored: boolean;
  };
  events: EventEmitter;
  lastError:
    | (Omit<ResultFail, "success"> & {
        timestamp: Date;
      })
    | null;
  retryTimeout: number | null;
  retryCount: number;
  retryMinDelay: number;
  retryMaxDelay: number;
};

export type RedisCreateInput = {
  id: string;
  redisUrl: string;
  retryMinDelay: number;
  retryMaxDelay: number;
};

export type RedisTransition = "connect" | "disconnect" | "fail";
