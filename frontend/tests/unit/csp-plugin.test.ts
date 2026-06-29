import { describe, it, expect, vi } from "vitest";

// Importing the Vite config module pulls in `vite`, which would
// normally try to start a dev server. We avoid that by mocking the
// `vite` package to return a stub `defineConfig` that just returns
// whatever config object is passed in.
vi.mock("vite", () => ({
  defineConfig: (cfg: unknown) => cfg,
}));

// We DO want to exercise the real `injectCspPlugin` (the function
// defined inside vite.config.ts) and the real `buildCspPolicy` it
// depends on. We import them by re-requiring the config file after the
// mock is in place.
//
// Note: `vite.config.ts` imports from `vite-plugin-compression`,
// `@vitejs/plugin-react`, and `@tailwindcss/vite`. We don't mock them —
// they are only used at `defineConfig` call-time, and we never call
// `defineConfig` here. We just import the module for its side effects
// (registering `injectCspPlugin`). To do that without running
// `defineConfig`, we rely on the mock above.

import viteConfig from "@/../vite.config";

// `defineConfig` was mocked to be the identity function, so importing
// the config returns the raw config object. We need to extract the
// `injectCspPlugin` from `plugins[0]`. Since plugin objects are not
// exported, we exercise them via the public hooks instead.

type Plugin = {
  name: string;
  transformIndexHtml?:
    | ((args: {
        html: string;
        ctx: { server?: unknown; filename?: string; id?: string };
      }) => unknown)
    | {
        order?: string;
        handler: (args: {
          html: string;
          ctx: { server?: unknown; filename?: string; id?: string };
        }) => unknown;
      };
  configureServer?: (server: {
    middlewares: { use: (fn: (...args: unknown[]) => void) => void };
  }) => void;
};

function invokeTransform(
  plugin: Plugin,
  args: {
    html: string;
    ctx: { server?: unknown; filename?: string; id?: string };
  },
): unknown {
  const t = plugin.transformIndexHtml;
  if (!t) throw new Error("no transformIndexHtml");
  // Object form: { order, handler(html, ctx) }
  if (typeof t === "object" && "handler" in t) {
    const handler = (t as { handler: (...a: unknown[]) => unknown }).handler;
    return handler(args.html, args.ctx);
  }
  return (t as (...a: unknown[]) => unknown)(args.html, args.ctx);
}

const plugin = (viteConfig as { plugins: Plugin[] }).plugins.find(
  (p) => p.name === "inject-csp",
) as Plugin;

describe("injectCspPlugin", () => {
  it("is registered first in the plugins list", () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("inject-csp");
  });

  describe("transformIndexHtml (build mode)", () => {
    it("returns a meta tag descriptor with the production policy", () => {
      const tags = invokeTransform(plugin, {
        html: "<html><head></head></html>",
        ctx: { filename: "index.html" }, // no `server` => build mode
      }) as Array<{ tag: string; attrs: Record<string, string> }>;

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(1);
      const meta = tags[0];
      expect(meta.tag).toBe("meta");
      expect(meta.attrs["http-equiv"]).toBe("Content-Security-Policy");
      const policy = meta.attrs["content"];
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("base-uri 'self'");
      expect(policy).toContain("form-action 'self'");
      // Production build must NOT include dev-only hosts.
      expect(policy).not.toContain("localhost:5117");
      expect(policy).not.toContain("ws://localhost:5173");
    });
  });

  describe("transformIndexHtml (dev mode)", () => {
    it("includes dev-only hosts in connect-src when ctx.server is set", () => {
      const tags = invokeTransform(plugin, {
        html: "<html><head></head></html>",
        ctx: { server: {} as unknown }, // presence of `server` => dev mode
      }) as Array<{ tag: string; attrs: Record<string, string> }>;

      const policy = tags[0].attrs["content"];
      expect(policy).toContain("http://localhost:5117");
      expect(policy).toContain("ws://localhost:5173");
    });
  });

  describe("configureServer (dev-only CSP-Report-Only header)", () => {
    it("registers a middleware that sets the Report-Only header", () => {
      const middlewares: Array<(...args: unknown[]) => void> = [];
      const fakeServer = {
        middlewares: {
          use: (fn: (...args: unknown[]) => void) => middlewares.push(fn),
        },
      };

      plugin.configureServer!(
        fakeServer as unknown as {
          middlewares: { use: (fn: (...args: unknown[]) => void) => void };
        },
      );

      expect(middlewares.length).toBe(1);
      // Invoke the middleware with a fake req/res/next and confirm the
      // header is set on the response.
      const headers: Record<string, string> = {};
      const fakeRes = { setHeader: (k: string, v: string) => (headers[k] = v) };
      const next = vi.fn();
      middlewares[0]({}, fakeRes, next);

      expect(headers["Content-Security-Policy-Report-Only"]).toBeDefined();
      const policy = headers["Content-Security-Policy-Report-Only"];
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("http://localhost:5117");
      expect(policy).toContain("ws://localhost:5173");
      expect(next).toHaveBeenCalled();
    });
  });
});
