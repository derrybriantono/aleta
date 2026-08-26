import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessDeniedCard } from "@/components/portal/shared";

describe("portal AccessDenied state", () => {
  it("renders a deterministic no-access message and stable selector", () => {
    render(<AccessDeniedCard />);

    expect(screen.getByTestId("access-denied-card")).toBeInTheDocument();
    expect(screen.getByText("Akses ditolak")).toBeInTheDocument();
    expect(screen.getByText(/Anda tidak memiliki izin/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buka/i })).toHaveAttribute("href", "/portal");
  });
});
