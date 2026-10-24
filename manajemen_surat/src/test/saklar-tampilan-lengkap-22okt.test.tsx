/**
 * ============================================================================
 * SAKLAR TAMPILAN LENGKAP - JADWAL SIDANG DAN JADWAL MEDIASI (22 Okt 2026, W57)
 * ============================================================================
 *
 * Permintaan hakim: "pada tampilan di jadwal sidang dan jadwal mediasi tambahkan
 * yang belum ada checklist on/off nya".
 *
 * Yang dijaga, dan DIJALANKAN (render nyata untuk unsur-unsur penting):
 *   - tiap kunci baru terdaftar di kelompoknya, menyala bawaan, bukan "tetap",
 *     berkalimat awam, dan tampil di daftar panel Tampilan beserta ikon (i);
 *   - mode lengkap menyalakannya, mode minimalis mematikannya, simpanan lama
 *     tanpa kuncinya tetap menyala (tampilan sekarang tidak berubah);
 *   - mematikannya menyembunyikan unsurnya di layar sungguhan - dan data /
 *     tombol lain tidak ikut hilang;
 *   - penjaga "tidak ada unsur tanpa saklar": daftar unsur yang diperiksa
 *     kedua layar. Tiap unsur punya saklar yang terdaftar, atau alasan sah
 *     mengapa ia tetap (mis. tombol Tampilan itu sendiri).
 *
 * Nomor perkara dan nama di sini karangan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { tampilanModeLengkap, tampilanModeMinimalis } from "@/lib/jadwal-sidang-1okt";
import { ALAT_ATAS_DIIZINKAN_URL, tampilanUrlJadwal } from "@/lib/jadwal-tampil-url";
import {
  KELOMPOK_TAMPILAN,
  KUNCI_SIMPANAN_TAMPILAN,
  SAKLAR_TAMPILAN,
  SAKLAR_WAJIB,
  bacaTampilan,
  tampil,
  tampilanBawaan,
} from "@/lib/tampilan-antrian-sidang";
import {
  KUNCI_SIMPANAN_TAMPILAN_MEDIASI,
  SAKLAR_BERSAMA_MEDIASI,
  SAKLAR_TAMPILAN_MEDIASI,
  bacaTampilanMediasi,
  tampilMediasi,
  tampilanMediasiBawaan,
} from "@/lib/tampilan-jadwal-mediasi";

const SRC = path.join(process.cwd(), "src");
const baca = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const LAYAR_SIDANG = baca("components/portal/aleta-ecourt-sidang.tsx");
const LAYAR_MEDIASI = baca("components/portal/aleta-ecourt-mediasi.tsx");

// ---------------------------------------------------------------------------
// Daftar yang diperiksa
// ---------------------------------------------------------------------------

/** Kunci baru Jadwal Sidang -> kelompoknya. */
const BARU_SIDANG = [
  ["tautan-jadwal", "atas"],
  ["tombol-tunda-otomatis", "atas"],
  ["tombol-perkara-saya", "atas"],
  ["identitas-pembuka", "atas"],
  ["tombol-kalender-sidang", "atas"],
  ["kalender-libur", "atas"],
  ["tanggal-dan-jumlah", "atas"],
  ["tanda-diperbarui", "atas"],
  ["pencarian-lanjutan", "atas"],
  ["menu-per-panitera", "atas"],
  ["menu-pengingat-kasir", "atas"],
  ["saklar-sidang-keliling", "atas"],
  ["pilih-hakim-baris", "alat"],
  ["status-putusan", "penanda"],
  ["warna-baris", "penanda"],
  ["jam-dipanggil", "keterangan"],
] as const;

/** Kunci baru Jadwal Mediasi. */
const BARU_MEDIASI = [
  "pengantar-layar",
  "kalender-libur",
  "sebutan-mediator",
  "dihadiri-sipp",
  "batas-dan-laporan",
  "kehadiran-rincian",
] as const;

/**
 * HASIL PEMERIKSAAN UNSUR: tiap yang tampil di kedua layar. `saklar` = kunci yang
 * terdaftar; `tetap` = alasan sah mengapa tidak diberi saklar.
 */
type Unsur = { unsur: string; layar: "sidang" | "mediasi" | "kedua"; saklar?: string; tetap?: string };
const UNSUR: Unsur[] = [
  // --- sudah punya saklar sebelum 22 Okt (ringkas; daftar lengkapnya di SAKLAR_TAMPILAN) ---
  { unsur: "penanda baris, keterangan, tombol baris, alat atas (76 saklar lama)", layar: "sidang", saklar: "layar-antrian" },
  { unsur: "pita ruang: jumlah ruang", layar: "sidang", saklar: "kartu-ruang" },
  { unsur: "pita ruang: yang sedang disidang", layar: "sidang", saklar: "ringkasan-ruang" },
  { unsur: "tombol ruang sidang", layar: "sidang", saklar: "saring-ruang" },
  { unsur: "tombol Layar penuh", layar: "sidang", saklar: "tombol-layar-penuh" },
  { unsur: "tombol Cetak", layar: "sidang", saklar: "cetak" },
  { unsur: "butir Menu: Hitung skor, Layar antrian, Cetak relaas, Penetapan kembali, Daftarkan ke antrian, Kasir, Kasir harian", layar: "sidang", saklar: "tombol-kasir-harian" },
  { unsur: "lencana kehadiran, pihak yang sudah hadir, Kehadiran rinci", layar: "sidang", saklar: "kehadiran-rinci" },
  { unsur: "hasil sidang / tundaan", layar: "sidang", saklar: "hasil-tundaan" },
  { unsur: "Pertanyaan saksi", layar: "sidang", saklar: "pertanyaan-saksi" },
  { unsur: "draf putusan H-7 dan checklist draf", layar: "sidang", saklar: "draf-putusan-agen" },
  { unsur: "lencana putusan belum diunggah e-Court / belum TTE panitera", layar: "sidang", saklar: "lencana-putusan-ecourt" },
  { unsur: "konseptor sementara kosong, keterangan perkara kosong", layar: "sidang", saklar: "tunjuk-konseptor" },
  { unsur: "tombol hasil mediasi (.rtf)", layar: "mediasi", saklar: "tombol-hasil-mediasi" },
  { unsur: "tombol Tandai berjalan | Selesai", layar: "mediasi", saklar: "tombol-status-mediasi" },
  { unsur: "lencana sedang berjalan | selesai", layar: "mediasi", saklar: "lencana-status-mediasi" },
  { unsur: "lencana ditunda", layar: "mediasi", saklar: "lencana-ditunda" },
  { unsur: "tanggal penetapan dan nomor SK mediator", layar: "mediasi", saklar: "penetapan-mediator" },
  { unsur: "tiga kartu angka", layar: "mediasi", saklar: "kartu-ringkasan" },
  { unsur: "tombol saring keadaan", layar: "mediasi", saklar: "saring-keadaan" },
  { unsur: "kotak saring dan pencarian lanjutan", layar: "mediasi", saklar: "pencarian-mediasi" },
  { unsur: "catatan cara menghitung tenggang", layar: "mediasi", saklar: "catatan-tenggang" },
  // --- baru 22 Okt ---
  ...BARU_SIDANG.map(([kunci]) => ({ unsur: `baru 22 Okt: ${kunci}`, layar: "sidang" as const, saklar: kunci })),
  ...BARU_MEDIASI.map((kunci) => ({ unsur: `baru 22 Okt: ${kunci}`, layar: "mediasi" as const, saklar: kunci })),
  { unsur: "Kumulasi perkara di Jadwal Mediasi (saklar bersama)", layar: "mediasi", saklar: "kumulasi-perkara" },
  // --- sengaja TIDAK diberi saklar ---
  { unsur: "tombol Tampilan itu sendiri", layar: "kedua", tetap: "satu-satunya jalan ke semua saklar" },
  { unsur: "tombol Pengaturan panggil (Jadwal Mediasi)", layar: "mediasi", tetap: "jalan ke saklar panggil petugas; punya saklar sendiri di dalamnya" },
  { unsur: "Ringkas | Lengkap", layar: "sidang", tetap: "pemilih kedalaman tabel; disembunyikan = terkunci di salah satu" },
  { unsur: "tombol Ciutkan | Kendali", layar: "sidang", tetap: "disembunyikan saat kendali terciut = kendali tak dapat dibuka lagi" },
  { unsur: "tombol ciut/bentang kelompok kotak saring", layar: "sidang", tetap: "sudah satu tombol nyala-mati per kelompok di baris itu sendiri" },
  { unsur: "kotak pencarian utama (Enter ke SIPP)", layar: "kedua", tetap: "fungsi utama layar" },
  { unsur: "tombol Tampilkan, panah hari, Hari ini, kotak tanggal", layar: "kedua", tetap: "fungsi utama layar" },
  { unsur: "tombol Rincian pada baris", layar: "kedua", tetap: "satu-satunya jalan ke rincian satu perkara / pertemuan" },
  { unsur: "kotak keadaan merah (retur, belum dipanggil, tenggang mepet, belum ditunda, belum minutasi, belum unggah putusan, Court Calendar)", layar: "sidang", tetap: "wajib (Tetap) - mendesak" },
  { unsur: "kotak gabungan Perlu diperiksa", layar: "sidang", tetap: "daftar pekerjaan hari itu; sengaja tanpa saklar" },
  { unsur: "banner gangguan jaringan dan pesan galat + Coba lagi", layar: "kedua", tetap: "kegagalan harus terbaca" },
  { unsur: "peringatan antrian tidak terbaca / memuat banyak tanggal", layar: "sidang", tetap: "peringatan data" },
  { unsur: "'x dari y perkara', Reset, 'Dicari ke SIPP' + lepaskan, 'Disaring: ...'", layar: "kedua", tetap: "menyebut saringan yang sedang berlaku" },
  { unsur: "keadaan kosong ('Tidak ada sidang ...')", layar: "kedua", tetap: "jawaban atas pertanyaan 'mengapa kosong'" },
  { unsur: "nomor, jam, nama pihak, agenda, kolom Majelis & Petugas (mode Lengkap)", layar: "kedua", tetap: "isi pokok tabel" },
  { unsur: "kolom No (nomor urut)", layar: "kedua", tetap: "kerangka tabel" },
  { unsur: "konseptor sementara dan keterangan perkara yang SUDAH terisi", layar: "sidang", tetap: "ditulis untuk orang berikutnya (lihat tunjuk-konseptor)" },
  { unsur: "isi Rincian (bagian-bagiannya dilipat satu per satu)", layar: "kedua", tetap: "tiap bagian sudah dapat dilipat sendiri" },
  { unsur: "lencana tenggang, hasil, Tempat, nama mediator di tabel mediasi", layar: "mediasi", tetap: "isi pokok tabel" },
];

const SEMUA_KUNCI_TERDAFTAR = new Set<string>([
  ...SAKLAR_TAMPILAN.map((x) => x.kunci),
  ...SAKLAR_TAMPILAN_MEDIASI.map((x) => x.kunci),
  ...SAKLAR_BERSAMA_MEDIASI.map((x) => x.kunci),
]);

// ---------------------------------------------------------------------------
// Daftar saklar
// ---------------------------------------------------------------------------

describe("Jadwal Sidang: saklar baru terdaftar", () => {
  it("tiap kunci baru ada di kelompoknya, menyala bawaan, bukan Tetap, ada contoh, dan dipakai menggambar", () => {
    const bawaan = tampilanBawaan();
    for (const [kunci, kelompok] of BARU_SIDANG) {
      const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(saklar, kunci).toBeTruthy();
      expect(saklar?.kelompok, kunci).toBe(kelompok);
      expect(saklar?.wajib ?? false, kunci).toBe(false);
      expect(saklar?.bawaanMati ?? false, kunci).toBe(false);
      expect(bawaan[kunci], kunci).toBe(true);
      expect(CONTOH_TAMPILAN[kunci], kunci).toBeTruthy();
      expect(LAYAR_SIDANG, kunci).toContain(`"${kunci}"`);
      expect(saklar?.label.length, kunci).toBeGreaterThan(5);
      expect(saklar?.keterangan.length, kunci).toBeGreaterThan(30);
    }
    expect(SAKLAR_TAMPILAN.length).toBe(76 + BARU_SIDANG.length);
  });

  it("kunci tidak ada yang kembar, dan kelompoknya dikenal panel", () => {
    const kunci = SAKLAR_TAMPILAN.map((x) => x.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
    const dikenal = KELOMPOK_TAMPILAN.map((k) => k.kunci) as string[];
    for (const s of SAKLAR_TAMPILAN) expect(dikenal, s.kunci).toContain(s.kelompok);
  });

  it("kalimat awam: tanpa istilah teknis", () => {
    for (const [kunci] of BARU_SIDANG) {
      const s = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)!;
      expect(`${s.label} ${s.keterangan}`, kunci).not.toMatch(/\b(peladen|borang|galat)\b|sys_|perkara_|audittrail|#\d{4}#|localStorage|JSON|endpoint|\bAPI\b/i);
    }
    for (const s of [...SAKLAR_TAMPILAN_MEDIASI, ...SAKLAR_BERSAMA_MEDIASI]) {
      expect(`${s.label} ${s.keterangan}`, s.kunci).not.toMatch(/\b(peladen|borang|galat)\b|sys_|perkara_|audittrail|#\d{4}#|localStorage|JSON|endpoint|\bAPI\b/i);
    }
  });

  it("simpanan lama tanpa kuncinya tetap menyala; dimatikan = mati; yang Tetap tidak berubah", () => {
    for (const [kunci] of BARU_SIDANG) {
      expect(tampil({}, kunci), kunci).toBe(true);
      expect(tampil({ [kunci]: false }, kunci), kunci).toBe(false);
      expect(bacaTampilan(JSON.stringify({ retur: false }))[kunci], kunci).toBe(true);
    }
    // yang Tetap tidak bertambah oleh saklar baru, dan tetap menyala walau simpanan menyebut false
    for (const [kunci] of BARU_SIDANG) expect(SAKLAR_WAJIB, kunci).not.toContain(kunci);
    for (const kunci of SAKLAR_WAJIB) expect(tampil({ [kunci]: false }, kunci), kunci).toBe(true);
  });

  it("mode lengkap menyalakan semuanya, mode minimalis mematikannya", () => {
    const lengkap = tampilanModeLengkap();
    const minimalis = tampilanModeMinimalis();
    for (const [kunci] of BARU_SIDANG) {
      expect(lengkap[kunci], kunci).toBe(true);
      expect(minimalis[kunci], kunci).toBe(false);
    }
  });

  it("tampilan lewat alamat: yang sudah tampil di sana tetap tampil, yang baru milik pengguna masuk akun tidak ikut", () => {
    const url = tampilanUrlJadwal();
    for (const kunci of ["kalender-libur", "tanggal-dan-jumlah", "tanda-diperbarui"]) {
      expect(ALAT_ATAS_DIIZINKAN_URL, kunci).toContain(kunci);
      expect(url[kunci], kunci).toBe(true);
    }
    for (const kunci of ["tautan-jadwal", "tombol-tunda-otomatis", "tombol-perkara-saya", "pencarian-lanjutan", "menu-per-panitera", "saklar-sidang-keliling", "pilih-hakim-baris", "tombol-kalender-sidang"]) {
      expect(url[kunci], kunci).toBe(false);
    }
  });
});

describe("Jadwal Mediasi: saklar baru terdaftar", () => {
  it("tiap kunci baru terdaftar, menyala bawaan, punya contoh, dan dipakai layar", () => {
    const bawaan = tampilanMediasiBawaan();
    for (const kunci of BARU_MEDIASI) {
      const saklar = SAKLAR_TAMPILAN_MEDIASI.find((x) => x.kunci === kunci);
      expect(saklar, kunci).toBeTruthy();
      expect(saklar?.bawaanMati ?? false, kunci).toBe(false);
      expect(bawaan[kunci], kunci).toBe(true);
      expect(tampilMediasi({}, kunci), kunci).toBe(true);
      expect(tampilMediasi({ [kunci]: false }, kunci), kunci).toBe(false);
      expect(CONTOH_TAMPILAN[kunci], kunci).toBeTruthy();
      expect(LAYAR_MEDIASI, kunci).toMatch(new RegExp(`tampilMediasi\\(\\s*tampilan\\s*,\\s*"${kunci}"`));
    }
    // simpanan lama (sebelum kunci baru) tidak mematikan apa pun
    const lama = bacaTampilanMediasi(JSON.stringify({ "tombol-hasil-mediasi": false }));
    for (const kunci of BARU_MEDIASI) expect(lama[kunci], kunci).toBe(true);
    expect(SAKLAR_BERSAMA_MEDIASI.map((x) => x.kunci)).toEqual(["kumulasi-perkara"]);
  });
});

describe("penjaga: tidak ada unsur tanpa saklar", () => {
  it("tiap unsur yang diperiksa punya saklar terdaftar, atau alasan sah mengapa ia tetap", () => {
    for (const u of UNSUR) {
      if (u.saklar) expect(SEMUA_KUNCI_TERDAFTAR.has(u.saklar), `${u.unsur} -> ${u.saklar}`).toBe(true);
      else expect((u.tetap ?? "").length, `${u.unsur}: tanpa saklar harus beralasan`).toBeGreaterThan(10);
    }
  });

  it("tiap saklar baru tercatat dalam daftar unsur (tidak ada saklar yatim)", () => {
    const tercatat = new Set(UNSUR.map((u) => u.saklar).filter(Boolean));
    for (const [kunci] of BARU_SIDANG) expect(tercatat.has(kunci), kunci).toBe(true);
    for (const kunci of BARU_MEDIASI) expect(tercatat.has(kunci), kunci).toBe(true);
  });

  it("komponen yang dulu tampil tanpa saklar kini dikawal tampil(...) di tempat dipasang", () => {
    // [penanda di sumber, kunci yang harus mengawalnya di sekitar penanda itu]
    const kawal: Array<[string, string]> = [
      ["<TombolTundaOtomatis", "tombol-tunda-otomatis"],
      ["<PemilihHakimBaris", "pilih-hakim-baris"],
      ["<TandaDiperbarui", "tanda-diperbarui"],
      ["const adaSaklarKeliling =", "saklar-sidang-keliling"],
      ['kunci: "pengingat-kasir"', "menu-pengingat-kasir"],
      ['kunci: "per-panitera-sidang"', "menu-per-panitera"],
      ['href={withBasePath("/admin/akses-publik")}', "tautan-jadwal"],
      ['aria-label="Pilih tanggal dari kalender"', "tombol-kalender-sidang"],
      ["variant={hanyaMilikSaya", "tombol-perkara-saya"],
      ["<PanelCariLanjut", "pencarian-lanjutan"],
    ];
    for (const [penanda, kunci] of kawal) {
      const titik = LAYAR_SIDANG.indexOf(penanda);
      expect(titik, penanda).toBeGreaterThan(-1);
      const sekitar = LAYAR_SIDANG.slice(Math.max(0, titik - 1500), titik + 200);
      expect(sekitar, `${penanda} harus dikawal "${kunci}"`).toContain(`"${kunci}"`);
    }
    // tiga penanda warna baris dikawal satu saklar
    expect((LAYAR_SIDANG.match(/warnaBaris &&/g) ?? []).length).toBe(3);
    // pemilih tanggal: kedua pemilih Jadwal Sidang dan kedua pemilih Jadwal Mediasi
    expect((LAYAR_SIDANG.match(/tampilKalender=\{tampil\(tampilan, "kalender-libur"\)\}/g) ?? []).length).toBe(2);
    expect((LAYAR_MEDIASI.match(/tampilKalender=\{kalenderLiburTampil\}/g) ?? []).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Render nyata - Jadwal Sidang
// ---------------------------------------------------------------------------

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA", logoUrl: "" },
    currentUser: { id: "u1", name: "Admin Uji", roleId: "admin" } as Record<string, unknown> | null,
    currentUserId: "u1" as string | null,
    positions: [] as unknown[],
    theme: "dark",
    setTheme: () => undefined,
  },
}));
vi.mock("@/lib/app-state", async (asli) => {
  const mod = await asli<typeof import("@/lib/app-state")>();
  return { ...mod, usePortal: () => keadaan.portal };
});
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/aleta-ecourt",
}));

const HARI_INI = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

function barisSidang(ubah: Record<string, unknown> = {}) {
  return {
    sidangId: "5001",
    perkaraId: "9001",
    nomorPerkara: "901/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 1,
    jenisPerkaraId: 347,
    sudahPutus: false,
    tanggalPutusan: "",
    statusPutusan: "",
    tanggalMinutasi: "",
    tanggalBht: "",
    tanggalSidang: `${HARI_INI}T00:00:00`,
    jamSidang: "09:00",
    agenda: "Pembuktian Penggugat",
    ruangan: "Ruang Sidang 1",
    ditunda: false,
    alasanDitunda: "",
    tanggalSidangBerikut: "",
    urutanSidang: 2,
    dihadiriOleh: 1,
    adaBas: false,
    durasi: null,
    pihak: { penggugat: ["Siti Karangan"], tergugat: ["Budi Karangan"] },
    panggilan: { hadirSebelumnya: 1, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    putusanEcourt: null,
    majelisKode: "A",
    majelisNama: "Hakim Karangan",
    paniteraNama: "PP Karangan",
    jurusitaNama: "JS Karangan",
    penandaPerkara: { ghaib: false, prodeo: false },
    ...ubah,
  };
}

const CATATAN_KELILING = { tanggal: HARI_INI, aktif: true, diputuskan: true, diubahNama: "Admin Uji", diubahPada: "" };

function pasangFetchSidang() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let isi: unknown = { ok: true, data: {} };
      if (/\/api\/aleta-ecourt\/sidang\?/.test(u)) {
        isi = { ok: true, data: { available: true, sidang: [barisSidang()], kesiapan: {}, antrian: { terbaca: false, alasan: "", tanggal: [], peta: {} } } };
      } else if (/\/api\/aleta-ecourt\/sidang\/keliling/.test(u)) {
        isi = { ok: true, data: { keliling: CATATAN_KELILING, bolehUbah: true } };
      } else if (/\/api\/aleta-ecourt\/sidang\/hakim-sidang/.test(u)) {
        isi = { ok: true, data: { pilihan: {}, calon: [{ id: 1, kode: "HKM", nama: "Hakim Pilihan" }], alasanCalon: "", bolehUbah: true } };
      }
      return { ok: true, status: 200, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
}

async function gambarSidang(props: Record<string, unknown> = {}, simpanan?: Record<string, boolean>) {
  window.localStorage.clear();
  if (simpanan) window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(simpanan));
  pasangFetchSidang();
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang as never, props));
  await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 15_000 });
  return hasil;
}

beforeEach(() => {
  keadaan.portal.currentUser = { id: "u1", name: "Admin Uji", roleId: "admin" };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** Keadaan unsur-unsur penting di layar Jadwal Sidang. */
function adaDi(container: HTMLElement) {
  return {
    tautan: container.querySelector("[data-tautan-jadwal]") !== null,
    tundaOtomatis: container.querySelector("[data-tunda-otomatis]") !== null,
    perkaraSaya: screen.queryByRole("button", { name: /Perkara saya|Semua perkara/ }) !== null,
    kalenderSidang: screen.queryByRole("button", { name: "Pilih tanggal dari kalender" }) !== null,
    kalenderLibur: screen.queryAllByRole("button", { name: /Buka kalender - hari libur/ }).length,
    jumlah: screen.queryByText(/^1 sidang$/) !== null,
    diperbarui: container.querySelector("[data-diperbarui]") !== null,
    lanjutan: screen.queryByRole("button", { name: /Pencarian lanjutan/ }) !== null,
    keliling: screen.queryByRole("switch", { name: /Sidang keliling/ }) !== null,
    pilihHakim: screen.queryByRole("button", { name: /pilih hakim|ganti hakim/ }) !== null,
    belumPutus: screen.queryAllByText("belum putus").length,
    identitas: screen.queryByText(/^Admin Uji/) !== null,
  };
}

describe("Jadwal Sidang (render): bawaan menyala - tampilan sekarang tidak berubah", () => {
  it("semua unsur baru tampil bila belum ada pilihan", async () => {
    const { container } = await gambarSidang({ bolehKelolaTautan: true });
    await waitFor(() => expect(adaDi(container).diperbarui).toBe(true), { timeout: 15_000 });
    await waitFor(() => expect(adaDi(container).pilihHakim).toBe(true), { timeout: 15_000 });
    const a = adaDi(container);
    expect(a.tautan).toBe(true);
    expect(a.tundaOtomatis).toBe(true);
    expect(a.perkaraSaya).toBe(true);
    expect(a.kalenderSidang).toBe(true);
    expect(a.kalenderLibur).toBe(2);
    expect(a.jumlah).toBe(true);
    expect(a.lanjutan).toBe(true);
    expect(a.keliling).toBe(true);
    expect(a.belumPutus).toBeGreaterThan(0);
    expect(a.identitas).toBe(true);
  }, 90_000);
});

describe("Jadwal Sidang (render): mematikan saklar menyembunyikan unsurnya", () => {
  it("kepala dan baris tanggal", async () => {
    const mati = {
      "tautan-jadwal": false,
      "tombol-tunda-otomatis": false,
      "tombol-perkara-saya": false,
      "identitas-pembuka": false,
      "tombol-kalender-sidang": false,
      "kalender-libur": false,
      "tanggal-dan-jumlah": false,
      "tanda-diperbarui": false,
      "pencarian-lanjutan": false,
    };
    const { container } = await gambarSidang({ bolehKelolaTautan: true }, mati);
    // beri waktu pembaruan latar: tanda "diperbarui" tidak boleh muncul
    await new Promise((r) => setTimeout(r, 800));
    const a = adaDi(container);
    expect(a.tautan).toBe(false);
    expect(a.tundaOtomatis).toBe(false);
    expect(a.perkaraSaya).toBe(false);
    expect(a.kalenderSidang).toBe(false);
    expect(a.kalenderLibur).toBe(0);
    expect(a.jumlah).toBe(false);
    expect(a.diperbarui).toBe(false);
    expect(a.lanjutan).toBe(false);
    expect(a.identitas).toBe(false);
    // yang bukan urusan saklar ini tetap ada: panah hari, kotak cari, Cetak, Menu, tombol Tampilan
    expect(screen.getByRole("button", { name: "Hari sebelumnya" })).toBeTruthy();
    expect(container.querySelector("[data-cari-pintar-sidang]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Cetak$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Menu$/ })).toBeTruthy();
    expect(container.querySelector("[data-tombol-tampilan-sidang]")).not.toBeNull();
    // datanya tetap: baris perkara tampil
    expect(screen.getByText("901/Pdt.G/2026/PA.Dgl")).toBeTruthy();
  }, 90_000);

  it("tanda 'diperbarui' mati saja: jumlah sidang tetap, pembaruan tidak memunculkan tandanya", async () => {
    const { container } = await gambarSidang({}, { "tanda-diperbarui": false });
    await new Promise((r) => setTimeout(r, 600));
    expect(container.querySelector("[data-diperbarui]")).toBeNull();
    expect(screen.queryByText(/^1 sidang$/)).not.toBeNull();
  }, 90_000);

  it("pita ruang: saklar Sidang keliling dan menu pilih hakim", async () => {
    const { container } = await gambarSidang({}, { "saklar-sidang-keliling": false, "pilih-hakim-baris": false });
    await new Promise((r) => setTimeout(r, 600));
    const a = adaDi(container);
    expect(a.keliling).toBe(false);
    expect(a.pilihHakim).toBe(false);
  }, 90_000);

  it("Menu: Per panitera sidang hilang bila saklarnya mati, hadir bila menyala", async () => {
    await gambarSidang({});
    await waitFor(() => expect(screen.queryByRole("switch", { name: /Sidang keliling/ })).not.toBeNull());
    await userEvent.click(await screen.findByRole("button", { name: /^Menu$/ }));
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: /Per panitera sidang/ })).not.toBeNull(), { timeout: 15_000 });
    await userEvent.keyboard("{Escape}");
    cleanup();

    await gambarSidang({}, { "menu-per-panitera": false });
    await waitFor(() => expect(screen.queryByRole("switch", { name: /Sidang keliling/ })).not.toBeNull());
    await userEvent.click(await screen.findByRole("button", { name: /^Menu$/ }));
    await screen.findByRole("menu");
    expect(screen.queryByRole("menuitem", { name: /Per panitera sidang/ })).toBeNull();
    // butir lain tetap
    expect(screen.queryByRole("menuitem", { name: /Hitung skor/ })).not.toBeNull();
  }, 120_000);

  it("status putusan: tulisan 'belum putus' hilang, 'Rincian' dan nomor perkara tetap", async () => {
    await gambarSidang({}, { "status-putusan": false });
    expect(screen.queryAllByText("belum putus").length).toBe(0);
    expect(screen.getAllByRole("button", { name: /Rincian/ }).length).toBeGreaterThan(0);
  }, 90_000);

  it("Perkara saya mati = saringannya tidak dipakai (seluruh perkara tampil), bukan daftar kosong", async () => {
    keadaan.portal.currentUser = { id: "u9", name: "Tidak Tercatat", roleId: "hakim" };
    await gambarSidang({}, { "tombol-perkara-saya": false });
    expect(screen.getByText("901/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Perkara saya|Semua perkara/ })).toBeNull();
    // peringatan 'nama Anda tidak tercatat' berkaitan dengan saringan itu: tidak muncul
    expect(screen.queryByText(/tidak tercatat sebagai majelis/)).toBeNull();
  }, 90_000);

  it("panel Tampilan memuat setiap saklar baru; mengubah centang menyimpan dan menyembunyikan", async () => {
    const { container } = await gambarSidang({ bolehKelolaTautan: true });
    await userEvent.click(container.querySelector("[data-tombol-tampilan-sidang]") as HTMLElement);
    for (const [kunci] of BARU_SIDANG) {
      const label = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)!.label;
      const kotak = await screen.findByRole("checkbox", { name: label });
      expect((kotak as HTMLInputElement).checked, kunci).toBe(true);
      // ikon (i) keterangan
      expect(container.querySelector(`[data-info-saklar="${kunci}"]`), kunci).not.toBeNull();
    }
    expect(container.querySelector("[data-tautan-jadwal]")).not.toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Tombol Tautan jadwal" }));
    await waitFor(() => expect(container.querySelector("[data-tautan-jadwal]")).toBeNull());
    expect(JSON.parse(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN) ?? "{}")["tautan-jadwal"]).toBe(false);

    // Mode minimalis mematikan semua yang baru; Mode lengkap menyalakannya lagi.
    await userEvent.click(screen.getByRole("button", { name: "Mode minimalis" }));
    for (const [kunci] of BARU_SIDANG) {
      const label = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)!.label;
      expect((screen.getByRole("checkbox", { name: label }) as HTMLInputElement).checked, kunci).toBe(false);
    }
    await userEvent.click(screen.getByRole("button", { name: "Mode lengkap" }));
    for (const [kunci] of BARU_SIDANG) {
      const label = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)!.label;
      expect((screen.getByRole("checkbox", { name: label }) as HTMLInputElement).checked, kunci).toBe(true);
    }
  }, 120_000);
});

describe("Jadwal Sidang (render): jam dipanggil di kolom Antrian / Jam", () => {
  it("tampil bila saklar menyala, hilang bila mati; nomor antrian tetap", async () => {
    const { SelAntrianJam } = await import("@/components/portal/aleta-ecourt-sidang");
    const baris = barisSidang();
    const antrian = { nomor: "7", keadaan: "dipanggil", jamPanggil: "09:12", pihak1: "", pihak2: "", saksi: "", waktuAmbil: "", namaPetugas: "" };
    const gambar = (tampilJamPanggil: boolean) =>
      render(
        createElement(SelAntrianJam as never, {
          baris,
          antrian,
          tanggalTampil: HARI_INI,
          sidangSelesai: false,
          tampilJamPanggil,
        })
      );
    const nyala = gambar(true);
    expect(nyala.container.textContent).toContain("dipanggil 09:12");
    nyala.unmount();
    const mati = gambar(false);
    expect(mati.container.textContent).not.toContain("dipanggil 09:12");
    expect(mati.container.textContent).toContain("7");
    mati.unmount();
  });
});

// ---------------------------------------------------------------------------
// Render nyata - Jadwal Mediasi
// ---------------------------------------------------------------------------

const MEDIASI_UJI = {
  mediasiId: "m-601",
  perkaraId: "p-601",
  nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  tanggal: HARI_INI,
  jam: "09:00",
  sampaiJam: "",
  tempat: "Ruang mediasi",
  dihadiri: "Semua Pihak",
  ditunda: false,
  mediator: "Himawan Contoh, S.H.I., M.H.",
  statusMediator: "H",
  jenisMediasi: "",
  nomorSk: "SK-77/2026",
  penetapanMediator: "2026-10-01",
  laporanMediator: "2026-10-20",
  selesai: false,
  hasil: "",
  hasilTeks: "",
  lamaHari: null,
  tenggatPerma: "2026-10-31",
  sisaHariTenggat: 9,
  lewatTenggang: false,
  pihak: { penggugat: ["Siti Karangan"], tergugat: ["Budi Karangan"] },
};

function pasangFetchMediasi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let isi: unknown = { data: { baris: [], peta: {} } };
      if (u.includes("/api/aleta-ecourt/jadwal-mediasi")) {
        isi = { ok: true, data: { available: true, terbaca: true, alasan: "", mediasi: [MEDIASI_UJI] } };
      }
      return { ok: true, status: 200, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
}

async function gambarMediasi(simpanan?: Record<string, boolean>, simpananSidang?: Record<string, boolean>) {
  window.localStorage.clear();
  if (simpanan) window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN_MEDIASI, JSON.stringify(simpanan));
  if (simpananSidang) window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(simpananSidang));
  pasangFetchMediasi();
  const { AletaEcourtMediasi } = await import("@/components/portal/aleta-ecourt-mediasi");
  const hasil = render(createElement(AletaEcourtMediasi));
  await waitFor(() => expect(screen.getByText(MEDIASI_UJI.nomorPerkara)).toBeTruthy(), { timeout: 20_000 });
  return hasil;
}

const SEBUTAN_PENGANTAR = /Pertemuan mediasi tersimpan terpisah/;
/** Teks isi tabel saja - kotak saring di atasnya punya tulisan yang mirip (mis. chip "Mediator Hakim"). */
const teksTabel = () => document.querySelector("table")?.textContent ?? "";

describe("Jadwal Mediasi (render): bawaan menyala", () => {
  it("semua unsur baru tampil bila belum ada pilihan", async () => {
    await gambarMediasi();
    expect(screen.queryByText(SEBUTAN_PENGANTAR)).not.toBeNull();
    expect(screen.queryAllByRole("button", { name: /Buka kalender - hari libur/ }).length).toBe(2);
    expect(teksTabel()).toContain("Mediator Hakim");
    expect(teksTabel()).toContain("dihadiri Semua Pihak");
    expect(teksTabel()).toContain("batas ");
    expect(teksTabel()).toContain("laporan ");
    await userEvent.click(screen.getByRole("button", { name: /Rincian/ }));
    expect(await screen.findByText(/Kehadiran pertemuan/)).toBeTruthy();
  }, 90_000);
});

describe("Jadwal Mediasi (render): mematikan saklar menyembunyikan unsurnya", () => {
  it("pengantar, kalender libur, sebutan mediator, dihadiri, batas dan laporan", async () => {
    await gambarMediasi({
      "pengantar-layar": false,
      "kalender-libur": false,
      "sebutan-mediator": false,
      "dihadiri-sipp": false,
      "batas-dan-laporan": false,
    });
    expect(screen.queryByText(SEBUTAN_PENGANTAR)).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Buka kalender - hari libur/ }).length).toBe(0);
    expect(teksTabel()).not.toContain("Mediator Hakim");
    expect(teksTabel()).not.toContain("dihadiri");
    expect(teksTabel()).not.toContain("batas ");
    expect(teksTabel()).not.toContain("laporan ");
    // yang pokok tetap: nomor perkara, nama mediator, lencana tenggang, tempat
    expect(screen.getByText(MEDIASI_UJI.nomorPerkara)).toBeTruthy();
    expect(teksTabel()).toContain("Himawan Contoh");
    expect(teksTabel()).toContain("9 hari lagi");
    expect(teksTabel()).toContain("Ruang mediasi");
    // kotak tanggal tetap dapat dipakai
    expect(screen.getAllByLabelText("Dari tanggal").length).toBeGreaterThan(0);
  }, 90_000);

  it("Rincian: bagian kehadiran hilang, keterangan dari SIPP tetap", async () => {
    await gambarMediasi({ "kehadiran-rincian": false });
    await userEvent.click(screen.getByRole("button", { name: /Rincian/ }));
    expect(await screen.findByText(/Keterangan mediasi/)).toBeTruthy();
    expect(screen.queryByText(/Kehadiran pertemuan/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Simpan kehadiran/ })).toBeNull();
  }, 90_000);

  it("panel Tampilan memuat tiap saklar baru dengan ikon (i); mengubah centang menyimpan", async () => {
    const { container } = await gambarMediasi();
    await userEvent.click(container.querySelector("[data-tampilan-mediasi]") as HTMLElement);
    for (const kunci of BARU_MEDIASI) {
      const kotak = container.querySelector(`[data-saklar-mediasi="${kunci}"]`) as HTMLInputElement | null;
      expect(kotak, kunci).not.toBeNull();
      expect(kotak?.checked, kunci).toBe(true);
      expect(container.querySelector(`[data-info-saklar="${kunci}"]`), kunci).not.toBeNull();
    }
    fireEvent.click(container.querySelector('[data-saklar-mediasi="sebutan-mediator"]') as HTMLElement);
    await waitFor(() => expect(teksTabel()).not.toContain("Mediator Hakim"));
    expect(JSON.parse(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN_MEDIASI) ?? "{}")["sebutan-mediator"]).toBe(false);
    fireEvent.click(container.querySelector('[data-saklar-mediasi="sebutan-mediator"]') as HTMLElement);
    await waitFor(() => expect(teksTabel()).toContain("Mediator Hakim"));
  }, 90_000);

  it("Kumulasi perkara di panel mediasi memegang saklar yang sama dengan Jadwal Sidang", async () => {
    const { container } = await gambarMediasi();
    await userEvent.click(container.querySelector("[data-tampilan-mediasi]") as HTMLElement);
    const kotak = container.querySelector('[data-saklar-bersama][data-saklar-mediasi="kumulasi-perkara"]') as HTMLInputElement;
    expect(kotak).not.toBeNull();
    expect(kotak.checked).toBe(true);
    fireEvent.click(kotak);
    await waitFor(() => expect((container.querySelector('[data-saklar-bersama]') as HTMLInputElement).checked).toBe(false));
    const simpananSidang = bacaTampilan(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN));
    expect(simpananSidang["kumulasi-perkara"]).toBe(false);
    // simpanan layar mediasi sendiri tidak ikut tercemar
    expect(JSON.parse(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN_MEDIASI) ?? "{}")["kumulasi-perkara"]).toBeUndefined();
  }, 90_000);
});

describe("pemilih tanggal bersama: saklar kalender libur", () => {
  it("tampilKalender=false: tombol kalender dan keterangan libur hilang, kotak tanggal tetap", async () => {
    const { PemilihTanggalSidang } = await import("@/components/ui/pemilih-tanggal-sidang");
    // 2026-08-17 libur nasional (HUT RI), dan Minggu 2026-10-25.
    const nyala = render(createElement(PemilihTanggalSidang, { value: "2026-08-17", onChange: () => undefined, liburBolehDipilih: true, "aria-label": "Tanggal uji" }));
    expect(within(nyala.container).queryByRole("button", { name: /Buka kalender/ })).not.toBeNull();
    expect(nyala.container.querySelector("[data-tanggal-libur]")).not.toBeNull();
    nyala.unmount();
    const mati = render(createElement(PemilihTanggalSidang, { value: "2026-08-17", onChange: () => undefined, liburBolehDipilih: true, tampilKalender: false, "aria-label": "Tanggal uji" }));
    expect(within(mati.container).queryByRole("button", { name: /Buka kalender/ })).toBeNull();
    expect(mati.container.querySelector("[data-tanggal-libur]")).toBeNull();
    expect(within(mati.container).getByLabelText("Tanggal uji")).toBeTruthy();
    mati.unmount();
  });
});

describe("Jadwal Sidang: kalender libur terbuka di baris tanggal (23 Okt 2026)", () => {
  it("menekan tombol kalender libur menampilkan kalendernya, tidak dipotong bingkai overflow-hidden", async () => {
    await gambarSidang();
    const [tombol] = screen.getAllByRole("button", { name: /Buka kalender/ });
    fireEvent.click(tombol);
    const kalender = await screen.findByRole("dialog", { name: /^Kalender / });
    // Bingkai rentang tanggal dulu overflow-hidden: kalender yang membuka ke bawah
    // terpotong, sehingga tombolnya tampak tidak berfungsi.
    for (let el = kalender.parentElement; el && el !== document.body; el = el.parentElement) {
      expect(el.classList.contains("overflow-hidden"), el.className).toBe(false);
    }
  }, 60_000);
});
