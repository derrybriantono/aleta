// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelDrafH7 } from "@/components/portal/draf-h7";
import {
  daftarVarianH7,
  pilihBlangkoH7,
  ringkasDrafH7,
  teksLaporanH7,
  untukChecklistH7,
  varianTolakBerbeda,
  type DrafH7,
} from "@/lib/agen-h7-putusan";
import { susunDrafSatu, type SumberAgenH7 } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import type { Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import type { AletaDatabase } from "@/server/db/client";

/**
 * 17 Okt 2026 - keputusan pengguna butir 54: agen H-7 menyiapkan varian draf
 * "ditolak" di samping "dikabulkan". Blangko tolak menurut keadaan (verstek /
 * hadir), ringkasan sama, hakim memilih varian (portal & checklist konseptor).
 * Ukur atas putusan nyata Jan-16 Okt 2026 (server, baca saja): 5 dari 739
 * putusan ditolak, 5/5 varian tolak = blangko menurut status akhir dan cocok
 * dengan amar (verstek / tidak).
 */

const BARIS = {
  perkaraId: "231", nomorPerkara: "231/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalSidang: "2026-10-24", agenda: "Musyawarah Majelis",
  urutanSidang: 4, panggilan: { tergugatPernahHadir: true }, majelisNama: "Hakim A", paniteraNama: "PP B",
};

describe("pilih blangko varian tolak", () => {
  it("cerai: hadir -> [Tolak] kontradiktoir; tidak pernah hadir -> [Tolak Verstek]; alasan menyebut varian", () => {
    const hadir = pilihBlangkoH7(BARIS, "putusan", "ditolak");
    expect(hadir.utama?.label).toMatch(/^\[03\] \[Tolak\] Cerai/);
    expect(hadir.alasan).toMatch(/varian bila majelis menolak/);
    const verstek = pilihBlangkoH7({ ...BARIS, panggilan: { tergugatPernahHadir: false } }, "putusan", "ditolak");
    expect(verstek.utama?.label).toBe("[01ab] [Tolak Verstek] Cerai - Tidak ada bukti");
    expect(varianTolakBerbeda(pilihBlangkoH7(BARIS, "putusan"), hadir)).toBe(true);
  });

  it("jenis tanpa baris tolak di peta (Zakat, Isbat Wasiat): TIDAK ada varian - bukan blangko kabul berlabel tolak", () => {
    // 18 Okt 2026 (paket i17): Kewarisan, PAW, dan Izin Poligami KINI punya blangko tolak sendiri, jadi contoh
    // "tanpa baris tolak" diganti jenis yang memang belum dipetakan sama sekali. 18 Okt (paket i28): Hibah dan Wakaf kini punya blangko tolak sendiri (folder 4d / 4e).
    for (const jenisPerkara of ["Zakat", "Isbat Wasiat"]) {
      const b = { ...BARIS, jenisPerkara, nomorPerkara: "9/Pdt.G/2026/PA.Dgl" };
      const t = pilihBlangkoH7(b, "putusan", "ditolak");
      expect(t.utama, jenisPerkara).toBeNull();
      expect(varianTolakBerbeda(pilihBlangkoH7(b, "putusan"), t)).toBe(false);
    }
    // Sebaliknya, jenis yang kini punya blangko tolak harus mendapat varian tolak (bukan blangko kabul).
    for (const jenisPerkara of ["Kewarisan", "P3HP/Penetapan Ahli Waris", "Izin Poligami", "Hibah", "Wakaf"]) {
      const b = { ...BARIS, jenisPerkara, nomorPerkara: "9/Pdt.G/2026/PA.Dgl" };
      const t = pilihBlangkoH7(b, "putusan", "ditolak");
      expect(t.utama?.label, jenisPerkara).toMatch(/^\[03\] \[Tolak\]/);
      expect(varianTolakBerbeda(pilihBlangkoH7(b, "putusan"), t), jenisPerkara).toBe(true);
    }
    expect(pilihBlangkoH7({ ...BARIS, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "194/Pdt.P/2026/PA.Dgl" }, "putusan", "ditolak").utama?.label).toBe(
      "[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)"
    );
  });
});

// ── Agen: satu perkara, sumber tiruan ──────────────────────────────────────
const KATALOG = new Map<string, Definisi>([
  ["0222", { kode: "0222", nama: "Awal Konflik", jenis: "data_teks", sql: "", bawaan: "" }],
  ["8503", { kode: "8503", nama: "Alasan Perceraian", jenis: "data_teks", sql: "", bawaan: "" }],
  ["8902", { kode: "8902", nama: "Pertimbangan tidak terbukti", jenis: "data_teks", sql: "", bawaan: "" }],
]);

function sumber(panggilan: string[]): SumberAgenH7 {
  const tak = async () => [];
  return {
    async jadwal() {
      return { ok: true, galat: "", sidang: [] };
    },
    async bacaBlangko(folder, berkas) {
      panggilan.push(`blangko.baca ${berkas}`);
      // Blangko tolak punya isian pertimbangan "tidak terbukti" yang tidak ada di blangko kabul.
      return { ada: true, penanda: /Tolak/.test(berkas) ? ["0222", "8902"] : ["0222", "8503"], sebab: "" };
    },
    async katalog() {
      return KATALOG;
    },
    async nilaiPenanda(_id, kode) {
      panggilan.push(`abt.nilaiPenanda ${[...kode].sort().join(",")}`);
      return { ada: true, sebab: "", nilai: { "0222": { status: "terisi", teks: "Maret 2024" } } };
    },
    async usulan(_db, muatan) {
      panggilan.push(`usulan ${muatan.sumber}`);
      return { ok: true, galat: "", jalur: [{ jalur: "sipp", usulan: [{ kode: "8503", nilai: "F", keyakinan: "pasti" }] }] };
    },
    riwayat: tak,
    saksi: tak,
    dokumen: tak,
    ktp: tak,
  };
}

describe("agen menyusun varian ditolak", () => {
  it("dua blangko dibaca, nilai ABT satu permintaan untuk penanda keduanya, isian & kesiapan per varian, ringkasan satu", async () => {
    const panggilan: string[] = [];
    const d = (await susunDrafSatu({} as AletaDatabase, BARIS, sumber(panggilan), new Date("2026-10-17T06:00:00+08:00")))!;
    expect(panggilan.filter((p) => p.startsWith("blangko.baca"))).toHaveLength(2);
    const nilai = panggilan.filter((p) => p.startsWith("abt.nilaiPenanda"));
    expect(nilai).toHaveLength(1);
    expect(nilai[0]).toContain("8503");
    expect(nilai[0]).toContain("8902");
    expect(d.blangko.utama?.label).toMatch(/Kabul/);
    expect(d.varian).toHaveLength(1);
    const v = d.varian![0];
    expect(v.status).toBe("ditolak");
    expect(v.blangko.utama?.label).toMatch(/\[Tolak\]/);
    expect(v.isian.map((i) => i.kode).sort()).toEqual(["0222", "8902"]);
    expect(v.isian.find((i) => i.kode === "8902")?.golongan).toBe("manusia");
    expect(d.isian.map((i) => i.kode).sort()).toEqual(["0222", "8503"]);
    expect(daftarVarianH7(d).map((x) => x.status)).toEqual(["dikabulkan", "ditolak"]);
  });

  it("jenis tanpa blangko tolak (belum dipetakan): tanpa varian", async () => {
    const panggilan: string[] = [];
    const d = (await susunDrafSatu({} as AletaDatabase, { ...BARIS, jenisPerkara: "Zakat" }, sumber(panggilan)))!;
    expect(panggilan.filter((p) => p.startsWith("blangko.baca"))).toHaveLength(0);
    expect(d.varian).toEqual([]);
  });

  it("jenis yang kini punya blangko tolak (Kewarisan, paket i17): dua blangko dibaca, satu varian ditolak", async () => {
    const panggilan: string[] = [];
    const d = (await susunDrafSatu({} as AletaDatabase, { ...BARIS, jenisPerkara: "Kewarisan" }, sumber(panggilan)))!;
    expect(panggilan.filter((p) => p.startsWith("blangko.baca"))).toHaveLength(2);
    expect(d.varian).toHaveLength(1);
    expect(d.varian![0].status).toBe("ditolak");
  });
});

// ── Laporan, checklist, layar ──────────────────────────────────────────────
async function drafContoh(): Promise<DrafH7> {
  return (await susunDrafSatu({} as AletaDatabase, BARIS, sumber([]), new Date("2026-10-17T06:00:00+08:00")))!;
}

afterEach(() => vi.unstubAllGlobals());

describe("laporan, checklist konseptor, panel Jadwal Sidang", () => {
  it("laporan menyebut varian; checklist membawa { blangko, saran } per varian; draf lama tanpa varian = []", async () => {
    const d = await drafContoh();
    expect(teksLaporanH7(d).join(" ")).toMatch(/Varian ditolak juga disiapkan: Tolak .*Majelis memilih varian sesudah musyawarah/);
    const c = untukChecklistH7(d);
    expect(c.varian).toHaveLength(1);
    expect(c.varian[0]).toMatchObject({ status: "ditolak", judul: "Varian ditolak", blangko: { label: expect.stringMatching(/Tolak/) } });
    expect(c.blangko?.label).toMatch(/Kabul/);
    const lama = { ...d } as DrafH7;
    delete lama.varian;
    expect(untukChecklistH7(lama).varian).toEqual([]);
    expect(daftarVarianH7(lama)).toHaveLength(1);
  });

  it("pop-up: varian dikabulkan dan ditolak tetap dapat dipilih; blangko & isian mengikuti varian, ringkasan perkara tetap (19 Okt: dialog bertahap)", async () => {
    const d = await drafContoh();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { peta: { "231": { ...d, laporan: teksLaporanH7(d) } } } }), { status: 200 })));
    render(<PanelDrafH7 perkaraId="231" ringkas={ringkasDrafH7(d)} />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button")[0]);
    });
    const dialog = document.body.querySelector("[data-dialog-draf-h7]") as HTMLElement;
    expect(dialog).not.toBeNull();
    const namaTolak = d.varian![0].isian.find((i) => i.kode === "8902")!.nama;
    const tolak = dialog.querySelector('[data-varian-h7="ditolak"]') as HTMLButtonElement;
    expect(tolak).not.toBeNull();
    expect(dialog.querySelector('[data-varian-h7="dikabulkan"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(dialog.querySelector("[data-nama-blangko]")?.textContent).toMatch(/^Kabul/);
    const kalimatKabul = dialog.querySelector("[data-kalimat-ringkasan]")?.textContent;
    await act(async () => {
      fireEvent.click(dialog.querySelector('[data-tahap="perlu"]') as HTMLElement);
    });
    expect(dialog.textContent).not.toContain(namaTolak);
    await act(async () => {
      fireEvent.click(tolak);
    });
    expect(tolak.getAttribute("aria-pressed")).toBe("true");
    expect(dialog.textContent).toContain(namaTolak);
    await act(async () => {
      fireEvent.click(dialog.querySelector('[data-tahap="ringkasan"]') as HTMLElement);
    });
    expect(dialog.querySelector("[data-nama-blangko]")?.textContent).toMatch(/^Tolak/);
    expect(dialog.querySelector("[data-kalimat-ringkasan]")?.textContent).toBe(kalimatKabul);
    expect(dialog.textContent).not.toMatch(/8902/);
  });
});

describe("ekstensi: kartu checklist konseptor memberi tombol per varian", () => {
  it("konseptor-langkah.js: tombol data-kl-pakai-h7 per varian, pakaiDrafH7 menerima varian apa adanya", () => {
    const js = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/konseptor-langkah.js"), "utf8");
    expect(js).toMatch(/data-kl-pakai-h7="\$\{i\}"/);
    expect(js).toMatch(/Buka draf varian dikabulkan/);
    expect(js).toMatch(/varian\[Number\(ke\)\] \? varian\[Number\(ke\)\] : S\.h7/);
  });
});
