// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { alasanTerisi } from "@/lib/hasil-sidang";
import {
  belumTundaLewatBatas,
  lewatBatasHariSidang,
  sidangElitigasi,
} from "@/lib/keadaan-sidang";
import { PITA_WAKTU_PUTUS, pitaWaktuPutus } from "@/lib/pita-waktu-putus";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";
import {
  JAM_BATAS_HASIL_SIDANG,
  SAAT_BELUM_TERBACA,
  jedaKeBatasBerikut,
  saatPengadilan,
  waktuPengadilan,
} from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * PERMINTAAN 24 SEPTEMBER 2026 - LAYAR ANTRIAN SIDANG
 * ============================================================================
 *
 *    1. papan kuning "Perlu ditindaklanjuti" dihapus (batch-23-sep-lanjutan)
 *    2. sesudah 15:00:00 WITA, sidang yang hasilnya belum dicatat masuk
 *       "Perlu diperiksa"
 *    3. tanda merah "Belum ditunda" sesudah 15:00:00
 *    4. tulisan agenda e-Litigasi merah
 *    5. warna umur perkara menurut SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024
 *    6. lencana hari tanpa "(mediasi N hari dipotong)"
 *    7-8. panel Rincian (antrian-dua-belas-butir)
 *    10. saklar Tampilan (tampilan-antrian-sidang)
 *    11. tombol Rincian berwarna selama terbuka
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const LAYAR = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const CETAK = baca("manajemen_surat/src/components/portal/aleta-ecourt-cetak-jadwal.tsx");
const JAM = baca("manajemen_surat/src/lib/waktu-pengadilan.ts");

const tanpaKomentar = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

function blokFungsi(nama: string): string {
  const i = LAYAR.indexOf(`function ${nama}(`);
  expect(i, `fungsi ${nama} hilang`).toBeGreaterThan(-1);
  return LAYAR.slice(i, LAYAR.indexOf("\nfunction ", i + 1));
}

// ===========================================================================
// BUTIR 2 & 3 - JAM PENGADILAN
// ===========================================================================

describe("butir 2 & 3 - pukul 15:00:00 menurut WITA, bukan zona peramban", () => {
  it("batasnya apa yang disebut pengguna", () => {
    expect(JAM_BATAS_HASIL_SIDANG).toBe("15:00:00");
    expect(JAM).toContain('"Asia/Makassar"');
    // hour12:false menulis tengah malam "24:00:00" pada sebagian mesin, dan
    // "24" >= "15" menyalakan aturannya sepanjang jam pertama hari baru.
    expect(JAM).toContain('hourCycle: "h23"');
  });

  it("15:00:00 WITA = 07:00:00 UTC, detik demi detik", () => {
    expect(waktuPengadilan(new Date("2026-09-24T07:00:00Z"))).toEqual({
      tanggal: "2026-09-24",
      jam: "15:00:00",
    });
    expect(saatPengadilan(new Date("2026-09-24T06:59:59Z")).lewatBatas).toBe(false);
    expect(saatPengadilan(new Date("2026-09-24T07:00:00Z")).lewatBatas).toBe(true);
  });

  it("tengah malam WITA adalah hari baru, jam 00 - bukan 24", () => {
    expect(waktuPengadilan(new Date("2026-09-23T16:00:00Z"))).toEqual({
      tanggal: "2026-09-24",
      jam: "00:00:00",
    });
    expect(saatPengadilan(new Date("2026-09-23T16:00:00Z")).lewatBatas).toBe(false);
  });

  it("pengatur waktunya dijadwalkan ke batas berikutnya, paling lama semenit", () => {
    expect(jedaKeBatasBerikut(new Date("2026-09-24T06:59:30.000Z"))).toBe(30_250);
    expect(jedaKeBatasBerikut(new Date("2026-09-24T02:00:00.000Z"))).toBe(60_000);
    expect(jedaKeBatasBerikut(new Date("2026-09-24T15:59:59.000Z"))).toBe(1_250);
  });

  it("hari sidang: lampau selalu lewat, depan tidak pernah, jam tak terbaca tidak pernah", () => {
    expect(lewatBatasHariSidang("2026-09-24", SAAT_BELUM_TERBACA)).toBe(false);
    const pagi = { tanggal: "2026-09-24", lewatBatas: false };
    const sore = { tanggal: "2026-09-24", lewatBatas: true };
    expect(lewatBatasHariSidang("2026-09-24", pagi)).toBe(false);
    expect(lewatBatasHariSidang("2026-09-23", pagi)).toBe(true);
    expect(lewatBatasHariSidang("2026-09-25", pagi)).toBe(false);
    expect(lewatBatasHariSidang("2026-09-24", sore)).toBe(true);
    expect(lewatBatasHariSidang("2026-09-25", sore)).toBe(false);
    expect(lewatBatasHariSidang("", sore)).toBe(false);
  });

  it("belum tunda lewat batas = sesudah 15:00 DAN hasilnya belum dicatat", () => {
    const sore = { tanggal: "2026-09-24", lewatBatas: true };
    const kosong = {
      tanggalSidang: "2026-09-24",
      ditunda: false,
      alasanDitunda: "",
      sudahPutus: false,
      tanggalPutusan: "",
      agenda: "Replik",
      putusanTerbaca: true,
      ikrarTerbaca: true,
    };
    expect(belumTundaLewatBatas(kosong, sore)).toBe(true);
    expect(belumTundaLewatBatas(kosong, { ...sore, lewatBatas: false })).toBe(false);
    expect(belumTundaLewatBatas({ ...kosong, ditunda: true, alasanDitunda: "Duplik" }, sore)).toBe(false);
    expect(belumTundaLewatBatas({ ...kosong, alasanDitunda: "putus DIKABULKAN" }, sore)).toBe(false);
    expect(
      belumTundaLewatBatas({ ...kosong, sidangIkrarTalak: true, ikrarTercatat: true }, sore)
    ).toBe(false);
  });

  it("gagal-tertutup: merah hanya bila ketiadaan hasilnya terbukti terbaca", () => {
    // Tinjauan 24 September 2026: peta putusan yang GAGAL dibaca kosong, dan
    // peta kosong terbaca "tidak ada yang putus" - 18 sidang pada 4 September
    // 2026 hanya tertahan oleh peta itu.
    const sore = { tanggal: "2026-09-24", lewatBatas: true };
    const kosong = {
      tanggalSidang: "2026-09-24",
      ditunda: false,
      alasanDitunda: "0",
      sudahPutus: false,
      tanggalPutusan: "",
      agenda: "Replik",
    };
    // Bot lama tidak mengirim penanda: diam.
    expect(belumTundaLewatBatas(kosong, sore)).toBe(false);
    expect(belumTundaLewatBatas({ ...kosong, putusanTerbaca: false, ikrarTerbaca: true }, sore)).toBe(false);
    expect(belumTundaLewatBatas({ ...kosong, putusanTerbaca: true }, sore)).toBe(true);
    // Sidang ikrar menuntut peta ikrar juga terbaca.
    const ikrar = { ...kosong, agenda: "Sidang Ikrar Talak", putusanTerbaca: true };
    expect(belumTundaLewatBatas({ ...ikrar, ikrarTerbaca: false }, sore)).toBe(false);
    expect(belumTundaLewatBatas({ ...ikrar, ikrarTerbaca: true }, sore)).toBe(true);
  });

  it("sidang berikutnya sudah ada: lanjutannya terbentuk, tidak ditagih", () => {
    const kemarin = { tanggal: "2026-09-24", lewatBatas: false };
    const baris = {
      tanggalSidang: "2025-06-11",
      ditunda: false,
      alasanDitunda: "0",
      sudahPutus: false,
      tanggalPutusan: "",
      agenda: "Sidang Pertama",
      putusanTerbaca: true,
      ikrarTerbaca: true,
    };
    expect(belumTundaLewatBatas(baris, kemarin)).toBe(true);
    expect(belumTundaLewatBatas({ ...baris, tanggalSidangBerikut: "2025-06-23" }, kemarin)).toBe(false);
  });

  it("tooltip tidak menunjuk tombol yang disembunyikan", () => {
    const i = LAYAR.indexOf("{belumTundaLewatBatas(baris, saat) ? (");
    const tanda = LAYAR.slice(i, i + 2500);
    expect(tanda).toContain('tampil(tampilan, "tombol-tunda-putus")');
    expect(tanda).toContain("nyalakan Tombol tunda | putus di menu Tampilan");
  });

  it("alasan terisi: nilai bawaan yang tidak pernah diisi bukan catatan", () => {
    for (const x of ["", "0", " - ", null, undefined, "null"]) expect(alasanTerisi(x), String(x)).toBe(false);
    expect(alasanTerisi("telah ikrar talak")).toBe(true);
  });

  it("jam dibaca di peramban, berdetak hanya pada batasnya, dan dibaca ulang saat tab terlihat", () => {
    const blok = blokFungsi("useSaatPengadilan");
    expect(blok).toContain("useState<SaatPengadilan>(SAAT_BELUM_TERBACA)");
    expect(blok).toContain("jedaKeBatasBerikut(");
    expect(blok).toContain("visibilitychange");
    // Tidak berdetak tiap detik - layar sebesar ini tidak dilukis ulang untuk
    // angka yang tidak ditampilkan di mana pun.
    expect(blok).not.toContain("setInterval");
    expect(LAYAR).toContain("}, [sidangSealur, antrian.peta, saat]);");
  });

  it("tanda merah Belum ditunda berdiri di depan tombol tunda|putus", () => {
    const i = LAYAR.indexOf("{belumTundaLewatBatas(baris, saat) ? (");
    const iJenis = LAYAR.lastIndexOf('{baris.jenisPerkara || "—"}', i);
    const iTunda = LAYAR.indexOf('{ kunci, jalan: "tunda" }', i);
    expect(i).toBeGreaterThan(-1);
    expect(iJenis).toBeGreaterThan(-1);
    expect(iTunda).toBeGreaterThan(i);
    const tanda = LAYAR.slice(i, i + 1500);
    expect(tanda).toContain("Belum ditunda");
    expect(tanda).toContain("border-rose-500");
    expect(tanda).toContain("rounded-full");
  });

  it("judul kotak Perlu diperiksa menyebut berapa yang datang dari aturan 15:00", () => {
    expect(LAYAR).toContain("judul={`${keadaan.judul} ${keteranganBatasJam}`}");
    expect(LAYAR).toContain("hitung[KUNCI_BELUM_TUNDA_LEWAT_BATAS] = sidangSealur.filter((baris) =>");
  });
});

// ===========================================================================
// BUTIR 4 - AGENDA e-LITIGASI MERAH
// ===========================================================================

/** Sel Agenda tabel utama, tanpa komentar JSX. */
function selAgenda(): string {
  const akhir = LAYAR.indexOf("<UmurPerkara durasi={baris.durasi} />");
  expect(akhir, "umur perkara di bawah agenda hilang").toBeGreaterThan(-1);
  const awal = LAYAR.lastIndexOf('<td className="px-3 py-2 align-top text-sm">', akhir);
  expect(awal, "sel Agenda tidak ditemukan").toBeGreaterThan(-1);
  return LAYAR.slice(awal, akhir).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("butir 4 - tulisan agenda e-Litigasi merah", () => {
  it("memakai aturan yang SAMA dengan kotak e-Litigasi", () => {
    expect(selAgenda()).toContain("sidangElitigasi(baris)");
    expect(LAYAR).toContain("cocok: (x) => sidangElitigasi(x)");
  });

  it("bukan seluruh perkara e-Court, dan bukan agendanya saja", () => {
    // 99,5% sidang 2026 perkaranya e-Court: lewatEcourt saja memerahkan
    // seluruh tabel. Agenda saja memerahkan perkara biasa.
    const sel = selAgenda();
    expect(sel).not.toMatch(/baris\.lewatEcourt\s*(\?|&&)/);
    expect(sel).not.toContain("agendaElitigasi(");
  });

  it("tulisan tanpa latar - tidak menyaru lencana retur/belum dipanggil", () => {
    const sel = selAgenda();
    const i = sel.indexOf("sidangElitigasi(baris)");
    const j = sel.indexOf("{baris.agenda}", i);
    expect(j).toBeGreaterThan(i);
    const gaya = sel.slice(i, j);
    expect(gaya).toContain("text-red-700");
    expect(gaya).toContain("dark:text-red-400");
    expect(gaya).toContain("font-semibold");
    expect(gaya).not.toMatch(/\bbg-/);
    expect(gaya).not.toContain("rounded");
  });

  it("hanya teks agendanya - nomor sidang tidak ikut merah", () => {
    const sel = selAgenda();
    const i = sel.indexOf("{baris.agenda}");
    const tutup = sel.indexOf("</span>", i);
    const ke = sel.indexOf("sidang ke-", i);
    expect(tutup).toBeGreaterThan(i);
    expect(ke).toBeGreaterThan(tutup);
  });

  it("berlaku di Lengkap DAN Ringkas", () => {
    const sel = selAgenda();
    const sebelum = sel.slice(0, sel.indexOf("sidangElitigasi(baris)"));
    expect(sebelum).not.toContain("kolom-lengkap");
    expect(sebelum).not.toContain("hanya-ringkas");
  });

  it("dapat dimatikan di menu Tampilan, dan bawaannya menyala", () => {
    const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === "agenda-elitigasi");
    expect(saklar?.kelompok).toBe("penanda");
    expect(tampilanBawaan()["agenda-elitigasi"]).toBe(true);
    expect(tampil({}, "agenda-elitigasi")).toBe(true);
    expect(selAgenda()).toContain('tampil(tampilan, "agenda-elitigasi")');
  });

  it("perkara e-Court yang agendanya harus dihadiri TIDAK merah", () => {
    expect(sidangElitigasi({ agenda: "Replik Penggugat", lewatEcourt: true })).toBe(true);
    expect(sidangElitigasi({ agenda: "Pembuktian Penggugat", lewatEcourt: true })).toBe(false);
    expect(sidangElitigasi({ agenda: "Mediasi", lewatEcourt: true })).toBe(false);
    expect(sidangElitigasi({ agenda: "Replik Penggugat", lewatEcourt: false })).toBe(false);
  });

  it("sidang pertama tidak pernah e-Litigasi - persetujuannya baru diketahui di sana", () => {
    // 58 dari 311 sidang yang dahulu tertandai sepanjang 2026, hampir semua
    // permohonan sidang-sehari yang agendanya menyebut "Kesimpulan".
    const satuHari = "SIDANG PERTAMA, Pemeriksaan Identitas, Penasihatan, Pemeriksaan Pokok Perkara, Kesimpulan";
    expect(sidangElitigasi({ agenda: satuHari, lewatEcourt: true, urutanSidang: 1 })).toBe(false);
    expect(sidangElitigasi({ agenda: "Kesimpulan", lewatEcourt: true, urutanSidang: 2 })).toBe(true);
    // 0 = tidak terbaca, BUKAN sidang pertama - tidak dikecualikan diam-diam.
    expect(sidangElitigasi({ agenda: "Kesimpulan", lewatEcourt: true, urutanSidang: 0 })).toBe(true);
  });

  it("kotak e-Litigasi tetap sejuk - tidak naik ke Perlu diperiksa", () => {
    const i = LAYAR.indexOf('kunci: "e-litigasi"');
    expect(LAYAR.slice(i, i + 200)).toContain('nada: "sejuk"');
  });

  it("lembar cetak tetap hitam-putih", () => {
    expect(CETAK).toContain('style={{ color: "#000", background: "#fff" }}');
    expect(CETAK).not.toContain("sidangElitigasi");
  });
});

// ===========================================================================
// BUTIR 5 & 6 - UMUR PERKARA
// ===========================================================================

describe("butir 5 - warna umur perkara menurut SK Dirjen Badilag 048/2024", () => {
  it("keempat pita: hijau, kuning, oranye, merah - dari NILAI SK, bukan hari", () => {
    expect(PITA_WAKTU_PUTUS.map((p) => [p.nilai, p.warna])).toEqual([
      [5, "hijau"],
      [3, "kuning"],
      [1, "oranye"],
      [0, "merah"],
    ]);
    expect(pitaWaktuPutus(undefined)).toBeNull();
    expect(pitaWaktuPutus(2)).toBeNull();
    // Kuning bukan amber: amber-100 dan orange-100 nyaris sama di layar.
    expect(pitaWaktuPutus(3)?.kelasKotak).toContain("yellow");
    expect(pitaWaktuPutus(1)?.kelasKotak).toContain("orange");
  });

  it("layar tidak menulis ulang batas harinya", () => {
    const blok = blokFungsi("UmurPerkara");
    expect(blok).toContain("pitaWaktuPutus(");
    expect(blok).not.toMatch(/hariBersih\s*<=?\s*\d/);
    expect(blok).not.toContain("sisa <= 30");
    // Warnanya dari pita SK saja - sisaHari kini hanya menentukan kalimat
    // kewajiban lapor SEMA di tooltip, bukan kelas warna.
    expect(blok).toContain("pita ? pita.kelasKotak");
    expect(blok).not.toMatch(/sisaHari[^\n]*(border-|bg-|text-red)/);
  });

  it("rincian menyebut dasarnya", () => {
    expect(LAYAR).toContain("048/DJA/SK.KP3.4.3/IV/2024");
    expect(LAYAR).toContain("Evaluasi Kinerja pada SIPP");
    expect(LAYAR).toContain("SEMA 2/2014");
    expect(LAYAR).toContain("PERMA 1/2016 Pasal 24");
    expect(LAYAR).toContain("{PITA_WAKTU_PUTUS.map((p, i) => (");
  });

  it("dapat dimatikan di menu Tampilan", () => {
    expect(LAYAR).toContain('{tampil(tampilan, "umur-perkara") ? (');
  });
});

describe("butir 6 - lencana hari tidak menyebut mediasi, rinciannya tetap", () => {
  const tubuh = blokFungsi("UmurPerkara");
  // Yang TAMPAK hanyalah yang di-return; rinci (tooltip) disusun sebelumnya.
  const tampak = tanpaKomentar(tubuh.slice(tubuh.indexOf("return (")));

  it("lencana hanya menyebut hari yang dihitung", () => {
    expect(tampak).toContain('<span className="font-semibold">{durasi.hariBersih} hari</span>');
    expect(tampak).not.toContain("dipotong");
    expect(tampak).not.toContain("durasi.hariMediasi");
  });

  it("kewajiban lapor lima bulan dari sisa SEMA, bukan dari nilai SK", () => {
    // Tinjauan 24 September 2026: memotong ghaib dari angka ini pernah
    // menyembunyikan perkara 163 hari sebagai "43 hari, sisa 107".
    expect(tubuh).toContain("durasi.sisaHari !== null && durasi.sisaHari < 0");
    expect(tubuh).not.toContain("sk?.nilai === 0");
    expect(LAYAR).not.toContain("durasi.kelonggaran");
    expect(LAYAR).not.toContain("Kelonggaran perkara khusus</dt>");
  });

  it("layar tidak mengaku sama dengan penilaian SK di Status Perkara", () => {
    // Tangganya sama, masukannya tidak: pengecualian perkara khusus tidak
    // dipotong di sini, dan hari mediasinya dari sumber lain.
    expect(LAYAR).not.toContain("cara yang sama dengan\n            penilaian SK di layar Status Perkara");
    expect(LAYAR).toContain("nilainya dapat berbeda untuk perkara ghaib");
  });

  it("tooltip tetap menjelaskan selisihnya dengan umur di SIPP", () => {
    expect(tampak).toContain("title={rinci}");
    expect(tubuh).toContain("Mediasi ${durasi.hariMediasi} hari TIDAK dihitung (PERMA 1/2016 Pasal 24).");
  });

  it("rincian mediasi tetap di panel Rincian waktu perkara", () => {
    const j = LAYAR.indexOf('<Bagian judul="Rincian waktu perkara"');
    const blok = LAYAR.slice(j, LAYAR.indexOf("</Bagian>", j));
    expect(j).toBeGreaterThan(-1);
    expect(blok).toContain('<dt className="text-muted-foreground">Mediasi dikeluarkan</dt>');
    expect(blok).toContain("{durasi.hariMediasi} hari");
    expect(blok).toContain('<dt className="font-semibold">Durasi yang dihitung</dt>');
    expect(blok).toContain("durasi.mediasi.map(");
  });
});

// ===========================================================================
// BUTIR 11 - TOMBOL RINCIAN BERWARNA SELAMA TERBUKA
// ===========================================================================

function blokRincian() {
  const awal = LAYAR.indexOf("TOMBOL RINCIAN DI UJUNG KANAN");
  const akhir = LAYAR.indexOf("JALAN KE STATUS PERKARA, DIKEMBALIKAN", awal);
  expect(awal, "tanda tombol Rincian hilang").toBeGreaterThan(-1);
  expect(akhir, "tanda tombol Status hilang").toBeGreaterThan(awal);
  return tanpaKomentar(LAYAR.slice(awal, akhir));
}

describe("butir 11 - tombol Rincian berwarna selama rinciannya terbuka", () => {
  it("terbuka = berisi warna primer, tertutup = rupa semula", () => {
    expect(blokRincian()).toMatch(
      /dibuka === kunci\s*\?\s*"border-primary bg-primary text-primary-foreground[^"]*"\s*:\s*"text-muted-foreground hover:bg-muted hover:text-foreground"/
    );
  });

  it("warnanya diturunkan dari keadaan yang SAMA dengan panel rinciannya", () => {
    const blok = blokRincian();
    expect(blok).toContain("aria-expanded={dibuka === kunci}");
    // Keadaan kedua dapat tertinggal menyala sesudah rincian ditutup lewat
    // jalan lain - pindah hari, baris lain, gagal baca.
    expect(blok).not.toMatch(/useState|aria-pressed/);
  });

  it("bentuk dan tebal huruf tidak berubah - kolom paling kanan tidak bergeser", () => {
    const blok = blokRincian();
    const i = blok.indexOf("<button");
    const tombol = blok.slice(i, blok.indexOf("</button>", i));
    expect(tombol).toContain("rounded-md border px-2 py-1 text-xs");
    expect(tombol).not.toMatch(/font-(semibold|bold|medium)|rounded-full|border-2|ring-/);
  });

  it("tombol Status tetap tanpa warna aktif - ia berpindah layar, bukan membuka", () => {
    const awal = LAYAR.indexOf("JALAN KE STATUS PERKARA, DIKEMBALIKAN");
    const status = tanpaKomentar(LAYAR.slice(awal, LAYAR.indexOf("</td>", awal)));
    expect(status).not.toContain("bg-primary");
    expect(status).not.toContain("aria-expanded");
  });
});

// ===========================================================================
// BUTIR 9 - TAMPILAN CATATAN SALURAN DI PANEL RINCIAN
// ===========================================================================

describe("butir 9 - pihak yang hadir sidang lalu tidak dinilai kepatutannya", () => {
  it("panel Kesiapan tidak memerahkan pihak yang tidak wajib dipanggil", () => {
    // Tinjauan 24 September 2026: merah "belum dapat dinilai" berdiri di
    // samping "tidak perlu dipanggil" - 865 dari 1.129 sidang lanjutan 2026.
    const i = LAYAR.indexOf('{pihak.kepatutan.alasan === "tidak_wajib_dipanggil" ? (');
    const j = LAYAR.indexOf("{pihak.kepatutan.patut === true ? (", i - 10);
    expect(i).toBeGreaterThan(-1);
    const cabang = tanpaKomentar(LAYAR.slice(i, i + 600));
    expect(cabang).toContain('<Badge variant="muted">tidak dinilai</Badge>');
    // Cabangnya berdiri SEBELUM cabang patut/belum_dikirim.
    expect(LAYAR.indexOf('pihak.kepatutan.alasan === "belum_dikirim"', i)).toBeGreaterThan(i);
    expect(j === -1 || j > i).toBe(true);
  });
});

describe("butir 9 - sandi E tanpa e-Summons tampil sebagai catatan, bukan merah", () => {
  it("lencana merah hanya untuk salah saluran; catatan saluran abu-abu", () => {
    const i = LAYAR.indexOf("{pihak.salahSaluran ? (");
    expect(i).toBeGreaterThan(-1);
    const blok = LAYAR.slice(i, i + 1500);
    expect(blok).toContain(") : pihak.catatanSaluran ? (");
    const catatan = blok.slice(blok.indexOf(") : pihak.catatanSaluran ? ("));
    expect(catatan).toContain("text-muted-foreground");
    expect(catatan.slice(0, catatan.indexOf("{pihak.catatanSaluran}"))).not.toContain('variant="danger"');
  });
});
