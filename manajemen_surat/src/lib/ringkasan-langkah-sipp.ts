/**
 * ============================================================================
 * RINGKASAN LANGKAH TULIS SIPP - KALIMAT AWAM (18 Okt 2026)
 * ============================================================================
 *
 * Bot menjawab penulisan ke SIPP sebagai daftar langkah {tabel, aksi, keterangan}.
 * Itu bahan untuk pengembang dan uji; petugas tidak perlu membaca nama tabel,
 * kata UPDATE/CALL, atau baris catatan sistem. Berkas ini menerjemahkannya
 * menjadi kalimat awam untuk layar Jadwal Sidang (tunda, putus, penetapan
 * kembali, penunjukan mediator).
 *
 * Aturan:
 *   - baris catatan sistem (tabel berawalan "sys_") TIDAK ditampilkan sama sekali;
 *   - nama tabel diganti sebutan yang dikenal petugas ("Jadwal sidang", "Putusan");
 *   - tabel yang tidak dikenal disebut "Data perkara", bukan nama tabelnya.
 *
 * Nama tabel tetap dipakai di kode dan di data jawaban; hanya TEKS TAMPIL yang
 * berubah.
 */

export type LangkahTulisSipp = { tabel?: string; aksi?: string; keterangan?: string };

const SEBUTAN_TABEL: Readonly<Record<string, string>> = {
  perkara_jadwal_sidang: "Jadwal sidang",
  perkara_putusan: "Putusan",
  perkara_proses: "Riwayat perkara",
  perkara: "Perkara",
  perkara_ikrar_talak: "Form ikrar talak",
  perkara_akta_cerai: "Akta cerai",
  perkara_data_pernikahan: "Data pernikahan",
  perkara_penetapan: "Penetapan",
  perkara_hakim_pn: "Majelis hakim",
  perkara_panitera_pn: "Panitera pengganti",
  perkara_jurusita: "Juru sita",
  perkara_mediasi: "Mediasi",
  perkara_mediator: "Mediator",
};

/** Catatan sistem (audit) bukan urusan petugas: tidak ditampilkan. */
export function langkahUntukPetugas<T extends LangkahTulisSipp>(langkah: ReadonlyArray<T> | null | undefined): T[] {
  return (langkah ?? []).filter((l) => !/^sys_/i.test(String(l.tabel ?? "")));
}

export function sebutanTabel(tabel: string | null | undefined): string {
  return SEBUTAN_TABEL[String(tabel ?? "")] ?? "Data perkara";
}

const KATA_AKSI: Readonly<Record<string, string>> = {
  UPDATE: "diperbarui",
  INSERT: "ditambahkan",
  DELETE: "dihapus",
  CALL: "diperbarui",
};

/**
 * Keterangan satu langkah dari bot, dibersihkan untuk dibaca petugas: baris catatan sistem
 * ("catatan audit ...") dibuang (hasilnya kosong), nomor urut internal ("#12") dan nama
 * prosedur dihilangkan.
 */
export function keteranganAwam(keterangan: string | null | undefined): string {
  const k = String(keterangan ?? "").replace(/\s+/g, " ").trim();
  if (/^catatan audit/i.test(k)) return "";
  return k
    .replace(/\bset_jurusita SIPP:\s*/i, "")
    .replace(/\s#\d+/g, "")
    .trim();
}

/** Satu langkah menjadi satu kalimat, atau null untuk catatan sistem. */
export function kalimatLangkah(l: LangkahTulisSipp): string | null {
  if (/^sys_/i.test(String(l.tabel ?? ""))) return null;
  const label = sebutanTabel(l.tabel);
  let ket = keteranganAwam(l.keterangan);
  // "putusan 12/Pdt.G/2026/PA.X - Cerai Talak" di bawah label "Putusan": awalan yang sama tidak diulang.
  const awal = label.toLowerCase();
  if (ket.toLowerCase().startsWith(awal)) ket = ket.slice(awal.length).replace(/^[\s:.-]+/, "");
  if (!ket) return `${label} ${KATA_AKSI[String(l.aksi ?? "").toUpperCase()] ?? "diperbarui"}`;
  return `${label}: ${ket}`;
}

/** Sebutan tabel yang tersentuh, tanpa pengulangan dan tanpa catatan sistem: "Jadwal sidang, Putusan". */
export function ringkasTabel(langkah: ReadonlyArray<LangkahTulisSipp> | null | undefined): string {
  return Array.from(new Set(langkahUntukPetugas(langkah).map((l) => sebutanTabel(l.tabel)))).join(", ");
}
