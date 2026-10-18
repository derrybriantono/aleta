// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { CERMIN_BAWAAN, CERMIN_PER_PEMILIK, daftarBercermin } from "@/lib/tipe-keluaran/bawaan";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { CERMIN_PORTAL } from "@/lib/tipe-keluaran/bawaan/bawaan-portal";
import { sidik } from "@/lib/tipe-keluaran/gabung";
import { DAFTAR_TIPE, KUNCI_DAFTAR, type EntriCermin, type KunciDaftar, type PemilikCermin } from "@/lib/tipe-keluaran/kontrak";
import { BUNYI_KEHADIRAN } from "@/server/modules/aleta-ecourt/bas-kehadiran";

/**
 * ============================================================================
 * CERMIN = SUMBER, DIBUKTIKAN DENGAN MENJALANKAN SUMBERNYA (K10)
 * ============================================================================
 *
 * Cermin bawaan menentukan keluaran saat tabel kosong. Cermin yang berselisih
 * satu huruf dengan ekstensi berarti panel dan portal berbicara dua bahasa -
 * persis penyakit yang hendak disembuhkan tabel tipe keluaran.
 *
 * Tidak ada yang dibandingkan sebagai teks. Sumbernya DIJALANKAN:
 *   - panel-alat.js dijalankan utuh di node:vm (lingkungan peramban ditiru);
 *   - CALON_MEDAN_PANEL dan MEDAN_PINTU hidup di DALAM fungsi konten.js, dan
 *     DAFTAR_ALASAN_SDG di abt.js yang menuntut halaman ABT: deklarasinya
 *     ditemukan lewat AST TypeScript, lalu initializer-nya dijalankan di vm;
 *   - BUNYI_KEHADIRAN diimpor dari modul portal yang memakainya.
 */

const AKAR_EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");

function deklarasiDari(berkas: string, nama: string): unknown {
  const teks = readFileSync(path.join(AKAR_EKSTENSI, berkas), "utf8");
  const sf = ts.createSourceFile(berkas, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const temu: string[] = [];
  const jalan = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nama && n.initializer) {
      temu.push(n.initializer.getText(sf));
    }
    ts.forEachChild(n, jalan);
  };
  jalan(sf);
  expect(temu, `${nama} harus dideklarasikan tepat sekali di ${berkas}`).toHaveLength(1);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${temu[0]})`, {})));
}

function jalankanPanelAlat(): { ALAT_PETA_BAWAAN: Record<string, Record<string, unknown>>; ALAT_PADANAN_JENIS: [string, string[]][] } {
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
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    Map,
    Set,
    URLSearchParams,
    URL,
    AbortController,
    document: {
      documentElement: elemen(),
      createElement: elemen,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
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
      storage: {
        onChanged: { addListener() {} },
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
      },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), clone() { return this; } }),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumber, konteks, { filename: "panel-alat.js" });
  return JSON.parse(
    JSON.stringify({
      ALAT_PETA_BAWAAN: vm.runInContext("ALAT_PETA_BAWAAN", konteks),
      ALAT_PADANAN_JENIS: vm.runInContext("ALAT_PADANAN_JENIS", konteks),
    })
  );
}

function urutanRapat(entri: readonly EntriCermin[]) {
  return entri.every((e, i) => e.urutan === i);
}

describe("putusan.medan-borang = CALON_MEDAN_PANEL + MEDAN_PINTU (konten.js)", () => {
  const calon = deklarasiDari("konten.js", "CALON_MEDAN_PANEL") as { penunjuk: string; label: string; banyak?: boolean }[];
  const pintu = deklarasiDari("konten.js", "MEDAN_PINTU") as string[];
  const cermin = CERMIN_EKSTENSI["putusan.medan-borang"];

  it("12 medan, urutan dan isi sama persis", () => {
    expect(calon).toHaveLength(12);
    const dariCermin = cermin.map((e) => {
      const data = e.data as { penunjuk: string; banyak?: boolean };
      return { penunjuk: data.penunjuk, label: e.nilai, ...(data.banyak ? { banyak: true } : {}) };
    });
    expect(dariCermin).toEqual(calon);
    expect(cermin.every((e) => e.kunci === "putusan-akhir")).toBe(true);
    expect(urutanRapat(cermin)).toBe(true);
  });

  it("tanda pintu tepat pada medan MEDAN_PINTU, tidak pada yang lain", () => {
    expect(cermin.filter((e) => (e.data as { pintu?: boolean }).pintu).map((e) => (e.data as { penunjuk: string }).penunjuk)).toEqual(pintu);
  });
});

describe("putusan.peta-blangko dan putusan.padanan-jenis = panel-alat.js yang dijalankan", () => {
  const { ALAT_PETA_BAWAAN, ALAT_PADANAN_JENIS } = jalankanPanelAlat();

  // 4 jenis lama + 3 jenis gugatan lain (blok 4B 11 Okt: harta bersama, kewarisan, poligami)
  // + 18 baris status cerai (blok P 12 Okt: 9 status x CG/CT, kunci "<jenis>|<status>[|verstek]").
  // Q3 16 Okt: + 12 baris cerai per keadaan (6 x CG/CT), + baris permohonan & gugatan lain per status/keadaan (itsbat, DK, PAW, perwalian,
  // pengangkatan anak, AUA, HB, kewarisan, poligami) termasuk 2 baris jenis baru (penetapan ahli waris, perwalian) = 82.
  // I2 16 Okt: + 7 baris wali adhal (jenis + kabul/tolak/cabut + gugur/digugurkan/NO ke 9b) = 89; jenis tanpa status kini 10.
  // F21 17 Okt: + 36 baris = 125: hak asuh "penguasaan anak" (10) dan "lain-lain" Pdt.G berkeadaan hak-asuh (8), pembatalan perkawinan (9),
  // ekonomi syariah gugatan sederhana (9); jenis tanpa status kini 13 (+ penguasaan anak, pembatalan perkawinan, ekonomi syariah).
  // I7 17 Okt: + 3 baris varian = 128: HB rekonvensi dikabulkan [01a] (keadaan) dan hak asuh tolak Tergugat ibu [03a] (penguasaan anak + Lain-Lain).
  // I8 17 Okt: + 4 baris = 132: cerai ditolak kontradiktoir [03a] (CG, CT) dan hak asuh tolak verstek [03b] (penguasaan anak, Lain-Lain).
  // F22 17 Okt: + 34 baris = 166: pencegahan perkawinan (9), wasiat (13), ekonomi syariah acara biasa (12; baris berkeadaan "es-biasa*").
  it("ALAT_PETA_BAWAAN: 9 jenis + baris status cerai + keadaan + 4 baris kumulasi (T 13 Okt), isi sama persis ('bawaan: true' = asal bawaan)", () => {
    expect(Object.keys(ALAT_PETA_BAWAAN)).toHaveLength(292); // I15 18 Okt: -1 (baris "penguasaan anak|ditolak|hak-asuh-t-ibu" dihapus; 349 pindah ke 6b); I17 18 Okt: +105 (celah putusan); I19 18 Okt: +22 (cabut ditolak T, eksepsi kewenangan, putusan sela, itsbat)
    expect(Object.keys(ALAT_PETA_BAWAAN).filter((k) => k.includes("+") && k.split("|")[0].includes("+"))).toHaveLength(44); // 4 (T 13 Okt: verstek) + 40 (I17 18 Okt: cerai kumulasi itsbat / hak asuh, folder 1c / 1d)
    expect(Object.keys(ALAT_PETA_BAWAAN).filter((k) => !k.includes("|"))).toHaveLength(15); // + pencegahan perkawinan, wasiat (F22 17 Okt)
    const cermin = CERMIN_EKSTENSI["putusan.peta-blangko"];
    const dariCermin = Object.fromEntries(
      cermin.map((e) => {
        const data = e.data as { jenisAsli: string; statusAsli?: string; blangko?: string; blangkoLain?: string[]; catatan?: string };
        return [e.kunci, { berkas: e.nilai, ...data, bawaan: true }];
      })
    );
    expect(Object.keys(dariCermin)).toEqual(Object.keys(ALAT_PETA_BAWAAN));
    expect(dariCermin).toEqual(ALAT_PETA_BAWAAN);
    expect(urutanRapat(cermin)).toBe(true);
  });

  it("ALAT_PADANAN_JENIS: 4 kunci / 14 string, urutan sama persis", () => {
    const cermin = CERMIN_EKSTENSI["putusan.padanan-jenis"];
    const kelompok: [string, string[]][] = [];
    for (const e of cermin) {
      const akhir = kelompok.at(-1);
      if (akhir && akhir[0] === e.kunci) akhir[1].push(e.nilai);
      else kelompok.push([e.kunci, [e.nilai]]);
    }
    expect(kelompok).toEqual(ALAT_PADANAN_JENIS);
    expect(ALAT_PADANAN_JENIS).toHaveLength(4);
    expect(ALAT_PADANAN_JENIS.reduce((n, [, lain]) => n + 1 + lain.length, 0)).toBe(14);
  });
});

describe("bas.saksi.alasan-pilihan = DAFTAR_ALASAN_SDG (abt.js)", () => {
  it("16 alasan; kunci = label = string sumber", () => {
    const sumber = deklarasiDari("abt.js", "DAFTAR_ALASAN_SDG") as string[];
    const cermin = CERMIN_EKSTENSI["bas.saksi.alasan-pilihan"];
    expect(sumber).toHaveLength(16);
    expect(cermin.map((e) => e.kunci)).toEqual(sumber);
    expect(cermin.map((e) => e.nilai)).toEqual(sumber);
  });

  /**
   * Panel mengirim KUNCI pilihan petugas ke bot, dan bot mengucapkannya
   * sebagai keterangan saksi. Kunci yang tidak dikenal CIRI_ALASAN_SDG, atau
   * yang dikenal tetapi tidak punya bunyi, tercetak sebagai label mentah
   * ("... dan judi dan temperamental") - itulah yang terjadi 25 September
   * ketika empat kunci baru dideteksi tetapi belum diberi bunyi. Maka bot
   * DIJALANKAN untuk tiap pilihan: kuncinya harus terbuka untuk SDG, harus
   * mengubah jawaban saksi (bukan dibuang diam-diam), dan jawabannya tidak
   * boleh memuat kurung atau garis miring label.
   */
  it("tiap pilihan diucapkan bot sebagai keterangan saksi, tanpa label mentah", () => {
    const require_ = createRequire(import.meta.url);
    const layanan = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as {
      CIRI_ALASAN: { kunci: string; hanyaDeteksi?: boolean }[];
      susunKeteranganSaksiSdg: (o: Record<string, unknown>) => {
        ok: boolean;
        alasan: string[];
        saksi1: { jawab: string }[];
        saksi2: { jawab: string }[];
      };
    };
    const pustaka = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtKalimatBaku.js")) as {
      susunAlasanRinci: (daftar: string[], pihak?: { pelaku: string; lawan: string }) => { tanpaFrasa: string[] };
    };
    // Satu-satunya kunci yang BUNYINYA kuncinya sendiri: penyebab tanpa pelaku
    // ("... serta masalah ekonomi"), lihat daftarUcapan di abtUsulanService.
    // Kunci lain tanpa frasa berbunyi "Tergugat ... dan temperamental".
    const BERBUNYI_SENDIRI = new Set(["masalah ekonomi"]);
    const terbuka = new Set(layanan.CIRI_ALASAN.filter((b) => !b.hanyaDeteksi).map((b) => b.kunci));
    const templat = [{ no: "1", tanya: "Apa penyebab pertengkaran Penggugat dan Tergugat?", jawab: "karena ..." }];
    const susun = (alasan: string[]) =>
      layanan.susunKeteranganSaksiSdg({ templat, alasan, pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" });
    const tanpaAlasan = susun([]);
    const sumber = deklarasiDari("abt.js", "DAFTAR_ALASAN_SDG") as string[];
    for (const kunci of sumber) {
      expect(terbuka.has(kunci), `${kunci} terbuka untuk SDG di CIRI_ALASAN`).toBe(true);
      const tanpaFrasa = pustaka.susunAlasanRinci([kunci], { pelaku: "Tergugat", lawan: "Penggugat" }).tanpaFrasa;
      expect(tanpaFrasa, `${kunci} punya frasa di abtKalimatBaku`).toEqual(BERBUNYI_SENDIRI.has(kunci) ? [kunci] : []);
      const h = susun([kunci]);
      expect(h.ok, kunci).toBe(true);
      expect(h.alasan, kunci).toEqual([kunci]);
      for (const [ke, s] of [
        [1, h.saksi1[0].jawab],
        [2, h.saksi2[0].jawab],
      ] as const) {
        expect(s, `saksi ${ke} - ${kunci}: ${s}`).not.toMatch(/[()/]/);
        // Perselisihan adalah AKIBAT, bukan penyebab: dipilih sendirian, jawaban
        // "apa penyebabnya" tetap menunggu diisi petugas (sama seperti uji
        // korpus SDG di saksi-deteksi-korpus.test.ts).
        if (kunci === "perselisihan terus-menerus") continue;
        expect(s, `saksi ${ke} - ${kunci} tidak mengubah jawaban`).not.toBe(ke === 1 ? tanpaAlasan.saksi1[0].jawab : tanpaAlasan.saksi2[0].jawab);
      }
    }
  });
});

describe("bas.kehadiran.bunyi = BUNYI_KEHADIRAN (bas-kehadiran.ts)", () => {
  it("5 bunyi, urutan sama persis", () => {
    const cermin = CERMIN_PORTAL["bas.kehadiran.bunyi"];
    expect(BUNYI_KEHADIRAN).toHaveLength(5);
    expect(cermin.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN]);
    expect(cermin.every((e) => e.kunci === "")).toBe(true);
  });
});

describe("rangkaian cermin (index.ts)", () => {
  it("tiap daftar dirangkai oleh PEMILIKNYA menurut registri, dan tidak ada daftar ganda", () => {
    const terlihat = new Map<string, string>();
    for (const [pemilik, cermin] of Object.entries(CERMIN_PER_PEMILIK) as [PemilikCermin, Record<string, unknown>][]) {
      for (const daftar of Object.keys(cermin)) {
        expect(KUNCI_DAFTAR).toContain(daftar);
        expect(DAFTAR_TIPE[daftar as KunciDaftar].pemilikCermin, daftar).toBe(pemilik);
        expect(terlihat.has(daftar), `${daftar} dirangkai dua kali`).toBe(false);
        terlihat.set(daftar, pemilik);
      }
    }
    expect(Object.keys(CERMIN_BAWAAN).sort()).toEqual([...terlihat.keys()].sort());
  });

  it("sidik unik di dalam tiap daftar - dua entri bersidik sama akan kehilangan satu saat benih ditanam", () => {
    for (const daftar of daftarBercermin()) {
      const s = (CERMIN_BAWAAN[daftar] ?? []).map((e) => sidik(daftar, e.kunci, e.nilai, e.data));
      expect(new Set(s).size, daftar).toBe(s.length);
    }
  });
});
