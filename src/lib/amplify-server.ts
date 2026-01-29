import "server-only";

import { Amplify } from "aws-amplify";
import amplifyconfig from "../../amplify_outputs.json";
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../amplify/data/resource";

// Ensure Amplify is configured for SSR/server actions.
Amplify.configure(amplifyconfig, { ssr: true });

function safeJson(value: unknown, maxLen: number): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  } catch {
    return "[unserializable]";
  }
}

function createTracedAmplifyClient<T extends { models: Record<string, any> }>(client: T): T {
  // Only trace in Node (server) and only when explicitly enabled.
  const enabled =
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.AMPLIFY_TRACE === "1";
  if (!enabled) return client;

  const modelProxyCache = new Map<string, any>();

  const modelsProxy = new Proxy(client.models, {
    get(modelsTarget, modelName: string) {
      const name = String(modelName);
      if (modelProxyCache.has(name)) return modelProxyCache.get(name);

      const modelClient = (modelsTarget as any)[modelName];
      if (!modelClient || typeof modelClient !== "object") return modelClient;

      const proxiedModel = new Proxy(modelClient, {
        get(target, propKey: string) {
          const prop = String(propKey);
          const orig = (target as any)[propKey];
          if (typeof orig !== "function") return orig;

          // Wrap common Amplify Data operations; leave everything else untouched.
          const shouldWrap =
            prop === "list" ||
            prop === "get" ||
            prop === "create" ||
            prop === "update" ||
            prop === "delete";
          if (!shouldWrap) return orig;

          return async (...args: any[]) => {
            const started = Date.now();
            try {
              return await orig(...args);
            } finally {
              const elapsed = Date.now() - started;
              const argsPreview = args.length ? safeJson(args[0], 600) : "";
              console.log(
                `[amplify] ${name}.${prop} ${elapsed}ms${argsPreview ? " " + argsPreview : ""}`
              );
            }
          };
        },
      });

      modelProxyCache.set(name, proxiedModel);
      return proxiedModel;
    },
  });

  return new Proxy(client, {
    get(target, propKey: string) {
      if (propKey === "models") return modelsProxy;
      return (target as any)[propKey];
    },
  });
}

// Use IAM auth (non-expiring) so we do not depend on API keys.
export const amplifyClient = createTracedAmplifyClient(generateClient<Schema>({ authMode: "iam" }));
