import { describe, expect, it } from "vitest";

/**
 * Gerbang lampiran dokumen pada aleta_bot/services/dynamicNotificationSchedulerService.js:
 *   const attachmentEnabled = notification.attachDocument !== false && notification.attach_document !== false;
 *
 * Perilaku yang wajib dijaga: default AKTIF. Notifikasi lama yang tidak punya
 * field ini sama sekali tidak boleh mendadak berhenti mengirim dokumen.
 */
function attachmentEnabled(notification: Record<string, unknown>) {
  return notification.attachDocument !== false && notification.attach_document !== false;
}

/** Ekspresi mapNotification di portal: kolom NULL/undefined dianggap aktif. */
function mapAttachDocument(value: number | null | undefined) {
  return value === undefined || value === null ? true : Boolean(value);
}

describe("gerbang lampiran dokumen di scheduler bot", () => {
  it("aktif secara default untuk notifikasi lama tanpa field apa pun", () => {
    expect(attachmentEnabled({ id: "pihak-baru" })).toBe(true);
  });

  it("mematikan lampiran hanya bila toggle bernilai false", () => {
    expect(attachmentEnabled({ attachDocument: false })).toBe(false);
    expect(attachmentEnabled({ attach_document: false })).toBe(false);
  });

  it("tetap aktif saat toggle bernilai true", () => {
    expect(attachmentEnabled({ attachDocument: true })).toBe(true);
  });

  it("tidak salah mematikan karena nilai falsy lain", () => {
    // undefined/null bukan penanda "dimatikan" — hanya false yang mematikan.
    expect(attachmentEnabled({ attachDocument: undefined })).toBe(true);
    expect(attachmentEnabled({ attachDocument: null })).toBe(true);
  });
});

describe("pemetaan kolom attach_document di portal", () => {
  it("memetakan 1/0 ke true/false", () => {
    expect(mapAttachDocument(1)).toBe(true);
    expect(mapAttachDocument(0)).toBe(false);
  });

  it("menganggap kolom kosong sebagai aktif, bukan mati", () => {
    // Penting untuk baris lama pada server yang belum sempat terisi.
    expect(mapAttachDocument(null)).toBe(true);
    expect(mapAttachDocument(undefined)).toBe(true);
  });
});
