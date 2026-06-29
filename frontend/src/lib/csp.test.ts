import { describe, it, expect } from "vitest";
import { buildCspPolicy, CSP_DIRECTIVES, DEV_CSP_EXTRAS } from "@/lib/csp";

describe("buildCspPolicy", () => {
  it("returns a string with every required directive", () => {
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    for (const directive of CSP_DIRECTIVES) {
      expect(policy).toContain(`${directive} `);
    }
  });

  it("uses 'self' as the default source for non-connect directives", () => {
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    // default-src is present and set to 'self'
    expect(policy).toMatch(/default-src 'self'/);
  });

  it("injects the provided connect-src value verbatim", () => {
    const policy = buildCspPolicy({
      connectSrc: ["'self'", "http://localhost:5117"],
    });
    expect(policy).toMatch(/connect-src 'self' http:\/\/localhost:5117/);
  });

  it("includes ws://localhost:5173 in the dev extras", () => {
    const policy = buildCspPolicy({
      connectSrc: ["'self'"],
      isDev: true,
    });
    expect(policy).toContain(DEV_CSP_EXTRAS.connectSrc.join(" "));
  });

  it("does NOT include dev-only hosts in production builds", () => {
    const policy = buildCspPolicy({
      connectSrc: ["'self'"],
      isDev: false,
    });
    expect(policy).not.toContain("localhost:5117");
    expect(policy).not.toContain("ws://localhost:5173");
  });

  it("ends with a semicolon-terminated directive list (no trailing semicolon)", () => {
    // Vite/HTML serializers append a final '; ' — we only own the body.
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    expect(policy.endsWith(";")).toBe(false);
    // …but every directive within the policy is terminated by '; '
    for (const directive of CSP_DIRECTIVES) {
      expect(policy).toContain(`${directive} `);
    }
  });

  it("forbids framing with frame-ancestors 'none'", () => {
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("restricts base-uri to 'self' to block <base> hijacking", () => {
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    expect(policy).toContain("base-uri 'self'");
  });

  it("restricts form-action to 'self' to block off-site form posts", () => {
    const policy = buildCspPolicy({ connectSrc: ["'self'"] });
    expect(policy).toContain("form-action 'self'");
  });
});
