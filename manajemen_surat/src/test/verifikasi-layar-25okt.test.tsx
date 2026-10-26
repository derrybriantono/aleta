import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KodeVerifikasiMasuk } from "@/components/portal/kode-verifikasi-masuk";
import { bacaVerifikasiDiperlukan } from "@/lib/masuk-sipp-klien";

/**
 * Layar kode verifikasi saat masuk (E5): pembacaan jawaban 403 server, pilihan
 * cara, pengiriman kode WhatsApp, dan lanjut masuk hanya sesudah server menerima kode.
 */

afterEach(() => cleanup());

describe("bacaVerifikasiDiperlukan", () => {
  it("membaca tiket dan cara yang sah; jawaban lain (batas perangkat, galat) bukan verifikasi", () => {
    expect(bacaVerifikasiDiperlukan({ code: "VERIFIKASI_DIPERLUKAN", tiket: "abc", message: "Masukkan kode", metode: ["whatsapp", "gaib", "cadangan"] })).toEqual({
      tiket: "abc",
      pesan: "Masukkan kode",
      metode: ["whatsapp", "cadangan"],
    });
    expect(bacaVerifikasiDiperlukan({ code: "BATAS_PERANGKAT", tiket: "abc" })).toBeNull();
    expect(bacaVerifikasiDiperlukan({ code: "VERIFIKASI_DIPERLUKAN" })).toBeNull();
    expect(bacaVerifikasiDiperlukan(null)).toBeNull();
  });
});

function ambilPalsu(jawab: (badan: Record<string, unknown>) => { ok: boolean; data?: unknown; pesan?: string }) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const h = jawab(JSON.parse(String(init?.body ?? "{}")));
    return { ok: h.ok, json: async () => (h.ok ? { ok: true, data: h.data ?? {} } : { ok: false, error: { message: h.pesan } }) } as Response;
  });
}

describe("KodeVerifikasiMasuk", () => {
  it("memilih cara, mengirim kode WhatsApp, lalu lanjut masuk hanya bila server menerima", async () => {
    const ambil = ambilPalsu((b) => {
      if (b.aksi === "kirim") return { ok: true, data: { nomor: "0812*****001", berlakuMenit: 5 } };
      if (b.aksi === "periksa" && b.kode === "123456") return { ok: true };
      return { ok: false, pesan: "Kode salah atau sudah tidak berlaku. Sisa percobaan 4." };
    });
    const lanjut = vi.fn();
    render(<KodeVerifikasiMasuk info={{ tiket: "T1", pesan: "", metode: ["authenticator", "whatsapp"] }} onLanjut={lanjut} onBatal={() => undefined} ambil={ambil as unknown as typeof fetch} />);

    expect(screen.getByText(/Masukkan kode verifikasi untuk melanjutkan masuk/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Kode WhatsApp" }));
    fireEvent.click(screen.getByRole("button", { name: /Kirim kode ke WhatsApp saya/ }));
    await waitFor(() => expect(screen.getByText(/Kode dikirim ke WhatsApp 0812\*\*\*\*\*001/)).toBeTruthy());

    const kolom = screen.getByLabelText("Kode verifikasi");
    fireEvent.change(kolom, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan masuk/ }));
    await waitFor(() => expect(screen.getByText(/Sisa percobaan 4/)).toBeTruthy());
    expect(lanjut).not.toHaveBeenCalled();

    fireEvent.change(kolom, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan masuk/ }));
    await waitFor(() => expect(lanjut).toHaveBeenCalledTimes(1));
    const periksa = ambil.mock.calls.map((c) => JSON.parse(String(c[1]?.body))).find((b) => b.aksi === "periksa" && b.kode === "123456");
    expect(periksa).toMatchObject({ tiket: "T1", metode: "whatsapp", percayai: true });
  });

  it("satu cara saja: tanpa pilihan; tombol lanjut mati selama kolom kosong", () => {
    render(<KodeVerifikasiMasuk info={{ tiket: "T2", pesan: "Pesan server", metode: ["cadangan"] }} onLanjut={() => undefined} onBatal={() => undefined} ambil={ambilPalsu(() => ({ ok: true })) as unknown as typeof fetch} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("Pesan server")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Lanjutkan masuk/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
