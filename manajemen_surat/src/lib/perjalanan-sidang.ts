/**
 * ============================================================================
 * PERJALANAN SIDANG - UMUR PERKARA PADA TIAP SIDANG
 * ============================================================================
 *
 * Menyusun titik grafik "Umur perkara pada tiap sidang" di layar Status
 * Perkara. Dipisah dari penggambarnya supaya hitungannya dapat diuji tanpa
 * menggambar apa pun.
 *
 * ============================================================================
 * YANG DIGAMBAR HARI YANG DIHITUNG, BUKAN HARI KALENDER
 * ============================================================================
 *
 * Grafik lama menggambar selisih kalender sejak pendaftaran lalu menaruh garis
 * 150 hari di atasnya. "Lama perkara" di kepala layar yang sama sudah lama tidak
 * begitu: hari pendaftaran dihitung hari ke-1 dan hari mediasi dikeluarkan
 * (PERMA 1/2016 Pasal 24) - cara rubrik SK Dirjen Badilag 048/2024 menilainya.
 * Diukur di SIPP satker ini (24 Sep 2026): dari 1.977 perkara putus yang
 * bersidang tiga kali atau lebih, 94 jatuh pada pita yang BERBEDA begitu
 * mediasinya dikeluarkan. Layar yang menyebut satu perkara hijau di kepalanya
 * dan kuning di grafiknya tidak dapat dipercaya kedua-duanya.
 *
 * Potongan mediasi DITEMPATKAN PADA TANGGALNYA: sidang sebelum mediasi tidak
 * dipotong apa pun, sidang di tengah mediasi dipotong sebanyak hari mediasi yang
 * sudah berjalan, sidang sesudahnya dipotong penuh. Jumlahnya dijepit ke
 * hariMediasi - angka yang dipotong kepala layar, tidak dihitung ulang di sini.
 * Rentangnya dimulai_mediasi sampai tgl_laporan_mediator, ujung yang sama dengan
 * v_durasi_mediasi (terukur: 0 dari 750 perkara berbeda). Karena itu titik pada
 * hari putusan sama persis dengan "Lama perkara".
 *
 * ============================================================================
 * SIDANG SESUDAH PUTUSAN TIDAK DIGAMBAR - TETAPI DISEBUT
 * ============================================================================
 *
 * Jadwal SIPP ikut memuat sidang ikrar talak, yang dapat ditunda enam bulan.
 * Itu bukan jangka penyelesaian perkara - SEMA 2/2014 berhenti pada putusan.
 * Terukur: 94 dari 158 perkara yang tampak melewati 150 hari pada grafik lama
 * melewatinya HANYA karena sidang sesudah putusan.
 *
 * ============================================================================
 * "SIDANG KE-" ADALAH NOMOR SIPP, BUKAN POSISI TITIK
 * ============================================================================
 *
 * Titik menyebut perkara_jadwal_sidang.urutan - nomor yang dicetak SIPP,
 * disebut di BAS, dan tertulis di tepi kiri daftar Perjalanan sidang tepat di
 * atas grafik ini. Posisi titik hanya cadangan untuk bot lama yang belum
 * mengirim nomornya. Menomori menurut posisi akan berselisih dengan daftar di
 * atasnya begitu satu sidang tidak digambar (tanggal tak terbaca), dan
 * menyebut "sidang ke-3" untuk sidang yang di BAS-nya tertulis ke-4.
 */

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const SEHARI = 86400000;

function waktuTanggal(iso: string | undefined): number | null {
  const teks = String(iso || "");
  if (!POLA_TANGGAL.test(teks)) return null;
  const waktu = Date.parse(`${teks}T00:00:00Z`);
  return Number.isNaN(waktu) ? null : waktu;
}

/** Selisih hari kalender dua tanggal YYYY-MM-DD; null bila salah satunya tak terbaca. */
export function selisihHariKalender(dari: string, sampai: string): number | null {
  const a = waktuTanggal(dari);
  const b = waktuTanggal(sampai);
  if (a === null || b === null) return null;
  return Math.round((b - a) / SEHARI);
}

/** Dibaca dari Status["jadwal"]; ruas lain boleh ikut dan diabaikan. */
export type SidangPerjalanan = {
  sidangId: string;
  tanggalSidang: string;
  agenda: string;
  ditunda: boolean;
  alasanDitunda: string;
  /**
   * perkara_jadwal_sidang.urutan - nomor sidang SIPP. Nol atau tidak ada:
   * bot lama; posisinya di antara yang digambar dipakai sebagai cadangan.
   */
  urutanSidang?: number;
};

/** Dibaca dari Status["mediasi"]["baris"]. */
export type MediasiPerjalanan = {
  tanggalMulai: string;
  /** dimulai_mediasi - ujung awal yang dipakai v_durasi_mediasi. */
  tanggalDimulaiTercatat?: string;
  /** tgl_laporan_mediator - ujung akhir yang dipakai v_durasi_mediasi. */
  tanggalLaporan: string;
  tanggalSelesai: string;
};

export type TitikPerjalanan = {
  kunci: string;
  /**
   * Sidang ke-berapa. Nomor sidang SIPP (urutanSidang) bila dikirim bot;
   * posisinya di antara yang digambar, mulai dari 1, bila tidak.
   */
  ke: number;
  tanggal: string;
  agenda: string;
  /**
   * Alasan sidang INI ditunda - yang menerangkan jeda ke sidang BERIKUTNYA.
   * Sama dengan bot (analisaPerkaraService.susunJedaSidang).
   */
  alasanTunda: string;
  /** alasan_ditunda pada sidang yang TIDAK ditunda, mis. "putus DIKABULKAN". */
  keterangan: string;
  hariKalender: number;
  potonganMediasi: number;
  /** Yang digambar: hari kalender + 1 (hari pendaftaran) - potongan mediasi. */
  hari: number;
  /** Hari kalender dari sidang sebelumnya; null pada sidang pertama. */
  jeda: number | null;
  akanDatang: boolean;
  hariPutus: boolean;
};

export type RentangMediasi = { mulai: string; selesai: string; hari: number; tanpaLaporan: boolean };

export type PerjalananSidang = {
  titik: TitikPerjalanan[];
  rentangMediasi: RentangMediasi[];
  hariMediasi: number;
  /** Sidang sesudah putusan (ikrar talak dan sejenisnya) yang tidak digambar. */
  sesudahPutus: number;
  /** Sidang bertanggal tak terbaca atau sebelum pendaftaran - salah catat. */
  tanpaTanggal: number;
  /** Ada hari mediasi yang dipotong kepala layar, tetapi rentangnya tak terbaca. */
  potonganTakTerletak: boolean;
  /** Rentang terbaca tetapi lamanya nol/tak terbaca - diarsir, tidak dipotong. */
  mediasiTakTerpotong: boolean;
};

/** Nomor sidang SIPP yang sah, atau 0 bila tidak dikirim. */
function nomorSipp(s: SidangPerjalanan): number {
  const n = Number(s.urutanSidang);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function susunPerjalananSidang(masuk: {
  tanggalDaftar: string;
  /** Kosong bila belum putus. */
  tanggalPutusan: string;
  /** status.umur.hariMediasi - angka yang SAMA dengan yang dipotong "Lama perkara". */
  hariMediasi: number;
  jadwal: SidangPerjalanan[];
  mediasi: MediasiPerjalanan[];
  /** YYYY-MM-DD menurut jam peramban. */
  hariIni: string;
}): PerjalananSidang | null {
  const daftar = masuk.tanggalDaftar;
  if (waktuTanggal(daftar) === null) return null;

  const putus = waktuTanggal(masuk.tanggalPutusan) === null ? "" : masuk.tanggalPutusan;
  const ujung = putus || masuk.hariIni;
  const hariMediasi = Math.max(0, Number(masuk.hariMediasi) || 0);

  // Baris kembar - tanggal mulai sama - menerangkan mediasi yang SAMA; yang
  // berujung menang atas yang menggantung. Aturan yang sama dengan
  // hariMediasiBersih di bot (sippJadwalSidangService.js), supaya arsiran di
  // layar ini tidak berselisih dengan umur di Antrian Sidang.
  const perMulai = new Map<string, string[]>();
  for (const m of masuk.mediasi || []) {
    const mulai = [m.tanggalDimulaiTercatat, m.tanggalMulai].find((x) => waktuTanggal(x) !== null);
    if (!mulai) continue;
    const laporan = [m.tanggalLaporan, m.tanggalSelesai].find((x) => waktuTanggal(x) !== null);
    const kelompok = perMulai.get(mulai) || [];
    if (laporan) kelompok.push(laporan);
    perMulai.set(mulai, kelompok);
  }

  const mentah: Array<{ mulai: string; selesai: string; tanpaLaporan: boolean }> = [];
  for (const [mulaiMentah, laporan] of perMulai) {
    const tanpaLaporan = laporan.length === 0;
    // Yang menggantung berjalan sampai putusan atau hari ini - sama dengan
    // v_durasi_mediasi, yang memakai NOW() untuk laporan kosong.
    const selesaiMentah = tanpaLaporan ? ujung : laporan.reduce((a, b) => (b > a ? b : a));
    // Dijepit ke umur perkaranya sendiri.
    const mulai = mulaiMentah > daftar ? mulaiMentah : daftar;
    const selesai = selesaiMentah < ujung ? selesaiMentah : ujung;
    if (selesai <= mulai) continue;
    mentah.push({ mulai, selesai, tanpaLaporan });
  }
  mentah.sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0));

  // Yang bertindih DISATUKAN, tidak dijumlah - satu hari tidak dipotong dua kali.
  const satu: Array<{ mulai: string; selesai: string; tanpaLaporan: boolean }> = [];
  for (const r of mentah) {
    const akhir = satu[satu.length - 1];
    if (akhir && r.mulai <= akhir.selesai) {
      if (r.selesai > akhir.selesai) akhir.selesai = r.selesai;
      akhir.tanpaLaporan = akhir.tanpaLaporan || r.tanpaLaporan;
    } else {
      satu.push({ ...r });
    }
  }
  const rentangMediasi: RentangMediasi[] = satu.map((r) => ({
    ...r,
    hari: selisihHariKalender(r.mulai, r.selesai) ?? 0,
  }));

  /** Hari mediasi yang sudah berjalan sampai tanggal itu. */
  const mediasiSampai = (tanggal: string) => {
    let hari = 0;
    for (const r of rentangMediasi) {
      if (tanggal <= r.mulai) break;
      hari += Math.max(0, selisihHariKalender(r.mulai, tanggal < r.selesai ? tanggal : r.selesai) ?? 0);
    }
    return hari;
  };

  const potonganTakTerletak = hariMediasi > 0 && rentangMediasi.length === 0;

  // Diurutkan menurut tanggal - sumbu mendatarnya perjalanan waktu. Dua sidang
  // pada hari yang SAMA dipecah menurut nomor SIPP-nya bila keduanya bernomor
  // (terukur pada dua perkara PA Donggala: jamnya tercatat terbalik terhadap
  // nomornya), supaya "ke-" di bawah sumbu tidak pernah menurun. Tanpa nomor,
  // sort yang stabil mempertahankan urutan jam dari bot.
  const urut = [...(masuk.jadwal || [])].sort((a, b) => {
    if (a.tanggalSidang !== b.tanggalSidang) return a.tanggalSidang < b.tanggalSidang ? -1 : 1;
    const na = nomorSipp(a);
    const nb = nomorSipp(b);
    return na > 0 && nb > 0 ? na - nb : 0;
  });

  let tanpaTanggal = 0;
  let sesudahPutus = 0;
  const titik: TitikPerjalanan[] = [];
  for (const s of urut) {
    const hariKalender = selisihHariKalender(daftar, s.tanggalSidang);
    if (hariKalender === null || hariKalender < 0) {
      tanpaTanggal += 1;
      continue;
    }
    if (putus && s.tanggalSidang > putus) {
      sesudahPutus += 1;
      continue;
    }
    const potonganMediasi = potonganTakTerletak
      ? 0
      : Math.min(hariMediasi, mediasiSampai(s.tanggalSidang), hariKalender);
    const sebelum = titik[titik.length - 1];
    const alasan = String(s.alasanDitunda || "").trim();
    titik.push({
      kunci: s.sidangId || `${s.tanggalSidang}-${titik.length}`,
      ke: nomorSipp(s) || titik.length + 1,
      tanggal: s.tanggalSidang,
      agenda: String(s.agenda || "").trim(),
      alasanTunda: s.ditunda ? alasan : "",
      keterangan: s.ditunda ? "" : alasan,
      hariKalender,
      potonganMediasi,
      hari: hariKalender + 1 - potonganMediasi,
      jeda: sebelum ? selisihHariKalender(sebelum.tanggal, s.tanggalSidang) : null,
      akanDatang: !putus && s.tanggalSidang >= masuk.hariIni,
      hariPutus: Boolean(putus) && s.tanggalSidang === putus,
    });
  }

  return {
    titik,
    rentangMediasi,
    hariMediasi,
    sesudahPutus,
    tanpaTanggal,
    potonganTakTerletak,
    mediasiTakTerpotong: hariMediasi === 0 && rentangMediasi.length > 0,
  };
}
