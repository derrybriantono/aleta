/**
 * TENGGANG PANGGILAN (bagian G2 yang benar-benar dapat dihitung).
 *
 * ============================================================================
 * ANGKA TENGGANGNYA DATANG DARI LUAR, BUKAN DARI BERKAS INI
 * ============================================================================
 *
 * Berapa hari sebelum sidang panggilan harus sampai adalah aturan hukum, dan
 * aturan hukum tidak ditulis sebagai angka di dalam kode. Yang dikerjakan
 * berkas ini hanyalah menghitung selisihnya - persis pekerjaan yang mesin
 * kerjakan lebih teliti daripada manusia, dan persis pekerjaan yang paling
 * sering keliru bila dikerjakan dengan jari di kalender.
 *
 * Pemanggil menyediakan angkanya beserta jangkar pasalnya. Bila angkanya tidak
 * disediakan, hasilnya "belum dapat diperiksa" - bukan angka bawaan. Angka
 * bawaan pada pemeriksaan hukum adalah kekeliruan yang tidak pernah terlihat:
 * ia benar pada kebanyakan perkara, dan pada perkara yang jalur panggilannya
 * berbeda ia meloloskan panggilan yang tidak sah.
 *
 * ============================================================================
 * HARI KERJA DAN HARI KALENDER BUKAN HAL YANG SAMA
 * ============================================================================
 *
 * Sebagian tenggang dihitung hari kerja, sebagian hari kalender. Selisihnya
 * kecil pada hari biasa dan besar pada minggu berlibur - dan perkara yang
 * panggilannya jatuh di sekitar libur panjang justru perkara yang paling
 * mungkin ditunda, sehingga kekeliruannya berulang.
 *
 * Hari libur TIDAK ditebak. Daftarnya diberikan pemanggil; bila kosong, yang
 * dikecualikan hanya Sabtu dan Minggu, dan hasilnya menyebut bahwa hari libur
 * nasional belum diperhitungkan.
 */

export type Relaas = {
  pihak: string;
  /** Tanggal panggilan disampaikan - bukan tanggal surat dibuat. */
  tanggalPanggilan: string;
  tanggalSidang: string;
  /** Jalur panggilan: menentukan tenggang mana yang berlaku. */
  jalur?: string;
  /** Panggilan elektronik baru sah bila diterima; kosong berarti belum diketahui. */
  diterima?: boolean | null;
};

export type TenggangJalur = {
  jalur: string;
  /** Sekurangnya sekian hari sebelum sidang. */
  hari: number;
  hariKerja: boolean;
  /** Jalur ini menuntut bukti penerimaan. */
  perluDiterima: boolean;
  /** Alamat pasal di pustaka hukum. */
  jangkar: string;
};

export type HasilPanggilan = {
  pihak: string;
  jalur: string;
  selisih: number;
  satuan: "hari kerja" | "hari kalender";
  dituntut: number;
  keadaan: "patut" | "tidakPatut" | "belumDapatDiperiksa";
  keterangan: string;
  jangkar: string;
};

const SEHARI = 24 * 60 * 60 * 1000;

function keTanggal(nilai: unknown): Date | null {
  const teks = String(nilai ?? "").trim();
  if (!teks) return null;
  // Dibaca sebagai UTC supaya zona waktu mesin tidak menggeser tanggalnya -
  // pergeseran satu hari di sini mengubah panggilan yang patut menjadi tidak.
  const cocok = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (cocok) {
    return new Date(Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])));
  }
  const parsed = new Date(teks);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function kunciTanggal(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10);
}

/** Selisih hari kalender, tidak menghitung hari panggilan itu sendiri. */
export function selisihHariKalender(dari: unknown, sampai: unknown): number | null {
  const awal = keTanggal(dari);
  const akhir = keTanggal(sampai);
  if (!awal || !akhir) return null;
  return Math.round((akhir.getTime() - awal.getTime()) / SEHARI);
}

/**
 * Selisih hari kerja, tidak menghitung hari panggilan itu sendiri.
 *
 * Sabtu dan Minggu selalu dikecualikan. Hari libur nasional dikecualikan hanya
 * bila daftarnya diberikan - menebaknya akan menghasilkan tenggang yang salah
 * setiap tahun, karena tanggalnya berpindah.
 */
export function selisihHariKerja(dari: unknown, sampai: unknown, liburan: string[] = []): number | null {
  const awal = keTanggal(dari);
  const akhir = keTanggal(sampai);
  if (!awal || !akhir) return null;
  if (akhir.getTime() <= awal.getTime()) {
    return Math.round((akhir.getTime() - awal.getTime()) / SEHARI);
  }

  const libur = new Set(liburan.map((item) => String(item ?? "").slice(0, 10)).filter(Boolean));
  let hitung = 0;
  const jalan = new Date(awal.getTime());

  while (jalan.getTime() < akhir.getTime()) {
    jalan.setUTCDate(jalan.getUTCDate() + 1);
    const hari = jalan.getUTCDay();
    if (hari === 0 || hari === 6) continue;
    if (libur.has(kunciTanggal(jalan))) continue;
    hitung += 1;
  }
  return hitung;
}

/**
 * Memeriksa kepatutan satu panggilan.
 *
 * Panggilan yang tanggalnya SESUDAH tanggal sidang tidak dinyatakan "kurang
 * sekian hari" melainkan tidak patut dengan sebab yang jelas: selisih negatif
 * yang dibaca sebagai angka kecil akan lolos pada aturan yang hanya
 * membandingkan besarnya.
 */
export function periksaPanggilan(
  relaas: Relaas,
  tenggang: TenggangJalur[],
  liburan: string[] = []
): HasilPanggilan {
  const pihak = String(relaas.pihak ?? "").trim() || "(pihak tanpa nama)";
  const jalur = String(relaas.jalur ?? "").trim() || "biasa";
  const aturan = (tenggang ?? []).find((item) => item.jalur.toLowerCase() === jalur.toLowerCase());

  const kosong = (keterangan: string): HasilPanggilan => ({
    pihak,
    jalur,
    selisih: 0,
    satuan: "hari kalender",
    dituntut: 0,
    keadaan: "belumDapatDiperiksa",
    keterangan,
    jangkar: aturan?.jangkar ?? "",
  });

  if (!aturan) return kosong(`Tenggang untuk jalur "${jalur}" belum disetel.`);
  if (!relaas.tanggalPanggilan) return kosong("Tanggal penyampaian panggilan belum tercatat.");
  if (!relaas.tanggalSidang) return kosong("Tanggal sidang belum tercatat.");

  const satuan: HasilPanggilan["satuan"] = aturan.hariKerja ? "hari kerja" : "hari kalender";
  const selisih = aturan.hariKerja
    ? selisihHariKerja(relaas.tanggalPanggilan, relaas.tanggalSidang, liburan)
    : selisihHariKalender(relaas.tanggalPanggilan, relaas.tanggalSidang);

  if (selisih === null) return kosong("Tanggal panggilan atau tanggal sidang tidak terbaca.");

  const dasar = { pihak, jalur, selisih, satuan, dituntut: aturan.hari, jangkar: aturan.jangkar };

  if (selisih < 0) {
    return {
      ...dasar,
      keadaan: "tidakPatut",
      keterangan: `Panggilan disampaikan SESUDAH hari sidang, terpaut ${Math.abs(selisih)} hari.`,
    };
  }

  if (aturan.perluDiterima) {
    if (relaas.diterima === null || relaas.diterima === undefined) {
      return { ...dasar, keadaan: "belumDapatDiperiksa", keterangan: "Bukti penerimaan panggilan belum tercatat." };
    }
    if (!relaas.diterima) {
      return {
        ...dasar,
        keadaan: "tidakPatut",
        keterangan: `Panggilan jalur ${jalur} belum diterima, sehingga belum sah meskipun terpaut ${selisih} ${satuan}.`,
      };
    }
  }

  if (selisih < aturan.hari) {
    return {
      ...dasar,
      keadaan: "tidakPatut",
      keterangan: `Terpaut ${selisih} ${satuan}, sekurangnya ${aturan.hari}.`,
    };
  }

  return { ...dasar, keadaan: "patut", keterangan: `Terpaut ${selisih} ${satuan}, sekurangnya ${aturan.hari}.` };
}

export type HasilVerstek = {
  layak: boolean;
  keadaan: "layak" | "tidakLayak" | "belumDapatDiperiksa";
  sebab: string[];
};

/**
 * Kelayakan verstek.
 *
 * Verstek bukan sekadar "tergugat tidak hadir". Ia menuntut tergugat sudah
 * dipanggil dengan patut DAN ketidakhadirannya tanpa alasan yang sah. Menilai
 * kelayakannya hanya dari kehadiran adalah kekeliruan yang paling mudah
 * dilakukan mesin, karena kehadiran satu-satunya yang tercatat rapi.
 *
 * Panggilan yang belum dapat diperiksa TIDAK dibaca sebagai panggilan yang
 * patut. Verstek yang dijatuhkan atas panggilan yang ternyata tidak sah
 * dibatalkan di tingkat banding, dan perkaranya diulang dari awal.
 */
export function periksaVerstek(masukan: {
  tergugatHadir: boolean | null | undefined;
  panggilan: HasilPanggilan[];
  /** Alasan sah yang tercatat - kosong berarti tidak ada, null berarti belum diperiksa. */
  alasanTidakHadir?: string | null;
}): HasilVerstek {
  const sebab: string[] = [];

  if (masukan.tergugatHadir === null || masukan.tergugatHadir === undefined) {
    return { layak: false, keadaan: "belumDapatDiperiksa", sebab: ["Kehadiran Tergugat belum tercatat."] };
  }
  if (masukan.tergugatHadir) {
    return { layak: false, keadaan: "tidakLayak", sebab: ["Tergugat hadir, sehingga verstek tidak berlaku."] };
  }

  const panggilanTergugat = (masukan.panggilan ?? []).filter((item) =>
    /tergugat|termohon/i.test(item.pihak)
  );

  if (!panggilanTergugat.length) {
    return { layak: false, keadaan: "belumDapatDiperiksa", sebab: ["Tidak ada relaas panggilan Tergugat."] };
  }

  const tertunda = panggilanTergugat.filter((item) => item.keadaan === "belumDapatDiperiksa");
  const tidakPatut = panggilanTergugat.filter((item) => item.keadaan === "tidakPatut");

  for (const item of tidakPatut) sebab.push(`Panggilan ${item.pihak}: ${item.keterangan}`);
  for (const item of tertunda) sebab.push(`Panggilan ${item.pihak}: ${item.keterangan}`);

  if (masukan.alasanTidakHadir === null || masukan.alasanTidakHadir === undefined) {
    sebab.push("Belum tercatat apakah ketidakhadiran Tergugat beralasan sah.");
    return { layak: false, keadaan: "belumDapatDiperiksa", sebab };
  }
  if (String(masukan.alasanTidakHadir).trim()) {
    sebab.push(`Ketidakhadiran Tergugat beralasan: ${String(masukan.alasanTidakHadir).trim()}`);
    return { layak: false, keadaan: "tidakLayak", sebab };
  }

  if (tidakPatut.length) return { layak: false, keadaan: "tidakLayak", sebab };
  if (tertunda.length) return { layak: false, keadaan: "belumDapatDiperiksa", sebab };

  return {
    layak: true,
    keadaan: "layak",
    sebab: [`Tergugat dipanggil patut pada ${panggilanTergugat.length} relaas dan tidak hadir tanpa alasan.`],
  };
}
