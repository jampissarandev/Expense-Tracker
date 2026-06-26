import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-themes so we can control theme state from the test.
const mockSetTheme = vi.fn();
let mockTheme = "system";
let mockResolvedTheme: "light" | "dark" = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme,
  }),
}));

// Import after mock declaration.
import { ModeToggle } from "@/components/common/ModeToggle";

beforeEach(() => {
  mockSetTheme.mockClear();
  mockTheme = "system";
  mockResolvedTheme = "light";
});

describe("ModeToggle", () => {
  it("renders a real (non-disabled) toggle after mount", () => {
    // happy-dom fires useEffect synchronously after first render, so the
    // mounted flag flips to true before we assert. The component is
    // designed to render a *disabled* placeholder only during the very
    // first SSR/hydration pass — that branch is exercised by the
    // placeholder.test.ts runtime checks in the production build, and
    // here we just confirm the post-hydration output is interactive.
    render(<ModeToggle />);
    const button = screen.getByRole("button", { name: "เปลี่ยนธีม" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("resolves to an interactive trigger after mount", async () => {
    mockResolvedTheme = "light";
    render(<ModeToggle />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "เปลี่ยนธีม" })
      ).not.toBeDisabled();
    });
  });

  it("opens dropdown and shows all three theme options", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const trigger = await waitFor(() =>
      screen.getByRole("button", { name: "เปลี่ยนธีม" })
    );

    await user.click(trigger);

    expect(await screen.findByText("สว่าง")).toBeInTheDocument();
    expect(screen.getByText("มืด")).toBeInTheDocument();
    expect(screen.getByText("ตามระบบ")).toBeInTheDocument();
  });

  it("clicking 'สว่าง' calls setTheme('light')", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const trigger = await waitFor(() =>
      screen.getByRole("button", { name: "เปลี่ยนธีม" })
    );
    await user.click(trigger);

    const lightOption = await screen.findByText("สว่าง");
    await user.click(lightOption);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("clicking 'มืด' calls setTheme('dark')", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const trigger = await waitFor(() =>
      screen.getByRole("button", { name: "เปลี่ยนธีม" })
    );
    await user.click(trigger);

    const darkOption = await screen.findByText("มืด");
    await user.click(darkOption);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("clicking 'ตามระบบ' calls setTheme('system')", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const trigger = await waitFor(() =>
      screen.getByRole("button", { name: "เปลี่ยนธีม" })
    );
    await user.click(trigger);

    const systemOption = await screen.findByText("ตามระบบ");
    await user.click(systemOption);

    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
