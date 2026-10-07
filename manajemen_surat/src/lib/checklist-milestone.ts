/**
 * ============================================================================
 * CHECKLIST MILESTONE - MESIN ATURANNYA
 * ============================================================================
 *
 * Bot membaca fakta dari SIPP (aleta_bot/services/checklistMilestoneService.js);
 * berkas ini yang MEMUTUSKAN: perkara mana yang menjadi butir, kapan
 * tenggatnya, masuk kelompok mana, dan kapan butirnya hilang sendiri karena
 * pekerjaannya selesai. Definisi tiap jenis ditulis di katalog
 * (checklist-milestone-katalog.ts); di sini pelaksanaannya.
 *
 * Tidak ada basis data di sini dan tidak ada jam peramban: waktu masuk lewat
 * `konteks`, fakta masuk lewat `fakta`. Karena itu tiap aturan dapat diuji
 * dengan fakta tiruan seribu kali tanpa menyentuh SIPP.
 *
 * ============================================================================
 * ATURAN YANG SUDAH ADA DIPAKAI ULANG, TIDAK DITULIS ULANG
 * ============================================================================
 *
 *   hasilSidangBelumDicatat  lib/keadaan-sidang.ts   (kotak "Belum tunda")
 *   hasilSidangPutusan       lib/hasil-sidang.ts     (sidang yang tertulis putus)
 *   agendaMusyawarah         lib/keadaan-sidang.ts   (sidang musyawarah/putusan)
 *   PETA_ATURAN              lib/penjaga-tenggat.ts  (batas hari ikrar, akta, dirput)
 *   bandingkanKonseptor      lib/konseptor-sementara (nama konseptor sementara)
 *   waktuPengadilan          lib/waktu-pengadilan.ts (tanggal & jam WITA)
 *
 * ============================================================================
 * GAGAL-TERTUTUP
 * ============================================================================
 *
 * Koleksi fakta yang gagal dibaca TIDAK menghasilkan "tidak ada butir": jenis
 * yang memakainya dipindah ke jenisTidakTersedia beserta sebabnya. Hasil
 * sidang hanya ditagih bila peta putusan, ikrar, dan sidang lanjutannya
 * terbukti terbaca - sama dengan penanda merah di Antrian Sidang.
 */

import {
  ALAMAT_ALETA,
  type JenisTersedia,
  type Kerjakan,
  type KunciPeran,
  PETA_KATALOG,
  katalogPeran,
} from "@/lib/checklist-milestone-katalog";
import { hasilSidangPutusan } from "@/lib/hasil-sidang";
import { agendaMusyawarah, hasilSidangBelumDicatat, sidangIkrar } from "@/lib/keadaan-sidang";
import { bandingkanKonseptor } from "@/lib/konseptor-sementara";
import { PETA_ATURAN, STATUS_DIKABULKAN, type FaktaTenggat, tanggalIso } from "@/lib/penjaga-tenggat";
import { JAM_BATAS_HASIL_SIDANG, waktuPengadilan } from "@/lib/waktu-pengadilan";

// ============================================================================
// BENTUK JAWABAN
// ============================================================================

export type Kelompok = "lewat" | "hari-ini" | "minggu-ini";

export type ButirChecklist = {
  id: string;
  jenis: string;
  judul: string;
  perkara: { id: string; nomor: string } | null;
  tenggat: string | null;
  kelompok: Kelompok;
  keterangan: string;
  kerjakan: Kerjakan;
};

export type RingkasChecklist = {
  lewat: number;
  hariIni: number;
  mingguIni: number;
  selesaiHariIni: number;
  totalHariIni: number;
};

export type JenisTakTersedia = { jenis: string; sebab: string };

// ============================================================================
// BENTUK FAKTA (dari bot)
// ============================================================================

export type PanggilanFakta = {
  wajibDipanggil: number[];
  sisiBelumDipanggil: number[];
  belumDipanggil: number;
  retur: number;
};

export type SidangFakta = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  urutan: number;
  ditunda: boolean;
  alasanDitunda: string;
  dihadiriOleh: number | null;
  adaBas: boolean;
  sidangIkrarTalak: boolean;
  ikrarTercatat: boolean;
  putusanTerbaca: boolean;
  ikrarTerbaca: boolean;
  berikutTerbaca: boolean;
  sudahPutus: boolean;
  tanggalPutusan: string;
  tanggalSidangBerikut: string;
  sidangBerikutId: string;
  /** Sidang lanjutannya sidang ikrar talak (bendera atau agenda) - panggilannya wajib bagi kedua pihak. */
  sidangBerikutIkrar?: boolean;
  jabatanSaya: number | null;
  majelisKode?: string;
  jurusitaNama?: string;
  paniteraNama?: string;
  panggilanTerbaca?: boolean;
  panggilan: PanggilanFakta | null;
  panggilanBerikut: PanggilanFakta | null;
};

export type PutusanFakta = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  tanggalPutusan: string;
  diinputTanggal: string;
  verstek: boolean;
  statusPutusanId: number | null;
  tanggalBht: string;
  adaDok: boolean;
  adaAnonim: boolean;
  dihadiriSaatPutus: number | null;
  pbtPihak1: string;
  pbtPihak2: string;
  adaPihak2: boolean;
  tanggalBanding: string;
  jabatanSaya: number | null;
};

export type PutusTanpaPutusanFakta = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  ditunda: boolean;
  alasanDitunda: string;
  tanggalPutusan: string;
  diinputPutusan: string;
};

export type BerjalanFakta = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  hariMediasi: number;
  durasiTerbaca: boolean;
  jabatanSaya: number | null;
  majelisKode?: string;
};

export type MediasiFakta = {
  mediasiId: string;
  perkaraId: string;
  nomorPerkara: string;
  penetapanMediator: string;
  dimulaiMediasi: string;
  laporanMediator: string;
  tenggatPerma: string;
};

export type IkrarFakta = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalBht: string;
  statusPutusanId: number | null;
  penetapanSidangIkrar: string;
  tanggalIkrar: string;
  sidangIkrarBerikut: string;
  jabatanSaya: number | null;
};

export type PerkaraTertentuFakta = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalPutusan: string;
  diinputPutusan: string;
  sidangMendatang: Array<{ tanggal: string; agenda: string }>;
  jabatanSaya: number | null;
};

export type SaksiFakta = {
  saksiId: string;
  perkaraId: string;
  nomorPerkara: string;
  sisi: number;
  urutan: number;
  diinputTanggal: string;
  pihakDiperbarui: string;
  adaJenisIdentitas: boolean;
  adaNomorIdentitas: boolean;
  adaTelepon: boolean;
};

export type ReturFakta = {
  relaasId: string;
  perkaraId: string;
  nomorPerkara: string;
  sidangId: string;
  tanggalSidang: string;
  tanggalRelaas: string;
  tanggalPutusan: string;
  sidangBerikut: string;
  adaSusulan: boolean;
  susulanDiinput: string;
};

export type PmhFakta = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  tanggalPmh: string;
  diinputPmh: string;
};

export type EfilingFakta = {
  efilingId: string;
  nomorRegister: string;
  jenisPerkara: string;
  tanggalBayar: string;
  nomorPerkara: string;
  perkaraId: string;
  tanggalDaftar: string;
  status: string;
};

export type PanjarFakta = {
  perkaraId: string;
  nomorPerkara: string;
  sidangBerikut: string;
  saldo: number | null;
  transaksi: number;
  terakhirMasuk: string;
  ambang: number;
};

export type SisaPanjarFakta = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalPutusan: string;
  saldo: number;
  keluarTerakhir: string;
  ambang: number;
};

export type TeleponFakta = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalDaftar: string;
  teleponLengkap: boolean;
  pihakDiperbarui: string;
};

export type AktaFakta = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalAkta: string;
  adaDok: boolean;
  diperbarui: string;
};

export type ArsipFakta = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalBht: string;
  arsipDiinput: string;
};

export type EcourtSegar = {
  terakhirBerhasil: string;
  terakhirDicoba: string;
  jadwalAktif: boolean;
  jarakJam: number;
  jamMulai: number;
  jamSelesai: number;
};

export type EcourtDokumenFakta = {
  segar: EcourtSegar;
  dokumen: Array<{
    kunci: string;
    nomorPerkara: string;
    perkaraId: string;
    jenisDokumen: string;
    agenda: string;
    tanggalSidang: string;
    diunggahPada: string;
    sumberUrl: string;
  }>;
};

export type PenetapanGagalFakta = {
  id: string;
  waktu: string;
  jenis: string;
  perkaraId: string;
  nomorPerkara: string;
  alasan: string;
  berhasilSesudah: string;
};

/** Titipan antrean penetapan (dari basis data ALETA, bukan dari bot). */
export type AntreanChecklist = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  jenis: string;
  keadaan: string;
  disiapkanAt: string;
  dikerjakanAt: string;
};

/** Tunjukan konseptor sementara (basis data ALETA). */
export type TunjukanKonsep = {
  perkaraId: string;
  nomorPerkara: string;
  nama: string;
  pengguna: string;
  ditetapkanOleh: string;
  ditetapkanAt: string;
};

// ============================================================================
// WAKTU
// ============================================================================

export type KonteksChecklist = {
  kini: Date;
  /** yyyy-mm-dd menurut WITA. */
  tanggal: string;
  /** HH:MM:SS menurut WITA. */
  jam: string;
};

export function konteksDari(kini: Date = new Date()): KonteksChecklist {
  const { tanggal, jam } = waktuPengadilan(kini);
  return { kini, tanggal, jam };
}

/** Tanggal ISO digeser sekian hari (boleh negatif). */
export function geserTanggal(iso: string, hari: number): string {
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

/** Selisih hari kalender (sesudah - sebelum). */
export function selisihTanggal(sebelum: string, sesudah: string): number {
  const a = Date.parse(`${sebelum}T12:00:00Z`);
  const b = Date.parse(`${sesudah}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "16 Sep 2026". */
export function tglPendek(iso: string): string {
  const cocok = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!cocok) return String(iso || "");
  return `${Number(cocok[3])} ${BULAN[Number(cocok[2]) - 1] ?? cocok[2]} ${cocok[1]}`;
}

/** Tenggat dalam WITA. Jam kosong berarti akhir hari. */
export type TenggatWita = { tanggal: string; jam?: string };

const AKHIR_HARI = "23:59:59";

/** ISO UTC dari tenggat WITA (UTC+8, tanpa musim panas). */
export function isoTenggat(t: TenggatWita): string {
  const d = new Date(`${t.tanggal}T${t.jam ?? AKHIR_HARI}+08:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Batas jendela "minggu-ini": 7 hari kalender sesudah hari ini. */
export const HARI_MINGGU_INI = 7;

/**
 * Kelompok sebuah tenggat, atau null bila di luar jendela.
 *
 * Tanpa tenggat: minggu-ini - pekerjaan terbuka tanpa tanggal. Tenggat
 * lebih dari 7 hari: minggu-ini hanya untuk butir penugasan
 * (selaluTampil), selain itu tidak ditampilkan.
 */
export function kelompokDari(
  tenggat: TenggatWita | null,
  konteks: Pick<KonteksChecklist, "tanggal" | "jam">,
  selaluTampil: boolean
): Kelompok | null {
  if (!tenggat || !tenggat.tanggal) return "minggu-ini";
  const jam = tenggat.jam ?? AKHIR_HARI;
  if (tenggat.tanggal < konteks.tanggal) return "lewat";
  if (tenggat.tanggal === konteks.tanggal) return konteks.jam >= jam ? "lewat" : "hari-ini";
  if (tenggat.tanggal <= geserTanggal(konteks.tanggal, HARI_MINGGU_INI)) return "minggu-ini";
  return selaluTampil ? "minggu-ini" : null;
}

// ============================================================================
// SEBUTAN
// ============================================================================

const SEBUT_SISI: Record<number, string> = { 1: "pihak pertama", 2: "pihak kedua" };

function sebutSisi(sisi: number[]): string {
  return sisi.map((s) => SEBUT_SISI[s] ?? `pihak ke-${s}`).join(" dan ");
}

/**
 * Sisi yang TIDAK hadir menurut dihadiri_oleh SIPP (lihat sandi kehadiran
 * sidang: 1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada).
 * null berarti kehadirannya tidak tercatat - dan itu bukan "semua hadir".
 */
export function sisiTidakHadir(dihadiriOleh: number | null, adaPihak2: boolean): number[] | null {
  let sisi: number[];
  if (dihadiriOleh === 1) sisi = [];
  else if (dihadiriOleh === 2) sisi = [2];
  else if (dihadiriOleh === 3) sisi = [1];
  else if (dihadiriOleh === 4) sisi = [1, 2];
  else return null;
  return adaPihak2 ? sisi : sisi.filter((s) => s !== 2);
}

function rupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

/** Ketua majelis atau hakim tunggal. */
function memimpin(jabatan: number | null): boolean {
  return jabatan === 1 || jabatan === 3;
}

// ============================================================================
// ATURAN PER JENIS
// ============================================================================

type Calon = {
  kunci: string;
  perkaraId?: string;
  nomorPerkara?: string;
  tenggat: TenggatWita | null;
  keterangan: string;
  kerjakan?: Kerjakan;
};

type HasilJenis = {
  calon: Calon[];
  selesaiHariIni: number;
  /** Diisi bila jenis ini ternyata tidak dapat dinilai pada jawaban ini. */
  tidakTersedia?: string;
  /**
   * Sebagian fakta jenis ini gagal dibaca, tetapi sisanya tetap dinilai -
   * kalimatnya masuk `galat` jawaban, supaya daftar yang tampil tidak dikira
   * lengkap.
   */
  galat?: string[];
};

/**
 * Pola gagal-tertutup bersama: bila ada fakta yang tak terbaca dan tidak
 * satu pun butir atau selesai tersisa, jenisnya TIDAK TERSEDIA (bukan daftar
 * kosong); bila masih ada yang tersisa, kekurangannya disebut di galat.
 */
function tandaiTakTerbaca(hasil: HasilJenis, takTerbaca: number, sebab: string): HasilJenis {
  if (takTerbaca <= 0) return hasil;
  if (hasil.calon.length === 0 && hasil.selesaiHariIni === 0) return { ...hasil, tidakTersedia: sebab };
  return { ...hasil, galat: [...(hasil.galat ?? []), `${sebab} Daftar yang tampil belum lengkap.`] };
}

type BahanAturan = {
  peran: KunciPeran;
  konteks: KonteksChecklist;
  fakta: Record<string, unknown>;
  tambahan: TambahanAleta;
};

export type TambahanAleta = {
  antrean: AntreanChecklist[];
  konsep: TunjukanKonsep[];
};

function koleksi<T>(fakta: Record<string, unknown>, nama: string): T[] {
  const nilai = fakta[nama];
  return Array.isArray(nilai) ? (nilai as T[]) : [];
}

// ---------------------------------------------------------------------------
// Hasil sidang - dipakai hakim, PP, dan ketua dengan saringan berbeda
// ---------------------------------------------------------------------------

/**
 * Sidang sampai hari ini yang hasilnya belum dicatat.
 *
 * Gagal-tertutup: baris yang peta putusannya, peta ikrarnya (untuk sidang
 * ikrar), atau peta sidang lanjutannya gagal dibaca TIDAK ditagih - tanpa
 * peta lanjutan, hasilSidangBelumDicatat akan menuduh sidang yang
 * lanjutannya sesungguhnya sudah terbentuk.
 */
function aturanHasilSidang(
  b: BahanAturan,
  saring: (s: SidangFakta) => boolean,
  sebutPetugas: boolean
): HasilJenis {
  const { konteks } = b;
  const calon: Calon[] = [];
  let selesaiHariIni = 0;
  let takTerbukti = 0;
  for (const s of koleksi<SidangFakta>(b.fakta, "sidang")) {
    if (!s.tanggalSidang || s.tanggalSidang > konteks.tanggal) continue;
    if (!saring(s)) continue;
    if (s.putusanTerbaca !== true || s.berikutTerbaca === false || (sidangIkrar(s) && s.ikrarTerbaca !== true)) {
      takTerbukti += 1;
      continue;
    }
    if (hasilSidangBelumDicatat(s)) {
      const petugas = sebutPetugas && s.majelisKode ? ` · majelis ${s.majelisKode}` : "";
      calon.push({
        kunci: s.sidangId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.tanggalSidang, jam: JAM_BATAS_HASIL_SIDANG },
        keterangan:
          `Sidang ${tglPendek(s.tanggalSidang)}${s.jamSidang ? ` pukul ${s.jamSidang}` : ""}` +
          `${s.agenda ? ` · agenda ${s.agenda}` : ""}${petugas} - belum ditunda, belum diputus, sidang lanjutan belum ada.`,
      });
    } else if (s.tanggalSidang === konteks.tanggal) {
      selesaiHariIni += 1;
    }
  }
  return {
    calon,
    selesaiHariIni,
    tidakTersedia:
      takTerbukti > 0 && calon.length === 0 && selesaiHariIni === 0
        ? `${takTerbukti} sidang tidak dapat dinilai karena peta putusan, ikrar, atau sidang lanjutan gagal dibaca dari SIPP.`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Lima bulan - dipakai hakim (perkara yang dipimpin) dan ketua (seluruh satker)
// ---------------------------------------------------------------------------

/** Batas SEMA 2/2014 dalam hari, sama dengan AMBANG_DURASI_HARI di bot. */
export const BATAS_LIMA_BULAN_HARI = 150;

/**
 * Hari ke-150 sebuah perkara: hari pendaftaran ikut dihitung (hari ke-1),
 * hari mediasi dikeluarkan - cara durasiBanyakPerkara.
 */
export function hariKe150(tanggalDaftar: string, hariMediasi: number): string {
  return geserTanggal(tanggalDaftar, BATAS_LIMA_BULAN_HARI - 1 + Math.max(0, Math.round(hariMediasi || 0)));
}

function aturanLimaBulan(b: BahanAturan, saring: (p: BerjalanFakta) => boolean, sebutMajelis: boolean): HasilJenis {
  const calon: Calon[] = [];
  // Umur yang tak terbaca (durasiBanyakPerkara gagal) bukan "belum lima
  // bulan": tanpa hari mediasi pun hari ke-150-nya tidak dapat dihitung.
  let takTerbaca = 0;
  for (const p of koleksi<BerjalanFakta>(b.fakta, "berjalan")) {
    if (!p.tanggalDaftar || !saring(p)) continue;
    if (!p.durasiTerbaca) {
      takTerbaca += 1;
      continue;
    }
    const batas = hariKe150(p.tanggalDaftar, p.hariMediasi);
    const umur = selisihTanggal(p.tanggalDaftar, b.konteks.tanggal) + 1 - Math.max(0, p.hariMediasi);
    calon.push({
      kunci: p.perkaraId,
      perkaraId: p.perkaraId,
      nomorPerkara: p.nomorPerkara,
      tenggat: { tanggal: batas },
      keterangan:
        `${p.jenisPerkara ? `${p.jenisPerkara} · ` : ""}terdaftar ${tglPendek(p.tanggalDaftar)}; umur ${umur} hari` +
        `${p.hariMediasi > 0 ? ` (tanpa ${p.hariMediasi} hari mediasi)` : ""}; hari ke-150 jatuh ${tglPendek(batas)}` +
        `${sebutMajelis && p.majelisKode ? ` · majelis ${p.majelisKode}` : ""}.`,
    });
  }
  return tandaiTakTerbaca(
    { calon, selesaiHariIni: 0 },
    takTerbaca,
    `Umur ${takTerbaca} perkara (hari mediasi yang dikeluarkan dari hitungan) gagal dibaca dari SIPP; batas lima bulannya tidak dapat dihitung.`
  );
}

// ---------------------------------------------------------------------------
// Ikrar talak - dipakai hakim (dipimpin) dan ketua (satker)
// ---------------------------------------------------------------------------

function aturanIkrar(b: BahanAturan, saring: (i: IkrarFakta) => boolean): HasilJenis {
  const { konteks } = b;
  const batasHari = PETA_ATURAN.get("ikrar-talak")?.batasHari ?? 180;
  const calon: Calon[] = [];
  let selesaiHariIni = 0;
  for (const i of koleksi<IkrarFakta>(b.fakta, "ikrar")) {
    if (!saring(i)) continue;
    if (i.statusPutusanId !== STATUS_DIKABULKAN || !i.tanggalBht) continue;
    if (i.tanggalIkrar) {
      if (i.tanggalIkrar === konteks.tanggal) selesaiHariIni += 1;
      continue;
    }
    const batas = geserTanggal(i.tanggalBht, batasHari);
    const sisa = selisihTanggal(konteks.tanggal, batas);
    const sisaTeks = sisa >= 0 ? `sisa tenggang ${sisa} hari` : `tenggang lewat ${-sisa} hari`;
    if (!i.penetapanSidangIkrar) {
      calon.push({
        kunci: `phs-ikrar:${i.perkaraId}`,
        perkaraId: i.perkaraId,
        nomorPerkara: i.nomorPerkara,
        tenggat: { tanggal: i.tanggalBht },
        keterangan:
          `BHT ${tglPendek(i.tanggalBht)}; hari sidang ikrar belum ditetapkan; ${sisaTeks} ` +
          `(dihitung ALETA 180 hari sejak BHT, Pasal 70 ayat (6) UU 7/1989).`,
        kerjakan: { tujuan: "sipp", halaman: "ikrar" },
      });
      continue;
    }
    if (i.penetapanSidangIkrar === konteks.tanggal) selesaiHariIni += 1;
    calon.push({
      kunci: `ikrar:${i.perkaraId}`,
      perkaraId: i.perkaraId,
      nomorPerkara: i.nomorPerkara,
      tenggat: { tanggal: batas },
      keterangan:
        `BHT ${tglPendek(i.tanggalBht)}; sidang ikrar ditetapkan ${tglPendek(i.penetapanSidangIkrar)}` +
        `${i.sidangIkrarBerikut ? `, sidang ikrar berikut ${tglPendek(i.sidangIkrarBerikut)}` : ", belum ada sidang ikrar mendatang"}` +
        `; ikrar belum diucapkan; ${sisaTeks}.`,
      kerjakan: { tujuan: "sipp", halaman: "ikrar" },
    });
  }
  return { calon, selesaiHariIni };
}

// ---------------------------------------------------------------------------
// Fakta penjaga tenggat - dipakai panitera, ketua, operator
// ---------------------------------------------------------------------------

function tenggatPenjaga(kode: string, fakta: FaktaTenggat): TenggatWita | null {
  const aturan = PETA_ATURAN.get(kode);
  const acuan = tanggalIso(fakta.tanggalAcuan);
  if (!aturan || !acuan) return null;
  return { tanggal: geserTanggal(acuan, aturan.batasHari) };
}

function aturanAkta(b: BahanAturan): HasilJenis {
  const calon: Calon[] = [];
  for (const kode of ["akta-cerai-gugat", "akta-cerai-talak"]) {
    for (const f of koleksi<FaktaTenggat>(b.fakta, `penjaga:${kode}`)) {
      if (f.statusPutusanId !== STATUS_DIKABULKAN) continue;
      const tenggat = tenggatPenjaga(kode, f);
      if (!tenggat) continue;
      calon.push({
        kunci: `${kode}:${f.perkaraId}`,
        perkaraId: String(f.perkaraId),
        nomorPerkara: String(f.nomorPerkara),
        tenggat,
        keterangan: `${f.jenisPerkara || "Perceraian"} · ${f.keterangan || ""}; akta cerai belum terbit (batas 14 hari).`,
        kerjakan: { tujuan: "sipp", halaman: "akta-cerai" },
      });
    }
  }
  const selesaiHariIni = koleksi<AktaFakta>(b.fakta, "aktaHariIni").filter((a) => a.tanggalAkta === b.konteks.tanggal)
    .length;
  return { calon, selesaiHariIni };
}

function aturanDirputGagal(b: BahanAturan): Calon[] {
  return koleksi<FaktaTenggat>(b.fakta, "penjaga:dirput-gagal").flatMap((f) => {
    const tenggat = tenggatPenjaga("dirput-gagal", f);
    if (!tenggat) return [];
    return [
      {
        kunci: `dirput:${f.perkaraId}`,
        perkaraId: String(f.perkaraId),
        nomorPerkara: String(f.nomorPerkara),
        tenggat,
        keterangan: `Pengiriman ke Direktori Putusan gagal${f.keterangan ? ` · ${f.keterangan}` : ""}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Panggilan sidang dekat - dipakai panitera dan ketua
// ---------------------------------------------------------------------------

/**
 * Sidang ini masih menunggu panggilan walau perkaranya sudah putus?
 *
 * Hanya sidang ikrar talak: Pasal 70 ayat (3) UU 7/1989 memerintahkan
 * pengadilan memanggil suami DAN istri ke sidang penyaksian ikrar, dan
 * sidang itu selalu jatuh sesudah putusan. Diukur di sipp_donggala: 18 dari
 * 71 sidang ikrar 2026 tanpa satu pun relaas - di antaranya sidang 19981
 * (15 Sep, JS 22) dan 20030 (14 Sep, JS 28) - dan tidak satu pun sampai ke
 * daftar juru sita karena perkaranya "sudah putus". Bot menandai sidang
 * ikrar dengan wajibSemuaSisi, sehingga panggilan-nya menuntut kedua pihak.
 */
function panggilanMasihDitagih(s: SidangFakta): boolean {
  return !s.sudahPutus || sidangIkrar(s);
}

function aturanSidangDekatBelumDipanggil(b: BahanAturan, sebutJs: boolean): HasilJenis {
  const { konteks } = b;
  const calon: Calon[] = [];
  let takTerbaca = false;
  for (const s of koleksi<SidangFakta>(b.fakta, "sidangPanggilan")) {
    if (s.panggilanTerbaca === false) takTerbaca = true;
    // Perkara yang sudah putus tidak lagi menunggu panggilan - KECUALI sidang
    // ikrar talak, yang justru berlangsung sesudah putusan (lihat
    // panggilanMasihDitagih).
    if (!s.panggilan || !panggilanMasihDitagih(s)) continue;
    if (s.tanggalSidang < konteks.tanggal || s.tanggalSidang > geserTanggal(konteks.tanggal, 3)) continue;
    if (s.panggilan.belumDipanggil <= 0) continue;
    calon.push({
      kunci: s.sidangId,
      perkaraId: s.perkaraId,
      nomorPerkara: s.nomorPerkara,
      tenggat: { tanggal: geserTanggal(s.tanggalSidang, -3) },
      keterangan:
        `Sidang ${tglPendek(s.tanggalSidang)}${sidangIkrar(s) ? " (sidang ikrar talak)" : s.urutan === 1 ? " (sidang pertama)" : ""}: ` +
        `${sebutSisi(s.panggilan.sisiBelumDipanggil)} belum punya relaas` +
        `${sebutJs && s.jurusitaNama ? ` · juru sita ${s.jurusitaNama}` : ""}` +
        `${!sebutJs && s.majelisKode ? ` · majelis ${s.majelisKode}` : ""}.`,
    });
  }
  return {
    calon,
    selesaiHariIni: 0,
    tidakTersedia: takTerbaca && calon.length === 0 ? "Keadaan panggilan gagal dibaca dari SIPP." : undefined,
  };
}

// ---------------------------------------------------------------------------
// Antrean penetapan
// ---------------------------------------------------------------------------

function tanggalWitaDari(isoWaktu: string): string {
  const d = new Date(isoWaktu);
  if (Number.isNaN(d.getTime())) return tanggalIso(isoWaktu);
  return waktuPengadilan(d).tanggal;
}

function aturanAntrean(
  b: BahanAturan,
  jenis: string[],
  saring: (a: AntreanChecklist) => boolean,
  nomorSipp: Map<string, string> = new Map()
): HasilJenis {
  const calon: Calon[] = [];
  let selesaiHariIni = 0;
  for (const a of b.tambahan.antrean) {
    if (!jenis.includes(a.jenis) || !saring(a)) continue;
    if (a.keadaan === "dikerjakan") {
      if (a.dikerjakanAt && tanggalWitaDari(a.dikerjakanAt) === b.konteks.tanggal) selesaiHariIni += 1;
      continue;
    }
    if (a.keadaan !== "menunggu") continue;
    const disiapkan = tanggalWitaDari(a.disiapkanAt);
    calon.push({
      kunci: a.id,
      perkaraId: a.perkaraId,
      // Nomor dari SIPP bila terbaca - titipan menyimpan nomor saat disiapkan,
      // dan titipan lama dapat menyimpannya kosong.
      nomorPerkara: nomorSipp.get(a.perkaraId) || a.nomorPerkara,
      tenggat: disiapkan ? { tanggal: disiapkan } : null,
      keterangan: `${a.jenis.toUpperCase()} dititipkan ${disiapkan ? tglPendek(disiapkan) : "-"}; tinggal diperiksa lalu ditekan di panel ALETA pada halaman perkara SIPP.`,
    });
  }
  return { calon, selesaiHariIni };
}

// ---------------------------------------------------------------------------
// Tabel aturan
// ---------------------------------------------------------------------------

const JENIS_PERMOHONAN_TUNGGAL = /dispensasi\s+kawin|istbat|isbat|itsbat|perwalian|asal\s+usul/i;

/**
 * Jendela putusan hakim yang naskahnya ditagih, dalam hari ke belakang -
 * sama dengan jendela koleksi putusan hakim di bot (geser(acuan, -7)).
 */
export const HARI_PUTUSAN_BELUM_UNGGAH = 7;

const ATURAN: Record<string, (b: BahanAturan) => HasilJenis> = {
  // ------------------------------------------------------------------ HAKIM
  "hakim.konsep-putusan": (b) => {
    const peta = new Map(koleksi<PerkaraTertentuFakta>(b.fakta, "perkaraTertentu").map((p) => [p.perkaraId, p]));
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const t of b.tambahan.konsep) {
      const p = peta.get(t.perkaraId);
      if (!p) continue;
      if (p.tanggalPutusan) {
        if (p.tanggalPutusan === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      const sasaran = p.sidangMendatang.find((s) => agendaMusyawarah(s.agenda)) ?? p.sidangMendatang[0] ?? null;
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara || t.nomorPerkara,
        tenggat: sasaran ? { tanggal: sasaran.tanggal } : null,
        keterangan:
          `Konseptor sementara ditunjuk ${t.ditetapkanOleh ? `oleh ${t.ditetapkanOleh} ` : ""}` +
          `${t.ditetapkanAt ? `pada ${tglPendek(tanggalWitaDari(t.ditetapkanAt))}` : ""}; ` +
          (sasaran
            ? `sidang ${tglPendek(sasaran.tanggal)}${sasaran.agenda ? ` (${sasaran.agenda})` : ""}.`
            : "belum ada sidang mendatang di SIPP."),
      });
    }
    return { calon, selesaiHariIni };
  },

  "hakim.putusan-belum-unggah": (b) => {
    const { konteks } = b;
    const kemarin = geserTanggal(konteks.tanggal, -1);
    // Sebelumnya hanya hari ini dan kemarin: putusan Jumat tanpa naskah
    // hilang dari daftar pada hari Senin, padahal naskahnya tetap belum ada.
    // Sekarang seluruh jendela yang dibaca bot (HARI_PUTUSAN_BELUM_UNGGAH),
    // dan yang lewat hari pembacaannya masuk kelompok "lewat".
    const awal = geserTanggal(konteks.tanggal, -HARI_PUTUSAN_BELUM_UNGGAH);
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const p of koleksi<PutusanFakta>(b.fakta, "putusan")) {
      if (!memimpin(p.jabatanSaya)) continue;
      if (!p.tanggalPutusan || p.tanggalPutusan < awal || p.tanggalPutusan > konteks.tanggal) continue;
      if (p.adaDok) {
        if (p.tanggalPutusan === konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      const kapan =
        p.tanggalPutusan === konteks.tanggal ? "hari ini" : p.tanggalPutusan === kemarin ? "kemarin" : tglPendek(p.tanggalPutusan);
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: p.tanggalPutusan },
        keterangan: `Dibacakan ${kapan}; dokumen putusan belum ada di SIPP.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "hakim.penetapan-tunggal": (b) => {
    const { konteks } = b;
    const batas = geserTanggal(konteks.tanggal, HARI_MINGGU_INI);
    const pertama = new Map<string, SidangFakta>();
    let selesaiHariIni = 0;
    const selesaiHitung = new Set<string>();
    for (const s of koleksi<SidangFakta>(b.fakta, "sidang")) {
      if (s.alurPerkaraId !== 16 || !JENIS_PERMOHONAN_TUNGGAL.test(s.jenisPerkara) || !memimpin(s.jabatanSaya)) continue;
      if (s.sudahPutus) {
        if (s.tanggalPutusan === konteks.tanggal && !selesaiHitung.has(s.perkaraId)) {
          selesaiHitung.add(s.perkaraId);
          selesaiHariIni += 1;
        }
        continue;
      }
      if (s.tanggalSidang < konteks.tanggal || s.tanggalSidang > batas) continue;
      // Sidang hari ini yang sudah ditunda bukan lagi calon hari penetapan.
      if (s.tanggalSidang === konteks.tanggal && s.ditunda) continue;
      const lama = pertama.get(s.perkaraId);
      if (!lama || s.tanggalSidang < lama.tanggalSidang) pertama.set(s.perkaraId, s);
    }
    const calon: Calon[] = [...pertama.values()].map((s) => ({
      kunci: s.perkaraId,
      perkaraId: s.perkaraId,
      nomorPerkara: s.nomorPerkara,
      tenggat: { tanggal: s.tanggalSidang },
      keterangan:
        `${s.jenisPerkara} · sidang ${tglPendek(s.tanggalSidang)}${s.jamSidang ? ` pukul ${s.jamSidang}` : ""}` +
        `${s.agenda ? ` · agenda ${s.agenda}` : ""}${s.urutan === 1 ? " (sidang pertama)" : ""}.`,
    }));
    return { calon, selesaiHariIni };
  },

  "hakim.phs-menunggu": (b) => {
    const perkara = koleksi<PerkaraTertentuFakta>(b.fakta, "perkaraTertentu");
    const dipimpin = new Set(perkara.filter((p) => memimpin(p.jabatanSaya)).map((p) => p.perkaraId));
    const nomor = new Map(perkara.map((p) => [p.perkaraId, p.nomorPerkara]));
    return aturanAntrean(b, ["phs"], (a) => dipimpin.has(a.perkaraId), nomor);
  },

  "hakim.ecourt-verifikasi": (b) => {
    const bahan = b.fakta.ecourtDokumen as EcourtDokumenFakta | null | undefined;
    if (!bahan || !bahan.segar) {
      return { calon: [], selesaiHariIni: 0, tidakTersedia: "Dokumen e-Court tidak dapat dibaca dari basis data bot." };
    }
    const berhasil = bahan.segar.terakhirBerhasil ? new Date(bahan.segar.terakhirBerhasil) : null;
    const umurJam = berhasil && !Number.isNaN(berhasil.getTime()) ? (b.konteks.kini.getTime() - berhasil.getTime()) / 3_600_000 : null;
    if (umurJam === null || umurJam > BATAS_SEGAR_ECOURT_JAM) {
      return {
        calon: [],
        selesaiHariIni: 0,
        tidakTersedia:
          umurJam === null
            ? "Belum pernah ada tarikan e-Court yang berhasil; status verifikasi tidak dapat dipercaya."
            : `Tarikan e-Court berhasil terakhir ${Math.floor(umurJam)} jam yang lalu (lebih dari ${BATAS_SEGAR_ECOURT_JAM} jam); status verifikasinya mungkin sudah berubah di e-Court.`,
      };
    }
    const calon: Calon[] = bahan.dokumen.map((d) => {
      const diunggah = tanggalIso(d.diunggahPada);
      const tanggal = d.tanggalSidang || diunggah;
      return {
        kunci: d.kunci,
        perkaraId: d.perkaraId || undefined,
        nomorPerkara: d.nomorPerkara,
        tenggat: tanggal ? { tanggal } : null,
        keterangan:
          `${d.jenisDokumen || "Dokumen"}${d.agenda ? ` · agenda ${d.agenda}` : ""}` +
          `${diunggah ? ` · diunggah ${tglPendek(diunggah)}` : ""}${d.tanggalSidang ? ` · sidang ${tglPendek(d.tanggalSidang)}` : ""}.`,
        kerjakan: d.sumberUrl
          ? { tujuan: "ecourt", alamat: d.sumberUrl }
          : { tujuan: "aleta", alamat: ALAMAT_ALETA.verifikasiDokumen },
      };
    });
    return { calon, selesaiHariIni: 0 };
  },

  "hakim.hasil-sidang-belum-dicatat": (b) => aturanHasilSidang(b, (s) => memimpin(s.jabatanSaya), false),

  "hakim.lima-bulan": (b) => aturanLimaBulan(b, (p) => memimpin(p.jabatanSaya), false),

  "hakim.mediasi-30-hari": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const m of koleksi<MediasiFakta>(b.fakta, "mediasi")) {
      if (m.laporanMediator) {
        if (m.laporanMediator === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      if (!m.tenggatPerma) continue;
      calon.push({
        kunci: m.mediasiId,
        perkaraId: m.perkaraId,
        nomorPerkara: m.nomorPerkara,
        tenggat: { tanggal: m.tenggatPerma },
        keterangan:
          `Mediator ditetapkan ${tglPendek(m.penetapanMediator)}` +
          `${m.dimulaiMediasi ? `, mediasi dimulai ${tglPendek(m.dimulaiMediasi)}` : ""}; laporan mediator belum ada ` +
          `(30 hari, dapat diperpanjang 30 hari atas kesepakatan para pihak - perpanjangan tidak tercatat di SIPP).`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "hakim.ikrar-talak": (b) => aturanIkrar(b, (i) => memimpin(i.jabatanSaya)),

  // ----------------------------------------------------- PANITERA PENGGANTI
  "panitera-pengganti.bas-belum": (b) => {
    const { konteks } = b;
    const kemarin = geserTanggal(konteks.tanggal, -1);
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const s of koleksi<SidangFakta>(b.fakta, "sidang")) {
      if (s.tanggalSidang !== konteks.tanggal && s.tanggalSidang !== kemarin) continue;
      if (s.adaBas) {
        if (s.tanggalSidang === konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: s.sidangId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.tanggalSidang },
        keterangan: `Sidang ${s.tanggalSidang === konteks.tanggal ? "hari ini" : "kemarin"}${s.jamSidang ? ` pukul ${s.jamSidang}` : ""}${s.agenda ? ` · agenda ${s.agenda}` : ""}; BAS belum diunggah ke SIPP.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera-pengganti.hasil-sidang-belum-dicatat": (b) => aturanHasilSidang(b, () => true, false),

  "panitera-pengganti.putusan-akhir-belum-diisi": (b) => {
    const { konteks } = b;
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    const terlihat = new Set<string>();
    for (const s of koleksi<PutusTanpaPutusanFakta>(b.fakta, "putusTanpaPutusan")) {
      if (!hasilSidangPutusan(s.ditunda, s.alasanDitunda)) continue;
      if (terlihat.has(s.perkaraId)) continue;
      terlihat.add(s.perkaraId);
      if (s.tanggalPutusan) {
        if (s.diinputPutusan === konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: s.perkaraId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.tanggalSidang },
        keterangan: `Sidang ${tglPendek(s.tanggalSidang)} tercatat "${hasilSidangPutusan(s.ditunda, s.alasanDitunda)}", tetapi blangko Putusan Akhir belum berisi tanggal putusan.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera-pengganti.putusan-belum-unggah": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const p of koleksi<PutusanFakta>(b.fakta, "putusan")) {
      if (p.adaDok && p.adaAnonim) {
        if (p.tanggalPutusan === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      const kurang = [!p.adaDok ? "naskah putusan" : "", !p.adaAnonim ? "anonimisasi" : ""].filter(Boolean).join(" dan ");
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: geserTanggal(p.tanggalPutusan, 2) },
        keterangan: `Putus ${tglPendek(p.tanggalPutusan)}; ${kurang} belum diunggah.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera-pengganti.saksi-belum-lengkap": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const s of koleksi<SaksiFakta>(b.fakta, "saksi")) {
      const kurang = [
        !s.adaJenisIdentitas ? "jenis identitas" : "",
        !s.adaNomorIdentitas ? "nomor identitas" : "",
        !s.adaTelepon ? "telepon" : "",
      ].filter(Boolean);
      if (kurang.length === 0) {
        if (s.diinputTanggal === b.konteks.tanggal || s.pihakDiperbarui === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: s.saksiId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.diinputTanggal },
        keterangan: `Saksi ${SEBUT_SISI[s.sisi] ?? "-"} ke-${s.urutan || "?"} (diinput ${tglPendek(s.diinputTanggal)}): belum ada ${kurang.join(", ")}.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera-pengganti.tunggakan-bas": (b) => {
    const batas = geserTanggal(b.konteks.tanggal, -2);
    const calon: Calon[] = [];
    for (const s of koleksi<SidangFakta>(b.fakta, "sidang")) {
      if (s.tanggalSidang > batas || s.adaBas) continue;
      calon.push({
        kunci: s.sidangId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.tanggalSidang },
        keterangan: `Sidang ${tglPendek(s.tanggalSidang)}${s.agenda ? ` · agenda ${s.agenda}` : ""}; BAS belum ada di SIPP.`,
      });
    }
    return { calon, selesaiHariIni: 0 };
  },

  // --------------------------------------------------------------- JURU SITA
  "jurusita.panggilan-sidang-pertama": (b) => aturanPanggilanJs(b).pertama,
  "jurusita.perintah-panggil-tunda": (b) => aturanPanggilanJs(b).perintah,
  "jurusita.belum-dipanggil-7-hari": (b) => aturanPanggilanJs(b).tujuhHari,
  "jurusita.relaas-belum-diinput": (b) => aturanPanggilanJs(b).belumDiinput,
  "jurusita.pbt-tidak-hadir": (b) => aturanPbt(b).baru,
  "jurusita.tunggakan-pbt-verstek": (b) => aturanPbt(b).tunggakan,

  "jurusita.retur-gagal": (b) => {
    const { konteks } = b;
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    const perPihak = new Set<string>();
    const tertagih = aturanPanggilanJs(b).perkaraTertagih;
    for (const r of koleksi<ReturFakta>(b.fakta, "retur")) {
      if (r.tanggalPutusan) continue;
      if (r.adaSusulan) {
        if (r.susulanDiinput === konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      // Sidang lanjutannya sudah ditagih sebagai panggilan (dengan catatan
      // retur) - satu pekerjaan, satu butir.
      if (r.sidangBerikut && tertagih.has(r.perkaraId)) continue;
      if (perPihak.has(r.relaasId)) continue;
      perPihak.add(r.relaasId);
      const sasaran = r.sidangBerikut || r.tanggalSidang;
      calon.push({
        kunci: r.relaasId,
        perkaraId: r.perkaraId,
        nomorPerkara: r.nomorPerkara,
        tenggat: sasaran ? { tanggal: sasaran } : null,
        keterangan:
          `Relaas${r.tanggalRelaas ? ` ${tglPendek(r.tanggalRelaas)}` : ""} untuk sidang ${tglPendek(r.tanggalSidang)} retur; ` +
          `belum ada relaas susulan${r.sidangBerikut ? `; sidang berikut ${tglPendek(r.sidangBerikut)}` : ""}.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  // ---------------------------------------------------------------- PANITERA
  "panitera.ppp-pjs-menunggu": (b) => aturanAntrean(b, ["ppp", "pjs"], () => true),

  "panitera.direktori-putusan": (b) => {
    const calon: Calon[] = [...aturanDirputGagal(b)];
    for (const f of koleksi<FaktaTenggat>(b.fakta, "penjaga:anonimisasi-hilang")) {
      const tenggat = tenggatPenjaga("anonimisasi-hilang", f);
      if (!tenggat) continue;
      calon.push({
        kunci: `anonim:${f.perkaraId}`,
        perkaraId: String(f.perkaraId),
        nomorPerkara: String(f.nomorPerkara),
        tenggat,
        keterangan: `Putusan tanpa berkas anonimisasi${f.keterangan ? ` · ${f.keterangan}` : ""}.`,
      });
    }
    for (const p of koleksi<PutusanFakta>(b.fakta, "putusan")) {
      if (p.adaDok) continue;
      calon.push({
        kunci: `naskah:${p.perkaraId}`,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: geserTanggal(p.tanggalPutusan, 2) },
        keterangan: `Putus ${tglPendek(p.tanggalPutusan)}; naskah putusan belum diunggah (batas H+2).`,
      });
    }
    return { calon, selesaiHariIni: 0 };
  },

  "panitera.bht-belum-diisi": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const p of koleksi<PutusanFakta>(b.fakta, "putusan")) {
      if (p.tanggalBht) {
        if (p.tanggalBht === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      if (p.tanggalBanding) continue;
      const bht = hariBht(p);
      if (!bht) continue;
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: bht.tanggal },
        keterangan: `Putus ${tglPendek(p.tanggalPutusan)}; ${bht.dasar}; BHT jatuh ${tglPendek(bht.tanggal)} tetapi belum diisi.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera.akta-cerai-belum-terbit": (b) => aturanAkta(b),

  "panitera.arsip-bht": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const a of koleksi<ArsipFakta>(b.fakta, "arsip")) {
      if (a.arsipDiinput) {
        if (a.arsipDiinput === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      if (!a.tanggalBht) continue;
      calon.push({
        kunci: a.perkaraId,
        perkaraId: a.perkaraId,
        nomorPerkara: a.nomorPerkara,
        tenggat: { tanggal: geserTanggal(a.tanggalBht, 5) },
        keterangan: `BHT ${tglPendek(a.tanggalBht)}; belum ada di register arsip.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "panitera.panggilan-belum-patut": (b) => aturanSidangDekatBelumDipanggil(b, true),

  // ------------------------------------------------------------------- KETUA
  "ketua.pmh-hari-ini": (b) => {
    const titipan = new Set(
      b.tambahan.antrean.filter((a) => a.jenis === "pmh" && a.keadaan === "menunggu").map((a) => a.perkaraId)
    );
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const p of koleksi<PmhFakta>(b.fakta, "pmh")) {
      if (p.tanggalPmh) {
        if (p.diinputPmh === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: p.tanggalDaftar },
        keterangan:
          `${p.jenisPerkara ? `${p.jenisPerkara} · ` : ""}terdaftar ${tglPendek(p.tanggalDaftar)}; majelis belum ditetapkan` +
          `${titipan.has(p.perkaraId) ? "; usulan PMH sudah dititipkan di antrean penetapan, tinggal ditekan" : ""}.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "ketua.lima-bulan-per-majelis": (b) => aturanLimaBulan(b, () => true, true),

  "ketua.hasil-sidang-belum-dicatat": (b) => aturanHasilSidang(b, () => true, true),

  "ketua.ikrar-akta": (b) => {
    const ikrar = aturanIkrar(b, () => true);
    const akta = aturanAkta(b);
    return { calon: [...ikrar.calon, ...akta.calon], selesaiHariIni: ikrar.selesaiHariIni + akta.selesaiHariIni };
  },

  "ketua.sidang-terancam-panggilan": (b) => aturanSidangDekatBelumDipanggil(b, true),

  // -------------------------------------------------------------------- PTSP
  "ptsp.ecourt-belum-register": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const e of koleksi<EfilingFakta>(b.fakta, "efiling")) {
      if (e.nomorPerkara) {
        if (e.tanggalDaftar === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      if (!e.tanggalBayar) continue;
      calon.push({
        kunci: e.efilingId,
        tenggat: { tanggal: e.tanggalBayar },
        keterangan:
          `Register e-Court ${e.nomorRegister || "-"}${e.jenisPerkara ? ` · ${e.jenisPerkara}` : ""}; ` +
          `dibayar ${tglPendek(e.tanggalBayar)}, belum bernomor perkara${e.status ? ` (status ${e.status})` : ""}.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "ptsp.panjar-habis": (b) => {
    const calon: Calon[] = [];
    for (const p of koleksi<PanjarFakta>(b.fakta, "panjar")) {
      if (p.transaksi <= 0 || p.saldo === null || p.saldo >= p.ambang) continue;
      calon.push({
        kunci: p.perkaraId,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        tenggat: { tanggal: p.sidangBerikut },
        keterangan: `Sidang ${tglPendek(p.sidangBerikut)}; saldo panjar ${p.saldo <= 0 ? "habis" : rupiah(p.saldo)} (ambang ${rupiah(p.ambang)}).`,
      });
    }
    return { calon, selesaiHariIni: 0 };
  },

  "ptsp.data-umum-belum-lengkap": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const t of koleksi<TeleponFakta>(b.fakta, "telepon")) {
      if (t.teleponLengkap) {
        if (t.tanggalDaftar === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: t.perkaraId,
        perkaraId: t.perkaraId,
        nomorPerkara: t.nomorPerkara,
        tenggat: { tanggal: t.tanggalDaftar },
        keterangan: `Terdaftar ${tglPendek(t.tanggalDaftar)}; nomor telepon pihak pertama belum diisi.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "ptsp.sisa-panjar": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const s of koleksi<SisaPanjarFakta>(b.fakta, "sisaPanjar")) {
      if (s.saldo <= s.ambang) {
        if (s.keluarTerakhir === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: s.perkaraId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomorPerkara,
        tenggat: { tanggal: s.tanggalPutusan },
        keterangan: `Putus ${tglPendek(s.tanggalPutusan)}; sisa panjar ${rupiah(s.saldo)} belum dikembalikan atau dicatat.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "ptsp.akta-belum-unggah": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    for (const a of koleksi<AktaFakta>(b.fakta, "akta")) {
      if (a.adaDok) {
        if (a.tanggalAkta === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      calon.push({
        kunci: a.perkaraId,
        perkaraId: a.perkaraId,
        nomorPerkara: a.nomorPerkara,
        tenggat: { tanggal: geserTanggal(a.tanggalAkta, 1) },
        keterangan: `Akta cerai bertanggal ${tglPendek(a.tanggalAkta)}; dokumen aktanya belum diunggah.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  // ---------------------------------------------------------------- OPERATOR
  "operator.sesi-ecourt": (b) => {
    const e = b.fakta.ecourt as EcourtSegar | null | undefined;
    if (!e) return { calon: [], selesaiHariIni: 0, tidakTersedia: "Keadaan tarikan e-Court tidak dapat dibaca." };
    const { konteks } = b;
    const jam = Number(konteks.jam.slice(0, 2));
    const dalamJamKerja = jam >= e.jamMulai && jam < e.jamSelesai;
    if (!e.jadwalAktif) {
      return {
        calon: [
          {
            kunci: "jadwal-mati",
            tenggat: null,
            keterangan: `Penjadwal tarikan e-Court tidak aktif${e.terakhirBerhasil ? `; tarikan berhasil terakhir ${waktuWitaTeks(e.terakhirBerhasil)}` : ""}.`,
          },
        ],
        selesaiHariIni: 0,
      };
    }
    const batasJam = 2 * Math.max(1, e.jarakJam);
    const berhasil = e.terakhirBerhasil ? new Date(e.terakhirBerhasil) : null;
    const umurJam = berhasil && !Number.isNaN(berhasil.getTime()) ? (konteks.kini.getTime() - berhasil.getTime()) / 3_600_000 : null;
    if (umurJam !== null && umurJam <= batasJam) return { calon: [], selesaiHariIni: 0 };
    if (!dalamJamKerja) return { calon: [], selesaiHariIni: 0 };
    const tenggat = berhasil ? witaDari(new Date(berhasil.getTime() + batasJam * 3_600_000)) : null;
    return {
      calon: [
        {
          kunci: "tarikan-basi",
          tenggat,
          keterangan:
            (berhasil
              ? `Tarikan e-Court berhasil terakhir ${waktuWitaTeks(e.terakhirBerhasil)} (${Math.floor(umurJam ?? 0)} jam lalu; jarak jadwal ${e.jarakJam} jam)`
              : "Belum pernah ada tarikan e-Court yang berhasil") +
            `${e.terakhirDicoba ? `; percobaan terakhir ${waktuWitaTeks(e.terakhirDicoba)}` : ""}. Sesi e-Court kemungkinan habis dan perlu dibuka dengan captcha.`,
        },
      ],
      selesaiHariIni: 0,
    };
  },

  "operator.penetapan-gagal": (b) => {
    const calon: Calon[] = [];
    let selesaiHariIni = 0;
    const perKunci = new Map<string, PenetapanGagalFakta>();
    for (const g of koleksi<PenetapanGagalFakta>(b.fakta, "penetapanGagal")) {
      if (g.berhasilSesudah) {
        if (tanggalWitaDari(g.berhasilSesudah) === b.konteks.tanggal) selesaiHariIni += 1;
        continue;
      }
      // Satu butir per perkara dan jenis - kegagalan yang diulang tiga kali
      // tetap satu pekerjaan.
      perKunci.set(`${g.perkaraId}:${g.jenis}`, g);
    }
    for (const g of perKunci.values()) {
      const tanggal = tanggalWitaDari(g.waktu);
      calon.push({
        kunci: `${g.perkaraId}:${g.jenis}`,
        perkaraId: g.perkaraId && g.perkaraId !== "0" ? g.perkaraId : undefined,
        nomorPerkara: g.nomorPerkara,
        tenggat: tanggal ? { tanggal } : null,
        keterangan: `${g.jenis.toUpperCase()} gagal ditulis ${waktuWitaTeks(g.waktu)}${g.alasan ? ` · ${g.alasan}` : ""}.`,
      });
    }
    return { calon, selesaiHariIni };
  },

  "operator.direktori-gagal": (b) => ({ calon: aturanDirputGagal(b), selesaiHariIni: 0 }),
};

/** Status e-Court yang lebih tua dari ini tidak dipakai menagih verifikasi. */
export const BATAS_SEGAR_ECOURT_JAM = 24;

function witaDari(d: Date): TenggatWita {
  const w = waktuPengadilan(d);
  return { tanggal: w.tanggal, jam: w.jam };
}

function waktuWitaTeks(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const w = waktuPengadilan(d);
  return `${tglPendek(w.tanggal)} ${w.jam.slice(0, 5)} WITA`;
}

/**
 * Hari BHT yang dapat dihitung: putusan + 15 hari bila semua sisi hadir,
 * atau pemberitahuan terakhir kepada sisi yang tidak hadir + 15 hari.
 * null bila kehadiran tidak tercatat atau PBT sisi yang tidak hadir belum
 * ada - BHT-nya belum dapat dihitung, dan itu pekerjaan juru sita.
 *
 * Diukur 2026 (sipp_donggala): selisih BHT - putusan tidak pernah kurang
 * dari 15 hari pada perkara yang semua pihaknya hadir.
 */
export function hariBht(p: PutusanFakta): { tanggal: string; dasar: string } | null {
  const tidakHadir = sisiTidakHadir(p.dihadiriSaatPutus, p.adaPihak2);
  if (tidakHadir === null || !p.tanggalPutusan) return null;
  if (tidakHadir.length === 0) {
    return { tanggal: geserTanggal(p.tanggalPutusan, 15), dasar: "semua pihak hadir saat putusan" };
  }
  const pbt = tidakHadir.map((s) => (s === 1 ? p.pbtPihak1 : p.pbtPihak2));
  if (pbt.some((t) => !t)) return null;
  const terakhir = [...pbt].sort().at(-1) as string;
  return {
    tanggal: geserTanggal(terakhir, 15),
    dasar: `pemberitahuan putusan kepada ${sebutSisi(tidakHadir)} ${tglPendek(terakhir)}`,
  };
}

/** Umur di atas ini, putusan verstek tanpa PBT dihitung tunggakan. */
export const HARI_PBT_BARU = 14;

function aturanPbt(b: BahanAturan): { baru: HasilJenis; tunggakan: HasilJenis } {
  const { konteks } = b;
  const batasBaru = geserTanggal(konteks.tanggal, -HARI_PBT_BARU);
  const baru: HasilJenis = { calon: [], selesaiHariIni: 0 };
  const tunggakan: HasilJenis = { calon: [], selesaiHariIni: 0 };
  for (const p of koleksi<PutusanFakta>(b.fakta, "putusan")) {
    const tidakHadir = sisiTidakHadir(p.dihadiriSaatPutus, p.adaPihak2);
    if (!tidakHadir || tidakHadir.length === 0 || !p.tanggalPutusan) continue;
    // BHT yang sudah terisi berarti prosesnya sudah berjalan terus: PBT-nya
    // kemungkinan dilaksanakan tetapi tidak dicatat. Itu urusan mutu data,
    // bukan pekerjaan yang menahan BHT - diukur di sipp_donggala: puluhan
    // putusan 2025 seperti itu, dan menagihnya membanjiri daftar juru sita
    // dengan pekerjaan setahun lalu.
    if (p.tanggalBht) continue;
    const sasaran = p.verstek && p.tanggalPutusan < batasBaru ? tunggakan : baru;
    const belum: number[] = [];
    for (const s of tidakHadir) {
      const t = s === 1 ? p.pbtPihak1 : p.pbtPihak2;
      if (!t) belum.push(s);
      else if (t === konteks.tanggal) sasaran.selesaiHariIni += 1;
    }
    if (belum.length === 0) continue;
    sasaran.calon.push({
      kunci: p.perkaraId,
      perkaraId: p.perkaraId,
      nomorPerkara: p.nomorPerkara,
      tenggat: { tanggal: geserTanggal(p.tanggalPutusan, 3) },
      keterangan:
        `Putus ${tglPendek(p.tanggalPutusan)}${p.verstek ? " (verstek)" : ""}; pemberitahuan putusan kepada ${sebutSisi(belum)} belum ada; BHT menunggu pemberitahuan ini.`,
    });
  }
  return { baru, tunggakan };
}

/**
 * Empat jenis panggilan juru sita dari satu penyisiran - supaya satu sidang
 * tidak ditagih dua kali di bawah dua nama:
 *
 *   perintah-panggil-tunda  sidang lanjutan dari sidang yang ditunda 'panggil'
 *   panggilan-sidang-pertama sidang urutan 1
 *   relaas-belum-diinput    sidang lain dalam 0-3 hari (batas H-3 lewat)
 *   belum-dipanggil-7-hari  sidang lain dalam 4-7 hari
 */
function aturanPanggilanJs(b: BahanAturan): {
  pertama: HasilJenis;
  perintah: HasilJenis;
  tujuhHari: HasilJenis;
  belumDiinput: HasilJenis;
  /** Perkara yang sidang mendatangnya sudah ditagih di salah satu jenis di atas. */
  perkaraTertagih: Set<string>;
} {
  const { konteks } = b;
  const hasil = {
    pertama: { calon: [], selesaiHariIni: 0 } as HasilJenis,
    perintah: { calon: [], selesaiHariIni: 0 } as HasilJenis,
    tujuhHari: { calon: [], selesaiHariIni: 0 } as HasilJenis,
    belumDiinput: { calon: [], selesaiHariIni: 0 } as HasilJenis,
    perkaraTertagih: new Set<string>(),
  };
  const sidang = koleksi<SidangFakta>(b.fakta, "sidang");
  const ditagih = new Set<string>();
  // Perkara yang panggilan sebelumnya retur tanpa susulan: butir panggilannya
  // membawa catatan itu, dan butir retur-nya sendiri tidak ditagih dua kali
  // (lihat jurusita.retur-gagal).
  const perkaraRetur = new Set(
    koleksi<ReturFakta>(b.fakta, "retur")
      .filter((r) => !r.tanggalPutusan && !r.adaSusulan)
      .map((r) => r.perkaraId)
  );
  const catatanRetur = (perkaraId: string) =>
    perkaraRetur.has(perkaraId) ? " Panggilan sebelumnya retur - periksa alamat atau jalurnya." : "";

  // Gagal-tertutup, sama dengan aturanSidangDekatBelumDipanggil: peta sidang
  // lanjutan atau peta panggilan yang gagal dibaca bot membuat panggilan dan
  // panggilanBerikut kosong - tanpa hitungan ini keempat jenis tampil KOSONG
  // (diukur: juru sita 22 dari 18 butir menjadi 0, tanpa sepatah kata).
  let takPerintah = 0;

  // 1. Perintah panggil dari sidang yang ditunda.
  const awalPerintah = geserTanggal(konteks.tanggal, -7);
  for (const s of sidang) {
    if (s.tanggalSidang < awalPerintah || s.tanggalSidang > konteks.tanggal) continue;
    if (!s.ditunda || !/panggil/i.test(s.alasanDitunda)) continue;
    if (s.berikutTerbaca === false || s.panggilanTerbaca === false) {
      takPerintah += 1;
      continue;
    }
    if (!s.sidangBerikutId || !s.tanggalSidangBerikut || s.tanggalSidangBerikut < konteks.tanggal) continue;
    // Sidang ikrar yang ditunda untuk memanggil: lanjutannya tetap sidang
    // ikrar, dan perkaranya memang sudah putus.
    if (s.sudahPutus && s.sidangBerikutIkrar !== true) continue;
    const p = s.panggilanBerikut;
    if (!p || p.belumDipanggil <= 0) continue;
    if (ditagih.has(s.sidangBerikutId)) continue;
    ditagih.add(s.sidangBerikutId);
    hasil.perkaraTertagih.add(s.perkaraId);
    hasil.perintah.calon.push({
      kunci: s.sidangBerikutId,
      perkaraId: s.perkaraId,
      nomorPerkara: s.nomorPerkara,
      tenggat: { tanggal: geserTanggal(s.tanggalSidangBerikut, -3) },
      keterangan:
        `Ditunda ${tglPendek(s.tanggalSidang)} dengan perintah "${s.alasanDitunda.replace(/\s+/g, " ").slice(0, 80)}"; ` +
        `sidang lanjutan ${tglPendek(s.tanggalSidangBerikut)}: ${sebutSisi(p.sisiBelumDipanggil)} belum punya relaas.` +
        catatanRetur(s.perkaraId),
    });
  }

  // 2-4. Sidang mendatang yang pihak wajibnya belum berelaas.
  const batasTujuh = geserTanggal(konteks.tanggal, HARI_MINGGU_INI);
  const batasTiga = geserTanggal(konteks.tanggal, 3);
  const batasPertama = geserTanggal(konteks.tanggal, 14);
  // Kelompoknya ditentukan tanggal dan urutan sidang - bukan keadaan
  // panggilannya - sehingga sidang yang panggilannya TAK TERBACA pun dapat
  // dihitung pada kelompoknya sendiri.
  const takPer = new Map<HasilJenis, number>();
  for (const s of sidang) {
    if (s.tanggalSidang < konteks.tanggal || !panggilanMasihDitagih(s)) continue;
    const pertama = s.urutan === 1;
    let sasaran: HasilJenis | null;
    if (pertama) sasaran = s.tanggalSidang <= batasPertama ? hasil.pertama : null;
    else if (s.tanggalSidang > batasTujuh) sasaran = null;
    else sasaran = s.tanggalSidang <= batasTiga ? hasil.belumDiinput : hasil.tujuhHari;
    if (!sasaran) continue;
    if (s.panggilanTerbaca === false) {
      takPer.set(sasaran, (takPer.get(sasaran) ?? 0) + 1);
      continue;
    }
    if (!s.panggilan) continue;
    if (s.panggilan.belumDipanggil <= 0 || ditagih.has(s.sidangId)) continue;
    // Sidang hari ini yang sudah berhasil (ditunda/putus) tidak lagi menunggu panggilan.
    if (s.tanggalSidang === konteks.tanggal && (s.ditunda || s.alasanDitunda)) continue;
    const ikrar = sidangIkrar(s) ? " Sidang ikrar talak: suami dan istri dipanggil (Pasal 70 ayat (3) UU 7/1989)." : "";
    ditagih.add(s.sidangId);
    hasil.perkaraTertagih.add(s.perkaraId);
    sasaran.calon.push({
      kunci: s.sidangId,
      perkaraId: s.perkaraId,
      nomorPerkara: s.nomorPerkara,
      tenggat: { tanggal: geserTanggal(s.tanggalSidang, -3) },
      keterangan:
        `${pertama ? "Sidang pertama" : "Sidang"} ${tglPendek(s.tanggalSidang)}${s.jamSidang ? ` pukul ${s.jamSidang}` : ""}: ` +
        `${sebutSisi(s.panggilan.sisiBelumDipanggil)} belum punya relaas di SIPP.${ikrar}${catatanRetur(s.perkaraId)}`,
    });
  }

  const tandaiSidang = (h: HasilJenis) => {
    const n = takPer.get(h) ?? 0;
    return tandaiTakTerbaca(h, n, `Keadaan panggilan (relaas) ${n} sidang mendatang gagal dibaca dari SIPP.`);
  };
  return {
    ...hasil,
    perintah: tandaiTakTerbaca(
      hasil.perintah,
      takPerintah,
      `Sidang lanjutan atau keadaan panggilannya gagal dibaca dari SIPP untuk ${takPerintah} sidang yang ditunda dengan perintah panggil.`
    ),
    pertama: tandaiSidang(hasil.pertama),
    tujuhHari: tandaiSidang(hasil.tujuhHari),
    belumDiinput: tandaiSidang(hasil.belumDiinput),
  };
}

// ============================================================================
// PENYUSUN JAWABAN
// ============================================================================

/**
 * Batas butir per jenis. Sisanya diringkas dalam satu butir "... dan N
 * perkara lain" (perkara null) - dan TETAP dihitung di ringkas, supaya
 * angka tunggakan tidak mengecil hanya karena daftarnya dipotong.
 */
export const BATAS_BUTIR_PER_JENIS = 20;

const URUT_KELOMPOK: Record<Kelompok, number> = { lewat: 0, "hari-ini": 1, "minggu-ini": 2 };

export type MasukanNilai = {
  peran: KunciPeran;
  konteks: KonteksChecklist;
  /** Fakta dari bot; null bila bot tidak dapat dihubungi. */
  fakta: Record<string, unknown> | null;
  /** Koleksi yang gagal dibaca bot, dengan pesannya. */
  gagalKoleksi: Record<string, string>;
  /** Sebab bot tidak terbaca (bila fakta null). */
  galatBot?: string;
  tambahan: TambahanAleta;
  /** Sebab pengguna belum tertaut ke pejabat SIPP untuk peran ini; kosong bila tertaut. */
  sebabTakTertaut: string;
};

export type HasilNilai = {
  butir: ButirChecklist[];
  ringkas: RingkasChecklist;
  jenisTidakTersedia: JenisTakTersedia[];
  galat: string[];
};

export function nilaiChecklist(m: MasukanNilai): HasilNilai {
  const jenisTidakTersedia: JenisTakTersedia[] = [];
  const galat: string[] = [];
  const semua: ButirChecklist[] = [];
  let selesaiHariIni = 0;

  if (m.fakta === null && m.galatBot) galat.push(`Fakta SIPP tidak terbaca: ${m.galatBot}`);
  if (m.sebabTakTertaut) galat.push(m.sebabTakTertaut);
  for (const [nama, pesan] of Object.entries(m.gagalKoleksi)) galat.push(`Koleksi ${nama} gagal dibaca: ${pesan}`);

  const bahan: BahanAturan = { peran: m.peran, konteks: m.konteks, fakta: m.fakta ?? {}, tambahan: m.tambahan };

  for (const jenis of katalogPeran(m.peran)) {
    if (!jenis.tersedia) {
      jenisTidakTersedia.push({ jenis: jenis.kunci, sebab: jenis.sebab });
      continue;
    }
    const sebabTak = sebabTidakDapatDinilai(jenis, m);
    if (sebabTak) {
      jenisTidakTersedia.push({ jenis: jenis.kunci, sebab: sebabTak });
      continue;
    }
    const aturan = ATURAN[jenis.kunci];
    if (!aturan) {
      jenisTidakTersedia.push({ jenis: jenis.kunci, sebab: "Aturannya belum terpasang di portal." });
      continue;
    }
    const hasil = aturan(bahan);
    if (hasil.tidakTersedia) {
      jenisTidakTersedia.push({ jenis: jenis.kunci, sebab: hasil.tidakTersedia });
      continue;
    }
    selesaiHariIni += hasil.selesaiHariIni;
    semua.push(...rapikanJenis(jenis, hasil.calon, m.konteks));
    // Beberapa jenis berbagi satu penyisiran (panggilan juru sita) - kalimat
    // yang sama cukup sekali.
    for (const g of hasil.galat ?? []) if (!galat.includes(g)) galat.push(g);
  }

  const ringkas: RingkasChecklist = {
    lewat: semua.filter((x) => x.kelompok === "lewat").length,
    hariIni: semua.filter((x) => x.kelompok === "hari-ini").length,
    mingguIni: semua.filter((x) => x.kelompok === "minggu-ini").length,
    selesaiHariIni,
    totalHariIni: 0,
  };
  ringkas.totalHariIni = ringkas.lewat + ringkas.hariIni + ringkas.selesaiHariIni;

  return { butir: potongPerJenis(urutkan(semua)), ringkas, jenisTidakTersedia, galat };
}

/** Sebab sebuah jenis tidak dapat dinilai pada jawaban ini, atau "" bila dapat. */
function sebabTidakDapatDinilai(jenis: JenisTersedia, m: MasukanNilai): string {
  if (jenis.butuhPejabat && m.sebabTakTertaut) return m.sebabTakTertaut;
  if (jenis.koleksi.length > 0 && m.fakta === null) {
    return `Fakta SIPP tidak terbaca${m.galatBot ? `: ${m.galatBot}` : ""}.`;
  }
  const gagal = jenis.koleksi.filter((k) => k in m.gagalKoleksi);
  if (gagal.length > 0) return `Koleksi ${gagal.join(", ")} gagal dibaca dari SIPP: ${m.gagalKoleksi[gagal[0]]}`;
  return "";
}

function rapikanJenis(jenis: JenisTersedia, calon: Calon[], konteks: KonteksChecklist): ButirChecklist[] {
  const hasil: ButirChecklist[] = [];
  const terlihat = new Set<string>();
  for (const c of calon) {
    const id = `${jenis.kunci}:${c.kunci}`;
    if (terlihat.has(id)) continue;
    const kelompok = kelompokDari(c.tenggat, konteks, jenis.selaluTampil);
    if (!kelompok) continue;
    terlihat.add(id);
    hasil.push({
      id,
      jenis: jenis.kunci,
      judul: jenis.judul,
      perkara: c.perkaraId ? { id: c.perkaraId, nomor: c.nomorPerkara ?? "" } : null,
      tenggat: c.tenggat ? isoTenggat(c.tenggat) || null : null,
      kelompok,
      keterangan: c.keterangan,
      kerjakan: c.kerjakan ?? jenis.kerjakan,
    });
  }
  return hasil;
}

function urutkan(butir: ButirChecklist[]): ButirChecklist[] {
  const urutJenis = new Map([...PETA_KATALOG.keys()].map((k, i) => [k, i]));
  return [...butir].sort((a, b) => {
    const k = URUT_KELOMPOK[a.kelompok] - URUT_KELOMPOK[b.kelompok];
    if (k !== 0) return k;
    if (a.tenggat !== b.tenggat) {
      if (a.tenggat === null) return 1;
      if (b.tenggat === null) return -1;
      return a.tenggat < b.tenggat ? -1 : 1;
    }
    const j = (urutJenis.get(a.jenis) ?? 0) - (urutJenis.get(b.jenis) ?? 0);
    if (j !== 0) return j;
    return (a.perkara?.nomor ?? "").localeCompare(b.perkara?.nomor ?? "", "id", { numeric: true });
  });
}

/**
 * Potong tiap jenis pada BATAS_BUTIR_PER_JENIS butir terdesak. Yang terpotong
 * diwakili satu butir ringkasan berkelompok paling desak di antaranya.
 */
function potongPerJenis(butir: ButirChecklist[]): ButirChecklist[] {
  const perJenis = new Map<string, ButirChecklist[]>();
  for (const x of butir) {
    const daftar = perJenis.get(x.jenis) ?? [];
    daftar.push(x);
    perJenis.set(x.jenis, daftar);
  }
  const dipotong = new Set<string>();
  const ringkasan: ButirChecklist[] = [];
  for (const [jenis, daftar] of perJenis) {
    if (daftar.length <= BATAS_BUTIR_PER_JENIS) continue;
    const sisa = daftar.slice(BATAS_BUTIR_PER_JENIS);
    for (const x of sisa) dipotong.add(x.id);
    const pertama = sisa[0];
    ringkasan.push({
      id: `${jenis}:lainnya`,
      jenis,
      judul: pertama.judul,
      perkara: null,
      tenggat: pertama.tenggat,
      kelompok: pertama.kelompok,
      keterangan:
        `... dan ${sisa.length} perkara lain untuk pekerjaan yang sama ` +
        `(${sisa.filter((x) => x.kelompok === "lewat").length} lewat tenggat). Daftar di atas memuat ${BATAS_BUTIR_PER_JENIS} yang paling mendesak.`,
      kerjakan: pertama.kerjakan,
    });
  }
  // Butir ringkasan diletakkan TEPAT SESUDAH butir terakhir jenisnya yang
  // masih tampil - bukan diurutkan ulang: tanpa nomor perkara ia akan
  // terselip di tengah butir lain yang tenggatnya sama.
  const tersisa = butir.filter((x) => !dipotong.has(x.id));
  for (const r of ringkasan) {
    let letak = -1;
    tersisa.forEach((x, i) => {
      if (x.jenis === r.jenis) letak = i;
    });
    tersisa.splice(letak + 1, 0, r);
  }
  return tersisa;
}

/** Dibuka untuk uji - menjalankan satu aturan jenis atas bahan tiruan. */
export function jalankanAturan(
  kunci: string,
  bahan: { peran: KunciPeran; konteks: KonteksChecklist; fakta: Record<string, unknown>; tambahan?: Partial<TambahanAleta> }
): HasilJenis {
  const aturan = ATURAN[kunci];
  if (!aturan) throw new Error(`Aturan ${kunci} tidak ada.`);
  return aturan({
    peran: bahan.peran,
    konteks: bahan.konteks,
    fakta: bahan.fakta,
    tambahan: { antrean: bahan.tambahan?.antrean ?? [], konsep: bahan.tambahan?.konsep ?? [] },
  });
}

/** Kunci jenis yang punya aturan - dijaga uji: harus sama dengan jenis katalog yang tersedia. */
export const KUNCI_ATURAN: readonly string[] = Object.keys(ATURAN);

/**
 * Mencocokkan tunjukan konseptor sementara dengan pengguna.
 *
 * Username SIPP (tanpa beda besar-kecil) lebih dulu. Bila tunjukannya tidak
 * menyebut username, nama yang ditulis tangan dibandingkan dengan aturan
 * bandingkanKonseptor - nama dibakukan, gelar dibuang - terhadap nama
 * pengguna ALETA dan nama pejabatnya di SIPP. Tunjukan yang menyebut
 * username ORANG LAIN tidak pernah cocok lewat nama.
 */
export function tunjukanMilikSaya(
  t: Pick<TunjukanKonsep, "nama" | "pengguna">,
  saya: { usernames: string[]; nama: string[] }
): boolean {
  const pengguna = String(t.pengguna ?? "").trim().toLowerCase();
  if (pengguna) return saya.usernames.some((u) => u.trim().toLowerCase() === pengguna);
  if (!String(t.nama ?? "").trim()) return false;
  return saya.nama.some((n) => {
    if (!String(n ?? "").trim()) return false;
    const banding = bandingkanKonseptor({ nama: t.nama }, [{ nama: n }]);
    return banding.adaTunjukan && banding.adaSipp && !banding.berbeda;
  });
}
