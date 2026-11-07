// @vitest-environment jsdom
/**
 * Tombol Salin di layar alat bukti ALETA ABT: bila papan klip ditolak peramban (izin, dokumen tidak berfokus, atau peladen tanpa HTTPS), tombol tidak
 * boleh diam. Labelnya tidak berubah jadi "Tersalin", pesan tampil, dan teksnya ada di kotak yang sudah terpilih seluruhnya supaya bisa disalin tangan.
 * Data rekaan.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";

const KTP: BarisBukti = { nm: "Kartu Tanda Penduduk", an: "Fulan Rekaan bin Fulan", no: "0000000000000000", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const NIKAH: BarisBukti = { nm: "Kutipan Akta Nikah", an: "", no: "123/45/VI/2010", tgl: "2010-06-01", oleh: "Kantor Urusan Agama", meterai: 0, cocok: 0, manual: null };
const ALINEA = [{ teks: "Mengabulkan gugatan." }, { teks: kalimatBaris(KTP, "P", 0) }, { teks: kalimatBaris(NIKAH, "P", 1) }];

let eksekusi: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { P: [], T: [], nikah: null, dokumen: [] } }) })));
  eksekusi = vi.fn(() => false);
  Object.defineProperty(document, "execCommand", { value: eksekusi, configurable: true, writable: true });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
});

const papan = (writeText: unknown) => vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: writeText ? { writeText } : undefined }));
const tampil = () => render(<BuktiAletaAbt alinea={ALINEA} perkaraId="1" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" />);

describe("tombol Salin kalimat bukti", () => {
  it("papan klip ditolak dan cadangan gagal: label tetap, pesan tampil, teks terpilih di kotak", async () => {
    papan(vi.fn(async () => Promise.reject(new Error("ditolak"))));
    tampil();
    fireEvent.click(await screen.findByRole("button", { name: "Salin kalimat" }));
    const kotak = (await screen.findByLabelText("Isi kalimat bukti untuk disalin tangan")) as HTMLTextAreaElement;
    expect(kotak.value).toContain("Kartu Tanda Penduduk");
    await waitFor(() => expect(kotak.selectionStart).toBe(0));
    expect(kotak.selectionEnd).toBe(kotak.value.length);
    expect(screen.getByText(/Peramban menolak menyalin otomatis/)).toBeTruthy();
    expect(screen.queryByText("Tersalin")).toBeNull();
    expect(screen.getByRole("button", { name: "Salin kalimat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByLabelText("Isi kalimat bukti untuk disalin tangan")).toBeNull();
  });

  it("berhasil: label menjadi Tersalin dan tidak ada kotak salin tangan", async () => {
    const tulis = vi.fn(async () => undefined);
    papan(tulis);
    tampil();
    fireEvent.click(await screen.findByRole("button", { name: "Salin kalimat" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tersalin" })).toBeTruthy());
    expect(tulis).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Isi kalimat bukti untuk disalin tangan")).toBeNull();
  });

  it("peladen tanpa papan klip: cadangan yang berhasil dihitung berhasil, yang gagal menampilkan kotak", async () => {
    papan(undefined);
    eksekusi.mockReturnValue(true);
    tampil();
    fireEvent.click(await screen.findByRole("button", { name: "Salin kalimat" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tersalin" })).toBeTruthy());
    document.body.replaceChildren();
    eksekusi.mockReturnValue(false);
    tampil();
    fireEvent.click(await screen.findByRole("button", { name: "Salin kalimat" }));
    expect(await screen.findByLabelText("Isi kalimat bukti untuk disalin tangan")).toBeTruthy();
    expect(screen.queryByText("Tersalin")).toBeNull();
  });
});

describe("tombol Salin pertimbangan", () => {
  it("ditolak: pesan dan kotak berisi seluruh pertimbangan, bukan diam", async () => {
    papan(vi.fn(async () => Promise.reject(new Error("dokumen tidak berfokus"))));
    tampil();
    const tombol = await screen.findByRole("button", { name: "Salin pertimbangan" });
    await waitFor(() => expect((tombol as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(tombol);
    const kotak = (await screen.findByLabelText("Isi pertimbangan untuk disalin tangan")) as HTMLTextAreaElement;
    expect(kotak.value).toContain("Kartu Tanda Penduduk");
    expect(screen.queryByText("Tersalin")).toBeNull();
    expect(screen.getByRole("button", { name: "Salin pertimbangan" })).toBeTruthy();
  });
});
