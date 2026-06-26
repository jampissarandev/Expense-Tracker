import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import NotFoundPage from "@/pages/NotFoundPage";

function renderNotFound() {
  return render(
    <MemoryRouter initialEntries={["/some-bogus-path"]}>
      <NotFoundPage />
    </MemoryRouter>
  );
}

describe("NotFoundPage", () => {
  it("renders the 404 heading", () => {
    renderNotFound();
    expect(screen.getByRole("heading", { name: "404", level: 1 })).toBeInTheDocument();
  });

  it("renders the Thai 'page not found' message", () => {
    renderNotFound();
    expect(screen.getByText("ไม่พบหน้าที่คุณกำลังมองหา")).toBeInTheDocument();
  });

  it("renders the secondary explanatory Thai message", () => {
    renderNotFound();
    expect(
      screen.getByText(
        "หน้าที่คุณต้องการอาจถูกลบ เปลี่ยนชื่อ หรือไม่มีอยู่ในระบบ"
      )
    ).toBeInTheDocument();
  });

  it("renders a 'back to home' button that links to '/'", () => {
    renderNotFound();
    const link = screen.getByRole("link", { name: /กลับไปหน้าแรก/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
