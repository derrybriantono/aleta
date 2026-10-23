/**
 * T4 (23 Okt 2026): halaman E-Keuangan (kerangka di /apps/[slug]) mengikuti pusat
 * tema portal - tidak ada warna tetap putih/slate yang tidak ikut kelas `dark`.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "e-keuangan" }) }));
vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ accessiblePortalApps: [{ href: "/apps/e-keuangan", label: "E-Keuangan", description: "Kerangka" }] }),
}));

import PlaceholderAppPage from "@/app/(portal)/apps/[slug]/page";

describe("E-Keuangan mengikuti tema portal", () => {
  it("ikon ruang pengembangan memakai token kartu, bukan putih/slate tetap", () => {
    const { container, getByText } = render(<PlaceholderAppPage />);
    expect(getByText("E-Keuangan")).toBeTruthy();
    const ikon = container.querySelector("div.rounded-2xl") as HTMLElement;
    const semuaKelas = Array.from(container.querySelectorAll("[class]")).map((e) => e.getAttribute("class") ?? "").join(" ");
    expect(ikon.className).toContain("bg-card");
    expect(semuaKelas).not.toMatch(/\bbg-white\b|dark:bg-slate-\d+|bg-popover/);
  });
});
