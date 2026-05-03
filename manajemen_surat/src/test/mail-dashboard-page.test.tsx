import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MailDashboardPage } from "@/components/portal/mail-dashboard-page";
import { dispositions, letters, personas } from "@/lib/mock-data";

const portalMock = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/app-state", () => ({
  usePortal: () => portalMock.value,
}));

describe("MailDashboardPage", () => {
  it("renders the four mail summary cards in a responsive four-column desktop grid", () => {
    portalMock.value = {
      accessibleLetters: letters,
      currentUser: personas.find((user) => user.id === "usr-ketua"),
      dispositions,
      pendingInbox: dispositions.filter((item) => item.status !== "Selesai").slice(0, 3),
      users: personas,
    };

    render(<MailDashboardPage />);

    const grid = screen.getByTestId("mail-dashboard-summary-grid");
    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "xl:grid-cols-4");

    expect(screen.getByTestId("mail-summary-card-surat-masuk")).toHaveTextContent("Surat Masuk (Total)");
    expect(screen.getByTestId("mail-summary-card-surat-keluar")).toHaveTextContent("Surat Keluar (Total)");
    expect(screen.getByTestId("mail-summary-card-tugas-masuk")).toHaveTextContent("Tugas Masuk");
    expect(screen.getByTestId("mail-summary-card-disposisi-terlambat")).toHaveTextContent("Disposisi Terlambat");
  });
});
