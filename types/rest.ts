export type RestSource = {
  type: "rest";
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers: Record<string, string>;
  body: string | (() => string);
  timeout: number;
}
