/**
 * PENJAGA TUTORIAL HIDUP
 *
 * Tujuan: tutorial tidak boleh basi. Uji ini GAGAL bila
 *   - ada aplikasi, menu samping, tab ALETA e-Court, atau hak aksi di matriks
 *     peran yang belum punya entri tutorial; atau
 *   - ada entri yang menunjuk kunci/halaman yang sudah tidak ada; atau
 *   - tanda "Baru di versi X" menunjuk versi yang tidak ada di catatan rilis.
 * Jadi tiap rilis yang menambah menu atau hak WAJIB menambah tutorialnya
 * (src/lib/tutorial-isi.ts).
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CATATAN_EKSTENSI } from "@/lib/catatan-ekstensi";
import { AKSI, GOLONGAN_PERAN, TAB_ECOURT, bawaanAplikasiGolongan, type GolonganPeran } from "@/lib/matriks-peran";
import { PATCH_NOTES } from "@/lib/patch-notes";
import { TUTORIAL } from "@/lib/tutorial-isi";
import {
  JUMLAH_VERSI_DIANGGAP_BARU,
  URUTAN_KELOMPOK_TUTORIAL,
  cocokDenganKata,
  golonganPelihatTutorial,
  jalurBersih,
  kelompokkanTutorial,
  periksaCakupan,
  saringTutorial,
  sumberKunciNyata,
  tandaBaru,
  tutorialTampil,
  tutorialUntukHalaman,
  versiAdaDiCatatan,
  type Tutorial,
} from "@/lib/tutorial-hidup";

// ─── Rute halaman yang benar-benar ada ───────────────────────────────────────

function kumpulkanRute(akar: string): RegExp[] {
  const hasil: RegExp[] = [];
  const jelajah = (dir: string, segmen: string[]) => {
    for (const nama of readdirSync(dir)) {
      const penuh = join(dir, nama);
      if (statSync(penuh).isDirectory()) {
        // Grup (portal) dan slot @x tidak ikut alamat.
        const abaikan = /^\(.+\)$/.test(nama) || nama.startsWith("@");
        jelajah(penuh, abaikan ? segmen : [...segmen, nama]);
      } else if (nama === "page.tsx" || nama === "page.ts") {
        const pola = segmen
          .map((s) => (/^\[\.\.\..+\]$/.test(s) ? ".+" : /^\[.+\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
          .join("/");
        hasil.push(new RegExp(`^/${pola}$`));
      }
    }
  };
  jelajah(akar, []);
  return hasil;
}

const RUTE = kumpulkanRute(join(process.cwd(), "src", "app"));
const halamanAda = (href: string) => {
  const j = jalurBersih(href);
  return RUTE.some((r) => r.test(j));
};

// ─── Bantuan ─────────────────────────────────────────────────────────────────

const PUNYA_KUNCI_MATRIKS = (t: Tutorial) =>
  (t.mencakup.aplikasi?.length ?? 0) +
    (t.mencakup.modul?.length ?? 0) +
    (t.mencakup.tab?.length ?? 0) +
    (t.mencakup.aksi?.length ?? 0) >
  0;

const lihat = (t: Tutorial, g: GolonganPeran) => tutorialTampil(t, { sebagaiGolongan: [g] });

function semuaTeks(t: Tutorial): string[] {
  return [t.judul, t.ringkas, ...t.langkah, ...(t.peringatan ?? []), ...(t.kataKunci ?? []), t.tautan?.teks ?? ""];
}

// ─── Kelengkapan ─────────────────────────────────────────────────────────────

describe("tutorial hidup - kelengkapan terhadap matriks peran dan daftar menu", () => {
  it("setiap aplikasi, menu samping, tab e-Court, dan hak aksi punya tutorial", () => {
    const { belumAdaTutorial } = periksaCakupan(TUTORIAL, sumberKunciNyata());
    expect(
      belumAdaTutorial,
      `Belum ada tutorial untuk: ${belumAdaTutorial.join(", ")}. Tambahkan entri di src/lib/tutorial-isi.ts yang 'mencakup'-nya memuat kunci itu.`
    ).toEqual([]);
  });

  it("tidak ada tutorial yang menunjuk aplikasi, menu, tab, atau hak yang sudah tidak ada", () => {
    const { menunjukYangHilang } = periksaCakupan(TUTORIAL, sumberKunciNyata());
    expect(
      menunjukYangHilang,
      `Tutorial menunjuk yang sudah tidak ada: ${menunjukYangHilang.join(", ")}. Hapus atau perbarui entrinya.`
    ).toEqual([]);
  });

  it("penjaga sungguh bereaksi: menu baru tanpa tutorial terdeteksi, dan tutorial yatim terdeteksi", () => {
    const nyata = sumberKunciNyata();
    const menambah = periksaCakupan(TUTORIAL, {
      ...nyata,
      modul: [...nyata.modul, "menu-baru-belum-ada-tutorialnya"],
      aksi: [...nyata.aksi, "sidang.hak-baru"],
    });
    expect(menambah.belumAdaTutorial).toEqual(["modul:menu-baru-belum-ada-tutorialnya", "aksi:sidang.hak-baru"]);

    const menghapus = periksaCakupan(TUTORIAL, { ...nyata, modul: nyata.modul.filter((m) => m !== "skp") });
    expect(menghapus.menunjukYangHilang).toContain("modul:skp");
  });

  it("id unik, berbentuk huruf kecil-strip, dan isinya terisi", () => {
    const id = TUTORIAL.map((t) => t.id);
    expect(new Set(id).size).toBe(id.length);
    for (const t of TUTORIAL) {
      expect(t.id, t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.judul.trim(), t.id).not.toBe("");
      expect(t.ringkas.trim(), t.id).not.toBe("");
      expect(t.langkah.length, `${t.id}: minimal tiga langkah`).toBeGreaterThanOrEqual(3);
      expect(t.halaman.length, `${t.id}: tanpa halaman, tombol ? tidak pernah menampilkannya`).toBeGreaterThan(0);
      expect(URUTAN_KELOMPOK_TUTORIAL, t.id).toContain(t.kelompok);
      for (const l of t.langkah) expect(l.trim(), t.id).not.toBe("");
    }
  });

  it("siapa-melihat diturunkan dari matriks: 'untuk' hanya dipakai bila tidak ada kunci matriks", () => {
    for (const t of TUTORIAL) {
      if (t.untuk) {
        expect(PUNYA_KUNCI_MATRIKS(t), `${t.id}: 'untuk' DAN kunci matriks - pilih satu`).toBe(false);
      } else {
        expect(PUNYA_KUNCI_MATRIKS(t), `${t.id}: tanpa kunci matriks wajib punya 'untuk'`).toBe(true);
      }
    }
  });

  it("semua halaman dan tautan menunjuk halaman portal yang ada", () => {
    const rusak: string[] = [];
    for (const t of TUTORIAL) {
      for (const h of t.halaman) if (!halamanAda(h)) rusak.push(`${t.id} halaman ${h}`);
      if (t.tautan && !halamanAda(t.tautan.href)) rusak.push(`${t.id} tautan ${t.tautan.href}`);
    }
    expect(rusak, `Halaman tidak ada: ${rusak.join("; ")}`).toEqual([]);
  });
});

// ─── Versi dan tanda "Baru" ──────────────────────────────────────────────────

describe("tutorial hidup - tanda Baru di versi X dari catatan rilis", () => {
  it("setiap versi yang disebut ada di catatan rilis portal atau ekstensi", () => {
    for (const t of TUTORIAL) {
      if (!t.baruDi) continue;
      expect(versiAdaDiCatatan(t.baruDi), `${t.id}: versi ${t.baruDi.sumber} ${t.baruDi.versi} tidak ada di catatan rilis`).toBe(true);
    }
  });

  it("tanda muncul untuk rilis terbaru dan padam untuk yang sudah lama", () => {
    const terbaruEkstensi = CATATAN_EKSTENSI[0].versi;
    const lamaEkstensi = CATATAN_EKSTENSI[JUMLAH_VERSI_DIANGGAP_BARU].versi;
    expect(tandaBaru({ baruDi: { sumber: "ekstensi", versi: terbaruEkstensi } })).toBe(`Baru di ekstensi ${terbaruEkstensi}`);
    expect(tandaBaru({ baruDi: { sumber: "ekstensi", versi: lamaEkstensi } })).toBeNull();
    expect(tandaBaru({ baruDi: { sumber: "portal", versi: PATCH_NOTES[0].version } })).toBe(`Baru di portal ${PATCH_NOTES[0].version}`);
    expect(tandaBaru({ baruDi: { sumber: "portal", versi: PATCH_NOTES[JUMLAH_VERSI_DIANGGAP_BARU].version } })).toBeNull();
    expect(tandaBaru({})).toBeNull();
  });

  it("ada fitur yang saat ini bertanda Baru (tutorial awal memuat yang terbaru)", () => {
    expect(TUTORIAL.filter((t) => tandaBaru(t) !== null).length).toBeGreaterThan(0);
  });
});

// ─── Hak: siapa melihat apa ──────────────────────────────────────────────────

describe("tutorial hidup - hanya fitur yang menjadi hak pembaca", () => {
  it("Super Admin melihat semua, dan 'lihat sebagai peran' menyaring seperti peran itu", () => {
    const superAdmin = saringTutorial(TUTORIAL, { sebagaiGolongan: ["super-admin"] });
    expect(superAdmin.length).toBe(TUTORIAL.length);
    for (const g of GOLONGAN_PERAN.filter((x) => x !== "super-admin")) {
      const dilihat = saringTutorial(TUTORIAL, { sebagaiGolongan: [g] });
      expect(dilihat.length, g).toBeGreaterThan(0);
      expect(dilihat.length, g).toBeLessThanOrEqual(TUTORIAL.length);
    }
  });

  it("setiap golongan melihat tutorial mulai-portal", () => {
    const mulai = TUTORIAL.find((t) => t.id === "mulai-portal")!;
    for (const g of GOLONGAN_PERAN) expect(lihat(mulai, g), g).toBe(true);
  });

  it("golongan yang diberi hak aksi di matriks selalu melihat tutorial aksinya", () => {
    for (const [kunci, aturan] of Object.entries(AKSI)) {
      const pembahas = TUTORIAL.filter((t) => (t.mencakup.aksi as readonly string[] | undefined)?.includes(kunci));
      expect(pembahas.length, kunci).toBeGreaterThan(0);
      for (const g of [...aturan.golongan, "admin" as const]) {
        expect(
          pembahas.some((t) => lihat(t, g)),
          `${kunci}: ${g} berhak tetapi tidak melihat tutorialnya`
        ).toBe(true);
      }
    }
  });

  it("golongan yang menerima sebuah aplikasi atau tab selalu melihat tutorialnya", () => {
    const aplikasi = sumberKunciNyata().aplikasi;
    for (const id of aplikasi) {
      const pembahas = TUTORIAL.filter((t) => t.mencakup.aplikasi?.includes(id));
      for (const g of GOLONGAN_PERAN) {
        if (bawaanAplikasiGolongan([g], id)) {
          expect(pembahas.some((t) => lihat(t, g)), `aplikasi ${id}: ${g} berhak tetapi tidak melihat tutorialnya`).toBe(true);
        }
      }
    }
    for (const [tab, aturan] of Object.entries(TAB_ECOURT)) {
      const pembahas = TUTORIAL.filter((t) => (t.mencakup.tab as readonly string[] | undefined)?.includes(tab));
      const penerima = aturan.golongan === "semua" ? GOLONGAN_PERAN : aturan.golongan;
      for (const g of penerima) {
        expect(pembahas.some((t) => lihat(t, g)), `tab ${tab}: ${g}`).toBe(true);
      }
    }
  });

  it("contoh nyata: unggah putusan hanya hakim dan pimpinan; Kasir hanya kasir, panitera, panmud", () => {
    const unggah = TUTORIAL.find((t) => t.id === "unggah-putusan")!;
    expect(golonganPelihatTutorial(unggah).has("hakim")).toBe(true);
    expect(golonganPelihatTutorial(unggah).has("pimpinan")).toBe(true);
    expect(golonganPelihatTutorial(unggah).has("kasir")).toBe(false);
    expect(golonganPelihatTutorial(unggah).has("pp")).toBe(false);
    expect(golonganPelihatTutorial(unggah).has("jurusita")).toBe(false);

    const kasir = TUTORIAL.find((t) => t.id === "kasir")!;
    expect(lihat(kasir, "kasir")).toBe(true);
    expect(lihat(kasir, "panitera")).toBe(true);
    expect(lihat(kasir, "hakim")).toBe(false);
    expect(lihat(kasir, "jurusita")).toBe(false);

    const relaas = TUTORIAL.find((t) => t.id === "relaas-massal")!;
    expect(lihat(relaas, "jurusita")).toBe(true);
    expect(lihat(relaas, "pp")).toBe(false);
  });

  it("akun nyata: hakim melihat unggah putusan, kasir tidak, super admin semuanya", () => {
    const unggah = TUTORIAL.find((t) => t.id === "unggah-putusan")!;
    expect(tutorialTampil(unggah, { pengguna: { roleId: "hakim" } })).toBe(true);
    expect(tutorialTampil(unggah, { pengguna: { roleId: "pegawai", additionalRoleIds: ["kasir"] } })).toBe(false);
    expect(tutorialTampil(unggah, { pengguna: { roleId: "super-admin" } })).toBe(true);
    expect(tutorialTampil(unggah, { pengguna: null })).toBe(false);
  });

  it("aplikasi belum matang hanya terlihat Super Admin, kecuali dibuka lewat Akses Menu", () => {
    const eAudit = TUTORIAL.find((t) => t.id === "e-audit")!;
    expect(lihat(eAudit, "hakim")).toBe(false);
    expect(lihat(eAudit, "admin")).toBe(false);
    expect(lihat(eAudit, "super-admin")).toBe(true);
    expect(
      tutorialTampil(eAudit, {
        pengguna: { roleId: "hakim" },
        aksesMenu: { roleId: "hakim", modules: { "buka:aleta-e-audit": true } },
      })
    ).toBe(true);
  });
});

// ─── Pencarian, kelompok, halaman ───────────────────────────────────────────

describe("tutorial hidup - pencarian, kelompok, dan tombol ? per halaman", () => {
  it("pencarian menemukan lewat judul, langkah, dan kata kunci, tanpa peduli huruf besar", () => {
    const kasir = TUTORIAL.find((t) => t.id === "kasir")!;
    expect(cocokDenganKata(kasir, "KASIR")).toBe(true);
    expect(cocokDenganKata(kasir, "panjar")).toBe(true);
    expect(cocokDenganKata(kasir, "pratinjau simpan")).toBe(true);
    expect(cocokDenganKata(kasir, "mediasi")).toBe(false);
    expect(cocokDenganKata(kasir, "   ")).toBe(true);
  });

  it("kelompok mengikuti urutan baku dan tidak kehilangan entri", () => {
    const kelompok = kelompokkanTutorial(TUTORIAL);
    expect(kelompok.reduce((n, g) => n + g.isi.length, 0)).toBe(TUTORIAL.length);
    const urutan = kelompok.map((g) => g.kelompok);
    expect(urutan).toEqual(URUTAN_KELOMPOK_TUTORIAL.filter((k) => urutan.includes(k)));
  });

  it("tombol ? di halaman utama menemukan tutorial fitur halaman itu", () => {
    const id = (jalur: string) => tutorialUntukHalaman(TUTORIAL, jalur).map((t) => t.id);
    expect(id("/aleta-ecourt")).toEqual(expect.arrayContaining(["jadwal-sidang", "status-perkara", "jadwal-mediasi", "kasir", "kendali-berkas"]));
    expect(id("/skp")).toContain("skp");
    expect(id("/bas")).toContain("bas-alat-tulis");
    expect(id("/admin/pengaturan-sipp-abt")).toContain("pengelola-pengaturan-sipp-abt");
    expect(id("/admin/aleta-ecourt")).toContain("integrasi-ecourt");
    expect(id("/aleta-ecourt?menu=sidang")).toContain("jadwal-sidang");
    // Halaman anak mewarisi tutorial induknya.
    expect(id("/perkara/123")).toContain("ruang-kerja-perkara");
    expect(id("/halaman-yang-tidak-ada")).toEqual([]);
  });

  it("prioritas isi ada: Jadwal Sidang, Status Perkara, Mediasi, e-Court, BAS, Blangko Derry, unggah putusan, Kasir, SKP, Pengaturan, ekstensi, widget", () => {
    const id = new Set(TUTORIAL.map((t) => t.id));
    for (const wajib of [
      "jadwal-sidang",
      "status-perkara",
      "jadwal-mediasi",
      "integrasi-ecourt",
      "bas-alat-tulis",
      "blangko-derry-abt",
      "unggah-putusan",
      "kasir",
      "skp",
      "pengelola-pengaturan-sipp-abt",
      "ekstensi-isi-input-abt",
      "ekstensi-unduhan",
      "ekstensi-deteksi-sisa-blangko",
      "ekstensi-widget",
    ]) {
      expect(id.has(wajib), wajib).toBe(true);
    }
  });
});

// ─── Bahasa ──────────────────────────────────────────────────────────────────

describe("tutorial hidup - bahasa sederhana tanpa istilah teknis", () => {
  const DILARANG: Array<[RegExp, string]> = [
    [/\btemplate\b/i, "pakai 'blangko', bukan 'template'"],
    [/\bpeladen\b/i, "pakai 'server', bukan 'peladen'"],
    [/\bendpoint\b/i, "istilah teknis"],
    [/\bAPI\b/, "istilah teknis"],
    [/\blocalhost\b/i, "istilah teknis"],
    [/\bjson\b/i, "istilah teknis"],
    [/\bvitest\b|\bdrizzle\b|\bmigrasi\b/i, "istilah teknis"],
    [/\.(tsx?|mjs|js)\b/, "nama berkas kode"],
    [/\bhttps?:\/\//i, "alamat teknis"],
    [/\bundefined\b|\bnull\b/i, "kebocoran nilai kosong"],
  ];

  it("tidak memuat label teknis, 'template', atau 'peladen'", () => {
    const temuan: string[] = [];
    for (const t of TUTORIAL) {
      for (const teks of semuaTeks(t)) {
        for (const [pola, alasan] of DILARANG) if (pola.test(teks)) temuan.push(`${t.id}: "${teks.slice(0, 60)}" (${alasan})`);
      }
    }
    expect(temuan).toEqual([]);
  });

  it("langkah berupa kalimat pendek (maks 400 huruf) dan berakhir tanda baca", () => {
    for (const t of TUTORIAL) {
      for (const l of t.langkah) {
        expect(l.length, `${t.id}: langkah terlalu panjang`).toBeLessThanOrEqual(400);
        expect(l.trim(), `${t.id}: "${l.slice(0, 40)}" tanpa tanda baca penutup`).toMatch(/[.!?)]$/);
      }
    }
  });
});
