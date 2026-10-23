import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaAiTugas } from "@/components/portal/aleta-ai/aleta-ai-tugas";
import { TANDA_DRAF } from "@/lib/aleta-ai/tugas";

/**
 * ALETA Ai tahap 3 (T9): layar Tugas dirender sungguhan (jsdom) dengan fetch
 * tiruan - jenis yang tidak berhak tidak dapat dipilih, langkah & berkas
 * tampil dari server, Hentikan/Lanjutkan memanggil rute, dan Kirim ke alur
 * SELALU lewat pratinjau + konfirmasi petugas.
 */

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: unknown }> = [];
const jawab = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => ({ ok, data, error: ok ? undefined : { message: String(data) } }) }) as unknown as Response;

const DAFTAR = {
  tugas: [{ id: "ait-1", jenis: "draf-putusan", judul: "Draf putusan 101/Pdt.G/2026/PA.Dgl", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", format: "docx", status: "selesai", pesan: "Berkas siap.", mode: "Mendalam", biayaRp: 4500, terputus: false }],
  jenis: [
    { jenis: "draf-putusan", label: "Draf putusan (format Donggala)", boleh: true, alasan: "", tujuan: [{ tujuan: "draf-h7", label: "Draf H-7" }] },
    { jenis: "panduan-sidang", label: "Panduan sidang", boleh: true, alasan: "", tujuan: [] },
    { jenis: "komparasi-arah", label: "Komparasi arah putusan", boleh: false, alasan: "hanya Ketua, Wakil, Hakim", tujuan: [] },
  ],
  format: ["docx", "rtf", "pdf", "html", "xlsx"],
  alatBantu: { aktif: false },
};
const RINCI = {
  ...DAFTAR.tugas[0],
  langkah: [
    { kode: "rencana", judul: "Rencana kerja", status: "selesai", catatan: "", model: "claude-opus-5-5", effort: "high", token: 3000, ringkas: "1. Baca data." },
    { kode: "ambil-data", judul: "Ambil data perkara", status: "selesai", catatan: "", model: "", effort: "", token: 0, ringkas: "{}" },
    { kode: "susun", judul: "Susun naskah", status: "selesai", catatan: "", model: "claude-opus-5-5", effort: "high", token: 3000, ringkas: "## DUDUK PERKARA" },
    { kode: "periksa", judul: "Periksa naskah", status: "selesai", catatan: "", model: "claude-opus-5-5", effort: "high", token: 3000, ringkas: "## DUDUK PERKARA" },
    { kode: "berkas", judul: "Buat berkas", status: "selesai", catatan: "DOCX, HTML", model: "", effort: "", token: 0, ringkas: "" },
  ],
  berkas: [{ id: "aibk-1", nama: "Draf.docx", format: "docx", ukuran: 2000, templat: "" }],
};

beforeEach(() => {
  panggilan = [];
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    const badan = init?.body ? JSON.parse(String(init.body)) : undefined;
    panggilan.push({ url, metode, badan });
    if (url.endsWith("/api/aleta-ai/tugas") && metode === "GET") return jawab(DAFTAR);
    if (url.endsWith("/api/aleta-ai/tugas/ait-1") && metode === "GET") return jawab(RINCI);
    if (url.endsWith("/api/aleta-ai/tugas/ait-1/kirim")) return jawab({ id: "aik-1", label: "Draf H-7", status: "menunggu-konfirmasi", nilai: { teks: "Penggugat Siti Rekaan ..." } });
    if (url.endsWith("/api/aleta-ai/kiriman/aik-1")) return jawab({ id: "aik-1", status: badan?.setuju ? "dikonfirmasi" : "dibatalkan" });
    if (url.endsWith("/api/aleta-ai/tugas") && metode === "POST") return jawab("Maaf, tugas ini hanya untuk Ketua, Wakil Ketua, dan Hakim.", false);
    return jawab({});
  });
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("layar Tugas ALETA Ai", () => {
  it("jenis tanpa hak dinonaktifkan; langkah, tanda draf, dan unduhan tampil dari server", async () => {
    render(<AletaAiTugas />);
    const opsi = await screen.findByRole("option", { name: /Komparasi arah putusan \(tidak berhak\)/ });
    expect((opsi as HTMLOptionElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Draf putusan 101/ }));
    const rinci = await screen.findByTestId("rincian-tugas");
    await waitFor(() => expect(within(rinci).getAllByRole("listitem").length).toBeGreaterThanOrEqual(5));
    expect(within(rinci).getByText(/1\. Rencana kerja/)).toBeTruthy();
    expect(within(rinci).getByText(new RegExp(TANDA_DRAF))).toBeTruthy();
    expect(within(rinci).getByRole("link", { name: /DOCX/ }).getAttribute("href")).toContain("/api/aleta-ai/tugas/ait-1/berkas/aibk-1");
    expect(within(rinci).queryByRole("button", { name: /Hentikan/ })).toBeNull();
  });

  it("Kirim ke alur: pratinjau dulu, baru terkirim saat petugas menekan 'Ya, kirim'", async () => {
    render(<AletaAiTugas />);
    fireEvent.click(await screen.findByRole("button", { name: /Draf putusan 101/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Draf H-7/ }));
    const dialog = await screen.findByRole("dialog", { name: "Konfirmasi kiriman" });
    expect(within(dialog).getByText(/Penggugat Siti Rekaan/)).toBeTruthy();
    expect(panggilan.some((p) => p.url.includes("/api/aleta-ai/kiriman/"))).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, kirim" }));
    await waitFor(() => expect(panggilan.find((p) => p.url.endsWith("/api/aleta-ai/kiriman/aik-1"))?.badan).toEqual({ setuju: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("penolakan server (403) ditampilkan apa adanya", async () => {
    render(<AletaAiTugas />);
    await screen.findByRole("option", { name: /Draf putusan/ });
    fireEvent.click(screen.getByRole("button", { name: /Mulai tugas/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("hanya untuk Ketua, Wakil Ketua, dan Hakim");
  });
});
