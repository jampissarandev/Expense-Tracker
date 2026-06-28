import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";

// ── Set VITE_API_URL before importing the auth module ───────────────────────

vi.stubEnv("VITE_API_URL", "http://localhost:5117");

// ── Probe component — reads the current auth context and prints it ──────────

interface AuthProbeState {
  user: unknown;
  accessToken: string | null;
  isLoading: boolean;
}

function AuthProbe({ onState }: { onState: (state: AuthProbeState) => void }) {
  const auth = useAuth();
  onState({
    user: auth.user,
    accessToken: auth.accessToken,
    isLoading: auth.isLoading,
  });
  return (
    <div>
      <span data-testid="loading">{auth.isLoading ? "loading" : "ready"}</span>
      <span data-testid="user-email">{auth.user?.email ?? "none"}</span>
      <span data-testid="token">{auth.accessToken ?? "none"}</span>
    </div>
  );
}

function renderProbe() {
  const states: AuthProbeState[] = [];
  const capture = (state: AuthProbeState) => {
    states.push(state);
  };
  const result = render(
    <AuthProvider>
      <AuthProbe onState={capture} />
    </AuthProvider>,
  );
  return { ...result, states };
}

const getFinalState = (states: AuthProbeState[]): AuthProbeState => {
  // States are captured in order — the final entry is the latest render.
  return states[states.length - 1];
};

// ── MSW server — default handler returns 500, tests override as needed ─────

const server = setupServer(
  http.post("http://localhost:5117/api/auth/refresh", () => {
    return new HttpResponse(null, { status: 500 });
  }),
);

beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("AuthProvider — loading-state correctness (R21)", () => {
  it("sets isLoading=false after the initial silent refresh resolves (success)", async () => {
    // Arrange — refresh returns 200 with a valid AuthResponse
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return HttpResponse.json({
          accessToken: {
            token: "fresh-access-token",
            expiresAt: new Date().toISOString(),
          },
          refreshToken: "fresh-refresh-token",
          refreshTokenExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          user: { id: "u-1", email: "alice@test.com", displayName: "Alice" },
        });
      }),
    );

    // Act
    const { states } = renderProbe();

    // Assert — the provider eventually settles to a non-loading state
    await waitFor(() => {
      const s = getFinalState(states);
      expect(s.isLoading).toBe(false);
    });

    const finalState = getFinalState(states);
    expect(finalState.user).toMatchObject({ email: "alice@test.com" });
    expect(finalState.accessToken).toBe("fresh-access-token");
  });

  it("sets isLoading=false after the initial silent refresh rejects with 500", async () => {
    // Arrange — default handler already returns 500, but be explicit
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // Act
    const { states } = renderProbe();

    // Assert — the provider must NOT get stuck at isLoading=true.
    // This is the exact regression R21 calls out: the catch block could
    // swallow the error and leave isLoading=true forever, hanging the
    // route guard spinner.
    await waitFor(() => {
      const s = getFinalState(states);
      expect(s.isLoading).toBe(false);
    });

    const finalState = getFinalState(states);
    expect(finalState.user).toBeNull();
    expect(finalState.accessToken).toBeNull();
  });

  it("sets isLoading=false after the initial silent refresh rejects with 401 (no refresh cookie)", async () => {
    // Arrange — refresh returns 401 (typical for an unauthenticated user)
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    // Act
    const { states } = renderProbe();

    // Assert
    await waitFor(() => {
      const s = getFinalState(states);
      expect(s.isLoading).toBe(false);
    });

    const finalState = getFinalState(states);
    expect(finalState.user).toBeNull();
    expect(finalState.accessToken).toBeNull();
  });

  it("renders the ready state on screen once the initial refresh settles", async () => {
    // Arrange — refresh returns 500
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // Act
    renderProbe();

    // Assert — the on-screen status flips to "ready" — proving the
    // route guard would no longer hang on the loading spinner.
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("user-email")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });
});
