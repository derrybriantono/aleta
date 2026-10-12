/**
 * Penanda "pernah diskors" (12 Okt 2026, butir 25 - agen L).
 *
 *   - logika murni: sidang hari ini / sidang sebelumnya / bot lama / tidak pernah
 *   - gambar: ikon berputar, diam bila gerak dikurangi, keterangan lengkap
 *   - saklar `pernah-diskors`: ada, menyala bawaan, punya contoh, sungguh dipakai layar
 *   - bot: riwayat skors lintas hari (yang sudah dilanjutkan ikut), hanya BACA
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { PenandaPernahDiskorsView } from "@/components/portal/pernah-diskors";
import { lamaSingkat, penandaPernahDiskors, tanggalSingkat, type PetaRiwayatSkors } from "@/lib/pernah-diskors";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan, tampilanSemuaMati } from "@/lib/tampilan-antrian-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const SIDANG = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

afterEach(cleanup);

const HARI = "2026-10-12";
const baris = { perkaraId: "7", tanggalSidang: HARI };

describe("penandaPernahDiskors - logika murni", () => {
  it("tanpa riwayat dan tanpa skors berlaku: tidak ada penanda", () => {
    expect(penandaPernahDiskors({ riwayat: {}, baris, hariIni: HARI })).toBeNull();
    expect(penandaPernahDiskors({ riwayat: undefined, baris, hariIni: HARI })).toBeNull();
    // perkara lain tidak ikut
    const lain: PetaRiwayatSkors = { "8": [{ tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00` }] };
    expect(penandaPernahDiskors({ riwayat: lain, baris, hariIni: HARI })).toBeNull();
  });

  it("(a) sidang hari ini pernah diskors lalu dilanjutkan: 'Diskors HH:MM' + lama + catatan", () => {
    const riwayat: PetaRiwayatSkors = {
      "7": [
        {
          tanggalSidang: HARI,
          diskorsPada: `${HARI} 09:40:00`,
          dilanjutkanPada: `${HARI} 10:15:00`,
          alasan: "menunggu saksi",
          oleh: "Ani Panitera",
        },
      ],
    };
    const p = penandaPernahDiskors({ riwayat, baris, hariIni: HARI });
    expect(p?.label).toBe("Diskors 09:40");
    expect(p?.hariSidangIni).toBe(true);
    expect(p?.keterangan).toContain("Sidang hari ini diskors pukul 09:40");
    expect(p?.keterangan).toContain("dilanjutkan pukul 10:15 (diskors 35 menit)");
    expect(p?.keterangan).toContain("catatan: menunggu saksi");
    expect(p?.keterangan).toContain("oleh Ani Panitera");
  });

  it("(a) yang belum dilanjutkan disebut 'belum dilanjutkan'", () => {
    const p = penandaPernahDiskors({
      riwayat: { "7": [{ tanggalSidang: HARI, diskorsPada: `${HARI} 11:00:00` }] },
      baris,
      hariIni: HARI,
    });
    expect(p?.label).toBe("Diskors 11:00");
    expect(p?.keterangan).toContain("belum dilanjutkan");
  });

  it("(b) sidang SEBELUMNYA pernah diskors: 'Pernah diskors' + tanggal sidang itu", () => {
    const riwayat: PetaRiwayatSkors = {
      "7": [{ tanggalSidang: "2026-10-05", diskorsPada: "2026-10-05 10:00:00", dilanjutkanPada: "2026-10-05 12:30:00" }],
    };
    const p = penandaPernahDiskors({ riwayat, baris, hariIni: HARI });
    expect(p?.label).toBe("Pernah diskors");
    expect(p?.hariSidangIni).toBe(false);
    expect(p?.keterangan).toContain("Sidang tanggal 5 Okt 2026 diskors pukul 10:00");
    expect(p?.keterangan).toContain("diskors 2 jam 30 menit");
  });

  it("skors di sidang SESUDAH tanggal baris ini tidak dihitung; baris lampau memakai teks netral", () => {
    const riwayat: PetaRiwayatSkors = {
      "7": [
        { tanggalSidang: "2026-10-05", diskorsPada: "2026-10-05 10:00:00" },
        { tanggalSidang: "2026-10-19", diskorsPada: "2026-10-19 10:00:00" },
      ],
    };
    // baris sidang 5 Okt yang dilihat hari ini (12 Okt): sidang 5 Okt, bukan hari ini
    const lampau = penandaPernahDiskors({ riwayat, baris: { perkaraId: "7", tanggalSidang: "2026-10-05" }, hariIni: HARI });
    expect(lampau?.label).toBe("Pernah diskors");
    expect(lampau?.keterangan).not.toContain("19 Okt");
    // baris sidang 1 Okt: belum ada skors sebelumnya
    expect(penandaPernahDiskors({ riwayat, baris: { perkaraId: "7", tanggalSidang: "2026-10-01" }, hariIni: HARI })).toBeNull();
  });

  it("bot lama (tanpa riwayat): skors yang berlaku tetap menjadi penanda, tidak digandakan", () => {
    const aktif = { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00`, oleh: "Ani", alasan: "" };
    const p = penandaPernahDiskors({ riwayat: undefined, aktif, baris, hariIni: HARI });
    expect(p?.label).toBe("Diskors 09:40");
    // riwayat memuat skors yang sama -> satu kalimat saja
    const ganda = penandaPernahDiskors({
      riwayat: { "7": [{ tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00` }] },
      aktif,
      baris,
      hariIni: HARI,
    });
    expect(ganda?.keterangan.split("\n")).toHaveLength(1);
  });

  it("dua skors di hari yang sama: label memakai yang TERBARU, keterangan terbaru dulu", () => {
    const p = penandaPernahDiskors({
      riwayat: {
        "7": [
          { tanggalSidang: HARI, diskorsPada: `${HARI} 09:00:00`, dilanjutkanPada: `${HARI} 09:20:00` },
          { tanggalSidang: HARI, diskorsPada: `${HARI} 11:00:00`, dilanjutkanPada: `${HARI} 11:05:00` },
        ],
      },
      baris,
      hariIni: HARI,
    });
    expect(p?.label).toBe("Diskors 11:00");
    const [pertama, kedua] = (p?.keterangan ?? "").split("\n");
    expect(pertama).toContain("pukul 11:00");
    expect(kedua).toContain("pukul 09:00");
  });

  it("pembantu tanggal dan lama", () => {
    expect(tanggalSingkat("2026-10-05")).toBe("5 Okt 2026");
    expect(lamaSingkat(0)).toBe("kurang dari semenit");
    expect(lamaSingkat(35)).toBe("35 menit");
    expect(lamaSingkat(60)).toBe("1 jam");
    expect(lamaSingkat(95)).toBe("1 jam 35 menit");
  });
});

describe("PenandaPernahDiskorsView - gambar", () => {
  it("ikon panah melingkar BERPUTAR dan diam bila pengguna mematikan gerak; title memuat keterangan", () => {
    const penanda = penandaPernahDiskors({
      riwayat: { "7": [{ tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00`, dilanjutkanPada: `${HARI} 10:15:00` }] },
      baris,
      hariIni: HARI,
    });
    const { container } = render(createElement(PenandaPernahDiskorsView, { penanda }));
    const lencana = container.querySelector("[data-pernah-diskors]");
    expect(lencana?.textContent).toContain("Diskors 09:40");
    expect(lencana?.getAttribute("title")).toContain("dilanjutkan pukul 10:15");
    const ikon = container.querySelector("[data-pernah-diskors-ikon]");
    expect(ikon?.getAttribute("class")).toContain("animate-spin");
    expect(ikon?.getAttribute("class")).toContain("motion-reduce:animate-none");
  });

  it("tanpa penanda tidak menggambar apa pun", () => {
    const { container } = render(createElement(PenandaPernahDiskorsView, { penanda: null }));
    expect(container.innerHTML).toBe("");
  });
});

describe("saklar pernah-diskors", () => {
  it("ada di kelompok penanda, menyala bawaan, mati bila semua dimatikan, punya contoh", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "pernah-diskors");
    expect(s?.kelompok).toBe("penanda");
    expect(tampil(tampilanBawaan(), "pernah-diskors")).toBe(true);
    expect(tampil(tampilanSemuaMati(), "pernah-diskors")).toBe(false);
    expect(CONTOH_TAMPILAN["pernah-diskors"]).toBeTruthy();
  });

  it("layar membacanya dan menaruh penanda TEPAT di bawah tombol Selesai; lencana diskors lama tetap", () => {
    expect(SIDANG).toContain('tampil(tampilan, "pernah-diskors")');
    const iSelesai = SIDANG.indexOf("<TombolSelesaiSidang");
    const iPenanda = SIDANG.indexOf("<PenandaPernahDiskorsView", iSelesai);
    expect(iSelesai).toBeGreaterThan(0);
    expect(iPenanda).toBeGreaterThan(iSelesai);
    // tidak ada kolom/tombol lain di antara keduanya
    expect(SIDANG.slice(iSelesai + 1, iPenanda)).not.toMatch(/<Tombol[A-Z]|<button/);
    expect(SIDANG).toContain("<LencanaDiskors catatan={skorsIni} />");
  });
});

describe("bot - riwayat skors lintas hari", () => {
  type Layanan = Record<string, (x: unknown) => Promise<Record<string, unknown>>>;
  const mod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
    buatLayanan: (deps: Record<string, unknown>) => Layanan;
    TABEL_SKORS: string;
  };

  it("memulangkan semua skors (juga yang sudah dilanjutkan) per perkara, terlama dulu, hanya membaca", async () => {
    const sql: string[] = [];
    const L = mod.buatLayanan({
      kueriBot: async (q: string) => {
        const rapi = q.replace(/\s+/g, " ").trim();
        sql.push(rapi);
        // pembacaan riwayat: terbaru dulu (ORDER BY id DESC)
        if (rapi.includes(`FROM ${mod.TABEL_SKORS}`) && rapi.includes("ORDER BY id DESC")) {
          return [
            { perkaraId: "7", tanggalSidang: "2026-10-12", alasan: "", oleh: "Ani", diskorsPada: "2026-10-12 09:40:00", dilanjutkanPada: "2026-10-12 10:15:00" },
            { perkaraId: "7", tanggalSidang: "2026-10-05", alasan: "saksi", oleh: "Budi", diskorsPada: "2026-10-05 10:00:00", dilanjutkanPada: null },
            { perkaraId: "", tanggalSidang: "2026-10-05" },
          ];
        }
        return [];
      },
      kueriSipp: async () => [],
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      setelAntrian: async () => ({ ok: true }),
    });
    const hasil = (await L.petaSelesai({ dari: "2026-10-12", sampai: "2026-10-12" })) as {
      riwayatSkors: Record<string, Array<{ tanggalSidang: string; dilanjutkanPada: string; alasan: string }>>;
      sumber: { riwayatSkors: { terbaca: boolean } };
    };
    expect(hasil.sumber.riwayatSkors.terbaca).toBe(true);
    expect(Object.keys(hasil.riwayatSkors)).toEqual(["7"]);
    expect(hasil.riwayatSkors["7"].map((x) => x.tanggalSidang)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(hasil.riwayatSkors["7"][0].alasan).toBe("saksi");
    expect(hasil.riwayatSkors["7"][1].dilanjutkanPada).toBe("2026-10-12 10:15:00");
    // hanya SELECT yang menyentuh tabel skors (CREATE TABLE IF NOT EXISTS ikut, pola tabel bot)
    expect(sql.filter((q) => /^(INSERT|UPDATE|DELETE|REPLACE)/.test(q))).toEqual([]);
  });

  it("riwayat gagal dibaca tidak menjatuhkan peta lain; alasan disebut di sumber", async () => {
    const L = mod.buatLayanan({
      kueriBot: async (q: string) => {
        if (q.includes("ORDER BY id DESC")) throw new Error("tabel rusak");
        return [];
      },
      kueriSipp: async () => [],
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      setelAntrian: async () => ({ ok: true }),
    });
    const hasil = (await L.petaSelesai({ dari: "2026-10-12", sampai: "2026-10-12" })) as {
      ok: boolean;
      riwayatSkors: Record<string, unknown>;
      sumber: { riwayatSkors: { terbaca: boolean; alasan: string } };
    };
    expect(hasil.ok).toBe(true);
    expect(hasil.riwayatSkors).toEqual({});
    expect(hasil.sumber.riwayatSkors.terbaca).toBe(false);
    expect(hasil.sumber.riwayatSkors.alasan).toContain("tabel rusak");
  });
});
