// @vitest-environment jsdom
/**
 * Usulan bunyi Fitur 46 (kartu-usulan-bukti.json): kartu `disetujui: false` tidak pernah keluar sebagai paragraf atau teks salin, kunci ada di katalog,
 * tanpa kata terlarang dan tanpa 16 angka, pasal hanya dari daftar yang diperiksa, kartu blangko tetap menang, sesudah disetujui menjadi usulan.
 * Data rekaan.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { jenisBuktiDari, KATALOG_BUKTI, kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";
import { bolehDisarankan } from "@/lib/rak-peraturan/indeks";
import {
  BUNYI_TANPA_ASLI,
  KARTU_PERTIMBANGAN,
  KARTU_USULAN,
  susunParagrafBukti,
  type BuktiMasuk,
  type JenisPerkaraBukti,
  type KartuUsulan,
  type KeadaanKartu,
  type MasukanPertimbangan,
} from "@/lib/sinkron-pertimbangan-bukti";

const AKAR = process.cwd();
const MENTAH = readFileSync(join(AKAR, "src/lib/kartu-usulan-bukti.json"), "utf8");
const TINJAUAN = readFileSync(join(AKAR, "../docs/arahan/awan-F46-usulan-bunyi.md"), "utf8");
const katalog = (k: string) => KATALOG_BUKTI.find((x) => x.kunci === k);

const baris = (kunci: string, tambah: Partial<BarisBukti> = {}): BarisBukti => ({ nm: katalog(kunci)?.nama ?? kunci, meterai: 0, cocok: 0, ...tambah });
const bukti = (sisi: "P" | "T", nomor: number, kunci: string, tambah: Partial<BarisBukti> = {}): BuktiMasuk => ({ sisi, nomor, baris: baris(kunci, tambah) });

function susun(jenis: JenisPerkaraBukti, status: string, verstek: boolean, daftar: BuktiMasuk[], ekstra: Partial<MasukanPertimbangan> = {}) {
  return susunParagrafBukti({ jenisPerkara: jenis, status, verstek, lawanHadir: !verstek, lawanMembantah: false, agendaPembuktianKe: 0, bukti: daftar, ...ekstra });
}
const statusDari = (k: KeadaanKartu) => (k.startsWith("tolak") ? "Ditolak" : "Dikabulkan");
const verstekDari = (k: KeadaanKartu) => k.endsWith("verstek");
const setujui = (id: string): KartuUsulan[] => KARTU_USULAN.map((c) => (c.id === id ? { ...c, disetujui: true } : c));
/** Isi tiap kalimat kartu (tanpa penanda) untuk mencari kebocoran ke paragraf. */
const ciriKartu = (c: KartuUsulan) => `menerangkan ${c.isi}`;

/** Daftar rujukan yang diperiksa: rak = terverifikasi di rak peraturan; blangko = sudah dipakai kartu blangko. */
const DAFTAR_PASAL = [
  { teks: "Pasal 1870 Kitab Undang-Undang Hukum Perdata", sumber: "rak" },
  { teks: "Pasal 165 HIR", sumber: "rak" },
  { teks: "Pasal 7 ayat (3) huruf b Kompilasi Hukum Islam", sumber: "rak" },
  { teks: "Pasal 285 RBg", sumber: "blangko" },
] as const;

describe("isi berkas kartu usulan", () => {
  it("semua kartu lengkap dan belum disetujui", () => {
    expect(KARTU_USULAN.length).toBeGreaterThan(0);
    for (const c of KARTU_USULAN) {
      expect(c.disetujui, c.id).toBe(false);
      expect(c.id && c.kunci && c.bunyi && c.isi, c.id).toBeTruthy();
      expect(c.perkara.length, c.id).toBeGreaterThan(0);
      expect(c.keadaan.length, c.id).toBeGreaterThan(0);
      expect(Array.isArray(c.dasar) && Array.isArray(c.perluDicek), c.id).toBe(true);
    }
    expect(new Set(KARTU_USULAN.map((c) => c.id)).size).toBe(KARTU_USULAN.length);
  });

  it("satu jenis hanya punya satu kartu pada perkara dan keadaan yang sama", () => {
    const lihat = new Set<string>();
    for (const c of KARTU_USULAN)
      for (const p of c.perkara)
        for (const k of c.keadaan) {
          const kunci = `${c.kunci}|${p}|${k}`;
          expect(lihat.has(kunci), kunci).toBe(false);
          lihat.add(kunci);
        }
  });

  it("semua kunci ada di katalog bukti surat, bukan kebendaan, dan nama katalognya terbaca ke kunci itu", () => {
    for (const c of KARTU_USULAN) {
      const j = katalog(c.kunci);
      expect(j, c.kunci).toBeTruthy();
      expect(j?.kelompok, c.kunci).not.toBe("Harta benda");
      expect(jenisBuktiDari(j?.nama), c.kunci).toBe(c.kunci);
    }
  });

  it("tiada kata terlarang, tiada 16 angka, tiada data pihak", () => {
    expect(MENTAH).not.toMatch(/aleta/i);
    expect(MENTAH).not.toMatch(/\d{16}/);
    expect(MENTAH).not.toMatch(/\d{4}[- .]\d{4}[- .]\d{4}[- .]\d{4}/);
  });

  it("hanya memakai penanda kolom yang dikenal penyusun", () => {
    const dikenal = new Set(["kode", "pihak", "para", "namaTanpaBin", "oleh", "pasalAkta"]);
    for (const c of KARTU_USULAN) for (const m of c.bunyi.matchAll(/\{(\w+)\}/g)) expect(dikenal.has(m[1]), `${c.id}: ${m[1]}`).toBe(true);
  });

  it("bunyi hanya menerangkan, tidak menyimpulkan dalil", () => {
    for (const c of KARTU_USULAN) {
      expect(c.bunyi, c.id).toContain("menerangkan");
      expect(c.bunyi, c.id).not.toMatch(/terbukti|membuktikan|dibuktikan|\bsah\b|suami istri|harus dinyatakan|berpendapat|\{\{tdkbantah/i);
      expect(c.bunyi, c.id).toMatch(/;$/);
    }
  });

  it("kekuatan mengikuti katalog: akta autentik hanya bertanda O, selain itu dinilai bersama alat bukti lain", () => {
    for (const c of KARTU_USULAN) {
      if (katalog(c.kunci)?.kuat === "Akta otentik") {
        expect(c.bunyi, c.id).toContain("akta autentik");
        expect(c.bunyi, c.id).toContain("{pasalAkta} jo. Pasal 1870 Kitab Undang-Undang Hukum Perdata");
        expect(c.bunyi, c.id).not.toContain("dinilai bersama");
      } else {
        expect(c.bunyi, c.id).toContain("dinilai bersama alat bukti lain");
        expect(c.bunyi, c.id).not.toMatch(/autentik|otentik/i);
      }
    }
  });

  it("lingkup keadaan: hanya dikabulkan; verstek hanya cerai dan hanya sisi Penggugat atau Pemohon", () => {
    for (const c of KARTU_USULAN) {
      for (const k of c.keadaan) expect(["kabul", "kabul-verstek"], c.id).toContain(k);
      if (c.keadaan.includes("kabul-verstek")) {
        expect(c.perkara, c.id).toEqual(["CG", "CT"]);
        expect(c.sisi, c.id).toBe("P");
      }
      if (c.perkara.includes("IN") || c.perkara.includes("DK")) expect(c.sisi, c.id).toBe("P");
    }
  });

  it("tidak ada kartu untuk jenis yang sudah punya bunyi sendiri di blangko pada perkara dan keadaan itu", () => {
    for (const c of KARTU_USULAN)
      for (const p of c.perkara)
        for (const k of c.keadaan) {
          const sendiri = KARTU_PERTIMBANGAN.filter((b) => b.perkara.includes(p) && b.keadaan.includes(k) && b.kunci !== "*" && b.kunci.includes(c.kunci) && !b.syarat);
          expect(sendiri.map((b) => b.id), `${c.id} ${p} ${k}`).toEqual([]);
        }
  });

  it("tinjauan untuk pemilik memuat bunyi semua kartu", () => {
    for (const c of KARTU_USULAN) expect(TINJAUAN.includes(c.bunyi), c.id).toBe(true);
  });
});

describe("pasal yang disebut", () => {
  it("daftar yang diperiksa memang terverifikasi di rak atau dipakai kartu blangko", () => {
    for (const p of DAFTAR_PASAL) if (p.sumber === "rak") expect(bolehDisarankan(p.teks).boleh, p.teks).toBe(true);
    const h = susun("CG", "Dikabulkan", false, [bukti("P", 1, "nikah")]);
    expect(h.paragraf.some((x) => x.bunyi.includes("Pasal 285 RBg/Pasal 165 HIR"))).toBe(true);
    expect(KARTU_PERTIMBANGAN.some((k) => k.bunyi.includes("{pasalAkta}"))).toBe(true);
  });

  it("bunyi dan dasar tidak menyebut pasal, nomor putusan, atau SEMA di luar daftar", () => {
    for (const c of KARTU_USULAN) {
      let t = [c.bunyi.replace("{pasalAkta}", "Pasal 285 RBg/Pasal 165 HIR"), ...c.dasar].join(" ");
      for (const p of DAFTAR_PASAL) t = t.split(p.teks).join(" ");
      expect(t, c.id).not.toMatch(/\bPasal\b|\bayat\b|\bSEMA\b|Yurisprudensi|\bNomor\s+\d|K\/(Pdt|Sip)|Undang-Undang|Peraturan|PERMA/);
    }
  });

  it("dasar menyebut rujukan yang benar-benar ada di bunyi", () => {
    for (const c of KARTU_USULAN) {
      const t = c.bunyi.replace("{pasalAkta}", "Pasal 285 RBg/Pasal 165 HIR");
      for (const d of c.dasar) expect(t, c.id).toContain(d);
    }
  });

  it("pasal bernomor di kolom perlu dicek pun terverifikasi di rak", () => {
    for (const c of KARTU_USULAN) for (const s of c.perluDicek) if (/Pasal\s+\d/.test(s)) expect(bolehDisarankan(s).boleh, `${c.id}: ${s}`).toBe(true);
  });

  it("hukum acara terpilih hanya menyisakan pasalnya", () => {
    const h = susun("CG", "Dikabulkan", false, [bukti("P", 3, "kk")], { konteks: { hukumAcara: "HIR" } });
    expect(h.perluDisetujui[0].bunyi).toContain("Pasal 165 HIR jo. Pasal 1870");
    expect(h.perluDisetujui[0].bunyi).not.toContain("RBg");
  });
});

describe("kartu belum disetujui", () => {
  it("tiap kartu pada tiap keadaannya hanya keluar di perluDisetujui, tidak pernah di paragraf", () => {
    for (const c of KARTU_USULAN)
      for (const p of c.perkara)
        for (const k of c.keadaan) {
          const sisi = c.sisi === "T" ? "T" : "P";
          const h = susun(p, statusDari(k), verstekDari(k), [bukti(sisi, 3, c.kunci, { an: "Rekaan", oleh: "Penerbit Rekaan" })]);
          const label = `${c.id} ${p} ${k}`;
          expect(h.perluDisetujui.map((x) => x.id), label).toEqual([c.id]);
          const keluar = h.perluDisetujui[0];
          expect(keluar, label).toMatchObject({ kode: "P.3", kunci: c.kunci, dasar: c.dasar });
          expect(keluar.bunyi, label).toContain(ciriKartu(c));
          expect(keluar.bunyi, label).not.toMatch(/[{}]|\[\[|\]\]/);
          if (c.bunyi.includes("{oleh}")) expect(keluar.bunyi, label).toContain("Penerbit Rekaan");
          expect(keluar.bunyi, label).toContain("REKAAN");
          for (const q of h.paragraf) expect(q.bunyi, label).not.toContain(ciriKartu(c));
        }
  });

  it("isian kosong: anak kalimatnya hilang dan tidak ada sisa penanda", () => {
    const h = susun("IN", "Dikabulkan", false, [bukti("P", 3, "desanikah")], { konteks: { jumlahPemohon: 1 } });
    expect(h.perluDisetujui[0].bunyi).toBe(
      "- Bahwa bukti P.3 yang diajukan Pemohon berupa Surat Keterangan Kepala Desa tentang Pernikahan menerangkan pernikahan orang yang namanya tertulis di dalamnya menurut keterangan penerbit surat. Bukti tersebut dinilai bersama alat bukti lain;"
    );
  });

  it("belumAdaBunyi tetap mencatat bukti itu sampai disetujui", () => {
    const h = susun("CG", "Dikabulkan", true, [bukti("P", 3, "kk")]);
    expect(h.belumAdaBunyi.map((x) => x.kode)).toEqual(["P.3"]);
    expect(h.perluDisetujui.map((x) => x.kode)).toEqual(["P.3"]);
  });

  it("keadaan selain dikabulkan tidak punya usulan", () => {
    for (const j of ["CG", "CT", "IN", "DK"] as const)
      for (const s of ["Ditolak", "Tidak Dapat Diterima", "Gugur", "Perdamaian", ""]) {
        for (const v of [false, true]) expect(susun(j, s, v, [bukti("P", 3, "kk")]).perluDisetujui, `${j} ${s} ${v}`).toEqual([]);
      }
  });

  it("dicabut: kosong sebelum pembuktian kedua; sesudahnya hanya bukti agenda lama", () => {
    const daftar = [bukti("P", 3, "kk"), { ...bukti("P", 4, "lahir"), agendaKe: 2 }];
    expect(susun("CG", "Dicabut", false, daftar, { agendaPembuktianKe: 1 }).perluDisetujui).toEqual([]);
    const h = susun("CG", "Dicabut", false, daftar, { agendaPembuktianKe: 2 });
    expect(h.perluDisetujui.map((x) => x.kode)).toEqual(["P.3"]);
  });

  it("dispensasi dengan satu Pemohon berhenti lebih dulu, tanpa usulan", () => {
    expect(susun("DK", "Dikabulkan", false, [bukti("P", 3, "kk")], { konteks: { jumlahPemohon: 1 } }).perluDisetujui).toEqual([]);
  });

  it("jenis di luar kartu dan bukti sisi lawan yang tidak dicakup tidak menghasilkan usulan", () => {
    expect(susun("CG", "Dikabulkan", false, [bukti("P", 3, "shm")]).perluDisetujui).toEqual([]);
    expect(susun("CG", "Dikabulkan", true, [bukti("T", 1, "kk")]).perluDisetujui).toEqual([]);
    expect(susun("CG", "Dikabulkan", false, [{ sisi: "P", nomor: 3, baris: { nm: "Percakapan WhatsApp" } }]).perluDisetujui).toEqual([]);
  });
});

describe("bukti tanpa asli", () => {
  const SISA = /kekuatan|autentik|otentik|dinilai|menerangkan|Pasal/i;

  it("verstek: bunyi hanya tidak dapat dicocokkan, tanpa kalimat kekuatan dan tanpa dasar, untuk jenis O maupun bukan", () => {
    for (const k of ["kk", "domisili"]) {
      const h = susun("CG", "Dikabulkan", true, [bukti("P", 3, k, { cocok: 1 })]);
      expect(h.perluDisetujui).toHaveLength(1);
      expect(h.perluDisetujui[0].bunyi).toBe("Menimbang, bahwa alat bukti P.3 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
      expect(h.perluDisetujui[0].bunyi).not.toMatch(SISA);
      expect(h.perluDisetujui[0].dasar).toEqual([]);
    }
    expect(BUNYI_TANPA_ASLI["kabul-verstek"]).toContain("tidak dapat dicocokkan dengan aslinya;");
  });

  it("sesudah disetujui tetap hanya kalimat itu", () => {
    const h = susun("CG", "Dikabulkan", true, [bukti("P", 3, "kk", { cocok: 1 })], { kartuUsulan: setujui("us-cerai-verstek-kk") });
    expect(h.perluDisetujui).toEqual([]);
    expect(h.paragraf.map((x) => x.bunyi)).toEqual(["Menimbang, bahwa alat bukti P.3 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;"]);
  });

  it("bila kartu blangko sudah menuliskannya, usulan tidak ditampilkan lagi", () => {
    const kasus: Array<[JenisPerkaraBukti, string]> = [
      ["CG", "kk"],
      ["CT", "domisili"],
      ["IN", "kua"],
      ["DK", "kk"],
      ["DK", "sehat"],
    ];
    for (const [j, k] of kasus) {
      const h = susun(j, "Dikabulkan", false, [bukti("P", 3, k, { cocok: 1 })]);
      expect(h.perluDisetujui, `${j} ${k}`).toEqual([]);
      expect(h.paragraf.filter((x) => /tidak dapat dicocokkan/.test(x.bunyi)).map((x) => x.kode), `${j} ${k}`).toEqual(["P.3"]);
      for (const q of h.paragraf) expect(q.bunyi, `${j} ${k}`).not.toContain("menerangkan");
    }
  });

  it("kode serupa tidak tertukar: P.3 tanpa asli tidak menutup usulan P.31", () => {
    const h = susun("CG", "Dikabulkan", false, [bukti("P", 3, "kk", { cocok: 1 }), bukti("P", 31, "domisili")]);
    expect(h.perluDisetujui.map((x) => x.kode)).toEqual(["P.31"]);
  });

  it("meterai atau pencocokan tanpa bunyi: tidak ada usulan, keterangan belumAdaBunyi tetap", () => {
    for (const tambah of [{ meterai: 1 }, { meterai: 2 }, { cocok: 2 }, { cocok: 3 }]) {
      const h = susun("CG", "Dikabulkan", false, [bukti("P", 3, "kk", tambah)]);
      expect(h.perluDisetujui, JSON.stringify(tambah)).toEqual([]);
      expect(h.belumAdaBunyi.some((x) => x.kode === "P.3"), JSON.stringify(tambah)).toBe(true);
    }
  });
});

describe("kartu blangko tetap menang", () => {
  const palsu = (kunci: string, keadaan: KeadaanKartu, perkara: JenisPerkaraBukti, disetujui: boolean): KartuUsulan => ({
    id: `palsu-${kunci}`,
    kunci,
    perkara: [perkara],
    keadaan: [keadaan],
    sisi: "PT",
    bunyi: "PALSU {kode} menerangkan sesuatu. Bukti tersebut dinilai bersama alat bukti lain;",
    isi: "sesuatu",
    dasar: [],
    perluDicek: [],
    disetujui,
  });

  it("kartu usulan untuk jenis yang punya bunyi sendiri diabaikan, disetujui atau belum", () => {
    const kasus: Array<[JenisPerkaraBukti, KeadaanKartu, string, boolean]> = [
      ["CG", "kabul", "ktp", false],
      ["CT", "kabul", "nikah", false],
      ["CG", "kabul-verstek", "ktp", true],
      ["CT", "kabul-verstek", "nikah", true],
      ["IN", "kabul", "ktp", false],
      ["DK", "kabul", "ktp", false],
      ["DK", "kabul", "lahir", false],
      ["DK", "kabul", "ijazah", false],
    ];
    for (const [j, k, kunci, v] of kasus)
      for (const disetujui of [false, true]) {
        const masuk = [bukti("P", 1, kunci, { an: "Rekaan" })];
        const tanpa = susun(j, "Dikabulkan", v, masuk, { kartuUsulan: [] });
        const dengan = susun(j, "Dikabulkan", v, masuk, { kartuUsulan: [palsu(kunci, k, j, disetujui)] });
        expect(dengan.paragraf, `${j} ${kunci}`).toEqual(tanpa.paragraf);
        expect(dengan.perluDisetujui, `${j} ${kunci}`).toEqual([]);
      }
  });

  it("kartu usulan tidak mengubah paragraf blangko mana pun", () => {
    const masuk = [bukti("P", 1, "ktp"), bukti("P", 2, "nikah"), bukti("P", 3, "kk"), bukti("P", 4, "domisili"), bukti("T", 1, "kk")];
    for (const j of ["CG", "CT", "IN", "DK"] as const)
      for (const [s, v] of [["Dikabulkan", false], ["Dikabulkan", true], ["Ditolak", false], ["Ditolak", true], ["Tidak Dapat Diterima", false]] as const) {
        const a = susun(j, s, v, masuk);
        const b = susun(j, s, v, masuk, { kartuUsulan: [] });
        expect(a.paragraf, `${j} ${s} ${v}`).toEqual(b.paragraf);
        expect(a.belumAdaBunyi, `${j} ${s} ${v}`).toEqual(b.belumAdaBunyi);
      }
  });
});

describe("sesudah disetujui", () => {
  const masuk = [bukti("P", 3, "domisili"), bukti("P", 1, "ktp"), bukti("P", 2, "nikah")];

  it("menjadi usulan bercentang di belakang kartu blangko, tidak otomatis", () => {
    const h = susun("CG", "Dikabulkan", true, masuk, { kartuUsulan: setujui("us-cerai-verstek-domisili") });
    expect(h.perluDisetujui).toEqual([]);
    const akhir = h.paragraf[h.paragraf.length - 1];
    expect(akhir).toMatchObject({ kode: "P.3", kunci: "domisili", cara: "usulan" });
    expect(akhir.bunyi).toContain("menerangkan tempat tinggal");
    expect(akhir.asal).toContain("bukan dari blangko");
    expect(h.paragraf.filter((x) => x.cara === "otomatis").length).toBeGreaterThan(0);
    expect(h.paragraf.slice(0, -1).every((x) => !x.bunyi.includes("menerangkan tempat tinggal"))).toBe(true);
    expect(h.belumAdaBunyi.map((x) => x.kode)).not.toContain("P.3");
  });

  it("hanya kartu yang disetujui yang berubah; kartu lain tetap menunggu", () => {
    const h = susun("IN", "Dikabulkan", false, [bukti("P", 3, "kua"), bukti("P", 4, "desanikah")], { kartuUsulan: setujui("us-itsbat-kua") });
    expect(h.perluDisetujui.map((x) => x.id)).toEqual(["us-itsbat-desanikah"]);
    expect(h.paragraf.filter((x) => x.kunci === "kua" && x.cara === "usulan")).toHaveLength(1);
  });

  it("kartu pada keadaan lain tidak ikut terpakai", () => {
    const h = susun("CG", "Dikabulkan", false, [bukti("P", 3, "ghaib")], { kartuUsulan: setujui("us-cerai-verstek-ghaib") });
    expect(h.paragraf.some((x) => x.bunyi.includes("tidak diketahui"))).toBe(false);
    expect(h.perluDisetujui).toEqual([]);
  });
});

describe("layar", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("menampilkan usulan berlabel tanpa tombol, dan teks salin tidak memuatnya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { P: [], T: [], nikah: null, dokumen: [] } }) })));
    const tulis = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: { writeText: tulis } }));
    const barisUji: BarisBukti[] = [baris("ktp", { an: "Rekaan" }), baris("domisili", { an: "Rekaan" })];
    const alinea = [{ teks: "Mengabulkan gugatan." }, ...barisUji.map((r, i) => ({ teks: kalimatBaris(r, "P", i) }))];
    render(createElement(BuktiAletaAbt, { alinea, perkaraId: "1", nomor: "1/Pdt.G/2026/PA.Uji", jenisPerkara: "Cerai Gugat" }));

    const judul = await screen.findByText("Usulan bunyi, perlu disetujui");
    const bagian = judul.parentElement as HTMLElement;
    expect(bagian.textContent).toContain("bukan dari blangko");
    expect(bagian.textContent).toContain("menerangkan tempat tinggal");
    expect(bagian.textContent).toContain("Tanpa rujukan pasal");
    expect(within(bagian).queryAllByRole("button")).toEqual([]);
    expect(within(bagian).queryAllByRole("checkbox")).toEqual([]);
    expect((bagian.textContent ?? "").replace("Usulan bunyi, perlu disetujui", "")).not.toMatch(/[{}]|\[\[|#\d+#|disetujui/);

    fireEvent.click(screen.getByRole("button", { name: "Salin pertimbangan" }));
    await waitFor(() => expect(tulis).toHaveBeenCalled());
    const calls = tulis.mock.calls as unknown as string[][];
    const salin = calls[0][0];
    expect(salin).toContain("Kartu Tanda Penduduk");
    expect(salin).not.toContain("menerangkan tempat tinggal");
  });
});
