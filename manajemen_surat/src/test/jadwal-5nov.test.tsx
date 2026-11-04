import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelAntrianJam } from "@/components/portal/aleta-ecourt-sidang";
import { PilihAtauKetik } from "@/components/portal/hasil-sidang";
import { IsianMediator, TombolPilihMediator } from "@/components/portal/jadwal-sidang-1okt";

const require = createRequire(import.meta.url);
const layananMediator = require(path.resolve(process.cwd(), "../aleta_bot/services/mediatorTulisService.js")) as {
  buatLayanan: (deps: { kueri: (sql: string, params?: unknown[]) => Promise<unknown[]> }) => {
    daftarMediator: (perkaraId: number) => Promise<Array<{ id: number; jumlahTahunIni?: number }>>;
  };
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("alasan penundaan: pilih lalu sunting di kotak yang sama", () => {
  function Bungkus() {
    const [nilai, setNilai] = useState("");
    return createElement(PilihAtauKetik, {
      label: "Alasan penundaan",
      nilai,
      onUbah: setNilai,
      pilihan: ["Kesimpulan para pihak", "Pemeriksaan saksi belum selesai"],
    });
  }

  it("memilih dari daftar mengisi kotak, lalu kalimatnya dapat disunting langsung", () => {
    render(createElement(Bungkus));
    const kotak = screen.getByRole("combobox", { name: "Alasan penundaan" }) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Daftar alasan penundaan" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Kesimpulan para pihak" }));
    expect(kotak.value).toBe("Kesimpulan para pihak");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.change(kotak, { target: { value: "Kesimpulan para pihak secara tertulis" } });
    expect(kotak.value).toBe("Kesimpulan para pihak secara tertulis");
  });

  it("tidak ada kotak kedua, dan kalimat sendiri yang tidak ada di daftar tetap sah", () => {
    render(createElement(Bungkus));
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const kotak = screen.getByRole("combobox", { name: "Alasan penundaan" }) as HTMLInputElement;
    fireEvent.change(kotak, { target: { value: "Hakim sakit" } });
    expect(kotak.value).toBe("Hakim sakit");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("panah membuka daftar utuh walau kotaknya sudah berisi pilihan", () => {
    render(createElement(Bungkus));
    fireEvent.click(screen.getByRole("button", { name: "Daftar alasan penundaan" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Kesimpulan para pihak" }));
    fireEvent.click(screen.getByRole("button", { name: "Daftar alasan penundaan" }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});

describe("sel antrian di kartu baru", () => {
  const baris = {
    jamSidang: "08:30",
    tanggalSidang: "2026-11-05",
    agenda: "Jawaban",
    lewatEcourt: false,
  } as never;
  const sel = (tambahan: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(SelAntrianJam, { baris, tanggalTampil: "2026-11-05", sidangSelesai: false, gayaKartu: true, ...tambahan } as never)
    );

  it("nomor dalam kotak dan jam di sampingnya, jam tidak diulang di bawah", () => {
    const html = sel({ antrian: { nomor: 3, keadaan: "menunggu", tanggalSidang: "2026-11-05" } });
    expect(html).toContain('title="Nomor antrian 3 — menunggu dipanggil"');
    expect(html.match(/08:30/g)).toHaveLength(1);
  });

  it("tanpa nomor dan sudah ada hasil: tampak sebagai Tanpa antrian, bukan Belum ambil", () => {
    for (const antrian of [undefined, { nomor: null, keadaan: "menunggu", tanggalSidang: "2026-11-05" }]) {
      const html = sel({ antrian, sidangSelesai: true });
      expect(html).toContain("Tanpa antrian");
      expect(html).not.toContain("Belum ambil");
    }
  });

  it("tanpa nomor dan belum ada hasil: tetap Belum ambil", () => {
    const html = sel({ antrian: { nomor: null, keadaan: "menunggu", tanggalSidang: "2026-11-05" } });
    expect(html).toContain("Belum ambil");
    expect(html).not.toContain("Tanpa antrian");
  });

  it("tampilan lama tidak berubah: tanpa nomor yang sudah selesai tetap seperti dulu", () => {
    const html = renderToStaticMarkup(
      createElement(SelAntrianJam, {
        baris,
        tanggalTampil: "2026-11-05",
        sidangSelesai: true,
        antrian: { nomor: null, keadaan: "menunggu", tanggalSidang: "2026-11-05" },
      } as never)
    );
    expect(html).toContain("Belum ambil");
  });
});

describe("mediator: angka tahun berjalan", () => {
  it("bot menggabung mediasi dan mediasi sukarela, per perkara, tahun berjalan", async () => {
    const dipanggil: Array<{ sql: string; params?: unknown[] }> = [];
    const kueri = async (sql: string, params?: unknown[]) => {
      dipanggil.push({ sql, params });
      if (sql.includes("FROM mediator m")) {
        return [
          { id: 25, status: "H", nama: "A", namaGelar: "A, S.H.", noSertifikasi: "", hakimId: null },
          { id: 30, status: "N", nama: "B", namaGelar: "B, S.H.", noSertifikasi: "", hakimId: null },
        ];
      }
      if (sql.includes("COUNT(DISTINCT perkara_id)")) return [{ mediatorId: "25", jumlah: 12 }];
      return [];
    };
    const hasil = await layananMediator.buatLayanan({ kueri }).daftarMediator(0);
    expect(hasil.find((m) => m.id === 25)?.jumlahTahunIni).toBe(12);
    expect(hasil.find((m) => m.id === 30)?.jumlahTahunIni).toBe(0);
    const hitung = dipanggil.find((d) => d.sql.includes("COUNT(DISTINCT perkara_id)"))!;
    expect(hitung.sql).toContain("jenis_mediasi IN (1, 2)");
    const tahun = new Date().getFullYear();
    expect(hitung.params).toEqual([`${tahun}-01-01`, `${tahun + 1}-01-01`]);
  });

  it("hitungan gagal terbaca: daftar tetap ada, angkanya tidak dikarang", async () => {
    const kueri = async (sql: string) => {
      if (sql.includes("FROM mediator m")) return [{ id: 25, status: "H", nama: "A", namaGelar: "A", noSertifikasi: "", hakimId: null }];
      if (sql.includes("COUNT(DISTINCT perkara_id)")) throw new Error("putus");
      return [];
    };
    const hasil = await layananMediator.buatLayanan({ kueri }).daftarMediator(0);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].jumlahTahunIni).toBeUndefined();
  });

  function pasangDataMediator() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              available: true,
              mediasi: [],
              daftarMediator: [
                { id: 25, status: "H", nama: "A", namaGelar: "A, S.H.", noSertifikasi: "", anggotaMajelis: false, jumlahTahunIni: 12 },
                { id: 30, status: "N", nama: "B", namaGelar: "B, S.H.", noSertifikasi: "", anggotaMajelis: false },
              ],
              akun: { hakim: null, panitera: null },
            },
          }),
          { status: 200 }
        )
      )
    );
  }

  it("angka tampil di samping nama; tanpa angka bila belum terbaca", async () => {
    pasangDataMediator();
    render(createElement(IsianMediator, { perkaraId: "10063", nomorPerkara: "520/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-29" }));
    expect(await screen.findByRole("option", { name: "A, S.H. (12)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "B, S.H." })).toBeTruthy();
  });

  it("borang tanpa keterangan teknis", async () => {
    pasangDataMediator();
    render(createElement(TombolPilihMediator, { gaya: "pita", sebab: "", baris: { perkaraId: "10063", nomorPerkara: "520/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-29" } }));
    fireEvent.click(screen.getByRole("button", { name: "Tetapkan mediator" }));
    await screen.findByRole("option", { name: "A, S.H. (12)" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy());
    const teks = document.body.textContent ?? "";
    for (const kata of ["SIPP", "akun", "Tgl Mulai", "tabel", "langkah"]) expect(teks).not.toContain(kata);
  });
});
