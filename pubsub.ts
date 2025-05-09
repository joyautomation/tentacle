import { createPubSub } from "graphql-yoga";

export const pubsub = createPubSub();

// Rate limiting state
const lastPublished: Record<string, number> = {};
const rateLimit = Deno.env.get("TENTACLE_PUBSUB_RATE_LIMIT") || 1000; // Default to 1 second

/**
 * Rate-limited version of pubsub.publish that will skip publishing if the same topic
 * was published to recently.
 * 
 * @param topic - The topic to publish to
 * @param payload - The data to publish
 * @returns The result of pubsub.publish if the rate limit allows, otherwise undefined
 */
export function rateLimitedPublish(topic: string, payload: unknown) {
  const now = performance.now();
  const lastTime = lastPublished[topic] || 0;
  
  // Skip if we've published too recently
  if (now - lastTime < Number(rateLimit)) {
    return;
  }
  
  // Update last published time and send the event
  lastPublished[topic] = now;
  return pubsub.publish(topic, payload);
}
