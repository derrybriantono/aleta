/**
 * ============================================================================
 * TUNDA & KETERANGAN PUTUS MASSAL PER PANITERA SIDANG (22 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim 22 Okt 2026: menu tunda dan keterangan putus MASSAL yang
 * dipilih per panitera sidang - untuk sidang biasa maupun sidang keliling, dan
 * TIDAK digabung dengan layar antrean.
 *
 * Penulisnya TIDAK baru: tiap perkara dikirim satu kali ke rute yang sama
 * dengan tombol tunda | putus di baris (POST /sidang-tunda dan /sidang-putus):
 * atas akun PP perkara itu, lewat antrean tulis SIPP yang sama, tanpa tulisan
 * ganda. Usulan isian per perkara disusun dengan aturan YANG SAMA dengan menu
 * ringkas di baris (@/lib/bawaan-tunda, @/lib/ikrar-talak) - berkas ini hanya
 * merangkai pemanggilannya.
 *
 * Fungsi murni: dipakai layar dan uji.
 */

import {
  dasarTanggalKosong,
  jamSidangBerikut,
  tambahHari,
  tanggalJamUntuk,
  usulanTundaSidang,
  type KeadaanTundaMin,
  type RiwayatTundaMin,
} from "@/lib/bawaan-tunda";
import { kehadiranDariAntrian, type AntrianSidangRingkas } from "@/lib/antrian-hasil-sidang";
import { bawaanTundaIkrar, peringatanBatasIkrar } from "@/lib/ikrar-talak";
import {
  antrianDariRingkas,
  bahanKehadiranDariKeadaan,
  susunKehadiran,
  usulanDihadiriOleh,
  type KehadiranOrang,
} from "@/lib/kehadiran-rinci";

export type JalanMassal = "tunda" | "putus";

/** Sandi kehadiran SIPP yang sah (lihat hasil-sidang.tsx KEHADIRAN). */
const SANDI_HADIR = new Set([1, 2, 3, 4]);
const HADIR_BAWAAN = 4;

export type KeadaanMassal = KeadaanTundaMin & {
  perkaraId: number | string;
  jamSidang?: string;
  ruanganId?: number;
  ruangan?: string | null;
  sidangKeliling?: string | null;
  tanggalBht?: string | null;
  tanggalPenetapanSidangIkrar?: string | null;
};

export type UsulanBarisMassal = {
  ikrar: boolean;
  dihadiri: number;
  alasan: string;
  agenda: string;
  tanggal: string;
  jam: string;
  /** Peringatan batas 6 bulan ikrar - baris ini tidak boleh disimpan selama terisi. */
  peringatan: string;
  /** Tanggal putus = tanggal SIDANG yang diputus, seperti menu ringkas. */
  tanggalPutus: string;
};

function hadirDariRinci(
  kehadiran: KehadiranOrang[] | null | undefined,
  antrian: AntrianSidangRingkas | null | undefined,
  keadaan: KeadaanMassal
): number | null {
  if (!kehadiran?.length) return null;
  const usul = usulanDihadiriOleh(
    susunKehadiran(kehadiran, antrianDariRingkas(antrian ?? null)),
    bahanKehadiranDariKeadaan(keadaan)
  ).sandi;
  return usul !== null && SANDI_HADIR.has(usul) ? usul : null;
}

/**
 * Usulan isian satu perkara - urutan sama dengan CatatHasilRingkas: kehadiran
 * dari antrian / kehadiran rinci, usulan dari riwayat (Court Calendar bila
 * kedua pihak pernah hadir, selain itu dua pekan; tundaan mediasi 3 minggu),
 * lalu tanggal & jam disusun ulang menurut alasan + agenda. Sidang ikrar
 * talak memakai bawaan ikrar (belum siap / tidak hadir) dan batas 6 bulan.
 *
 * agendaLama: usulan agenda untuk bot lama tanpa riwayat (usulanAgendaBerikut).
 */
export function usulanBarisMassal(
  isi: {
    keadaan: KeadaanMassal;
    riwayat?: RiwayatTundaMin | null;
    antrian?: AntrianSidangRingkas | null;
    kehadiranRinci?: KehadiranOrang[] | null;
  },
  agendaLama: (agenda: string) => string = () => ""
): UsulanBarisMassal {
  const k = isi.keadaan;
  const tgl = String(k.tanggalSidang || "").slice(0, 10);
  const ikrar = String(k.ikrarTalak || "").toUpperCase() === "Y";
  const hadirAntrian = kehadiranDariAntrian(isi.antrian ?? undefined) ?? hadirDariRinci(isi.kehadiranRinci, isi.antrian, k);
  const usul = usulanTundaSidang(k, isi.riwayat ?? null, hadirAntrian);

  let dihadiri = HADIR_BAWAAN;
  let alasan = "";
  let agenda = "";
  let tanggal = tambahHari(tgl, 14);
  let jam = "09:00";
  if (usul) {
    dihadiri = usul.kehadiran;
    alasan = usul.alasan;
    agenda = usul.agenda;
    jam = usul.jam;
    if (usul.tanggal) tanggal = usul.tanggal;
  } else {
    const sudahAda = Number(k.dihadiriOleh);
    if (SANDI_HADIR.has(sudahAda)) dihadiri = sudahAda;
    else if (hadirAntrian) dihadiri = hadirAntrian;
    const a = agendaLama(String(k.agenda || ""));
    if (a) {
      agenda = a;
      jam = jamSidangBerikut(a);
    }
  }

  if (ikrar) {
    const b = bawaanTundaIkrar(dihadiri === 3 || dihadiri === 4 ? "tidak-hadir" : "belum-siap", {
      tanggalSidang: tgl,
      tanggalBht: k.tanggalBht,
      tanggalPenetapanSidangIkrar: k.tanggalPenetapanSidangIkrar,
    });
    return {
      ikrar,
      dihadiri,
      alasan: b.alasan,
      agenda: b.agenda,
      tanggal: b.tanggal,
      jam: b.jam,
      peringatan: peringatanBatasIkrar(b.tanggal, k),
      tanggalPutus: tgl,
    };
  }

  const dasar = usul?.dasar ?? dasarTanggalKosong(tgl);
  const berikut = tanggalJamUntuk(dasar, alasan, agenda, dihadiri);
  return {
    ikrar,
    dihadiri,
    alasan,
    agenda,
    tanggal: berikut.tanggal || tanggal,
    jam: berikut.jam || jam,
    peringatan: "",
    tanggalPutus: tgl,
  };
}

export type IsianBarisMassal = {
  alasan: string;
  agenda: string;
  tanggal: string;
  jam: string;
  dihadiri: number;
  statusId: string;
  verstek: boolean;
  peringatan?: string;
  ikrar?: boolean;
};

/** Baris lengkap untuk disimpan - aturan "lengkap" sama dengan menu ringkas. */
export function barisLengkap(jalan: JalanMassal, isian: IsianBarisMassal): { lengkap: boolean; sebab: string } {
  if (jalan === "tunda") {
    if (isian.peringatan) return { lengkap: false, sebab: isian.peringatan };
    if (!isian.alasan.trim()) return { lengkap: false, sebab: "Alasan tunda belum diisi." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isian.tanggal)) return { lengkap: false, sebab: "Tanggal sidang berikutnya belum diisi." };
    if (!isian.jam) return { lengkap: false, sebab: "Jam sidang berikutnya belum diisi." };
    if (!isian.agenda.trim()) return { lengkap: false, sebab: "Agenda sidang berikutnya belum diisi." };
    return { lengkap: true, sebab: "" };
  }
  if (isian.ikrar) return { lengkap: false, sebab: "Sidang ikrar talak dicatat dari tombol putus di barisnya." };
  if (!isian.statusId) return { lengkap: false, sebab: "Status putusan belum dipilih." };
  return { lengkap: true, sebab: "" };
}

/**
 * Bawaan centang: semua perkara panitera sidang itu yang BELUM diberi hasil
 * (belum ditunda / diputus / ikrar). Pada keterangan putus, sidang ikrar talak
 * tidak dicentang (dicatat dari barisnya - ada form ikrar dan e-Doc).
 */
export function bawaanCentang<T extends { sidangId: string; sidangIkrarTalak?: boolean }>(
  daftar: readonly T[],
  sudahHasil: (b: T) => boolean,
  jalan: JalanMassal
): Set<string> {
  return new Set(
    daftar.filter((b) => !sudahHasil(b) && !(jalan === "putus" && b.sidangIkrarTalak)).map((b) => String(b.sidangId))
  );
}

/** Satu tanggal untuk semua: menimpa tanggal tiap baris yang dicentang. */
export function terapkanTanggalSemua<T extends { tanggal: string }>(
  isian: Readonly<Record<string, T>>,
  terpilih: ReadonlySet<string>,
  tanggal: string
): Record<string, T> {
  const hasil: Record<string, T> = { ...isian };
  for (const id of terpilih) if (hasil[id]) hasil[id] = { ...hasil[id], tanggal };
  return hasil;
}

/** Muatan POST - sama persis bentuknya dengan menu ringkas (CatatHasilRingkas.kirim). */
export function muatanMassal(
  jalan: JalanMassal,
  keadaan: KeadaanMassal,
  isian: IsianBarisMassal,
  ruang: Record<string, number | boolean>
): Record<string, unknown> {
  if (jalan === "tunda") {
    return {
      jadwalId: keadaan.jadwalId,
      perkaraId: keadaan.perkaraId,
      alasanTunda: isian.alasan,
      tanggalBerikut: isian.tanggal,
      jamBerikut: isian.jam,
      jamSekarang: keadaan.jamSidang,
      agendaBerikut: isian.agenda,
      dihadiriOleh: isian.dihadiri,
      ruangId: keadaan.ruanganId,
      ...ruang,
      kering: false,
    };
  }
  return {
    jalur: "sidang",
    jadwalId: keadaan.jadwalId,
    perkaraId: keadaan.perkaraId,
    statusPutusanId: Number(isian.statusId),
    tanggalPutus: String(keadaan.tanggalSidang || "").slice(0, 10),
    verstek: isian.verstek ? "Y" : "T",
    jamSekarang: keadaan.jamSidang,
    dihadiriOleh: isian.dihadiri,
    ruangId: keadaan.ruanganId,
    ...ruang,
    kering: false,
  };
}

export type HasilBarisMassal = {
  sidangId: string;
  nomorPerkara: string;
  keadaan: "berhasil" | "diantrekan" | "gagal" | "dilewati";
  sebab: string;
};

/** Jawaban rute -> hasil satu baris (kalimat untuk orang, bukan kode). */
export function hasilDariJawaban(
  sidangId: string,
  nomorPerkara: string,
  isi: { ok?: boolean; alasan?: string; pesan?: string; diantrekan?: boolean; kering?: boolean } | null | undefined
): HasilBarisMassal {
  if (isi?.ok && isi.kering !== true) {
    return isi.diantrekan
      ? { sidangId, nomorPerkara, keadaan: "diantrekan", sebab: isi.pesan || "Diantrekan - ditulis pada jam kerja berikutnya." }
      : { sidangId, nomorPerkara, keadaan: "berhasil", sebab: "" };
  }
  return { sidangId, nomorPerkara, keadaan: "gagal", sebab: isi?.alasan || isi?.pesan || "Tidak tersimpan." };
}

export function ringkasHasilMassal(hasil: readonly HasilBarisMassal[]): {
  berhasil: number;
  diantrekan: number;
  gagal: number;
  dilewati: number;
  semuaBerhasil: boolean;
  kalimat: string;
} {
  const n = (k: HasilBarisMassal["keadaan"]) => hasil.filter((h) => h.keadaan === k).length;
  const berhasil = n("berhasil");
  const diantrekan = n("diantrekan");
  const gagal = n("gagal");
  const dilewati = n("dilewati");
  const bagian = [
    berhasil ? `${berhasil} tersimpan` : "",
    diantrekan ? `${diantrekan} diantrekan` : "",
    gagal ? `${gagal} gagal` : "",
    dilewati ? `${dilewati} dilewati` : "",
  ].filter(Boolean);
  return {
    berhasil,
    diantrekan,
    gagal,
    dilewati,
    // Tertutup sendiri hanya bila SEMUA tersimpan langsung - yang diantrekan,
    // gagal, atau dilewati harus terbaca dulu.
    semuaBerhasil: hasil.length > 0 && berhasil === hasil.length,
    kalimat: bagian.join(" · ") || "Tidak ada yang disimpan.",
  };
}
