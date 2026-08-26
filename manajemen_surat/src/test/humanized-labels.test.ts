import { describe, expect, it } from "vitest";

import { getWhatsAppRuntimeDisplayLabel, getWhatsAppRuntimeMessage } from "@/components/portal/use-whatsapp-gateway";
import { humanizeErrorMessage, humanizeStatus } from "@/lib/humanized-labels";

describe("humanized UI labels", () => {
  it("renders technical statuses as clear Indonesian labels", () => {
    expect(humanizeStatus("connected")).toBe("Terhubung");
    expect(humanizeStatus("browser_locked")).toBe("WhatsApp sedang dipakai proses lain");
    expect(humanizeStatus("failed")).toBe("Gagal");
    expect(humanizeStatus("dry_run")).toBe("Simulasi");
  });

  it("renders WhatsApp runtime messages in user-friendly language", () => {
    expect(getWhatsAppRuntimeDisplayLabel("connected")).toBe("Terhubung");
    expect(getWhatsAppRuntimeDisplayLabel("waiting_qr")).toBe("Perlu Pindai QR");
    expect(getWhatsAppRuntimeMessage("disconnected")).toContain("belum terhubung");
  });

  it("converts common API errors into human-readable messages", () => {
    expect(humanizeErrorMessage("Unauthorized")).toBe("Anda belum login atau sesi Anda telah berakhir.");
    expect(humanizeErrorMessage("Forbidden")).toBe("Anda tidak memiliki izin untuk membuka halaman ini.");
    expect(humanizeErrorMessage("Invalid payload")).toBe("Data yang dikirim belum lengkap atau tidak sesuai.");
    expect(humanizeErrorMessage("Safe Sending Window not allowed")).toBe("Saat ini berada di luar jam aman pengiriman.");
  });
});
