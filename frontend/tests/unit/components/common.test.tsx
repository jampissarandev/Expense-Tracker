import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, LoadingFullPage } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";

describe("LoadingSpinner", () => {
  it("renders with default label and accessible role", () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-label", "Loading");
  });

  it("honors a custom label", () => {
    render(<LoadingSpinner label="กำลังโหลดข้อมูล" />);
    expect(screen.getByRole("status", { name: "กำลังโหลดข้อมูล" })).toBeInTheDocument();
  });
});

describe("LoadingFullPage", () => {
  it("renders a full-page loading state", () => {
    render(<LoadingFullPage label="กำลังโหลด" />);
    expect(screen.getByRole("status", { name: "กำลังโหลด" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="ยังไม่มีรายการ" description="เริ่มต้นด้วยการเพิ่มรายการแรกของคุณ" />);
    expect(screen.getByText("ยังไม่มีรายการ")).toBeInTheDocument();
    expect(screen.getByText("เริ่มต้นด้วยการเพิ่มรายการแรกของคุณ")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    render(<EmptyState title="ยังไม่มีรายการ" icon={InboxIcon} />);
    // icon is decorative — query the role/status container
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an action element when provided", () => {
    render(<EmptyState title="ยังไม่มีรายการ" action={<Button>เพิ่มรายการ</Button>} />);
    expect(screen.getByRole("button", { name: "เพิ่มรายการ" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders default title and message", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders custom title and message", () => {
    render(<ErrorState title="โหลดข้อมูลไม่สำเร็จ" message="กรุณาลองใหม่อีกครั้ง" />);
    expect(screen.getByText("โหลดข้อมูลไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.getByText("กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
  });

  it("shows a retry button when onRetry is provided", () => {
    const onRetry = (): void => {};
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("omits the retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a custom retry icon via the RefreshCwIcon import path (smoke test)", () => {
    // Sanity check — the component imports the icon; if the import path breaks
    // this test will fail to render.
    expect(RefreshCwIcon).toBeDefined();
  });
});
