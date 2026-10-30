/**
 * ============================================================================
 * AGEN H-1 BAS SIDANG BERIKUTNYA (G2a 2.4, 30 Oktober 2026) - ATURAN MURNI
 * ============================================================================
 *
 * Sore hari kerja ALETA menyiapkan BAS untuk sidang HARI KERJA BERIKUTNYA: blangko BAS Derry yang tepat untuk agenda
 * sidang itu (rekomendasiBlangko - mesin yang sama dengan saran blangko Jadwal Sidang/Blangko Derry, termasuk BAS sela,
 * pemeriksaan setempat, sumpah, dan mediasi elektronik paket sela-ps-30okt), perkiraan kehadiran, dan keadaan tanya jawab
 * saksi. Pola sama dengan draf putusan H-7 (lib/agen-h7-putusan.ts): SIPP dan ABT hanya dibaca; tidak ada yang ditulis.
 *
 * Saat PP membuka perkara itu di Blangko Derry pada sidangnya, blangko draf terbuka sendiri dan isian diisi oleh "Isi dari
 * SIPP" yang memang otomatis untuk panitera (keputusan 12 Okt); tanya jawab saksi yang kosong tersusun sendiri saat
 * penyuntingnya dibuka (2.1). Tidak ada tombol tambahan (arahan pengguna 30 Okt malam).
 *
 * Berkas ini murni (tanpa jaringan dan basis data) supaya diuji langsung.
 */
import { agendaMusyawarah, sidangIkrar } from "@/lib/keadaan-sidang";
import { geserHari, sebabLibur, sebutTanggalPanjang, type PetaLibur } from "@/lib/hari-libur";
import { masukanRekomendasiDariBaris, rekomendasiBlangko, type Rekomendasi } from "@/lib/rekomendasi-blangko";

const teks = (x: unknown) => String(x ?? "").trim();

// ============================================================================
// 1. SIDANG MANA YANG DISIAPKAN
// ============================================================================

/**
 * Hari kerja sesudah `hariIni` (Sabtu, Minggu, libur nasional/cuti bersama/daerah dilewati). Jumat sore menyiapkan Senin;
 * sebelum libur panjang menyiapkan hari kerja pertama sesudahnya. "" bila tidak ditemukan dalam 21 hari.
 */
export function hariKerjaBerikut(hariIni: string, peta?: PetaLibur): string {
  for (let i = 1; i <= 21; i += 1) {
    const t = geserHari(hariIni, i);
    if (!t) return "";
    if (!(peta ? sebabLibur(t, peta) : sebabLibur(t))) return t;
  }
  return "";
}

/** Baris jadwal sidang bot (SidangBaris) yang dipakai agen; selebihnya diteruskan ke rekomendasi apa adanya. */
export type BarisSidangH1 = {
  perkaraId?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  tanggalSidang?: unknown;
  jamSidang?: unknown;
  agenda?: unknown;
  sudahPutus?: unknown;
  sidangIkrarTalak?: unknown;
  urutanSidang?: unknown;
  dihadiriOleh?: unknown;
  majelisNama?: unknown;
  paniteraNama?: unknown;
  saksiPihak1?: unknown;
  saksiPihak2?: unknown;
  panggilan?: { hadirSebelumnya?: unknown; tergugatPernahHadir?: unknown; penggugatPernahHadir?: unknown } | null;
  [ruas: string]: unknown;
};

/** Golongan agenda untuk petugas (bukan penentu blangko - blangko dipilih rekomendasiBlangko atas teks agendanya). */
export type JenisAgendaH1 = "pemeriksaan-setempat" | "sumpah" | "mediasi" | "putusan" | "kesimpulan" | "pembuktian" | "ikrar" | "lain";

export const JENIS_AGENDA_TEKS: Record<JenisAgendaH1, string> = {
  "pemeriksaan-setempat": "pemeriksaan setempat",
  sumpah: "pengucapan sumpah",
  mediasi: "mediasi",
  putusan: "musyawarah / pembacaan putusan",
  kesimpulan: "kesimpulan",
  pembuktian: "pembuktian",
  ikrar: "penyaksian ikrar talak",
  lain: "sidang lanjutan",
};

export function jenisAgendaH1(baris: Pick<BarisSidangH1, "agenda" | "sidangIkrarTalak">): JenisAgendaH1 {
  const a = teks(baris.agenda);
  if (sidangIkrar({ agenda: a, sidangIkrarTalak: baris.sidangIkrarTalak === true })) return "ikrar";
  if (/setempat|descente/i.test(a)) return "pemeriksaan-setempat";
  if (/sumpah|li'?an/i.test(a)) return "sumpah";
  if (/mediasi/i.test(a)) return "mediasi";
  if (agendaMusyawarah(a)) return "putusan";
  if (/kesimpulan/i.test(a)) return "kesimpulan";
  if (/bukti|pembuktian|saksi/i.test(a)) return "pembuktian";
  return "lain";
}

/** Sidang tanggal `tanggal` yang disiapkan: belum memutus (kecuali sidang ikrar talak sesudah putus). */
export function sasaranH1(baris: BarisSidangH1, tanggal: string): boolean {
  if (!teks(baris.perkaraId) || teks(baris.tanggalSidang).slice(0, 10) !== tanggal) return false;
  if (baris.sudahPutus === true && !sidangIkrar({ agenda: teks(baris.agenda), sidangIkrarTalak: baris.sidangIkrarTalak === true })) return false;
  return true;
}

// ============================================================================
// 2. BLANGKO BAS
// ============================================================================

export type PilihanBasH1 = { utama: Rekomendasi | null; alternatif: Rekomendasi[]; perkiraanKehadiran: boolean; alasan: string };

/**
 * Blangko BAS Derry untuk sidang yang belum berlangsung. Kehadiran sidang itu belum ada, jadi dipakai kehadiran sidang
 * SEBELUMNYA (sama dengan draf H-7) - ditandai perkiraan. Teks dasar = agenda (alasan tunda sidang besok tentu kosong).
 */
export function pilihBasH1(baris: BarisSidangH1): PilihanBasH1 {
  const m = masukanRekomendasiDariBaris(baris as Record<string, unknown>);
  const perkiraanKehadiran = m.dihadiriOleh === null || m.dihadiriOleh === undefined;
  // Keputusan 44: sidang mediasi selalu kedua pihak hadir - kehadiran sidang lalu tidak dipakai sebagai perkiraan (mesin saran
  // memperlakukan kehadiran yang belum tercatat pada agenda mediasi sebagai kontradiktoir).
  const mediasi = jenisAgendaH1(baris) === "mediasi";
  const hasil = rekomendasiBlangko({ ...m, alasanDitunda: "", keterangan: "", ditunda: false, dihadiriOleh: mediasi ? (m.dihadiriOleh ?? null) : (m.dihadiriOleh ?? m.hadirSebelumnya ?? null) });
  const daftar = hasil.bas;
  const utama = daftar.find((r) => r.utama) ?? daftar[0] ?? null;
  return {
    utama,
    alternatif: daftar.filter((r) => r !== utama),
    perkiraanKehadiran,
    alasan: utama
      ? `${utama.alasan.replace(/\.$/, "")}${perkiraanKehadiran && m.hadirSebelumnya !== null && m.hadirSebelumnya !== undefined ? "; kehadiran diperkirakan dari sidang sebelumnya" : ""}.`
      : "Belum ada blangko BAS Derry yang pasti untuk agenda ini; pilih blangko sendiri.",
  };
}

// ============================================================================
// 3. SAKSI DAN DRAF
// ============================================================================

/** Saksi yang sudah punya tanya jawab di ABT (bot case.pemeriksaanSaksi). */
export type SaksiTanyaJawab = { pihak?: unknown; saksiKePihak?: unknown; tanyaJawab?: unknown };

export type SaksiH1 = { terdaftarP: number; terdaftarT: number; bertanyaJawab: number };

export function saksiH1(baris: BarisSidangH1, tanyaJawab: SaksiTanyaJawab[]): SaksiH1 {
  return {
    terdaftarP: Number(baris.saksiPihak1) || 0,
    terdaftarT: Number(baris.saksiPihak2) || 0,
    bertanyaJawab: (Array.isArray(tanyaJawab) ? tanyaJawab : []).filter((s) => Array.isArray(s.tanyaJawab) && (s.tanyaJawab as unknown[]).length > 0).length,
  };
}

export type DrafH1 = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  urutanSidang: number;
  agenda: string;
  jenisAgenda: JenisAgendaH1;
  blangko: Pick<Rekomendasi, "folder" | "berkas" | "menu" | "alias" | "label"> | null;
  alternatif: Array<Pick<Rekomendasi, "folder" | "berkas" | "menu" | "alias" | "label">>;
  alasan: string;
  perkiraanKehadiran: boolean;
  saksi: SaksiH1;
  catatan: string[];
  majelisNama: string;
  paniteraNama: string;
  dibuatPada: string;
};

const ringkasBlangko = (r: Rekomendasi) => ({ folder: r.folder, berkas: r.berkas, menu: r.menu, alias: r.alias.slice(), label: r.label });

export function susunDrafH1(baris: BarisSidangH1, bahan: { tanyaJawab?: SaksiTanyaJawab[]; kini?: Date } = {}): DrafH1 {
  const pilih = pilihBasH1(baris);
  const jenisAgenda = jenisAgendaH1(baris);
  const saksi = saksiH1(baris, bahan.tanyaJawab ?? []);
  const catatan: string[] = [];
  if (pilih.utama && pilih.perkiraanKehadiran) catatan.push("Kehadiran sidang ini belum diketahui; bila berbeda dari sidang sebelumnya, pilih blangko BAS lain.");
  if (jenisAgenda === "pembuktian") {
    const terdaftar = saksi.terdaftarP + saksi.terdaftarT;
    if (!terdaftar) catatan.push("Saksi belum tercatat di SIPP; tanya jawab saksi tersusun sendiri setelah saksi dicatat dan penyuntingnya dibuka.");
    else if (saksi.bertanyaJawab < terdaftar) catatan.push(`${terdaftar - saksi.bertanyaJawab} saksi belum punya tanya jawab; drafnya tersusun sendiri saat penyunting tanya jawab saksi dibuka.`);
  }
  if (!pilih.utama) catatan.push(pilih.alasan);
  return {
    perkaraId: teks(baris.perkaraId),
    nomorPerkara: teks(baris.nomorPerkara),
    jenisPerkara: teks(baris.jenisPerkara),
    tanggalSidang: teks(baris.tanggalSidang).slice(0, 10),
    urutanSidang: Number(baris.urutanSidang) || 0,
    agenda: teks(baris.agenda),
    jenisAgenda,
    blangko: pilih.utama ? ringkasBlangko(pilih.utama) : null,
    alternatif: pilih.alternatif.slice(0, 4).map(ringkasBlangko),
    alasan: pilih.alasan,
    perkiraanKehadiran: pilih.perkiraanKehadiran,
    saksi,
    catatan,
    majelisNama: teks(baris.majelisNama),
    paniteraNama: teks(baris.paniteraNama),
    dibuatPada: (bahan.kini ?? new Date()).toISOString(),
  };
}

// ============================================================================
// 4. RINGKAS, MILIK AKUN, KALIMAT
// ============================================================================

export type RingkasDrafH1 = { perkaraId: string; tanggalSidang: string; label: string; jenisAgenda: JenisAgendaH1; adaBlangko: boolean; perkiraan: boolean };

export function ringkasDrafH1(d: DrafH1): RingkasDrafH1 {
  return { perkaraId: d.perkaraId, tanggalSidang: d.tanggalSidang, label: d.blangko ? d.blangko.label : "", jenisAgenda: d.jenisAgenda, adaBlangko: Boolean(d.blangko), perkiraan: d.perkiraanKehadiran };
}

/** Lencana Jadwal Sidang (tanpa istilah teknis, tanpa kode). */
export function teksLencanaH1(r: RingkasDrafH1 | null | undefined): string {
  if (!r) return "";
  return r.adaBlangko ? "BAS disiapkan" : "BAS belum ada saran";
}

/** Keterangan panjang (ikon (i) / title). */
export function keteranganDrafH1(d: DrafH1): string {
  const tgl = sebutTanggalPanjang(d.tanggalSidang);
  const isi = d.blangko ? `BAS sidang ${tgl} (${JENIS_AGENDA_TEKS[d.jenisAgenda]}) disiapkan otomatis: ${d.blangko.label}. ${d.alasan}` : `BAS sidang ${tgl} (${JENIS_AGENDA_TEKS[d.jenisAgenda]}): ${d.alasan}`;
  return [isi, ...d.catatan.filter((c) => c !== d.alasan)].join(" ");
}

/**
 * Draf milik akun: PP perkara atau anggota majelis (nama dicocokkan longgar oleh `cocokNama`); Super Admin/Admin semua.
 * Diurutkan tanggal lalu nomor perkara.
 */
export function drafH1Saya(daftar: DrafH1[], o: { nama: string; lihatSemua: boolean; cocokNama: (nama: string, teksDaftar: string) => boolean }): DrafH1[] {
  const nama = teks(o.nama);
  return daftar
    .filter((d) => o.lihatSemua || (nama && (o.cocokNama(nama, d.paniteraNama) || o.cocokNama(nama, d.majelisNama))))
    .sort((a, b) => a.tanggalSidang.localeCompare(b.tanggalSidang) || a.nomorPerkara.localeCompare(b.nomorPerkara));
}
