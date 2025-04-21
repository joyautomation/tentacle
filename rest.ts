import {
  createErrorProperties,
  createFail,
  createSuccess,
} from "@joyautomation/dark-matter";

export const sendRestRequest = async (
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  headers: Record<string, string>,
  body: string | ((value: number) => string),
  timeout: number,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET"
        ? (typeof body === "string" ? body : undefined)
        : undefined,
      signal: controller.signal,
    }).then((response) => {
      return response.json();
    });
    clearTimeout(timeoutId);
    return createSuccess(response);
  } catch (error) {
    clearTimeout(timeoutId);
    return createFail(createErrorProperties(error));
  }
};
