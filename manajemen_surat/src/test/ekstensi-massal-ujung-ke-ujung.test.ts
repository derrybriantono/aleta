// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { nilaiPraperiksa } from "@/lib/praperiksa-putusan";

import { buatIndexedDbTiruan } from "./indexeddb-tiruan";

/**
 * ============================================================================
 * MODE MASSAL PUTUSAN, DIJALANKAN UJUNG KE UJUNG ATAS BEBERAPA PERKARA
 * ============================================================================
 *
 * Yang dijalankan kode SUNGGUHAN: panel-alat.js UTUH (antrean di
 * chrome.storage, alatTipeKeluaran, alatAmbil, kunci antrean) dan, dari
 * konten.js, dipotong (bukan disalin): bagianMassalBerkas, bagianAntreanSipp,
 * jalankanAntreanSippSekali, jalankanSatuAntreanSipp, kirimKeJembatan, dan
 * pembantunya. Tiap "pemuatan halaman" SIPP adalah konteks vm dan DOM yang
 * BARU - persis seperti halaman perkara yang dimuat ulang sesudah Simpan, atau
 * tab lain - dan yang menyeberang hanya chrome.storage.local (dan, bila
 * diminta, satu pengelola Web Locks bersama), seperti aslinya.
 *
 * Yang ditiru hanya tepi luarnya:
 *   - borang Putusan Akhir SIPP di balik jembatan, PER TAB, dengan bentuk dan
 *     penangan change dari views/putusan/edit_putusan_akhir.php (alur 15):
 *     Status Dikabulkan memunculkan faktor, faktor sekunder, qobla, dan
 *     nusyuz; qobla "Qobla Dukhul" (atau cerai talak) memunculkan keadaan
 *     istri; qobla borang baru BAWAANNYA "Qobla Dukhul" (PHP `NULL == 0`);
 *   - Simpan SIPP dengan urutan ATURAN managePutusanAkhir::validateInput
 *     (alur 15, jenis_pengadilan 4) - lihat aturanSimpan. Tiap tekanannya
 *     DIHITUNG;
 *   - draf dan usulan pilihan ALETA (rute isian-sipp), unggah naskah, dan
 *     praperiksa (lolos, atau nilaiPraperiksa sungguhan);
 *   - pekerja latar MV3 yang MATI: chrome.runtime.sendMessage selalu gagal,
 *     dan tidak satu pun langkah antrean boleh bergantung padanya.
 *
 * Cacat yang dijaga (semuanya terukur pada kode sebelum 26 September 2026):
 *   A. antrean tidak mengisi medan pilihan sama sekali - tidak satu perkara
 *      pun tersimpan lewat mode massal;
 *   B. antrean dari berkas diam-diam otomatis;
 *   C. panel yang digambar ulang: Simpan ditekan DUA kali untuk satu perkara;
 *      perkara terputus ("jalan") dikerjakan ulang sendiri;
 *   E. "Lanjutkan ke SIPP" di ABT membuka alamat di luar SIPP;
 *   F. qobla dan nusyuz tidak dijaga: Simpan ditolak SIPP, atau - pada qobla
 *      bawaan borang - "Qobla Dukhul" tersimpan tanpa dipilih siapa pun;
 *      pilihan petugas di medan bukan-pintu ditimpa; praperiksa tidak melihat
 *      status yang dipilih antrean sendiri;
 *   G. salinan antrean yang basi menimpa penyimpanan (akhiri, dua tab,
 *      antrean baru), dan dua tab atas perkara yang sama menekan Simpan dua
 *      kali.
 *
 * ALETA_UJI_KONTEN / ALETA_UJI_ALAT / ALETA_UJI_ABT menunjuk SALINAN berkas
 * untuk pembukti gigitan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.join(EKSTENSI, "konten.js");
const BERKAS_ALAT = process.env.ALETA_UJI_ALAT || path.join(EKSTENSI, "panel-alat.js");
const BERKAS_ABT = process.env.ALETA_UJI_ABT || path.join(EKSTENSI, "abt.js");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
const adaFungsi = (isi: string, nama: string) => new RegExp(`^(?:async )?function ${nama}\\(`, "m").test(isi);
const adaTetapan = (isi: string, nama: string) => new RegExp(`^const ${nama} = `, "m").test(isi);

/** Tetapan puncak - satu baris, atau sampai "};" di kolom nol. */
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ============================================================================
// SIPP TIRUAN - BORANG DAN ATURAN SIMPAN DARI KODE SIPP SENDIRI
// ============================================================================
type Pilihan = { nilai: string; label: string };
type Medan = { tampak: boolean; banyak?: boolean; radio?: boolean; pilihan: Pilihan[]; nilai: string | string[] };
type Perkara = {
  nomor: string;
  jenis: "Cerai Gugat" | "Cerai Talak";
  putus: boolean;
  amar: string;
  /** Tanggal sidang terakhir - isian bawaan tgl_putusan (dd/mm/yyyy). */
  sidangTerakhir?: string;
  /** Tanggal sidang pertama (yyyy-mm-dd) - batas bawah tanggal putusan. */
  sidangPertama?: string;
};

const STATUS = 'select[name="status_putusan"]';
const VERSTEK = 'select[name="verstek"]';
const SUMBER = 'input[name="sumber_hukum[]"]';
const FAKTOR = 'select[name="faktor_cerai"]';
const FAKTOR2 = 'select[name="faktor_cerai_sekunder"]';
const NUSYUZ = 'input[name="status_nusyuz"]';
const QOBLA = 'select[name="qobla"]';
const KEADAAN = 'select[name="keadaan_istri"]';
const HARI_INI = "2026-09-26";

const AMAR_SAH =
  "<p>1. Mengabulkan gugatan Penggugat;</p><p>2. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;</p>";
const PERHUM = "<p>Menimbang, bahwa gugatan Penggugat beralasan hukum dan tidak melawan hak.</p>";

const pilihanFaktor = (): Pilihan[] => [
  { nilai: "-1", label: "Pilih Faktor" },
  { nilai: "5", label: "Perselisihan dan pertengkaran terus menerus" },
  { nilai: "6", label: "Meninggalkan salah satu pihak" },
];

/**
 * Borang Putusan Akhir yang baru dibuka, alur 15, PA, cerai (346/347) -
 * views/putusan/edit_putusan_akhir.php bersama managePutusanAkhir.php:
 *   - status "-1" (Pilih Status Putusan);
 *   - verstek TANPA isian "Pilih": $verstek kosong, peramban memilih "Tidak";
 *   - sumber hukum kotak centang, tak satu pun tercentang;
 *   - faktor, faktor sekunder: "-1" (Pilih Faktor), tersembunyi;
 *   - qobla: $qobla_bada tidak di-set sebelum ada baris perkara_akta_cerai,
 *     dan `NULL == 0` di PHP - "Qobla Dukhul" (0) yang tercetak selected;
 *     tersembunyi;
 *   - nusyuz: radio, tak satu pun tercentang; tersembunyi;
 *   - keadaan istri: "" (Pilih Keadaan Istri), tersembunyi - dirender untuk
 *     346 DAN 347;
 *   - tgl_putusan: tanggal sidang terakhir.
 * Status "-1" berarti #popup_*_tr disembunyikan saat halaman dimuat.
 */
function borangBaru(): Record<string, Medan> {
  return {
    [STATUS]: {
      tampak: true,
      pilihan: [
        { nilai: "-1", label: "Pilih Status Putusan" },
        { nilai: "62", label: "Dikabulkan" },
        { nilai: "63", label: "Ditolak" },
        { nilai: "67", label: "Dicabut" },
      ],
      nilai: "-1",
    },
    [VERSTEK]: { tampak: true, pilihan: [{ nilai: "T", label: "Tidak" }, { nilai: "Y", label: "Ya" }], nilai: "T" },
    [SUMBER]: {
      tampak: true,
      banyak: true,
      pilihan: [
        { nilai: "1", label: "Hukum Islam" },
        { nilai: "2", label: "Undang-Undang" },
        { nilai: "3", label: "Kompilasi Hukum Islam" },
      ],
      nilai: [],
    },
    [FAKTOR]: { tampak: false, pilihan: pilihanFaktor(), nilai: "-1" },
    [FAKTOR2]: { tampak: false, pilihan: pilihanFaktor(), nilai: "-1" },
    [QOBLA]: {
      tampak: false,
      pilihan: [
        { nilai: "-1", label: "Pilih Salah Satu" },
        { nilai: "0", label: "Qobla Dukhul" },
        { nilai: "1", label: "Ba'da Dukhul" },
      ],
      nilai: "0",
    },
    [NUSYUZ]: {
      tampak: false,
      radio: true,
      pilihan: [
        { nilai: "1", label: "Nusyuz" },
        { nilai: "0", label: "Tidak Nusyuz" },
      ],
      nilai: "",
    },
    [KEADAAN]: {
      tampak: false,
      pilihan: [
        { nilai: "", label: "Pilih Keadaan Istri" },
        { nilai: "1", label: "Suci" },
        { nilai: "2", label: "Haid" },
        { nilai: "3", label: "Hamil" },
        { nilai: "4", label: "Tidak diketahui" },
      ],
      nilai: "",
    },
  };
}

type Usulan = {
  kunci: string;
  nilai: string;
  nilaiLabel?: string;
  keyakinan: string;
  kutipan?: string;
  nilaiBanyak?: Pilihan[];
  sumberUsulan?: string;
};
type UsulanTanpaKunci = Omit<Usulan, "kunci">;

/**
 * Usulan seperti yang dijawab usulan-medan-putusan.ts untuk cerai gugat yang
 * dikabulkan: status dari amar (pasti), verstek "Tidak" karena amar diam
 * (cukup, tanpa kutipan), faktor dari kalimat pertimbangan (cukup, berkutipan),
 * dan qobla/nusyuz/keadaan istri BAWAAN karena naskah diam.
 */
const USULAN_BAKU: Record<string, UsulanTanpaKunci> = {
  [STATUS]: { nilai: "62", nilaiLabel: "Dikabulkan", keyakinan: "pasti", kutipan: "Mengabulkan gugatan Penggugat" },
  [VERSTEK]: { nilai: "T", nilaiLabel: "Tidak", keyakinan: "cukup", kutipan: "" },
  [SUMBER]: {
    nilai: "1",
    nilaiLabel: "Hukum Islam",
    keyakinan: "pasti",
    kutipan: "Kompilasi Hukum Islam",
    nilaiBanyak: [
      { nilai: "1", label: "Hukum Islam" },
      { nilai: "3", label: "Kompilasi Hukum Islam" },
    ],
  },
  [FAKTOR]: {
    nilai: "5",
    nilaiLabel: "Perselisihan dan pertengkaran terus menerus",
    keyakinan: "cukup",
    kutipan: "antara Penggugat dan Tergugat terus menerus terjadi perselisihan",
  },
  [QOBLA]: { nilai: "1", nilaiLabel: "Ba'da Dukhul", keyakinan: "cukup", kutipan: "" },
  [NUSYUZ]: { nilai: "0", nilaiLabel: "Tidak Nusyuz", keyakinan: "cukup", kutipan: "" },
  [KEADAAN]: { nilai: "1", nilaiLabel: "Suci", keyakinan: "cukup", kutipan: "" },
};

/**
 * Perkara qobla dukhul yang disebut tegas: usulan qobla SAMA dengan nilai
 * bawaan borang, dan keadaan istri ikut tampak. Dipakai uji yang menjaga hal
 * lain (keadaan bersama antrean, nusyuz) supaya tidak bergantung pada qobla.
 */
const USULAN_QOBLA_DUKHUL: Record<string, UsulanTanpaKunci> = {
  ...USULAN_BAKU,
  [QOBLA]: { nilai: "0", nilaiLabel: "Qobla Dukhul", keyakinan: "pasti", kutipan: "belum pernah berkumpul sebagai suami isteri" },
};

type OpsiDunia = { usulan?: Record<string, UsulanTanpaKunci> };

function buatDunia(perkara: Perkara[], opsi: OpsiDunia = {}) {
  const per = new Map(perkara.map((p) => [p.nomor, { ...p }]));
  /** Tiap tab punya borangnya sendiri: nomor tab -> borang. */
  const borangTab = new Map<number, { nomor: string; medan: Record<string, Medan>; naskah: Record<string, string> }>();
  let tabTerakhir = 0;
  const usulan: Record<string, UsulanTanpaKunci> = { ...(opsi.usulan ?? USULAN_BAKU) };
  /** Usulan yang berbeda untuk satu perkara saja: nomor -> kunci -> usulan. */
  const usulanPer: Record<string, Record<string, UsulanTanpaKunci>> = {};
  /** Tiap Simpan yang ditekan: tab, nomor, diterima atau pesan penolakan SIPP. */
  const simpan: Array<{ nomor: string; tab: number; diterima: boolean; pesan: string; isian?: Record<string, unknown> }> = [];
  /** Tiap pengisian ke medan yang SEDANG tersembunyi di borang. */
  const isiTersembunyi: string[] = [];
  const unggahNaskah: string[] = [];
  const praperiksaDiminta: Array<Record<string, unknown>> = [];
  let gerbangUsulan: ((nomor: string) => Promise<void>) | null = null;

  /**
   * Penangan change borang (alur 15): #status_putusan, #qobla, #faktor_cerai.
   * Keadaan istri tampak bila Dikabulkan dan (qobla "0" atau cerai talak);
   * yang disembunyikan dikosongkan.
   */
  function gambarUlang(tab: number, penunjuk: string) {
    const bt = borangTab.get(tab)!;
    const b = bt.medan;
    const talak = per.get(bt.nomor)!.jenis === "Cerai Talak";
    const kabul = String(b[STATUS].nilai) === "62";
    if (penunjuk === STATUS) for (const k of [FAKTOR, FAKTOR2, QOBLA, NUSYUZ]) b[k].tampak = kabul;
    if (penunjuk === STATUS || (penunjuk === QOBLA && kabul)) {
      if (kabul && (String(b[QOBLA].nilai) === "0" || talak)) b[KEADAAN].tampak = true;
      else {
        b[KEADAAN].tampak = false;
        b[KEADAAN].nilai = "";
      }
    }
    // Pilihan sekunder yang sama dengan primer dimatikan; yang terpilih dikosongkan.
    if (penunjuk === FAKTOR && String(b[FAKTOR2].nilai) === String(b[FAKTOR].nilai)) b[FAKTOR2].nilai = "-1";
  }

  /**
   * managePutusanAkhir::validateInput untuk alur 15, jenis_pengadilan 4
   * (Pengadilan Agama), jenis perkara 346/347 - urutan pemeriksaannya
   * dipertahankan, pesannya dari kode dan form_validation_lang SIPP.
   * Tidak ditiru: is_islam_ikrar (keadaan istri wajib pada 346 bukan-Islam),
   * reskom, dan alur selain 15.
   */
  function aturanSimpan(tab: number, p: Perkara): string {
    const { medan: b, naskah } = borangTab.get(tab)!;
    const status = Number.parseInt(String(b[STATUS].nilai), 10) || 0;
    const qobla = String(b[QOBLA].nilai);
    // 1. Qobla lebih dulu, sebelum form_validation.
    if (status === 62 && qobla === "-1") return "Tidak Berhasil, Qobla/Bada Belum Diisi";
    // 2. Sumber hukum.
    if ((b[SUMBER].nilai as string[]).length === 0) return "Tidak Berhasil, Sumber Hukum Belum Dipilih";
    // 3. form_validation, menurut urutan set_rules.
    const galat: string[] = [];
    const panjang = (x: unknown) => String(x ?? "").trim().length;
    const minimal = (nama: string, isi: unknown) => {
      if (!panjang(isi)) galat.push(`Kolom ${nama} Tidak Boleh Kosong.`);
      else if (panjang(isi) < 50) galat.push(`Kolom ${nama} Harus Memiliki Minimum Karakter 50.`);
    };
    minimal("Amar Putusan", naskah["#amar"]);
    const tgl = String(naskah["#tgl_putusan"] ?? "").trim();
    if (!tgl) galat.push("Kolom Tanggal Putusan Tidak Boleh Kosong.");
    else if (tgl.length !== 10) galat.push("Kolom Tanggal Putusan Harus Memiliki Karakter sejumlah 10.");
    minimal("Amar Anonim", naskah["#amar_anonim"]);
    minimal("Pertimbangan Hukum", naskah["#perhum"]);
    if (!String(b[STATUS].nilai).trim()) galat.push("Kolom Status Putusan Tidak Boleh Kosong.");
    if (!String(b[VERSTEK].nilai).trim()) galat.push("Kolom Apakah Putusan Verstek Tidak Boleh Kosong.");
    if (galat.length) return `Tidak Berhasil${galat.map((x) => `<p>${x}</p>`).join("")}`;
    // 4. Tanggal putusan: tidak melebihi hari ini, tidak sebelum sidang pertama.
    const iso = tgl.split("/").reverse().join("-");
    if (iso > HARI_INI) return "Tanggal Putusan Tidak Boleh Melebihi Hari Ini. Hari ini Tanggal 26/09/2026";
    if (p.sidangPertama && iso < p.sidangPertama) {
      return `Tanggal Putusan Tidak Boleh Kurang dari Tanggal Sidang Terakhir (${p.sidangPertama}).`;
    }
    // 5. Alur < 100.
    if (status < 1) return status === -1 ? "Status Putusan Wajib Dipilih." : "Status Putusan Tidak Valid.";
    if (![5, 6, 7].includes(status) && !["Y", "T"].includes(String(b[VERSTEK].nilai))) return "Status Verstek Tidak Valid.";
    if (status === 62) {
      if ((Number.parseInt(String(b[FAKTOR].nilai), 10) || 0) < 1) return "Faktor Penyebab Percerian Wajib Dipilih.";
      if (String(b[NUSYUZ].nilai) === "") return "Status Nusyuz Wajib Dipilih.";
      if ((p.jenis === "Cerai Talak" || qobla === "0") && (Number.parseInt(String(b[KEADAAN].nilai), 10) || 0) < 1) {
        return "Keadaan Istri Wajib Dipilih.";
      }
    }
    return "";
  }

  return {
    per,
    simpan,
    isiTersembunyi,
    unggahNaskah,
    usulan,
    usulanPer,
    praperiksaDiminta,
    /** Panggilan ke pekerja latar - yang di sini selalu MATI (lihat muatHalaman). */
    latarDipanggil: 0,
    setGerbangUsulan(g: ((nomor: string) => Promise<void>) | null) {
      gerbangUsulan = g;
    },
    gerbang: () => gerbangUsulan,
    /** Usulan ALETA untuk satu medan satu perkara - seperti rute isian-sipp. */
    usulanUntuk(nomor: string, kunci: string): Usulan {
      return { kunci, ...((usulanPer[nomor] || {})[kunci] || usulan[kunci] || { nilai: "", keyakinan: "kosong" }) };
    },
    /** Borang satu tab - tanpa nomor: tab yang terakhir membuka borang. */
    borang: (tab?: number) => borangTab.get(tab ?? tabTerakhir)!.medan,
    /** Nomor perkara borang yang terbuka di satu tab (edoc, butir 6). */
    nomorBorang: (tab: number) => borangTab.get(tab)?.nomor ?? "",
    /** Petugas menekan "Tambah Putusan Akhir" di satu tab: borangnya lahir baru. */
    bukaBorang(tab: number, nomor: string) {
      tabTerakhir = tab;
      const p = per.get(nomor)!;
      borangTab.set(tab, { nomor, medan: borangBaru(), naskah: { "#tgl_putusan": p.sidangTerakhir ?? "26/09/2026" } });
    },
    jembatan(tab: number, pesan: { jenis: string; penunjuk: string; nilai?: string }) {
      const bt = borangTab.get(tab);
      if (!bt) return { ok: false, alasan: "medan_tidak_ketemu" };
      const m = bt.medan[pesan.penunjuk];
      if (pesan.jenis === "pilihan") {
        if (!m) return { ok: false, alasan: "medan_tidak_ketemu" };
        const semua = Array.isArray(m.nilai) ? m.nilai : [m.nilai];
        return {
          ok: true,
          tampak: m.tampak,
          // Seperti jembatan.js: select -> value; kelompok radio/centang -> yang pertama tercentang.
          nilaiSekarang: Array.isArray(m.nilai) ? (m.nilai[0] ?? "") : m.nilai,
          pilihan: m.pilihan.map((x) => ({ ...x, terpilih: semua.includes(x.nilai) })),
        };
      }
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : bt.naskah[pesan.penunjuk] || "", tampak: true };
      if (pesan.jenis === "isi") {
        if (["#perhum", "#amar", "#amar_anonim"].includes(pesan.penunjuk)) {
          bt.naskah[pesan.penunjuk] = String(pesan.nilai);
          return { ok: true };
        }
        if (!m) return { ok: false, alasan: "medan_tidak_ketemu" };
        const nilai = String(pesan.nilai);
        const cocok = m.pilihan.find((x) => x.nilai === nilai) || m.pilihan.find((x) => x.label.toLowerCase() === nilai.toLowerCase());
        if (!cocok) return { ok: false, alasan: "pilihan_tidak_ada" };
        // jembatan.js tidak memeriksa tampak: medan tersembunyi pun terisi. Dicatat.
        if (!m.tampak) isiTersembunyi.push(pesan.penunjuk);
        if (Array.isArray(m.nilai)) {
          if (!m.nilai.includes(cocok.nilai)) m.nilai.push(cocok.nilai);
        } else m.nilai = cocok.nilai;
        gambarUlang(tab, pesan.penunjuk);
        return { ok: true, terbaca: cocok.nilai };
      }
      return { ok: false, alasan: "tidak dikenal" };
    },
    /** Simpan SIPP: diterima atau ditolak menurut aturannya sendiri. */
    tekanSimpan(tab: number, nomor: string) {
      const p = per.get(nomor)!;
      const bt = borangTab.get(tab);
      const pesan = bt && bt.nomor === nomor ? aturanSimpan(tab, p) : "Perkara Tidak Diketahui.";
      simpan.push({
        nomor,
        tab,
        diterima: !pesan,
        pesan,
        isian: pesan ? undefined : polos({ ...Object.fromEntries(Object.entries(bt!.medan).map(([k, v]) => [k, v.nilai])), ...bt!.naskah }),
      });
      if (pesan) {
        return { ok: false, bunyi: `SIPP menolak menyimpan: ${pesan} Halaman TIDAK dimuat ulang supaya isian yang sudah masuk tidak hilang.` };
      }
      p.putus = true;
      return { ok: true, bunyi: "Tersimpan di SIPP." };
    },
    draf(nomor: string) {
      const p = per.get(nomor);
      if (!p) return { ada: false, sebab: "belum ada draf putusan" };
      return { ada: true, versi: 1, keadaan: "draf", jenisPerkara: p.jenis, pertimbangan: PERHUM, amar: p.amar, amarAnonim: p.amar };
    },
  };
}
type Dunia = ReturnType<typeof buatDunia>;

/** Pengelola Web Locks tiruan, SATU untuk semua tab seasal: kunci bernama, bergiliran. */
function buatKunciBersama() {
  const ekor = new Map<string, Promise<unknown>>();
  const hitung = { diminta: 0 };
  return {
    hitung,
    request(nama: string, a: unknown, b?: unknown) {
      const kerja = (typeof a === "function" ? a : b) as () => unknown;
      hitung.diminta += 1;
      const hasil = (ekor.get(nama) ?? Promise.resolve()).then(() => kerja());
      ekor.set(
        nama,
        hasil.catch(() => undefined)
      );
      return hasil;
    },
  };
}
type KunciBersama = ReturnType<typeof buatKunciBersama>;

// ============================================================================
// SATU PEMUATAN HALAMAN SIPP (SATU TAB)
// ============================================================================
const halamanTerbuka: JSDOM[] = [];
afterEach(() => {
  while (halamanTerbuka.length) halamanTerbuka.pop()!.window.close();
});

type IsianPilihan = { medan: string; nilai: string; asal: string };
type Butir = { nomor: string; keadaan: string; catatan: string; sebabTahan?: string; pemegang?: string; isianPilihan?: IsianPilihan[] };
type Antrean = { id: string; asal?: string; tahap: string; modus: string; butir: Butir[] };
type Kotak = HTMLDivElement & { isi: HTMLDivElement };
type OpsiHalaman = {
  /** Latensi tiap operasi chrome.storage.local (ms). */
  jedaSimpanan?: number;
  /** Pengelola Web Locks bersama; tanpa ini navigator.locks tidak ada. */
  kunci?: KunciBersama;
  /** praperiksaSebelumMengisi sungguhan, dijawab nilaiPraperiksa. */
  praperiksaAsli?: boolean;
  /**
   * Butir 6 (6 Okt 2026): tampilan Baru, simpanPutusanLaluBuka dan jalur edoc
   * a30 SUNGGUHAN (rak naskah di IndexedDB tiruan bersama, unggah-sipp
   * tiruan). Yang ditiru hanya anonimisasi ABT dan tekanan Simpan.
   */
  edoc?: EdocUji;
};
type EdocUji = {
  idb: ReturnType<typeof buatIndexedDbTiruan>;
  /** Hasil anonimisasi ABT tiruan. */
  anon: "ok" | "gagal";
  /** Rute unggah-sipp menolak kiriman ini. */
  tolakUnggah?: boolean;
  /** Tampilan Lama (a30Aktif mati): tidak boleh ada edoc sama sekali. */
  lama?: boolean;
  /** Tiap kiriman unggah-sipp: nomor, nama berkas putusan dan anonimisasi. */
  unggah: Array<{ nomor: string; putusan: string; anonimisasi: string }>;
  /** Anonimisasi yang diminta (nama berkas sumbernya). */
  anonDiminta: string[];
  /** Tab yang memuat ulang halaman perkara sesudah Simpan. */
  dimuatUlang: number[];
};

function edocUji(anon: "ok" | "gagal" = "ok", tolakUnggah = false): EdocUji {
  return { idb: buatIndexedDbTiruan(), anon, tolakUnggah, unggah: [], anonDiminta: [], dimuatUlang: [] };
}
let nomorTab = 0;

function muatHalaman(dunia: Dunia, simpanan: Record<string, unknown>, opsi: OpsiHalaman = {}) {
  const tab = (nomorTab += 1);
  const konten = baca(BERKAS_KONTEN);
  const alat = baca(BERKAS_ALAT);
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  halamanTerbuka.push(dom);
  const dokumen = dom.window.document;
  const catatan: Array<{ jenis: string; ringkas: string }> = [];

  const jawab = (isi: unknown) => {
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return r;
  };
  const jeda = async () => {
    if (opsi.jedaSimpanan) await new Promise((r) => setTimeout(r, opsi.jedaSimpanan));
  };

  const k: Record<string, any> = {
    console: { ...console, warn() {}, log() {} },
    // Pewaktu dijalankan segera - jeda 600 ms mode otomatis dan 350 ms
    // gambar-ulang borang tidak mengubah urutan kejadiannya.
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    FormData: dom.window.FormData,
    File: dom.window.File,
    Event: dom.window.Event,
    encodeURIComponent,
    decodeURIComponent,
    document: dokumen,
    location: { origin: "http://192.168.10.10", pathname: "/SIPP/perkara_detil/x", search: "", hostname: "192.168.10.10" },
    window: {
      location: { hostname: "192.168.10.10", pathname: "/SIPP/perkara_detil/x", search: "", origin: "http://192.168.10.10" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: {
        getManifest: () => ({ version: "0.0.0" }),
        getURL: (x: string) => x,
        // Pekerja latar MV3 yang sudah mati: tiap pesan ke sana gagal. Antrean
        // SIPP tidak boleh bergantung padanya - yang menyeberang antar
        // halaman hanya chrome.storage.local.
        sendMessage: (pesan?: { jenis?: string }) => {
          // Laporan antrean kerja (penahan tombol Perbarui, 9 Okt 2026) dikirim
          // lalu dilupakan - antrean tidak bergantung padanya, jadi tidak dihitung.
          if (!/^antrean-kerja-/.test(String((pesan && pesan.jenis) || ""))) dunia.latarDipanggil += 1;
          throw new Error("Could not establish connection. Receiving end does not exist.");
        },
      },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[] | string) => {
            await jeda();
            const hasil: Record<string, unknown> = {};
            for (const x of [kunci].flat()) if (x in simpanan) hasil[x] = polos(simpanan[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => {
            await jeda();
            Object.assign(simpanan, polos(isi));
          },
          remove: async (kunci: string[] | string) => {
            await jeda();
            for (const x of [kunci].flat()) delete simpanan[x];
          },
        },
        session: { get: async () => ({}), set: async () => undefined },
      },
    },
    fetch: async (alamat: string, o?: { method?: string; body?: unknown }) => {
      const url = String(alamat);
      const metode = String(o?.method || "GET").toUpperCase();
      // Daftar tipe keluaran tidak terjangkau: cadangan tertanam yang berlaku.
      if (url.includes("/ekstensi/tipe-keluaran")) throw new TypeError("Failed to fetch");
      if (url.includes("/putusan/unggah-sipp") && opsi.edoc) {
        const badan = o?.body as FormData;
        const put = badan.get("putusan") as File | null;
        const anon = badan.get("anonimisasi") as File | null;
        opsi.edoc.unggah.push({ nomor: String(badan.get("nomorPerkara")), putusan: put ? put.name : "", anonimisasi: anon ? anon.name : "" });
        if (opsi.edoc.tolakUnggah) return jawab({ data: { ok: false, sebab: "Folder SIPP tidak terjangkau dari ALETA." } });
        return jawab({ data: { ok: true, berkas: [{ jenis: "putusan", ok: true }, ...(anon ? [{ jenis: "anonimisasi", ok: true }] : [])] } });
      }
      if (url.includes("/putusan/unggah-naskah")) {
        const badan = o?.body as FormData;
        dunia.unggahNaskah.push(String(badan.get("nomorPerkara")));
        return jawab({ data: { ok: true, versi: 1 } });
      }
      if (url.includes("/putusan/praperiksa")) {
        const badan = JSON.parse(String(o?.body || "{}"));
        dunia.praperiksaDiminta.push(badan);
        const rapor = nilaiPraperiksa(
          {
            nomorPerkara: badan.nomorPerkara,
            petitum: "",
            pihak: [],
            anak: [],
            majelis: [],
            jadwal: [],
            putusan: { ada: false, tanggalPutusan: "", statusPutusan: "", verstek: "" },
            ecourt: { terdaftar: null, pihak: [] },
            libur: null,
            hariIni: HARI_INI,
          } as never,
          { ...badan, amar: dunia.per.get(badan.nomorPerkara)?.amar || "" }
        );
        return jawab({ data: { ...rapor, ada: true } });
      }
      if (url.includes("/putusan/isian-sipp") && metode === "POST") {
        const badan = JSON.parse(String(o?.body || "{}")) as { nomorPerkara: string; medan: Array<{ kunci: string }> };
        const g = dunia.gerbang();
        if (g) await g(badan.nomorPerkara);
        return jawab({ data: { usulan: badan.medan.map((m) => dunia.usulanUntuk(badan.nomorPerkara, m.kunci)) } });
      }
      if (url.includes("/putusan/isian-sipp")) {
        const nomor = decodeURIComponent(url.split("nomorPerkara=")[1] || "");
        return jawab({ data: dunia.draf(nomor) });
      }
      return jawab({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  if (opsi.kunci) k.navigator = { locks: opsi.kunci };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(alat, k, { filename: "panel-alat.js" });

  // Tepi luar konten.js - ditimpa SESUDAH panel-alat.js dimuat.
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as unknown as Kotak;
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      return kotak;
    },
    alatCatat: (jenis: string, ringkas: string) => void catatan.push({ jenis, ringkas }),
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    gambarRaporAgen: () => dokumen.createElement("div"),
    bacaPutusanSegar: async (nomor: string) => ({ sudahPutus: Boolean(dunia.per.get(nomor)?.putus), tanggal: "", status: "" }),
    simpanPutusanLaluBuka: async (nomor: string) => dunia.tekanSimpan(tab, nomor),
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string; nilai?: string }) => dunia.jembatan(tab, pesan),
    cariNomorPerkara: () => "",
  });
  if (!opsi.praperiksaAsli) {
    k.praperiksaSebelumMengisi = async () => ({ hentikan: false, jumlah: { perhatian: 0 }, temuan: [] });
  }

  // Butir 6: tampilan Baru dengan simpanPutusanLaluBuka dan jalur edoc a30
  // SUNGGUHAN. Yang ditiru: tekanan Simpan (borang dunia ini) beserta jawaban
  // SIPP-nya, anonimisasi ABT, dan pemuatan ulang halaman.
  const fungsiEdoc: string[] = [];
  const tetapanEdoc: string[] = [];
  if (opsi.edoc) {
    const e = opsi.edoc;
    let jawabSipp: { st: number; pesan: string } | null = null;
    delete k.simpanPutusanLaluBuka;
    Object.assign(k, {
      indexedDB: e.idb,
      // File/FormData Node: Blob jsdom tidak punya arrayBuffer().
      File: globalThis.File,
      FormData: globalThis.FormData,
      a30Aktif: () => !e.lama,
      namaPenggunaSipp: () => "munifa",
      bunyiSimpanTidakDitekan: () => "Simpan tidak ditekan.",
      dengarBuktiSimpan: () => ({ id: "telinga", tunggu: async () => jawabSipp, jawaban: () => jawabSipp, lepas() {} }),
      tekanSimpanPutusan: async () => {
        const h = dunia.tekanSimpan(tab, dunia.nomorBorang(tab));
        jawabSipp = h.ok ? { st: 1, pesan: "Data Berhasil Disimpan" } : { st: 0, pesan: h.bunyi };
        return { ok: true, bukti: "terkirim" };
      },
      muatUlangHalamanPerkara: () => void e.dimuatUlang.push(tab),
      a30SiapkanAnonimisasi: async (p: { berkas: File }) => {
        e.anonDiminta.push(p.berkas.name);
        if (e.anon === "gagal") {
          return { ok: false, perluAbt: true, pesan: "Masuk ABT dulu: anonimisasi dibuat oleh ABT dengan akun ABT Anda di peramban ini." };
        }
        return { ok: true, berkas: new globalThis.File(["{\\rtf1 anonim}"], `anonim_${p.berkas.name}`, { type: "application/rtf" }) };
      },
    });
    fungsiEdoc.push(
      ...[
        "simpanPutusanLaluBuka",
        "samaPutusan",
        "a30OpsiSimpanMassal",
        "a30OpsiEdocMassal",
        "a30OpsiSimpanPutusan",
        // 7 Okt 2026: penantian anonimisasi berbatas (tanpa wadah = gagal bersebab).
        "a30TungguAnonim",
        "a30PilihSesudahBatas",
        "a30UnggahEdoc",
        "kirimBadanUnggahSipp",
        "pesanGagalUnggah",
        "perkaraIdDariHalaman",
        "a30Bentuk",
        "a30PerluKeRtf",
        "a30BukaRakNaskah",
        "a30TransaksiRak",
        "a30BitaBerkas",
        "a30SimpanNaskahEdoc",
        "a30AmbilNaskahEdoc",
        "a30HapusNaskahEdoc",
      ].filter((n) => adaFungsi(konten, n))
    );
    tetapanEdoc.push(
      ...["BATAS_JAWABAN_SIMPAN_MS", "BATAS_UNGGAH_SIPP_MS", "ALETA_API_UNGGAH_SIPP", "PESAN_GAGAL_UNGGAH", "A30_MIME", "A30_TERIMA_NASKAH", "A30_RAK_NASKAH", "a30KunciRak"].filter(
        (n) => adaTetapan(konten, n)
      )
    );
  }

  const fungsi = [
    "buatElemen",
    "ringkasHentikan",
    "kirimKeJembatan",
    "nilaiTerpilihMedan",
    "muatanUsulanMedan",
    "jalankanSatuAntreanSipp",
    "bagianAntreanSipp",
    "nomorDariNamaBerkas",
    "tandaBukanNaskahPutusan",
    "namaBerkasAnonim",
    "pilahBerkasMassal",
    "bagianMassalBerkas",
    ...(opsi.praperiksaAsli ? ["praperiksaSebelumMengisi", "bacaUsulanBorangPutusan", "mintaPraperiksaPutusan"] : []),
  ];
  // Yang lahir 26 September 2026; kode yang lebih tua (pembukti gigitan)
  // tidak memilikinya, dan ujinya harus MERAH karena perilakunya, bukan
  // karena potongannya tidak ketemu.
  // nilaiTerpilihBukanBawaan dan NILAI_BAWAAN_BORANG naik ke tingkat modul
  // (dipakai bersama panel satu perkara) pada hari yang sama.
  const opsional = ["jalankanAntreanSippSekali", "tampilkanAntreanSipp", "namaKeadaanButir", "nilaiTerpilihBukanBawaan"].filter((n) =>
    adaFungsi(konten, n)
  );
  const tetapanOpsional = ["NAMA_SEBAB_TAHAN", "NILAI_BAWAAN_BORANG"].filter((n) => adaTetapan(konten, n));
  vm.runInContext(
    [
      ...[
        "ALETA_API_ISIAN_PUTUSAN",
        "ALETA_API_PRAPERIKSA_PUTUSAN",
        "PENUNJUK_TANGGAL_PUTUSAN",
        "ALETA_API_UNGGAH_NASKAH",
        "BATAS_UNGGAH_NASKAH_MS",
        "POLA_PERKARA",
        "NAMA_KEADAAN_ANTREAN",
        ...tetapanOpsional,
        ...tetapanEdoc,
      ].map((n) => tetapan(konten, n)),
      konten.includes('\nlet antreanSippBerjalan = "";') ? 'let antreanSippBerjalan = "";' : "",
      ...[...fungsi, ...opsional, ...fungsiEdoc].map((n) => potongFungsi(konten, n)),
      "this.__uji = { bagianAntreanSipp, bagianMassalBerkas, alatBuatAntrean, alatSimpanAntrean, alatMuatAntrean, " +
        'jalankanAntreanSippSekali: typeof jalankanAntreanSippSekali === "function" ? jalankanAntreanSippSekali : null };',
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );
  const uji = k.__uji as {
    bagianAntreanSipp: (nomor: string) => Promise<Kotak | null>;
    bagianMassalBerkas: (wadah: HTMLElement, sesudah?: () => void) => HTMLDivElement;
    alatBuatAntrean: (p: Record<string, unknown>) => Antrean;
    alatSimpanAntrean: (a: Antrean | null) => Promise<boolean>;
    alatMuatAntrean: () => Promise<Antrean | null>;
    jalankanAntreanSippSekali:
      | ((a: Antrean, b: Butir, kabar: HTMLElement | null, tombol: HTMLButtonElement | null, otomatis: boolean) => Promise<void>)
      | null;
  };

  let kotak: Kotak | null = null;
  /** Panel perkara digambar (ulang): yang lama dibuang, seperti tampilkan(). */
  async function gambarPanel(nomor: string) {
    if (kotak) kotak.remove();
    kotak = await uji.bagianAntreanSipp(nomor);
    if (kotak) dokumen.body.appendChild(kotak);
    return kotak;
  }
  return {
    tab,
    k,
    uji,
    dokumen,
    catatan,
    gambarPanel,
    kotak: () => kotak,
    /** Kabar panel antrean yang terakhir digambar di tab ini. */
    kabar: () => (kotak?.querySelector(".aleta-abt-kabar")?.textContent || ""),
    /** Petugas membuka tingkap Putusan Akhir; panel digambar ulang karena borangnya berganti. */
    async bukaBorang(nomor: string) {
      dunia.bukaBorang(tab, nomor);
      dokumen.body.appendChild(dokumen.createElement("form")).id = "frm_putusan";
      return gambarPanel(nomor);
    },
  };
}

async function tunggu(syarat: () => boolean | Promise<boolean>, apa: string) {
  for (let i = 0; i < 1500; i += 1) {
    if (await syarat()) return;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error(`tidak kunjung terjadi: ${apa}`);
}

/** Beberapa putaran pewaktu tanpa syarat - untuk membuktikan sesuatu TIDAK terjadi. */
const reda = async () => {
  for (let i = 0; i < 60; i += 1) await new Promise((r) => setTimeout(r, 2));
};

const antreanTersimpan = (simpanan: Record<string, unknown>) => simpanan.antreanPutusanMassal as Antrean | undefined;
const keadaan = (simpanan: Record<string, unknown>, nomor: string) =>
  antreanTersimpan(simpanan)?.butir.find((b) => b.nomor === nomor)?.keadaan;
const selesaiDikerjakan = (simpanan: Record<string, unknown>, nomor: string) =>
  !["menunggu", "jalan", undefined].includes(keadaan(simpanan, nomor));

const N1 = "101/Pdt.G/2026/PA.Dgl";
const N2 = "102/Pdt.G/2026/PA.Dgl";
const N3 = "103/Pdt.G/2026/PA.Dgl";

function tigaPerkara(): Perkara[] {
  return [
    { nomor: N1, jenis: "Cerai Gugat", putus: false, amar: AMAR_SAH },
    { nomor: N2, jenis: "Cerai Talak", putus: false, amar: AMAR_SAH },
    { nomor: N3, jenis: "Cerai Gugat", putus: false, amar: AMAR_SAH },
  ];
}

async function susunAntrean(dunia: Dunia, simpanan: Record<string, unknown>, modus: string, nomor: string[]) {
  const h = muatHalaman(dunia, simpanan);
  const antrean = h.uji.alatBuatAntrean({ tahap: "sipp", asal: "sidang", modus, butir: nomor.map((n) => ({ nomor: n })) });
  await h.uji.alatSimpanAntrean(antrean);
  return antrean;
}

/**
 * Satu perkara di mode otomatis, seperti di kantor: halaman perkara dimuat,
 * panel menunjuk perkaranya, petugas membuka tingkap Putusan Akhir, lalu
 * ALETA bekerja sendiri sampai perkara itu selesai, tertahan, atau gagal.
 */
async function kerjakanOtomatis(dunia: Dunia, simpanan: Record<string, unknown>, nomor: string, opsi: OpsiHalaman = {}) {
  const h = muatHalaman(dunia, simpanan, opsi);
  const awal = await h.gambarPanel(nomor);
  expect(awal?.textContent).toContain(`Perkara berikutnya: ${nomor}`);
  await h.bukaBorang(nomor);
  await tunggu(() => selesaiDikerjakan(simpanan, nomor), `${nomor} selesai dikerjakan`);
  return h;
}

const butirDi = (simpanan: Record<string, unknown>, nomor: string) => antreanTersimpan(simpanan)!.butir.find((b) => b.nomor === nomor)!;

// ===========================================================================
describe("A. antrean otomatis atas tiga perkara: tiap perkara TERSIMPAN di SIPP", () => {
  it("tiga perkara berturut-turut, dimuat ulang di antaranya: tiga Simpan, ketiganya diterima SIPP", async () => {
    const dunia = buatDunia(tigaPerkara());
    // N2 diputus verstek: usulan "Ya" harus menggantikan "Tidak" bawaan borang.
    dunia.usulanPer[N2] = { [VERSTEK]: { nilai: "Y", nilaiLabel: "Ya", keyakinan: "pasti", kutipan: "verstek" } };
    const simpanan: Record<string, unknown> = {};
    const h0 = muatHalaman(dunia, simpanan);
    await h0.uji.alatSimpanAntrean(
      h0.uji.alatBuatAntrean({ tahap: "sipp", asal: "sidang", tanggalSidang: "2026-09-26", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }, { nomor: N3 }] })
    );

    for (const nomor of [N1, N2, N3]) await kerjakanOtomatis(dunia, simpanan, nomor);

    expect(dunia.simpan.map((s) => [s.nomor, s.diterima, s.pesan])).toEqual([
      [N1, true, ""],
      [N2, true, ""],
      [N3, true, ""],
    ]);
    expect(antreanTersimpan(simpanan)!.butir.map((b) => b.keadaan)).toEqual(["selesai", "selesai", "selesai"]);
    expect([...dunia.per.values()].every((p) => p.putus)).toBe(true);
    // Seluruh alur berjalan dengan pekerja latar mati, tanpa satu pesan pun ke sana.
    expect(dunia.latarDipanggil).toBe(0);

    // Isian yang diterima SIPP: status, verstek, sumber hukum (dua), faktor,
    // qobla BA'DA (bukan "Qobla Dukhul" bawaan borang), nusyuz, dan keadaan
    // istri hanya pada cerai talak - pada gugat ba'da dukhul medannya
    // disembunyikan dan dikosongkan SIPP sendiri.
    const isian = dunia.simpan.map((s) => s.isian!);
    expect(isian[0][STATUS]).toBe("62");
    expect(isian[0][VERSTEK]).toBe("T");
    expect(isian[0][SUMBER]).toEqual(["1", "3"]);
    expect(isian[0][FAKTOR]).toBe("5");
    expect(isian[0][QOBLA]).toBe("1");
    expect(isian[0][NUSYUZ]).toBe("0");
    expect(isian[0][KEADAAN]).toBe("");
    expect(isian[1][KEADAAN]).toBe("1");
    // Verstek bawaan "Tidak" BUKAN pilihan petugas: usulan "Ya" menggantikannya.
    expect(isian[1][VERSTEK]).toBe("Y");
    expect(isian[2]["#amar"]).toBe(AMAR_SAH);
    // Tidak satu pun medan yang tersembunyi ikut diisi.
    expect(dunia.isiTersembunyi).toEqual([]);

    // Halaman sesudah perkara terakhir: panel menyebut antreannya habis.
    const akhir = muatHalaman(dunia, simpanan);
    expect((await akhir.gambarPanel(N3))!.textContent).toContain("Seluruh antrean selesai.");
  });

  it("pilihan yang SUDAH dipilih petugas tidak ditimpa; Status yang berbeda dari usulan MENAHAN Simpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "manual", butir: [{ nomor: N1 }] }));
    await h.bukaBorang(N1);
    // Petugas memilih Ditolak sebelum menekan tombol ALETA.
    dunia.borang(h.tab)[STATUS].nilai = "63";
    const tombol = [...h.kotak()!.querySelectorAll("button")].find((b) => /Isi putusan/.test(b.textContent || ""))!;
    tombol.click();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1 selesai dikerjakan");

    expect(dunia.simpan).toEqual([]);
    expect(dunia.borang(h.tab)[STATUS].nilai).toBe("63");
    const butir = antreanTersimpan(simpanan)!.butir[0];
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.sebabTahan).toBe("pilihan-beda");
    expect(butir.catatan).toContain('Status Putusan: blangko berisi "Ditolak", ALETA mengusulkan "Dikabulkan"');
  });

  it("usulan yang bentrok tidak ditebak: pilihan wajib kosong menahan Simpan, tidak dikirim untuk ditolak SIPP", async () => {
    const dunia = buatDunia(tigaPerkara());
    dunia.usulan[SUMBER] = { nilai: "", keyakinan: "bentrok" };
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }] }));
    await kerjakanOtomatis(dunia, simpanan, N1);

    expect(dunia.simpan).toEqual([]);
    const butir = antreanTersimpan(simpanan)!.butir[0];
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.sebabTahan).toBe("pilihan-kosong");
    expect(butir.catatan).toContain("pilihan wajib belum terisi: Sumber Hukum (naskah menyebut lebih dari satu)");
    // Antreannya tetap berjalan: panel berikutnya menunjuk N2.
    const h2 = muatHalaman(dunia, simpanan);
    expect((await h2.gambarPanel(N1))!.textContent).toContain(`Perkara berikutnya: ${N2}`);
  });

  it("SIPP menolak satu perkara: perkara itu gagal dengan pesan SIPP, antrean berlanjut ke yang berikutnya", async () => {
    const perkara = tigaPerkara();
    perkara[1].amar = "<p>1. Mengabulkan.</p>"; // kurang dari 50 huruf
    const dunia = buatDunia(perkara);
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }, { nomor: N3 }] }));

    await kerjakanOtomatis(dunia, simpanan, N1);
    const h2 = await kerjakanOtomatis(dunia, simpanan, N2);
    expect(keadaan(simpanan, N2)).toBe("gagal");
    // Pesan form_validation SIPP (form_validation_lang.php), yang mendahului
    // pemeriksaan panjang amar di badan validateInput.
    expect(antreanTersimpan(simpanan)!.butir[1].catatan).toContain("Kolom Amar Putusan Harus Memiliki Minimum Karakter 50.");
    // Halaman TIDAK dimuat ulang sesudah penolakan; panel yang digambar ulang
    // di halaman yang sama menunjuk perkara berikutnya dan tidak mengulang N2.
    const kotak = await h2.gambarPanel(N2);
    await reda();
    expect(kotak!.textContent).toContain(`Perkara berikutnya di antrean: ${N3}`);
    await kerjakanOtomatis(dunia, simpanan, N3);

    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([
      [N1, true],
      [N2, false],
      [N3, true],
    ]);
  });
});

// ===========================================================================
describe("B. antrean dari berkas: modusnya dipilih, dan layar menyebut Simpan otomatis", () => {
  async function susunDariBerkas(dunia: Dunia, simpanan: Record<string, unknown>, modus?: "manual" | "otomatis") {
    const h = muatHalaman(dunia, simpanan);
    const wadah = h.dokumen.body.appendChild(h.dokumen.createElement("div"));
    let dipanggil = 0;
    const kotak = h.uji.bagianMassalBerkas(wadah, () => void (dipanggil += 1));
    const pemilih = kotak.querySelector("input[type=file]") as HTMLInputElement;
    const daftar = [
      "101_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai Gugat.rtf",
      "PA.Dgl_2026_Pdt.G_102_putusan_akhir.rtf",
      "103_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai Gugat.rtf",
    ].map((n) => new h.k.File(["{\\rtf1 isi}"], n, { type: "application/rtf" }));
    Object.defineProperty(pemilih, "files", { value: daftar, configurable: true });
    pemilih.dispatchEvent(new h.k.Event("change"));
    const pilih = kotak.querySelector("select") as HTMLSelectElement | null;
    if (modus && pilih) pilih.value = modus;
    (kotak.querySelector("button") as HTMLButtonElement).click();
    await tunggu(() => Boolean(antreanTersimpan(simpanan)), "antrean dari berkas tersimpan");
    return { h, kotak, dipanggil: () => dipanggil };
  }

  it("bawaannya otomatis DAN terucap: panel berkas, kabarnya, dan panel antrean menyebut Simpan SIPP ditekan sendiri", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const { kotak, dipanggil } = await susunDariBerkas(dunia, simpanan);

    expect(dunia.unggahNaskah).toEqual([N1, N2, N3]);
    const antrean = antreanTersimpan(simpanan)!;
    expect(antrean.modus).toBe("otomatis");
    expect(antrean.asal).toBe("berkas");
    expect(kotak.textContent).toMatch(/MENEKAN SIMPAN SIPP SENDIRI/);
    await tunggu(() => /Mode otomatis/.test(kotak.textContent || ""), "kabar susun");
    expect(kotak.textContent).toContain("ALETA menekan Simpan SIPP sendiri");
    // Bagian antrean diminta tampil seketika, tanpa memuat ulang halaman.
    expect(dipanggil()).toBe(1);

    const h = muatHalaman(dunia, simpanan);
    const panel = (await h.gambarPanel(N1))!;
    expect(panel.textContent).toContain("Antrean dari berkas naskah putusan");
    expect(panel.textContent).not.toContain("tahap ABT");
    expect(panel.textContent).toContain("MENEKAN SIMPAN SIPP SENDIRI");
  });

  it("dari berkas sampai tersimpan: ketiga perkara berjalan sendiri dan diterima SIPP", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunDariBerkas(dunia, simpanan);
    for (const nomor of [N1, N2, N3]) await kerjakanOtomatis(dunia, simpanan, nomor);
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([
      [N1, true],
      [N2, true],
      [N3, true],
    ]);
  });

  it("modus manual yang dipilih: tidak ada Simpan sampai tombolnya ditekan, dan tombolnya menyebut simpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunDariBerkas(dunia, simpanan, "manual");
    expect(antreanTersimpan(simpanan)!.modus).toBe("manual");

    const h = muatHalaman(dunia, simpanan);
    const panel = (await h.bukaBorang(N1))!;
    await reda();
    expect(dunia.simpan).toEqual([]);
    expect(panel.textContent).toContain("Mode manual");
    expect(panel.textContent).toContain("MENEKAN SIMPAN SIPP untuk perkara itu");
    const tombol = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Isi putusan & simpan (dari draf ALETA)")!;
    tombol.click();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1 selesai");
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([[N1, true]]);
  });

  it("modus yang tidak dikenal TIDAK menjadi otomatis", () => {
    const h = muatHalaman(buatDunia([]), {});
    expect(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "draf", butir: [] }).modus).toBe("manual");
    expect(h.uji.alatBuatAntrean({ tahap: "sipp", butir: [] }).modus).toBe("manual");
    expect(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [] }).modus).toBe("otomatis");
  });
});

// ===========================================================================
describe("C. panel yang digambar ulang selagi blangko terbuka: satu perkara, satu Simpan", () => {
  it("dua gambar panel beruntun di halaman yang sama -> Simpan ditekan SEKALI", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }] }));
    await h.bukaBorang(N1);
    // Pengamat DOM menggambar panelnya lagi sebelum pewaktu 600 ms berbunyi.
    await h.gambarPanel(N1);
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1 selesai");
    await reda();

    expect(dunia.simpan.filter((s) => s.nomor === N1)).toHaveLength(1);
    expect(keadaan(simpanan, N1)).toBe("selesai");
  });

  // Tiga penjaga berlapis - pewaktu panel yang sudah dibuang diam, satu
  // pengerjaan per halaman, dan keadaan dibaca ulang dari penyimpanan. Uji di
  // atas menggigit bila ketiganya hilang; dua uji di bawah menggigit
  // masing-masing penjaga pertama dan kedua SENDIRIAN.
  it("panel yang dibuang sebelum pewaktunya berbunyi tidak mengerjakan apa pun", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }] }));
    await h.bukaBorang(N1);
    h.kotak()!.remove(); // panelnya diganti sebelum 600 ms
    await reda();
    expect(dunia.simpan).toEqual([]);
    expect(keadaan(simpanan, N1)).toBe("menunggu");
  });

  it("dua pengerjaan serentak atas perkara yang sama di satu halaman -> satu Simpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }] }));
    dunia.bukaBorang(h.tab, N1);
    const a = (await h.uji.alatMuatAntrean())!;
    const sekali = h.uji.jalankanAntreanSippSekali;
    expect(sekali).not.toBeNull();
    await Promise.all([sekali!(a, a.butir[0], null, null, true), sekali!(a, a.butir[0], null, null, true)]);
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([[N1, true]]);
  });

  it("error di tengah pengerjaan tidak ditelan: perkaranya gagal beserta sebabnya, antrean berlanjut", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h = muatHalaman(dunia, simpanan);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }] }));
    h.k.praperiksaSebelumMengisi = async () => {
      throw new Error("rapor praperiksa rusak");
    };
    await h.gambarPanel(N1);
    const panel = (await h.bukaBorang(N1))!;
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1 tidak tertinggal 'jalan'");

    expect(keadaan(simpanan, N1)).toBe("gagal");
    expect(antreanTersimpan(simpanan)!.butir[0].catatan).toContain("rapor praperiksa rusak");
    expect(panel.textContent).toContain("rapor praperiksa rusak");
    expect(h.catatan.some((c) => c.jenis === "massal-galat" && c.ringkas.includes("rapor praperiksa rusak"))).toBe(true);
    // Perkara berikutnya tetap dikerjakan di halamannya.
    await kerjakanOtomatis(dunia, simpanan, N2);
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([[N2, true]]);
  });

  it("perkara yang terputus di tengah ('jalan') tidak dikerjakan ulang sendiri; tombolnya tetap ada", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h0 = muatHalaman(dunia, simpanan);
    const antrean = h0.uji.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: N1 }, { nomor: N2 }] });
    antrean.butir[0].keadaan = "jalan"; // halaman dimuat ulang di tengah pengerjaan
    await h0.uji.alatSimpanAntrean(antrean);

    const h = muatHalaman(dunia, simpanan);
    const panel = (await h.bukaBorang(N1))!;
    await reda();
    expect(dunia.simpan).toEqual([]);
    expect(panel.textContent).toContain("pekerjaan sebelumnya terputus");
    const tombol = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Isi putusan & simpan (dari draf ALETA)")!;
    tombol.click();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1 selesai lewat tombol");
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([[N1, true]]);
  });
});

// ===========================================================================
describe("D. salinan daftar medan antrean sama dengan milik panel satu perkara", () => {
  it("CALON_PILIHAN (antrean) = CALON_MEDAN_PANEL (bagianIsiPutusan), isi dan urutan", () => {
    const konten = baca(BERKAS_KONTEN);
    const ambil = (nama: string) => {
      const awal = konten.indexOf(`const ${nama} = [`);
      expect(awal).toBeGreaterThan(-1);
      const akhir = konten.indexOf("];", awal);
      return konten
        .slice(konten.indexOf("[", awal), akhir)
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
    };
    const antrean = ambil("CALON_PILIHAN");
    expect(antrean.length).toBe(13); // "[" + 12 medan
    expect(antrean).toEqual(ambil("CALON_MEDAN_PANEL"));
  });
});

// ===========================================================================
describe("E. 'Lanjutkan ke SIPP' dari ABT membuka halaman tempat konten.js berjalan", () => {
  const manifest = JSON.parse(baca(path.join(EKSTENSI, "manifest.json"))) as {
    content_scripts: Array<{ matches: string[]; js: string[] }>;
  };
  const polaKonten = manifest.content_scripts
    .filter((c) => c.js.includes("konten.js"))
    .flatMap((c) => c.matches)
    .map((m) => new RegExp(`^${m.replace(/[.?+^$(){}|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`));
  const dijangkauKonten = (alamat: string) => polaKonten.some((p) => p.test(alamat.replace(/:\d+(?=\/)/, "")));

  function alamatDari(asal: { origin: string; hostname: string }) {
    const abt = baca(BERKAS_ABT);
    const k: Record<string, unknown> = { location: asal };
    vm.createContext(k);
    vm.runInContext(`${potongFungsi(abt, "alamatSippDariAbt")}\nthis.hasil = alamatSippDariAbt();`, k);
    return String(k.hasil);
  }

  it("server satker (192.168.10.10) dan mesin setempat (127.0.0.1:8056)", () => {
    const kantor = alamatDari({ origin: "http://192.168.10.10", hostname: "192.168.10.10" });
    expect(dijangkauKonten(kantor)).toBe(true);
    const setempat = alamatDari({ origin: "http://127.0.0.1:8056", hostname: "127.0.0.1" });
    expect(dijangkauKonten(setempat)).toBe(true);
    // Alamat lama di peladen - di luar SIPP, tanpa panel ALETA.
    expect(dijangkauKonten("http://192.168.10.10/index.php/dashboard")).toBe(false);
  });

  it("tombol serah terima memakai alamat itu, dan antrean ABT membawa asalnya", () => {
    const abt = baca(BERKAS_ABT);
    expect(abt).toContain('window.open(alamatSippDariAbt(), "_blank");');
    expect(abt).not.toContain("window.open(`${location.origin}/index.php/dashboard`");
    const buat = abt.slice(abt.indexOf("const antrean = alatBuatAntrean({"), abt.indexOf("await alatSimpanAntrean(antrean);"));
    expect(buat).toContain('asal: "abt",');
  });
});

// ===========================================================================
describe("F. aturan SIPP yang sesungguhnya: qobla, nusyuz, keadaan istri, pilihan petugas, praperiksa", () => {
  it("SIPP tiruan sendiri: blangko baru bawaan 'Qobla Dukhul', dan urutan penolakan validateInput", async () => {
    const dunia = buatDunia(tigaPerkara());
    dunia.bukaBorang(1, N1);
    expect(dunia.borang(1)[QOBLA].nilai).toBe("0");
    expect(dunia.borang(1)[VERSTEK].nilai).toBe("T");
    // Borang yang baru dibuka: sumber hukum lebih dulu.
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Sumber Hukum Belum Dipilih");
    const pilih = (penunjuk: string, nilai: string) => dunia.jembatan(1, { jenis: "isi", penunjuk, nilai });
    pilih(SUMBER, "1");
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Kolom Amar Putusan Tidak Boleh Kosong.");
    for (const x of ["#amar", "#amar_anonim"]) dunia.jembatan(1, { jenis: "isi", penunjuk: x, nilai: AMAR_SAH });
    dunia.jembatan(1, { jenis: "isi", penunjuk: "#perhum", nilai: PERHUM });
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Status Putusan Wajib Dipilih.");
    pilih(STATUS, "62");
    // Dikabulkan membuka faktor, qobla (bawaan 0 -> keadaan istri ikut tampak), nusyuz.
    expect([FAKTOR, FAKTOR2, QOBLA, NUSYUZ, KEADAAN].map((x) => dunia.borang(1)[x].tampak)).toEqual([true, true, true, true, true]);
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Faktor Penyebab Percerian Wajib Dipilih.");
    pilih(FAKTOR, "5");
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Status Nusyuz Wajib Dipilih.");
    pilih(NUSYUZ, "0");
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Keadaan Istri Wajib Dipilih.");
    pilih(QOBLA, "-1");
    expect(dunia.tekanSimpan(1, N1).bunyi).toContain("Qobla/Bada Belum Diisi");
    pilih(QOBLA, "1");
    expect(dunia.borang(1)[KEADAAN].tampak).toBe(false);
    expect(dunia.tekanSimpan(1, N1).ok).toBe(true);
  });

  it("usulan tanpa qobla dan nusyuz: TIDAK disimpan - 'Qobla Dukhul' bawaan bukan jawaban, nusyuz kosong", async () => {
    const usulan = { ...USULAN_BAKU };
    delete usulan[QOBLA];
    delete usulan[NUSYUZ];
    const dunia = buatDunia(tigaPerkara(), { usulan });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1);

    // Kode sebelum 26 September 2026: qobla "0" dianggap terpilih, nusyuz tidak
    // dijaga - Simpan ditekan lalu ditolak "Status Nusyuz Wajib Dipilih".
    expect(dunia.simpan).toEqual([]);
    const b = butirDi(simpanan, N1);
    expect(b.keadaan).toBe("tertahan");
    expect(b.sebabTahan).toBe("pilihan-kosong");
    expect(b.catatan).toContain(`Qobla/Ba'da Dukhul (masih bawaan blangko "Qobla Dukhul", tidak ada usulan ALETA)`);
    expect(b.catatan).toContain("Status Nusyuz (tidak ada usulan ALETA)");
  });

  it("qobla bentrok: Simpan TIDAK ditekan - dahulu 'Qobla Dukhul' bawaan blangko tersimpan tanpa dipilih siapa pun", async () => {
    const dunia = buatDunia(tigaPerkara(), {
      usulan: { ...USULAN_BAKU, [QOBLA]: { nilai: "1", nilaiLabel: "Ba'da Dukhul", keyakinan: "bentrok" } },
    });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1);

    expect(dunia.simpan).toEqual([]);
    const b = butirDi(simpanan, N1);
    expect(b.sebabTahan).toBe("pilihan-kosong");
    expect(b.catatan).toContain("Qobla/Ba'da Dukhul (naskah menyebut lebih dari satu)");
  });

  it("nusyuz tanpa usulan: Simpan TIDAK ditekan, sebabnya pilihan wajib kosong - bukan penolakan SIPP", async () => {
    const usulan = { ...USULAN_QOBLA_DUKHUL };
    delete usulan[NUSYUZ];
    const dunia = buatDunia(tigaPerkara(), { usulan });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1);

    expect(dunia.simpan).toEqual([]);
    const b = butirDi(simpanan, N1);
    expect(b.keadaan).toBe("tertahan");
    expect(b.sebabTahan).toBe("pilihan-kosong");
    expect(b.catatan).toContain("Status Nusyuz (tidak ada usulan ALETA)");
  });

  it("pintu kedua (qobla): ba'da dukhul menyembunyikan keadaan istri - yang tersembunyi tidak diisi, dan tersimpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1);

    expect(dunia.simpan.map((s) => [s.diterima, s.pesan])).toEqual([[true, ""]]);
    expect(dunia.simpan[0].isian![QOBLA]).toBe("1");
    expect(dunia.simpan[0].isian![KEADAAN]).toBe("");
    // Qobla yang bukan pintu diisi SESUDAH daftar medan dibaca: keadaan istri
    // - tampak ketika dibaca, disembunyikan qobla - ikut diisi di balik layar.
    expect(dunia.isiTersembunyi).toEqual([]);
    expect(butirDi(simpanan, N1).isianPilihan!.map((x) => x.medan)).not.toContain("Keadaan Istri");
  });

  it("pintu kedua (qobla) yang MEMBUKA: 'Pilih Salah Satu' -> Qobla Dukhul memunculkan keadaan istri, yang lalu diisi", async () => {
    const dunia = buatDunia(tigaPerkara(), {
      usulan: { ...USULAN_BAKU, [QOBLA]: { nilai: "0", nilaiLabel: "Qobla Dukhul", keyakinan: "pasti", kutipan: "belum pernah berkumpul" } },
    });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "manual", [N1]);
    const h = muatHalaman(dunia, simpanan);
    await h.bukaBorang(N1);
    // Petugas sempat mengembalikan qobla ke "Pilih Salah Satu" - keadaan istri
    // tersembunyi sampai qobla dipilih lagi.
    dunia.jembatan(h.tab, { jenis: "isi", penunjuk: STATUS, nilai: "62" });
    dunia.jembatan(h.tab, { jenis: "isi", penunjuk: QOBLA, nilai: "-1" });
    dunia.borang(h.tab)[STATUS].nilai = "-1";
    for (const x of [FAKTOR, FAKTOR2, QOBLA, NUSYUZ, KEADAAN]) dunia.borang(h.tab)[x].tampak = false;
    [...h.kotak()!.querySelectorAll("button")].find((b) => /Isi putusan/.test(b.textContent || ""))!.click();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1");

    expect(dunia.simpan.map((s) => [s.diterima, s.pesan])).toEqual([[true, ""]]);
    expect(dunia.simpan[0].isian![QOBLA]).toBe("0");
    expect(dunia.simpan[0].isian![KEADAAN]).toBe("1");
  });

  it("isian pilihan dicatat per perkara (medan, nilai, asal); yang dari bawaan ditandai 'diisi bawaan - periksa'", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1, N2]);
    await kerjakanOtomatis(dunia, simpanan, N1);

    const isian = butirDi(simpanan, N1).isianPilihan!;
    const asal = Object.fromEntries(isian.map((x) => [x.medan, [x.nilai, x.asal]]));
    expect(asal["Status Putusan"]).toEqual(["Dikabulkan", "tegas"]);
    expect(asal["Sumber Hukum"]).toEqual(["Hukum Islam, Kompilasi Hukum Islam", "tegas"]);
    expect(asal["Faktor Penyebab Perceraian"]).toEqual(["Perselisihan dan pertengkaran terus menerus", "usulan"]);
    expect(asal["Qobla/Ba'da Dukhul"]).toEqual(["Ba'da Dukhul", "bawaan"]);
    expect(asal["Status Nusyuz"]).toEqual(["Tidak Nusyuz", "bawaan"]);
    expect(asal["Putusan Verstek"]).toEqual(["Tidak", "bawaan"]);

    const h = muatHalaman(dunia, simpanan);
    const teks = (await h.gambarPanel(""))!.textContent || "";
    expect(teks).toContain(`${N1}: diisi bawaan - periksa:`);
    expect(teks).toContain(`Qobla/Ba'da Dukhul "Ba'da Dukhul"`);
    expect(teks).toContain(`Status Nusyuz "Tidak Nusyuz"`);
    expect(teks).not.toContain(`Status Putusan "Dikabulkan"`);
    // Perkara yang belum dikerjakan tidak punya tanda.
    expect(teks).not.toContain(`${N2}: diisi bawaan`);
  });

  it("mode manual: faktor yang SUDAH dipilih petugas tidak ditimpa - berbeda dari usulan menahan Simpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "manual", [N1]);
    const h = muatHalaman(dunia, simpanan);
    await h.bukaBorang(N1);
    // Petugas memilih Dikabulkan, Ba'da Dukhul, dan faktor "Meninggalkan salah satu pihak".
    dunia.jembatan(h.tab, { jenis: "isi", penunjuk: STATUS, nilai: "62" });
    dunia.jembatan(h.tab, { jenis: "isi", penunjuk: QOBLA, nilai: "1" });
    dunia.jembatan(h.tab, { jenis: "isi", penunjuk: FAKTOR, nilai: "6" });
    [...h.kotak()!.querySelectorAll("button")].find((b) => /Isi putusan/.test(b.textContent || ""))!.click();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1");

    expect(dunia.simpan).toEqual([]);
    expect(dunia.borang(h.tab)[FAKTOR].nilai).toBe("6");
    const b = butirDi(simpanan, N1);
    expect(b.sebabTahan).toBe("pilihan-beda");
    expect(b.catatan).toContain(
      'Faktor Penyebab Perceraian: blangko berisi "Meninggalkan salah satu pihak", ALETA mengusulkan "Perselisihan dan pertengkaran terus menerus"'
    );
  });

  it("praperiksa membaca Status yang dipilih ANTREAN: 'Dikabulkan' atas amar 'Menolak' ditahan, tidak disimpan", async () => {
    const amarTolak = "<p>1. Menolak gugatan Penggugat untuk seluruhnya;</p><p>2. Membebankan biaya perkara kepada Penggugat;</p>";
    const dunia = buatDunia([{ nomor: N1, jenis: "Cerai Gugat", putus: false, amar: amarTolak }], {
      usulan: { ...USULAN_BAKU, [STATUS]: { nilai: "62", nilaiLabel: "Dikabulkan", keyakinan: "cukup", kutipan: "" } },
    });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1, { praperiksaAsli: true });

    expect(dunia.praperiksaDiminta.map((x) => [x.statusPutusan, x.verstek])).toEqual([["Dikabulkan", "T"]]);
    expect(dunia.simpan).toEqual([]);
    const b = butirDi(simpanan, N1);
    expect(b.keadaan).toBe("tertahan");
    expect(b.sebabTahan).toBe("praperiksa");
    expect(b.catatan).toContain('Status "Dikabulkan" tidak berpadanan dengan amar');
  });

  it("praperiksa yang lolos: dijalankan SEKALI, atas isian yang akan disimpan, lalu Simpan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1, { praperiksaAsli: true });
    expect(dunia.praperiksaDiminta.map((x) => [x.statusPutusan, x.verstek, x.tanggalPutusan])).toEqual([["Dikabulkan", "T", "26/09/2026"]]);
    expect(dunia.simpan.map((s) => s.diterima)).toEqual([true]);
  });
});

// ===========================================================================
describe("G. keadaan bersama antrean: salinan basi tidak menimpa, satu perkara satu Simpan", () => {
  /** Menahan permintaan usulan PERTAMA (atau milik satu nomor) sampai dilepas. */
  function gerbangSekali(dunia: Dunia, hanya?: string) {
    const g = { tertahan: false, lepas: () => undefined as void };
    dunia.setGerbangUsulan(async (nomor) => {
      if (g.tertahan || (hanya && nomor !== hanya)) return;
      g.tertahan = true;
      await new Promise<void>((r) => (g.lepas = r));
    });
    return g;
  }

  it("'Akhiri antrean' selagi perkara dikerjakan: Simpan TIDAK ditekan, antrean tidak hidup lagi", async () => {
    const dunia = buatDunia(tigaPerkara(), { usulan: USULAN_QOBLA_DUKHUL });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1, N2]);
    const g = gerbangSekali(dunia);
    const h = muatHalaman(dunia, simpanan);
    const panel = (await h.bukaBorang(N1))!;
    await tunggu(() => g.tertahan, "pengerjaan N1 sampai usulan");
    [...panel.querySelectorAll("button")].find((b) => b.textContent === "Akhiri antrean")!.click();
    await tunggu(() => !antreanTersimpan(simpanan), "antrean dibuang");
    g.lepas();
    await tunggu(() => dunia.simpan.length > 0 || /Simpan tidak ditekan/.test(h.kabar()), "N1 berhenti atau disimpan");
    await reda();

    expect(dunia.simpan).toEqual([]);
    expect(antreanTersimpan(simpanan)).toBeUndefined();
    expect(h.kabar()).toContain("antrean sudah diakhiri sebelum Simpan");
    // Halaman perkara berikutnya: tidak ada antrean, tidak ada yang dikerjakan.
    const h2 = muatHalaman(dunia, simpanan);
    expect(await h2.bukaBorang(N2)).toBeNull();
    await reda();
    expect(dunia.simpan).toEqual([]);
  });

  it("dua tab, dua perkara: catatan tab yang satu tidak hilang ditimpa salinan tab lain", async () => {
    const dunia = buatDunia(tigaPerkara(), { usulan: USULAN_QOBLA_DUKHUL });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1, N2]);
    const g = gerbangSekali(dunia, N1);
    const a = muatHalaman(dunia, simpanan);
    await a.bukaBorang(N1);
    await tunggu(() => g.tertahan, "tab A tertahan di usulan N1");
    const b = muatHalaman(dunia, simpanan);
    await b.bukaBorang(N2);
    await tunggu(() => selesaiDikerjakan(simpanan, N2), "tab B menyelesaikan N2");
    g.lepas();
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "tab A menyelesaikan N1");
    await reda();

    expect(dunia.simpan.filter((x) => x.diterima).map((x) => x.nomor).sort()).toEqual([N1, N2]);
    expect(antreanTersimpan(simpanan)!.butir.map((x) => [x.nomor, x.keadaan])).toEqual([
      [N1, "selesai"],
      [N2, "selesai"],
    ]);
    const c = muatHalaman(dunia, simpanan);
    expect((await c.gambarPanel(""))!.textContent).toContain("Seluruh antrean selesai.");
  });

  it("antrean BARU disusun selagi antrean lama berjalan di tab lain: yang baru utuh, yang lama tidak menekan Simpan", async () => {
    const dunia = buatDunia(tigaPerkara(), { usulan: USULAN_QOBLA_DUKHUL });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    const g = gerbangSekali(dunia);
    const a = muatHalaman(dunia, simpanan);
    await a.bukaBorang(N1);
    await tunggu(() => g.tertahan, "A tertahan");
    const d = muatHalaman(dunia, simpanan);
    const baru = d.uji.alatBuatAntrean({ tahap: "sipp", asal: "berkas", modus: "manual", butir: [{ nomor: N2 }, { nomor: N3 }] });
    await d.uji.alatSimpanAntrean(baru);
    g.lepas();
    await tunggu(() => dunia.simpan.length > 0 || /Simpan tidak ditekan/.test(a.kabar()), "A berhenti atau menyimpan");
    await reda();

    expect(dunia.simpan).toEqual([]);
    expect(a.kabar()).toContain("antrean ini sudah diganti antrean lain sebelum Simpan");
    const akhir = antreanTersimpan(simpanan)!;
    expect(akhir.id).toBe(baru.id);
    expect(akhir.butir.map((x) => [x.nomor, x.keadaan])).toEqual([
      [N2, "menunggu"],
      [N3, "menunggu"],
    ]);
  });

  it("dua tab membuka blangko perkara YANG SAMA (penyimpanan berlatensi, Web Locks): satu klaim, satu Simpan", async () => {
    const dunia = buatDunia(tigaPerkara(), { usulan: USULAN_QOBLA_DUKHUL });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    const kunci = buatKunciBersama();
    const a = muatHalaman(dunia, simpanan, { jedaSimpanan: 5, kunci });
    const b = muatHalaman(dunia, simpanan, { jedaSimpanan: 5, kunci });
    await Promise.all([a.bukaBorang(N1), b.bukaBorang(N1)]);
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1");
    await reda();
    await reda();

    expect(dunia.simpan.map((x) => [x.nomor, x.diterima])).toEqual([[N1, true]]);
    expect(kunci.hitung.diminta).toBeGreaterThan(0);
    // Yang kalah ditolak SAAT KLAIM - dengan kunci, ia tidak pernah menandai
    // perkaranya "jalan" atas namanya sendiri.
    const kalah = dunia.simpan[0].tab === a.tab ? b : a;
    expect(kalah.kabar()).toContain(`${N1} sudah sedang dikerjakan - tidak dikerjakan lagi.`);
    expect(butirDi(simpanan, N1).keadaan).toBe("selesai");
  });

  it("tanpa Web Locks tetap berfungsi: dua tab atas perkara yang sama tetap satu Simpan (penanda pemegang)", async () => {
    const dunia = buatDunia(tigaPerkara(), { usulan: USULAN_QOBLA_DUKHUL });
    const simpanan: Record<string, unknown> = {};
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    const a = muatHalaman(dunia, simpanan, { jedaSimpanan: 5 });
    const b = muatHalaman(dunia, simpanan, { jedaSimpanan: 5 });
    await Promise.all([a.bukaBorang(N1), b.bukaBorang(N1)]);
    await tunggu(() => selesaiDikerjakan(simpanan, N1), "N1");
    await reda();
    await reda();
    expect(dunia.simpan.map((x) => [x.nomor, x.diterima])).toEqual([[N1, true]]);
  });
});

// ===========================================================================
describe("H. bunyi 'tertahan' menurut sebabnya", () => {
  it("ringkasan, baris perkara, dan kabar menyebut sebab masing-masing - bukan 'ditahan praperiksa' untuk semua", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const h0 = muatHalaman(dunia, simpanan);
    const sebab = ["praperiksa", "pilihan-kosong", "pilihan-beda", "gagal-isi", "medan-tambahan", "antrean-diakhiri"];
    const antrean = h0.uji.alatBuatAntrean({
      tahap: "sipp",
      modus: "manual",
      butir: [...sebab.map((_, i) => ({ nomor: `${200 + i}/Pdt.G/2026/PA.Dgl` })), { nomor: N1 }],
    });
    sebab.forEach((s, i) => {
      antrean.butir[i].keadaan = "tertahan";
      antrean.butir[i].sebabTahan = s;
    });
    await h0.uji.alatSimpanAntrean(antrean);

    const h = muatHalaman(dunia, simpanan);
    const teks = (await h.gambarPanel(""))!.textContent || "";
    for (const bunyi of [
      "1 ditahan praperiksa",
      "1 tertahan karena pilihan wajib kosong",
      "1 tertahan karena pilihan petugas berbeda",
      "1 tertahan karena medan gagal terisi",
      "1 tertahan karena medan tambahan satker",
      "1 tertahan karena antrean diakhiri",
    ]) {
      expect(teks).toContain(bunyi);
    }
    expect(teks).not.toMatch(/tertahan \(/);

    // Butir tanpa catatan: barisnya menyebut sebabnya sendiri.
    const baris = [...h.kotak()!.querySelectorAll(".aleta-perkakas-baris")].map((x) => x.textContent || "");
    expect(baris.find((x) => x.startsWith("203/"))).toContain("tertahan karena medan gagal terisi");
    expect(baris.find((x) => x.startsWith("201/"))).toContain("tertahan karena pilihan wajib kosong");

    // Kabar saat perkara tertahan dicoba lagi: sebabnya, bukan "ditahan praperiksa".
    const kabar = h.dokumen.createElement("div");
    const segar = (await h.uji.alatMuatAntrean())!;
    await h.uji.jalankanAntreanSippSekali!(segar, segar.butir[3], kabar, null, true);
    expect(kabar.textContent).toContain("sudah tertahan karena medan gagal terisi - tidak dikerjakan lagi.");
    expect(kabar.textContent).not.toContain("praperiksa");
  });
});

// ============================================================================
describe("I. antrean baru tidak diam-diam mengganti antrean yang belum selesai", () => {
  // Hanya ada satu antrean tersimpan. Sampai 26 September 2026 menyusun
  // antrean baru menghapus perkara antrean lama yang belum dikerjakan tanpa
  // kabar; kini petugas ditanya (alatBolehGantiAntrean di panel-alat.js).
  const antreanLama = (keadaanButir: string) => ({
    id: "massal-lama",
    dibuat: "2026-09-26T00:00:00.000Z",
    tanggalSidang: "2026-09-25",
    tahap: "sipp",
    asal: "sidang",
    modus: "manual",
    kering: false,
    posisi: 0,
    butir: ["201/Pdt.G/2026/PA.Dgl", "202/Pdt.G/2026/PA.Dgl"].map((nomor) => ({
      nomor,
      perkaraId: "",
      jenis: "",
      enc: "",
      keadaan: keadaanButir,
      catatan: "",
      dokumen: { rtf: "", pdf: "", anonim: "", unggah: "" },
    })),
  });

  async function susunDariBerkas(simpanan: Record<string, unknown>, jawab: boolean) {
    const dunia = buatDunia(tigaPerkara());
    const h = muatHalaman(dunia, simpanan);
    const ditanya: string[] = [];
    (h.k.window as { confirm?: (pesan: string) => boolean }).confirm = (pesan: string) => {
      ditanya.push(pesan);
      return jawab;
    };
    const wadah = h.dokumen.body.appendChild(h.dokumen.createElement("div"));
    const kotak = h.uji.bagianMassalBerkas(wadah, () => undefined);
    const pemilih = kotak.querySelector("input[type=file]") as HTMLInputElement;
    const daftar = ["101_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai Gugat.rtf"].map(
      (n) => new h.k.File(["{\\rtf1 isi}"], n, { type: "application/rtf" })
    );
    Object.defineProperty(pemilih, "files", { value: daftar, configurable: true });
    pemilih.dispatchEvent(new h.k.Event("change"));
    (kotak.querySelector("button") as HTMLButtonElement).click();
    await tunggu(
      () => /dipertahankan/.test(kotak.textContent || "") || antreanTersimpan(simpanan)?.asal === "berkas",
      "penyusunan antrean selesai"
    );
    return { ditanya, kotak, dunia };
  }

  it("antrean lama masih menunggu: petugas ditanya, dan menolak MEMPERTAHANKAN antrean lama", async () => {
    const simpanan: Record<string, unknown> = { antreanPutusanMassal: antreanLama("menunggu") };
    const { ditanya, kotak, dunia } = await susunDariBerkas(simpanan, false);
    expect(ditanya).toHaveLength(1);
    expect(ditanya[0]).toContain("jadwal sidang (sidang 2026-09-25)");
    expect(ditanya[0]).toContain("2 perkara yang belum dikerjakan");
    expect(antreanTersimpan(simpanan)!.id).toBe("massal-lama");
    expect(kotak.textContent).toContain("Antrean lama dipertahankan - antrean baru tidak disusun.");
    // Naskahnya tetap tersimpan sebagai draf - hanya antreannya yang tidak diganti.
    expect(dunia.unggahNaskah).toEqual([N1]);
  });

  it("menyetujui: antrean lama diganti antrean dari berkas", async () => {
    const simpanan: Record<string, unknown> = { antreanPutusanMassal: antreanLama("jalan") };
    const { ditanya } = await susunDariBerkas(simpanan, true);
    expect(ditanya).toHaveLength(1);
    expect(antreanTersimpan(simpanan)!.id).not.toBe("massal-lama");
    expect(antreanTersimpan(simpanan)!.asal).toBe("berkas");
  });

  it("antrean lama yang sudah habis diganti tanpa bertanya", async () => {
    const simpanan: Record<string, unknown> = { antreanPutusanMassal: antreanLama("selesai") };
    const { ditanya } = await susunDariBerkas(simpanan, false);
    expect(ditanya).toEqual([]);
    expect(antreanTersimpan(simpanan)!.asal).toBe("berkas");
  });
});

// ===========================================================================
describe("J. edoc putusan + edoc anonimisasi sesudah Simpan antrean (butir 6, 6 Okt 2026)", () => {
  const RAK = ["aleta-naskah-edoc", "naskah"] as const;
  const NAMA = [
    "101_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai Gugat.rtf",
    "PA.Dgl_2026_Pdt.G_102_putusan_akhir.rtf",
    "103_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai Gugat.rtf",
  ];

  /** "Kirim naskah lalu susun antrean" di halaman daftar, dengan opsi edoc. */
  async function susunDariBerkasEdoc(dunia: Dunia, simpanan: Record<string, unknown>, e: EdocUji, nama = NAMA) {
    const h = muatHalaman(dunia, simpanan, { edoc: e });
    const wadah = h.dokumen.body.appendChild(h.dokumen.createElement("div"));
    const kotak = h.uji.bagianMassalBerkas(wadah);
    const pemilih = kotak.querySelector("input[type=file]") as HTMLInputElement;
    const daftar = nama.map((n) => new globalThis.File([`{\\rtf1 naskah ${n}}`], n, { type: "application/rtf" }));
    Object.defineProperty(pemilih, "files", { value: daftar, configurable: true });
    pemilih.dispatchEvent(new h.k.Event("change"));
    (kotak.querySelector("button") as HTMLButtonElement).click();
    await tunggu(() => Boolean(antreanTersimpan(simpanan)), "antrean dari berkas tersimpan");
    await tunggu(() => /Buka perkara pertamanya/.test(kotak.textContent || ""), "kabar susun");
    return { h, kotak };
  }

  it("dari berkas, otomatis: tiap perkara tersimpan LALU edoc putusan + anonimisasinya diunggah; antrean berlanjut; rak dikosongkan", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji();
    const { kotak } = await susunDariBerkasEdoc(dunia, simpanan, e);
    // Naskah asli disimpan di peramban (rak), per nomor perkara.
    expect([...e.idb.isi(...RAK).keys()].sort()).toEqual([N1, N2, N3].map((n) => n.toLowerCase()).sort());
    expect(kotak.textContent).toContain("edoc putusan dan edoc anonimisasinya ikut diunggah (3 dari 3 naskah siap untuk edoc)");

    for (const nomor of [N1, N2, N3]) await kerjakanOtomatis(dunia, simpanan, nomor, { edoc: e });

    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([
      [N1, true],
      [N2, true],
      [N3, true],
    ]);
    // Edoc SESUDAH Simpan, satu kiriman per perkara: naskah asli + anonimnya.
    expect(e.unggah).toEqual([
      { nomor: N1, putusan: NAMA[0], anonimisasi: `anonim_${NAMA[0]}` },
      { nomor: N2, putusan: NAMA[1], anonimisasi: `anonim_${NAMA[1]}` },
      { nomor: N3, putusan: NAMA[2], anonimisasi: `anonim_${NAMA[2]}` },
    ]);
    for (const nomor of [N1, N2, N3]) {
      const b = butirDi(simpanan, nomor) as Butir & { edoc?: string };
      expect(b.keadaan).toBe("selesai");
      expect(b.edoc).toBe("ok");
      expect(b.catatan).toContain("tersimpan di SIPP");
      expect(b.catatan).toContain("Edoc putusan dan edoc anonimisasi terunggah");
    }
    // Halaman tiap perkara dibuka kembali - antrean menunjuk perkara berikutnya.
    await tunggu(() => e.dimuatUlang.length === 3, "halaman perkara dibuka kembali");
    expect(e.dimuatUlang).toHaveLength(3);
    // Naskah yang sudah menjadi edoc tidak disimpan lebih lama.
    expect(e.idb.isi(...RAK).size).toBe(0);
  });

  it("anonimisasi ABT gagal: putusan TETAP tersimpan, edoc tidak diunggah, sebabnya di butir, antrean LANJUT ke perkara berikutnya", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji("gagal");
    await susunDariBerkasEdoc(dunia, simpanan, e, NAMA.slice(0, 2));
    await kerjakanOtomatis(dunia, simpanan, N1, { edoc: e });
    const b1 = butirDi(simpanan, N1) as Butir & { edoc?: string };
    expect(b1.keadaan).toBe("selesai");
    expect(b1.edoc).toMatch(/^gagal: /);
    expect(b1.catatan).toContain("EDOC GAGAL");
    expect(b1.catatan).toContain("Masuk ABT dulu");
    // Halaman tetap dibuka kembali (dahulu: "Halaman TIDAK dimuat ulang" -> antrean diam).
    await tunggu(() => e.dimuatUlang.length === 1, "halaman perkara dibuka kembali");
    expect(e.dimuatUlang).toHaveLength(1);

    // Baris N1 di panel antrean tidak lagi hijau; N2 tetap dikerjakan.
    const h2 = muatHalaman(dunia, simpanan, { edoc: e });
    const panel = (await h2.gambarPanel(N2))!;
    const baris = [...panel.querySelectorAll(".aleta-perkakas-baris")].find((x) => (x.textContent || "").includes(N1))!;
    expect(baris.className).toContain("aleta-perkakas-awas");
    expect(baris.className).not.toContain("aleta-perkakas-baik");
    await kerjakanOtomatis(dunia, simpanan, N2, { edoc: e });
    expect(dunia.simpan.map((s) => [s.nomor, s.diterima])).toEqual([
      [N1, true],
      [N2, true],
    ]);
    expect(e.unggah).toEqual([]);
    // Naskah yang belum menjadi edoc tetap di rak - dapat diunggah dari panel perkara.
    expect(e.idb.isi(...RAK).size).toBe(2);
  });

  it("rute unggah-sipp menolak: dicatat per perkara beserta sebabnya, antrean berlanjut", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji("ok", true);
    await susunDariBerkasEdoc(dunia, simpanan, e, NAMA.slice(0, 2));
    for (const nomor of [N1, N2]) await kerjakanOtomatis(dunia, simpanan, nomor, { edoc: e });
    expect(e.unggah.map((u) => u.nomor)).toEqual([N1, N2]);
    for (const nomor of [N1, N2]) {
      const b = butirDi(simpanan, nomor) as Butir & { edoc?: string };
      expect(b.keadaan).toBe("selesai");
      expect(b.edoc).toMatch(/^gagal: .*Folder SIPP tidak terjangkau/);
    }
    await tunggu(() => e.dimuatUlang.length === 2, "halaman perkara dibuka kembali");
    expect(e.dimuatUlang).toHaveLength(2);
  });

  it("antrean dari tanggal sidang tanpa naskah di peramban ini: putusan tersimpan, edoc disebut TIDAK diunggah beserta jalan keluarnya", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji();
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1, { edoc: e });
    const b = butirDi(simpanan, N1) as Butir & { edoc?: string };
    expect(b.keadaan).toBe("selesai");
    expect(b.edoc).toMatch(/^gagal: /);
    expect(b.catatan).toMatch(/naskah aslinya tidak tersimpan di peramban ini/);
    expect(b.catatan).toMatch(/Unggah putusan ke SIPP/);
    expect(e.unggah).toEqual([]);
    await tunggu(() => e.dimuatUlang.length === 1, "halaman perkara dibuka kembali");
    expect(e.dimuatUlang).toHaveLength(1);
  });

  it("antrean dari tanggal sidang, naskah perkara itu tersimpan sebelumnya: edocnya ikut diunggah", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji();
    // Naskah dikirim lebih dahulu dari Putusan otomatis panel perkara (prosesNaskah) - rak yang sama.
    const h0 = muatHalaman(dunia, simpanan, { edoc: e });
    const naskah = new globalThis.File(["{\\rtf1 naskah}"], "putusan 101.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const rtf = new globalThis.File(["{\\rtf1 naskah}"], "putusan 101.rtf", { type: "application/rtf" });
    expect(await h0.k.a30SimpanNaskahEdoc(N1, naskah, rtf)).toBe(true);
    await susunAntrean(dunia, simpanan, "otomatis", [N1]);
    await kerjakanOtomatis(dunia, simpanan, N1, { edoc: e });
    // Bentuk asli (DOCX) yang diunggah sebagai edoc, bukan RTF antaranya.
    expect(e.unggah).toEqual([{ nomor: N1, putusan: "putusan 101.docx", anonimisasi: "anonim_putusan 101.docx" }]);
    expect((butirDi(simpanan, N1) as Butir & { edoc?: string }).edoc).toBe("ok");
  });

  it("rak naskah: TXT tidak disimpan, kunci tanpa beda huruf besar-kecil, kedaluwarsa 14 hari dibuang", async () => {
    const e = edocUji();
    const h = muatHalaman(buatDunia([]), {}, { edoc: e });
    const f = (n: string) => new globalThis.File(["x"], n, { type: "" });
    expect(await h.k.a30SimpanNaskahEdoc(N1, f("putusan.txt"), null)).toBe(false);
    expect(await h.k.a30SimpanNaskahEdoc(N1, f("putusan.rtf"), null)).toBe(true);
    const ambil = await h.k.a30AmbilNaskahEdoc(N1.toUpperCase());
    expect(ambil.asli.name).toBe("putusan.rtf");
    expect(ambil.rtf).toBeNull();
    // Rekam berumur 15 hari: tidak dipakai, dan dibuang pada simpan berikutnya.
    const isi = e.idb.isi(...RAK);
    const lama = isi.get(N1.toLowerCase()) as { waktu: number };
    lama.waktu = Date.now() - 15 * 24 * 60 * 60 * 1000;
    expect(await h.k.a30AmbilNaskahEdoc(N1)).toBeNull();
    expect(await h.k.a30SimpanNaskahEdoc(N2, f("b.pdf"), null)).toBe(true);
    expect([...isi.keys()]).toEqual([N2.toLowerCase()]);
  });

  it("antrean dari ABT tidak ikut: edocnya diurus di tahap ABT", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = edocUji();
    const h = muatHalaman(dunia, simpanan, { edoc: e });
    await h.k.a30SimpanNaskahEdoc(N1, new globalThis.File(["x"], "n.rtf"), null);
    await h.uji.alatSimpanAntrean(h.uji.alatBuatAntrean({ tahap: "sipp", asal: "abt", modus: "otomatis", butir: [{ nomor: N1 }] }));
    await kerjakanOtomatis(dunia, simpanan, N1, { edoc: e });
    const b = butirDi(simpanan, N1) as Butir & { edoc?: string };
    expect(b.keadaan).toBe("selesai");
    expect(b.edoc).toBeUndefined();
    expect(b.catatan).not.toMatch(/EDOC|Edoc/);
    expect(e.unggah).toEqual([]);
    expect(e.anonDiminta).toEqual([]);
  });

  it("tampilan Lama (a30 mati): naskah tidak disimpan, tidak ada edoc - perilaku semula", async () => {
    const dunia = buatDunia(tigaPerkara());
    const simpanan: Record<string, unknown> = {};
    const e = { ...edocUji(), lama: true };
    const { kotak } = await susunDariBerkasEdoc(dunia, simpanan, e, NAMA.slice(0, 1));
    expect(e.idb.isi(...RAK).size).toBe(0);
    expect(kotak.textContent).not.toContain("edoc");
    await kerjakanOtomatis(dunia, simpanan, N1, { edoc: e });
    const b = butirDi(simpanan, N1) as Butir & { edoc?: string };
    expect(b.keadaan).toBe("selesai");
    expect(b.edoc).toBeUndefined();
    expect(e.unggah).toEqual([]);
  });
});
