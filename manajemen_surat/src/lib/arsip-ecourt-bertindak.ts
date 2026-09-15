/**
 * ============================================================================
 * AGEN ARSIP e-COURT BERTINDAK (TAHAP 5) - RENCANANYA
 * ============================================================================
 *
 * Empat agen sebelumnya membaca, menilai, dan mengusulkan. Yang ini BERTINDAK:
 * ia menarik ulang berkas arsip yang catatannya ada tetapi bendanya hilang.
 *
 * ============================================================================
 * KEADAAN YANG MELAHIRKANNYA - DIUKUR DI PELADEN, 15 SEPTEMBER 2026
 * ============================================================================
 *
 *   aleta_bot_ecourt_files   400 baris tercatat
 *   ada di cakram              0
 *   hilang                   400
 *
 * Seluruhnya. Contoh yang hilang:
 *   /usr/src/app/data/ecourt/487-Pdt.G-2026-PA.Dgl/Dokumen Bukti__4a532e94.pdf
 *
 * Sebabnya bukan penghapusan. Berkasnya diunduh KE DALAM lapisan peti, sebelum
 * volume ecourt-docs dipasang; begitu peti dibangun ulang, lapisan itu musnah
 * dan catatannya tinggal. Volumenya kini SUDAH ada:
 *
 *   /var/www/html/aleta-data/ecourt-docs -> /usr/src/app/data/ecourt
 *
 * tetapi tidak ada yang pernah menarik ulang isinya.
 *
 * ============================================================================
 * SATU PEMERIKSAAN YANG MEMBEDAKAN AGEN INI DARI PENGUNDUH BIASA
 * ============================================================================
 *
 * Sebelum menarik satu berkas pun, ia memastikan TUJUANNYA BERTAHAN.
 *
 * Menarik ulang 400 berkas ke direktori yang tidak di-mount adalah pekerjaan
 * yang menghapus dirinya sendiri: ia berhasil, catatannya diperbarui, dan
 * musnah pada pembangunan peti berikutnya - lalu diulang lagi bulan depan
 * oleh orang yang tidak tahu bahwa ini sudah pernah dikerjakan.
 *
 * Itulah yang sudah terjadi sekali di sini. Agen yang tidak memeriksanya akan
 * mengulanginya dengan lebih rajin.
 *
 * ============================================================================
 * YANG TIDAK PERNAH DIKERJAKANNYA
 * ============================================================================
 *
 *   - tidak menghapus apa pun, dari cakram maupun dari catatan
 *   - tidak menyentuh SIPP sama sekali
 *   - tidak menarik berkas yang catatannya tidak ada (itu penarikan baru,
 *     pekerjaan penjadwal arsip, bukan pemulihan)
 *
 * Pemulihan mengembalikan yang HILANG. Ia bukan penarikan, dan mencampur
 * keduanya membuat "memulihkan" berarti "mengunduh apa saja".
 */

/** Berapa berkas ditarik dalam satu jalan. */
export const BATAS_SEKALI_JALAN = 50;

export type BerkasArsip = {
  id: string;
  nomorPerkara: string;
  jalurBerkas: string;
  sumberUrl: string;
  adaDiCakram: boolean;
  ukuranByte: number | null;
};

export type FaktaArsip = {
  /** Direktori akar arsip, mis. /usr/src/app/data/ecourt. */
  akar: string;
  /** Benar bila akar itu benar-benar volume yang bertahan antar pembangunan. */
  akarBertahan: boolean;
  /** Alasan bila tidak bertahan - disebut apa adanya, bukan disembunyikan. */
  alasanTidakBertahan?: string;
  berkas: BerkasArsip[];
};

export type Tindakan = {
  id: string;
  nomorPerkara: string;
  jalurBerkas: string;
  sumberUrl: string;
};

export type RencanaArsip = {
  akar: string;
  tercatat: number;
  ada: number;
  hilang: number;
  /** Yang akan ditarik pada jalan ini - dibatasi BATAS_SEKALI_JALAN. */
  tindakan: Tindakan[];
  sisaSesudahIni: number;
  /** Hanya benar bila akarnya bertahan DAN ada yang perlu ditarik. */
  amanDijalankan: boolean;
  /** Kalimat yang dibaca orang. Selalu terisi, termasuk saat tidak aman. */
  alasan: string;
};

/**
 * Menyusun rencana pemulihan.
 *
 * TIDAK MENARIK APA PUN. Ia hanya memutuskan apa yang pantas ditarik dan
 * apakah menariknya sekarang ada gunanya - pemisahan yang sama dengan tiga
 * agen sebelumnya, dan di sini ia lebih penting lagi: rencana yang dapat
 * dibaca lebih dahulu adalah rencana yang dapat dibatalkan.
 */
export function rencanaPemulihan(fakta: FaktaArsip, batas = BATAS_SEKALI_JALAN): RencanaArsip {
  const tercatat = fakta.berkas.length;
  const hilangSemua = fakta.berkas.filter((b) => !b.adaDiCakram);
  const ada = tercatat - hilangSemua.length;

  // Yang tidak punya sumber tidak dapat ditarik ulang, dan menyebutnya sebagai
  // "akan ditarik" adalah janji yang pasti gagal.
  const dapatDitarik = hilangSemua.filter((b) => b.sumberUrl.trim() && b.jalurBerkas.trim());

  if (!fakta.akarBertahan) {
    return {
      akar: fakta.akar,
      tercatat,
      ada,
      hilang: hilangSemua.length,
      tindakan: [],
      sisaSesudahIni: hilangSemua.length,
      amanDijalankan: false,
      alasan:
        `Tidak dijalankan: ${fakta.akar} tidak bertahan antar pembangunan peti` +
        `${fakta.alasanTidakBertahan ? ` (${fakta.alasanTidakBertahan})` : ""}. ` +
        "Menarik ulang ke sana adalah pekerjaan yang menghapus dirinya sendiri - " +
        "itulah yang sudah terjadi sekali pada 400 berkas ini. Pasang volumenya dahulu.",
    };
  }

  if (hilangSemua.length === 0) {
    return {
      akar: fakta.akar,
      tercatat,
      ada,
      hilang: 0,
      tindakan: [],
      sisaSesudahIni: 0,
      amanDijalankan: false,
      alasan: `Tidak ada yang perlu dipulihkan - ${tercatat} berkas tercatat, seluruhnya ada di cakram.`,
    };
  }

  const tindakan = dapatDitarik.slice(0, batas).map((b) => ({
    id: b.id,
    nomorPerkara: b.nomorPerkara,
    jalurBerkas: b.jalurBerkas,
    sumberUrl: b.sumberUrl,
  }));

  const tanpaSumber = hilangSemua.length - dapatDitarik.length;
  const catatanSumber =
    tanpaSumber > 0
      ? ` ${tanpaSumber} di antaranya tidak punya alamat sumber dan tidak dapat ditarik ulang.`
      : "";

  return {
    akar: fakta.akar,
    tercatat,
    ada,
    hilang: hilangSemua.length,
    tindakan,
    sisaSesudahIni: hilangSemua.length - tindakan.length,
    amanDijalankan: tindakan.length > 0,
    alasan:
      `${hilangSemua.length} dari ${tercatat} berkas arsip hilang dari cakram.` +
      `${catatanSumber} Akan ditarik ulang ${tindakan.length} pada jalan ini` +
      `${hilangSemua.length - tindakan.length > 0 ? `, sisa ${hilangSemua.length - tindakan.length} pada jalan berikutnya` : ""}.`,
  };
}

export type HasilJalan = {
  diminta: number;
  berhasil: number;
  gagal: number;
  /** Sebab gagal per berkas - disebut, tidak diringkas menjadi satu angka. */
  sebabGagal: { nomorPerkara: string; sebab: string }[];
};

/** Kalimat penutup sesudah satu jalan pemulihan - untuk layar dan catatan. */
export function ringkasJalan(rencana: RencanaArsip, hasil: HasilJalan): string {
  if (!rencana.amanDijalankan) return rencana.alasan;
  const pokok = `${hasil.berhasil} dari ${hasil.diminta} berkas berhasil ditarik ulang.`;
  const sisa =
    rencana.sisaSesudahIni > 0 ? ` Sisa ${rencana.sisaSesudahIni} menunggu jalan berikutnya.` : "";
  if (hasil.gagal === 0) return `${pokok}${sisa}`;
  // Sebab gagal yang pertama disebut utuh. Angka tanpa sebab menyuruh orang
  // membuka log; sebab tanpa angka menyembunyikan seberapa luas.
  const contoh = hasil.sebabGagal[0];
  return (
    `${pokok} ${hasil.gagal} gagal` +
    `${contoh ? ` - ${contoh.nomorPerkara}: ${contoh.sebab}` : ""}.${sisa}`
  );
}
