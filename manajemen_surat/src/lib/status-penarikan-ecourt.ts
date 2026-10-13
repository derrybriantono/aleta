/**
 * Status penarikan data e-Court di dasbor ALETA e-Court (13 Okt 2026, butir 12).
 *
 * Bentuk datanya dari bot (GET /ecourt/penarikan/status, lewat
 * /api/aleta-ecourt/penarikan?bagian=status). Fungsi di sini MURNI: mengubah
 * satu penarikan / keadaan menjadi kalimat dan nada lencana, supaya diuji
 * tanpa merender.
 */

export type HasilPenarikan = "berhasil" | "gagal" | "sesi-habis" | "berjalan" | "terputus";

export type RingkasPenarikan = {
  nama: string;
  mulai: string;
  selesai: string;
  sumber: string;
  labelSumber: string;
  otomatis: boolean;
  jenis: "berkala" | "perkara";
  perkara: string;
  akun: string;
  labelAkun: string;
  hasil: HasilPenarikan;
  sebab: string;
  perkaraDiperiksa: number | null;
  dokumenTerlihat: number | null;
  dokumenBaru: number | null;
  berkasTerunduh: number | null;
  galat: number | null;
};

export type AkunUtama = {
  slot: string;
  label: string;
  dipilih: boolean;
  sah: boolean;
  bawaan: boolean;
  alasan: string;
  pesan: string;
};

export type StatusPenarikan = {
  dibaca: string;
  akunUtama: AkunUtama;
  penjadwal: {
    aktif: boolean;
    aktifTersimpan: boolean;
    selaluAktif: boolean;
    jarakJam: number | null;
    jamMulai: number | null;
    jamSelesai: number | null;
    dalamJamKerja: boolean;
    sedangJalan: boolean;
    sumberBerjalan: string;
    perkaraBerjalan: string;
    akunBerjalan: string;
    berikutnya: string | null;
    zonaWaktu: string;
  };
  verifikasiHarian: {
    menyala: boolean;
    detakBerikutnya: string | null;
    terakhirPutaran: string;
    tersambung: boolean;
    alasan: string;
    jumlahTarik: number;
  } | null;
  terakhirBerkala: RingkasPenarikan | null;
  terakhirPerkara: RingkasPenarikan | null;
  riwayat: RingkasPenarikan[];
  sesi: { berlaku: boolean | null; pada: string; sumber: string };
};

export type Nada = "success" | "warning" | "danger" | "muted";

export const LABEL_HASIL: Record<HasilPenarikan, string> = {
  berhasil: "berhasil",
  gagal: "gagal",
  "sesi-habis": "sesi habis",
  berjalan: "sedang berjalan",
  terputus: "terputus",
};

export const NADA_HASIL: Record<HasilPenarikan, Nada> = {
  berhasil: "success",
  gagal: "danger",
  "sesi-habis": "danger",
  berjalan: "warning",
  terputus: "warning",
};

/** "12 Okt 16.35 WITA" - zona pengadilan, bukan zona peramban. */
export function waktuPendek(iso: string | null | undefined, zona = "Asia/Makassar"): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  try {
    const b: Record<string, string> = {};
    for (const x of new Intl.DateTimeFormat("id-ID", {
      timeZone: zona,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(t)) {
      b[x.type] = x.value;
    }
    const singkat = zona === "Asia/Makassar" ? " WITA" : zona === "Asia/Jakarta" ? " WIB" : zona === "Asia/Jayapura" ? " WIT" : "";
    return `${b.day} ${b.month} ${b.hour}.${b.minute}${singkat}`;
  } catch {
    return t.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** "2 perkara diperiksa · 3 dokumen baru" - angka yang tidak terbaca dilewati. */
export function angkaPenarikan(r: RingkasPenarikan): string {
  const bagian: string[] = [];
  if (r.perkaraDiperiksa !== null) bagian.push(`${r.perkaraDiperiksa} perkara diperiksa`);
  if (r.dokumenBaru !== null) bagian.push(`${r.dokumenBaru} dokumen baru`);
  if (r.berkasTerunduh) bagian.push(`${r.berkasTerunduh} berkas terunduh`);
  return bagian.join(" · ");
}

/** Satu kalimat untuk satu penarikan. */
export function kalimatPenarikan(r: RingkasPenarikan | null, zona?: string): string {
  if (!r) return "Belum ada catatan penarikan.";
  const siapa = r.perkara ? `${r.labelSumber}, ${r.perkara}` : r.labelSumber;
  const akun = r.labelAkun || r.akun ? ` · akun ${r.labelAkun || r.akun}` : "";
  const angka = angkaPenarikan(r);
  const sebab = r.sebab ? ` - ${r.sebab}` : "";
  return `${waktuPendek(r.mulai, zona)} (${siapa})${akun}: ${LABEL_HASIL[r.hasil]}${angka ? ` · ${angka}` : ""}${sebab}`;
}

/** Keadaan sesi e-Court dalam satu frasa + nadanya. */
export function keadaanSesi(sesi: StatusPenarikan["sesi"], zona?: string): { teks: string; nada: Nada } {
  if (sesi.berlaku === true) {
    return { teks: `Sesi e-Court aktif (${sesi.sumber}, ${waktuPendek(sesi.pada, zona)})`, nada: "success" };
  }
  if (sesi.berlaku === false) {
    return { teks: `Sesi e-Court TIDAK aktif (${sesi.sumber}, ${waktuPendek(sesi.pada, zona)}) - perlu login ulang`, nada: "danger" };
  }
  return { teks: "Sesi e-Court belum diperiksa", nada: "muted" };
}

/** Kalimat jadwal tarikan berikutnya. */
export function kalimatBerikutnya(s: StatusPenarikan): string {
  const z = s.penjadwal.zonaWaktu || undefined;
  if (!s.penjadwal.aktif) return "Penarikan berkala tidak menyala.";
  const bagian = [
    s.penjadwal.berikutnya ? `Berkala berikutnya ${waktuPendek(s.penjadwal.berikutnya, z)}` : "Berkala berikutnya belum terjadwal",
  ];
  if (s.verifikasiHarian?.menyala && s.verifikasiHarian.detakBerikutnya) {
    bagian.push(`pemeriksaan sidang hari ini berikutnya ${waktuPendek(s.verifikasiHarian.detakBerikutnya, z)}`);
  }
  return `${bagian.join("; ")}.`;
}

/** Peringatan yang patut ditampilkan di atas kartu - [] bila tidak ada. */
export function peringatanPenarikan(s: StatusPenarikan): string[] {
  const hasil: string[] = [];
  if (!s.akunUtama.sah) hasil.push(s.akunUtama.pesan || "Akun utama penarikan belum sah.");
  if (!s.penjadwal.aktif) hasil.push("Penarikan otomatis tidak berjalan - dokumen baru di e-Court tidak ditarik sendiri.");
  if (s.sesi.berlaku === false) hasil.push("Sesi e-Court akun utama habis - login ulang di Integrasi e-Court.");
  const terakhir = [s.terakhirBerkala, s.terakhirPerkara]
    .filter((r): r is RingkasPenarikan => Boolean(r))
    .sort((a, b) => (a.mulai < b.mulai ? 1 : -1))[0];
  if (terakhir && (terakhir.hasil === "gagal" || terakhir.hasil === "terputus")) {
    hasil.push(`Penarikan terakhir ${LABEL_HASIL[terakhir.hasil]}${terakhir.sebab ? `: ${terakhir.sebab}` : ""}.`);
  }
  return hasil;
}
