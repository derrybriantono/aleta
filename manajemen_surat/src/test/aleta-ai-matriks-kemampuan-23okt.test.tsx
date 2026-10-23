import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MatriksKemampuanAi } from "@/components/portal/aleta-ai/matriks-kemampuan";
import { DAFTAR_KEMAMPUAN_AI, KEMAMPUAN_AI } from "@/lib/matriks-peran";

/**
 * ALETA Ai - layar matriks kemampuan per peran di Pengaturan (keputusan
 * pengguna 23 Okt, butir 10): dirender sungguhan dengan fetch tiruan.
 *   - baris = kemampuan dari GET /api/aleta-ai/kemampuan, kolom = golongan
 *     (tanpa Admin/Super Admin yang selalu boleh);
 *   - centang -> PUT {matriks:{kemampuan: golongan[]}}; kembalikan -> null;
 *   - bukan Super Admin (tanpa `matriks`) atau PUT ditolak -> pesan, tidak ada tabel/perubahan.
 */

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: any }> = [];
const jawab = (data: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: String(data) } }) }) as unknown as Response;

const matriksBawaan = () =>
  DAFTAR_KEMAMPUAN_AI.map((k) => ({ kemampuan: k, label: KEMAMPUAN_AI[k].label, golongan: [...KEMAMPUAN_AI[k].golongan] as string[], bawaan: true }));

beforeEach(() => {
  panggilan = [];
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchTiruan.mockReset();
});

describe("matriks kemampuan ALETA Ai di Pengaturan", () => {
  it("menampilkan bawaan, menyimpan centang baru lewat PUT, dan mengembalikan ke bawaan", async () => {
    let matriks = matriksBawaan();
    fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
      const metode = (init?.method ?? "GET").toUpperCase();
      const badan = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      panggilan.push({ url, metode, badan });
      if (metode === "PUT") {
        matriks = matriks.map((m) =>
          m.kemampuan in badan.matriks
            ? badan.matriks[m.kemampuan] === null
              ? { ...m, golongan: [...KEMAMPUAN_AI[m.kemampuan as "draf-putusan"].golongan], bawaan: true }
              : { ...m, golongan: badan.matriks[m.kemampuan], bawaan: false }
            : m
        );
      }
      return jawab({ matriks });
    });
    render(<MatriksKemampuanAi />);
    expect(await screen.findByTestId("matriks-kemampuan-ai")).toBeInTheDocument();
    expect(screen.getAllByRole("rowheader")).toHaveLength(DAFTAR_KEMAMPUAN_AI.length);
    expect(screen.queryByRole("columnheader", { name: "Super Admin" })).toBeNull();
    const ppPutusan = screen.getByRole("checkbox", { name: "Draf putusan / pertimbangan / amar - Panitera Pengganti" }) as HTMLInputElement;
    const hakimPutusan = screen.getByRole("checkbox", { name: "Draf putusan / pertimbangan / amar - Hakim" }) as HTMLInputElement;
    expect(ppPutusan.checked).toBe(false);
    expect(hakimPutusan.checked).toBe(true);
    const simpan = screen.getByRole("button", { name: /Simpan matriks/ });
    expect(simpan).toBeDisabled();

    fireEvent.click(ppPutusan);
    expect(ppPutusan.checked).toBe(true);
    fireEvent.click(simpan);
    await screen.findByText("Matriks kemampuan tersimpan dan langsung berlaku.");
    const put = panggilan.find((p) => p.metode === "PUT")!;
    expect(put.url).toMatch(/\/api\/aleta-ai\/kemampuan$/);
    expect(put.badan).toEqual({ matriks: { "draf-putusan": ["pimpinan", "hakim", "pp"] } });
    expect(screen.getByRole("rowheader", { name: /^Draf putusan/ })).not.toHaveTextContent("(bawaan)");

    fireEvent.click(screen.getByRole("button", { name: "Kembalikan Draf putusan / pertimbangan / amar ke bawaan" }));
    fireEvent.click(screen.getByRole("button", { name: /Simpan matriks/ }));
    await waitFor(() => expect(panggilan.filter((p) => p.metode === "PUT")).toHaveLength(2));
    expect(panggilan.filter((p) => p.metode === "PUT")[1]!.badan).toEqual({ matriks: { "draf-putusan": null } });
    await waitFor(() => expect((screen.getByRole("checkbox", { name: "Draf putusan / pertimbangan / amar - Panitera Pengganti" }) as HTMLInputElement).checked).toBe(false));
  });

  it("bukan Super Admin: tidak ada tabel; PUT ditolak server: pesannya tampil", async () => {
    fetchTiruan.mockImplementation(async () => jawab({ kemampuan: [] }));
    render(<MatriksKemampuanAi />);
    expect(await screen.findByText("Matriks kemampuan hanya dapat diatur Super Admin.")).toBeInTheDocument();
    expect(screen.queryByTestId("matriks-kemampuan-ai")).toBeNull();
    cleanup();

    fetchTiruan.mockImplementation(async (_url: string, init?: RequestInit) =>
      (init?.method ?? "GET") === "PUT" ? jawab("Hanya Super Admin yang dapat membuka bagian ini.", 403) : jawab({ matriks: matriksBawaan() })
    );
    render(<MatriksKemampuanAi />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Relaas & analisa panggilan - Kasir" }));
    fireEvent.click(screen.getByRole("button", { name: /Simpan matriks/ }));
    expect(await screen.findByText("Hanya Super Admin yang dapat membuka bagian ini.")).toBeInTheDocument();
  });
});
