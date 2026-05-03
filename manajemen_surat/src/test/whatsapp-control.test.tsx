import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WhatsAppControl } from "@/components/portal/whatsapp-control";

vi.mock("@/components/portal/use-whatsapp-gateway", () => ({
  getWhatsAppRuntimeLabel: () => "waiting_qr",
  getWhatsAppRuntimeDisplayLabel: () => "Perlu Scan QR",
  getWhatsAppRuntimeMessage: () => "QR siap dipindai",
  useWhatsAppGateway: () => ({
    snapshot: {
      runtimeStatus: "waiting_qr",
      internalStatus: "qr",
      qrCode: "data:image/png;base64,qr",
      linked: false,
      phoneNumber: "",
      sessionName: "aleta-session",
      savedStatus: "inactive",
      lastConnectedAt: null,
      requiresPhoneNumberBeforeInit: false,
      lastErrorMessage: null,
    },
    refresh: vi.fn(),
    initialize: vi.fn(),
    deactivate: vi.fn(),
    feedback: "",
    setFeedback: vi.fn(),
    isRefreshing: false,
    isInitializing: false,
    isDeactivating: false,
  }),
}));

describe("WhatsAppControl", () => {
  it("renders a summary card without duplicate initialization actions", () => {
    render(<WhatsAppControl />);

    expect(screen.getByText("Ringkasan WhatsApp Gateway")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buka Pusat Koneksi/i })).toHaveAttribute(
      "href",
      "/admin/status-whatsapp"
    );
    expect(screen.queryByRole("button", { name: /Mulai Inisialisasi/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/QR hanya ditampilkan di halaman pusat WhatsApp/i)
    ).toBeInTheDocument();
  });
});
