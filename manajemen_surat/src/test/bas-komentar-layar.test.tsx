import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BasKomentarHakim } from "@/components/portal/bas-komentar-hakim";
import { AletaEcourtAbtWajib } from "@/components/portal/aleta-ecourt-abt-wajib";
import { AletaEcourtTemplatHukum } from "@/components/portal/aleta-ecourt-templat-hukum";

/**
 * ============================================================================
 * LAYAR TAHAP 6-7 - DIGAMBAR SUNGGUHAN, FETCH DITIRU
 * ============================================================================
 *
 * Yang dijaga di layar (aturannya sendiri diuji atas basis data di
 * bas-komentar.test.ts, templat-hukum.test.ts, abt-wajib.test.ts):
 *   - hakim membaca tanya-jawab dan "Komentari" mengirim bagian + kutipan
 *     keterangan yang dipilih;
 *   - pegawai yang tidak boleh menulis tidak melihat tombol Komentari;
 *   - batas sumber dan halangan ABT tertulis, tidak disembunyikan;
 *   - templat DRAF bertanda "DRAF - belum disahkan pimpinan", tombol Sahkan
 *     hanya bagi Super Admin;
 *   - variabel wajib: saklar mati bagi yang bukan Super Admin.
 */

type Rute = (url: string, init?: RequestInit) => unknown;
let rute: Rute = () => ({});
const dikirim: Array<{ url: string; method: string; badan: unknown }> = [];

beforeEach(() => {
  dikirim.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      dikirim.push({ url: String(url), method, badan: init?.body ? JSON.parse(String(init.body)) : null });
      const data = rute(String(url), init);
      return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
  window.history.replaceState(null, "", "/aleta/bas/komentar?nomor=214%2FPdt.G%2F2026%2FPA.Dgl");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ALUR = {
  ada: true,
  alur: {
    nomorPerkara: "214/Pdt.G/2026/PA.Dgl",
    perkaraId: "9648",
    dibacaPada: "2026-09-29T10:00:00.000Z",
    batas: ["Yang tampil: lembar BAS ALETA versi terakhir yang disimpan, dan keterangan saksi di ABT."],
    halangan: ["APS Badilag - abt_keterangan_saksi tidak terbaca: ECONNREFUSED"],
    saksi: [
      {
        sumber: "ALETA",
        kunci: "lembar-P1",
        sebutan: "saksi ke-1",
        nama: "Saksi Satu",
        keterangan: "Lembar A1a",
        baris: [{ bagian: "lembar-P1:1", urutan: 1, penanya: "", pertanyaan: "Sejak kapan bertengkar?", jawaban: "Sejak 2024" }],
      },
    ],
  },
};

function saya(bolehMenulis: boolean) {
  return { id: "usr-x", nama: "X", bolehMenulis, bolehMenyelesaikanSemua: !bolehMenulis };
}

describe("layar Baca BAS & komentar hakim", () => {
  it("hakim: membaca, lalu Komentari mengirim bagian, kutipan, dan nomor", async () => {
    rute = (url, init) => {
      if (url.includes("/bas-komentar/alur")) return ALUR;
      if (init?.method === "POST") {
        return {
          komentar: {
            id: "bkm-1",
            nomor: "214/Pdt.G/2026/PA.Dgl",
            perkaraId: "9648",
            sidangKe: null,
            bagian: "lembar-P1:1",
            kutipan: "Sejak 2024",
            isi: "Seharusnya 2023.",
            penulis: { id: "usr-x", nama: "X" },
            dibuatPada: "2026-09-29T10:01:00.000Z",
            selesai: false,
            diselesaikanOleh: null,
            diselesaikanPada: null,
          },
        };
      }
      return { komentar: [], saya: saya(true) };
    };
    render(<BasKomentarHakim />);
    expect(await screen.findByText("Sejak kapan bertengkar?")).toBeTruthy();
    expect(screen.getByText(/versi terakhir yang disimpan/)).toBeTruthy();
    expect(screen.getByText(/ECONNREFUSED/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Komentari/ }));
    // Isian pertama di layar milik baris yang dikomentari; isian kedua milik
    // kartu "Komentar umum" di bawah.
    fireEvent.change(screen.getAllByLabelText("Isi komentar")[0], { target: { value: "Seharusnya 2023." } });
    fireEvent.click(screen.getAllByRole("button", { name: /Kirim komentar/ })[0]);

    await waitFor(() => expect(dikirim.some((d) => d.method === "POST")).toBe(true));
    const kirim = dikirim.find((d) => d.method === "POST");
    expect(kirim?.url).toMatch(/\/api\/aleta-ecourt\/bas-komentar$/);
    expect(kirim?.badan).toMatchObject({
      nomor: "214/Pdt.G/2026/PA.Dgl",
      perkaraId: "9648",
      bagian: "lembar-P1:1",
      kutipan: "Sejak 2024",
      isi: "Seharusnya 2023.",
    });
    expect(await screen.findByText("Seharusnya 2023.")).toBeTruthy();
    expect(screen.getByText("Belum ditanggapi")).toBeTruthy();
  });

  it("pegawai yang tidak boleh menulis: tanpa tombol Komentari", async () => {
    rute = (url) => (url.includes("/bas-komentar/alur") ? ALUR : { komentar: [], saya: saya(false) });
    render(<BasKomentarHakim />);
    expect(await screen.findByText("Sejak kapan bertengkar?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Komentar ditulis hakim/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Komentari/ })).toBeNull();
  });
});

describe("kartu admin", () => {
  const BUTIR = {
    id: "th-benih-pertimbangan-verstek",
    jenis: "pertimbangan",
    kunci: "verstek",
    judul: "Dikabulkan dengan verstek (DRAF)",
    isi: "Menimbang, bahwa {tanggal_relaas};",
    disahkan: false,
    disahkanOleh: null,
    disahkanPada: null,
    diubahPada: "2026-09-29T00:00:00.000Z",
  };

  it("templat DRAF bertanda jelas; Sahkan hanya bila server membolehkan", async () => {
    rute = () => ({ butir: [BUTIR], bolehMenyunting: false, tandaDraf: "DRAF - belum disahkan pimpinan" });
    const { unmount } = render(<AletaEcourtTemplatHukum />);
    expect(await screen.findByText("DRAF - belum disahkan pimpinan")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sahkan/ })).toBeNull();
    unmount();

    rute = () => ({ butir: [BUTIR], bolehMenyunting: true, tandaDraf: "DRAF - belum disahkan pimpinan" });
    render(<AletaEcourtTemplatHukum />);
    fireEvent.click(await screen.findByRole("button", { name: /Sahkan atas nama pimpinan/ }));
    await waitFor(() => expect(dikirim.some((d) => d.method === "PUT")).toBe(true));
    expect(dikirim.find((d) => d.method === "PUT")?.badan).toEqual({ id: BUTIR.id, sahkan: true });
  });

  it("variabel wajib: saklar mati bagi yang bukan Super Admin, persen dan asal ukur tertulis", async () => {
    rute = () => ({
      daftar: [
        {
          jenis: "cerai gugat",
          jenisNama: "Cerai Gugat",
          diukurPada: "2026-09-14T08:00:00.000Z",
          catatan: "",
          variabel: [
            { kode: "1214", nama: "Alat-alat bukti CG/CT", sumber: "ukur", persenTerisi: 97.9, aktif: true, jumlahPerkara: 1643, jumlahTerisi: 1609, ditetapkanAdmin: false },
          ],
        },
      ],
      bolehMenyunting: false,
      ambang: { wajib: 0.9, simpan: 0.5, minimalPerkara: 10 },
    });
    render(<AletaEcourtAbtWajib />);
    expect(await screen.findByText("97.9%")).toBeTruthy();
    expect(screen.getByText("1609/1643")).toBeTruthy();
    const saklar = screen.getByRole("switch", { name: /#1214#/ });
    expect((saklar as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Ukur ulang/ })).toBeNull();
  });
});

describe("jalan ke layar hakim", () => {
  it("Status Perkara (bagian Saksi) dan Alat Bantu Tulis BAS menautkan /bas/komentar membawa nomor", () => {
    const akar = process.cwd();
    const status = readFileSync(path.join(akar, "src/components/portal/aleta-ecourt-status-perkara.tsx"), "utf8");
    expect(status).toContain('withBasePath("/bas/komentar?nomor=" + encodeURIComponent(status.identitas.nomorPerkara))');
    const panitera = readFileSync(path.join(akar, "src/components/portal/bas-panitera.tsx"), "utf8");
    expect(panitera).toContain('"/bas/komentar" + (berkas?.nomorPerkara ? "?nomor=" + encodeURIComponent(berkas.nomorPerkara) : "")');
  });
});
