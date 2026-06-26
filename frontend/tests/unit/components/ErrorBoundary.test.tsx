import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// A controllable child that throws on demand.
function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error("kaboom-from-child");
  }
  return <div data-testid="child">child-rendered</div>;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silence expected React error boundary logs but still allow assertions
    // via spy.mock.calls.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("child-rendered")).toBeInTheDocument();
  });

  it("renders the default fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );

    // Default fallback shows Thai heading + message.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("เกิดข้อผิดพลาด")).toBeInTheDocument();
    expect(
      screen.getByText("มีข้อผิดพลาดบางอย่างในแอปพลิเคชัน")
    ).toBeInTheDocument();
    // The error message itself is exposed in the fallback.
    expect(screen.getByText("kaboom-from-child")).toBeInTheDocument();
  });

  it("calls componentDidCatch → console.error when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    // Verify the boundary logged something tagged with our prefix.
    const callMessages = consoleErrorSpy.mock.calls
      .map((args) => args.map(String).join(" "))
      .join("\n");
    expect(callMessages).toMatch(/ErrorBoundary caught an error/);
    expect(callMessages).toMatch(/kaboom-from-child/);
  });

  it("renders a custom fallback when provided via the `fallback` prop", () => {
    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom error UI</div>}
      >
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    // The default fallback must NOT be rendered.
    expect(screen.queryByText("เกิดข้อผิดพลาด")).not.toBeInTheDocument();
  });

  it("the retry button resets boundary state and re-renders children", async () => {
    // We control whether the child throws via a flag we can flip.
    let shouldThrow = true;

    function ToggleableBoom(): React.ReactElement {
      return <Boom shouldThrow={shouldThrow} />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleableBoom />
      </ErrorBoundary>
    );

    // Initially in error state.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();

    // Stop throwing and click retry.
    shouldThrow = false;
    const user = userEvent.setup();
    const retryButton = screen.getByRole("button", { name: /ลองอีกครั้ง/ });
    await user.click(retryButton);

    // After retry, boundary re-renders children. The child should mount
    // cleanly because the throw flag is now false.
    rerender(
      <ErrorBoundary>
        <ToggleableBoom />
      </ErrorBoundary>
    );

    await expect(screen.findByTestId("child")).resolves.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
