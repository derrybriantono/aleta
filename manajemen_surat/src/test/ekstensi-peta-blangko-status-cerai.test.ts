// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { pilihBlangkoPutusan, saranPemetaan } from "@/lib/pemetaan-blangko";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { validasiEntri } from "@/lib/tipe-keluaran/validasi";

/**
 * ============================================================================
 * BLANGKO CERAI PER STATUS PUTUSAN (Agen P, 12 Okt 2026)
 * ============================================================================
 *
 * panel-alat.js dijalankan SUNGGUHAN (node:vm); pemilihnya (alatPetaUntukPerkara) dipanggil dengan nama jenis dan
 * status PERSIS seperti SIPP sipp_donggala (status_putusan jenis_pengadilan 4). Yang dijaga:
 *   1. tiap status cerai yang terjadi di satker mendarat di blangko derry_briantono yang tepat, di menu CG/CT yang benar;
 *   2. "Dikabulkan" verstek tetap ke [01] Format Lengkap (baris |verstek), kontradiktoir ke [02];
 *   3. status kosong = perilaku lama (baris jenis);
 *   4. baris status ikut ke tipe keluaran tertanam & kembali utuh dari entri portal (statusAsli tidak hilang);
 *   5. cermin portal lolos validasi dan saran admin memakai kunci admin "<Jenis>|<Status>[|verstek]";
 *   6. bila folder blangko ABT laptop ada, setiap nama berkas BENAR-BENAR ada di folder CG/CT.
 */

const AKAR_EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const ABT_DERRY = "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono";

function jalankanPanelAlat() {
  const sumber = readFileSync(path.join(AKAR_EKSTENSI, "panel-alat.js"), "utf8");
  const elemen = () => ({
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: unknown) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  });
  const konteks: Record<string, unknown> = {
    console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set,
    URLSearchParams, URL, AbortController,
    document: { documentElement: elemen(), createElement: elemen, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    location: { origin: "http://127.0.0.1", pathname: "/", search: "" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p: string) => p },
      storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), clone() { return this; } }),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumber, konteks, { filename: "panel-alat.js" });
  return (kode: string) => JSON.parse(JSON.stringify(vm.runInContext(kode, konteks) ?? null));
}

/** Menu putusan (abt_menu.nama, J3 MENU-FINAL.tsv) -> folder derry_briantono. */
const FOLDER_MENU_PUTUSAN: Record<string, string> = {
  "Putusan Cerai Gugat": "1 Perceraian CG",
  "Putusan Cerai Talak": "1a Perceraian CT",
  "Putusan Itsbat Nikah": "2 Itsbat Nikah",
  "Putusan Itsbat Nikah Kontensius": "2a Itsbat Nikah Kontensius",
  "Putusan Dispensasi Kawin": "3 Dispensasi Kawin",
  "Putusan Harta Bersama": "4a Harta Bersama",
  "Putusan Kewarisan": "4b Kewarisan",
  "Putusan Izin Poligami": "5 Izin Poligami",
  "Putusan Perwalian": "6 Perwalian",
  "Putusan Asal Usul Anak": "8 Asal Usul Anak",
  "Putusan Penetapan Ahli Waris (P3HP)": "9 Penetapan Ahli Waris",
  "Putusan Lain-Lain (Pengangkatan Anak)": "9a Lain-Lain (Pengangkatan Anak)",
  "Putusan Permohonan Umum (Cabut/Gugur/NO)": "9b Permohonan Umum",
};

type Baris = { berkas: string; blangko: string; statusAsli?: string; jenisAsli: string; catatan?: string };
type Hasil = { baris: Baris; kunci: string; tingkat: string } | null;

describe("pemilih blangko cerai per status (panel-alat.js yang dijalankan)", () => {
  const jalan = jalankanPanelAlat();
  const pilih = (jenis: string, status: string, verstek: boolean): Hasil =>
    jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(jenis)}, ${JSON.stringify(status)}, ${verstek})`);

  const HARAP: [string, boolean, string][] = [
    ["Dikabulkan", true, "[01] [Kabul Verstek] Cerai (Format Lengkap)"],
    ["Ditolak", true, "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti"],
    ["Ditolak", false, "[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti"],
    ["Tidak Dapat Diterima", false, "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui"],
    ["Tidak Dapat Diterima", true, "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui"],
    ["Digugurkan", false, "[98] [Gugur] 3. Cerai P & T Tidak Hadir"],
    ["Gugur", false, "[98] [Gugur] 3. Cerai P & T Tidak Hadir"],
    ["Dicabut", false, "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)"],
    ["Dicoret dari Register", false, "[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis"],
  ];

  for (const [jenis, kode, menu] of [
    ["Cerai Gugat", "CG", "Putusan Cerai Gugat"],
    ["Cerai Talak", "CT", "Putusan Cerai Talak"],
  ] as const) {
    it(`${jenis}: tiap status SIPP -> blangko & menu ${menu}`, () => {
      for (const [status, verstek, berkas] of HARAP) {
        const h = pilih(jenis, status, verstek);
        expect(h, `${status} verstek=${verstek}`).not.toBeNull();
        expect(h!.baris.berkas, `${status} verstek=${verstek}`).toBe(berkas);
        expect(h!.baris.blangko).toBe(menu);
        expect(h!.tingkat).toMatch(/^status/);
      }
      const kontra = pilih(jenis, "Dikabulkan", false);
      expect(kontra!.baris.berkas).toBe(`[02] [Kabul] ${kode} - F`);
      expect(kontra!.baris.catatan).toContain(`[02b] [Kabul] ${kode} - F - Mediasi Berhasil Sebagian`);
    });
  }

  it("status bertulisan SIPP '(verstek)' dibaca verstek; status kosong = baris jenis lama", () => {
    expect(pilih("Cerai Gugat", "Dikabulkan (verstek)", false)!.kunci).toBe("cerai gugat|dikabulkan|verstek");
    const lama = pilih("Cerai Talak", "", false);
    expect(lama!.tingkat).toBe("jenis");
    expect(lama!.baris.berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
  });

  it("baris status tidak menyentuh jenis lain (poligami dikabulkan tetap baris jenis)", () => {
    const h = pilih("Izin Poligami", "Dikabulkan", false);
    expect(h!.tingkat).toBe("jenis");
    expect(h!.baris.berkas).toBe("[01] [Kabul] Izin Poligami");
  });

  it("tipe keluaran tertanam membawa statusAsli dan kembali utuh lewat alatPetaBawaanDariEntri", () => {
    const tertanam = jalan("alatTipeTertanamPeta()") as { kunci: string; data: { statusAsli?: string } }[];
    const status = tertanam.filter((e) => e.kunci.includes("|") && !e.kunci.includes("+")); // "+" = baris kumulasi (T 13 Okt)
    // 18 baris status cerai (9 status x CG/CT) + baris keadaan dan baris permohonan/gugatan lain (Q3 16 Okt), semuanya bernama status.
    const cerai = status.filter((e) => /^cerai (gugat|talak)\|/.test(e.kunci) && [undefined, "verstek"].includes(e.kunci.split("|")[2]));
    expect(cerai).toHaveLength(18);
    expect(status.length).toBeGreaterThan(18);
    expect(status.every((e) => typeof e.data.statusAsli === "string" && e.data.statusAsli)).toBe(true);
    const balik = jalan("alatPetaBawaanDariEntri(alatTipeTertanamPeta())");
    expect(balik).toEqual(jalan("ALAT_PETA_BAWAAN"));
  });

  const folderAda = existsSync(ABT_DERRY);
  it.skipIf(!folderAda)("tiap nama berkas status ada di folder derry_briantono laptop (paket abt-cerai-lengkap terpasang)", () => {
    const peta = jalan("ALAT_PETA_BAWAAN") as Record<string, Baris>;
    for (const [kunci, b] of Object.entries(peta)) {
      if (kunci.split("|")[0].includes("+")) continue; // baris kumulasi (T 13 Okt) dijaga putusan-bas-kumulasi-13okt.test.ts
      // Q3 16 Okt: folder menurut MENU yang dipakai barisnya (menu putusan: nama TETAP sesudah susunan berpasangan).
      const folder = FOLDER_MENU_PUTUSAN[b.blangko];
      if (!folder) continue; // baris jenis lama tanpa menu (itsbat, dispensasi) - dijaga uji lain
      // Folder laptop (PA Bungku) hanya memuat paket cerai; nama berkas permohonan/gugatan lain diperiksa terhadap daftar berkas server
      // (peta perkara L3, 16 Okt 2026) saat dibangun - lihat putusan-per-keadaan-q3.test.ts untuk daftar tetapnya.
      if (!/^Putusan Cerai (Gugat|Talak)$/.test(b.blangko)) continue;
      // I8 17 Okt: [03a] tolak kontradiktoir milik paket ABT abt-tolak-ikrar-derry - ada di laptop hanya sesudah dipasang di sana (dijaga pemetaan-i8-17okt.test.ts atas fixture server).
      // I17 18 Okt: [98] [Cabut] 7. (sesudah jawaban) dan [98] [NO] 8. (cacat formil) milik paket abt-putusan-celah-gugatan-derry - dijaga pemetaan-i17-18okt.test.ts atas fixture server.
      const belumTerpasangI17 = (nama: string) => /^\[98\] \[(Cabut|NO)\] [78]\. Cerai P & T Hadir/.test(nama) && !existsSync(path.join(ABT_DERRY, folder, `${nama}.rtf`));
      // I19/I22 18 Okt: [02c] cabut ditolak T / kumulasi nafkah istri, [99c]/[99d] eksepsi kewenangan, [98e]/[98f] putusan sela, [01d] verstek kumulasi nafkah istri - paket belum terpasang di laptop (dijaga pemetaan-i19/i22-18okt.test.ts atas fixture server).
      const belumTerpasangBaru = (nama: string) => /Pencabutan Ditolak T Sesudah Jawaban|Eksepsi Kewenangan|Kumulasi Nafkah Istri/.test(nama) && !existsSync(path.join(ABT_DERRY, folder, `${nama}.rtf`));
      const belumTerpasangI8 = (nama: string) => /^\[03a\] \[Tolak\] Cerai - Kontradiktoir/.test(nama) && !existsSync(path.join(ABT_DERRY, folder, `${nama}.rtf`));
      if (belumTerpasangI8(b.berkas) || belumTerpasangI17(b.berkas) || belumTerpasangBaru(b.berkas)) continue;
      expect(existsSync(path.join(ABT_DERRY, folder, `${b.berkas}.rtf`)), `${kunci}: ${b.berkas}`).toBe(true);
      if (!/^varian: /.test(b.catatan || "")) continue;
      for (const varian of (b.catatan || "").replace(/^varian: /, "").split("; ").filter(Boolean)) {
        // G3 15 Okt: 4b (nama baru, paket agen H3) ikut. F3 14 Okt: 3b (kuasa insidentil) milik paket ABT abt-kuasa-insidentil (agen B3) - ada di laptop hanya sesudah dipasang di sana.
        if (/(\[Gugur\] 3b|\[NO\] 4b)\. Cerai P Diwakili Kuasa Insidentil/.test(varian) && !existsSync(path.join(ABT_DERRY, folder, `${varian}.rtf`))) continue;
        if (belumTerpasangI8(varian) || belumTerpasangI17(varian) || belumTerpasangBaru(varian)) continue;
        expect(existsSync(path.join(ABT_DERRY, folder, `${varian}.rtf`)), `${kunci} varian: ${varian}`).toBe(true);
      }
    }
  });
});

describe("cermin portal & layar admin", () => {
  it("cermin putusan.peta-blangko lolos validasi portal (statusAsli dikenal)", () => {
    for (const e of CERMIN_EKSTENSI["putusan.peta-blangko"]) {
      const h = validasiEntri("putusan.peta-blangko", { kunci: e.kunci, nilai: e.nilai, data: e.data });
      expect(h.ok, `${e.kunci}: ${h.ok ? "" : h.alasan.join("; ")}`).toBe(true);
    }
  });

  it("saran admin memakai kunci <Jenis>|<Status>[|verstek] dan dipilih pilihBlangkoPutusan seperti di ekstensi", () => {
    const saran = Object.fromEntries(saranPemetaan("putusan").map((s) => [s.kunci, s.namaBerkas]));
    expect(saran["Cerai Gugat|Dikabulkan|verstek"]).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(saran["Cerai Talak|Dikabulkan"]).toBe("[02] [Kabul] CT - F");
    expect(saran["Cerai Talak|Dicabut"]).toBe("[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)");
    expect(saran["Cerai Gugat"]).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
    const h = pilihBlangkoPutusan(saran, { jenis: "Cerai Talak", status: "Dicabut", verstek: false });
    expect(h && h.namaBerkas).toBe(saran["Cerai Talak|Dicabut"]);
  });
});
