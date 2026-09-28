import { pitaJarak } from "@/lib/jarak-antar-sidang";

/**
 * ============================================================================
 * TIGA JARAK WAKTU SATU SIDANG
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: jarak waktu "antara perkara yang
 * sebelumnya dengan perkara yang berjalan dengan perkara selanjutnya masih
 * bingung dalam menghitungnya". Yang tampil sebelumnya dua lencana tanpa nama
 * - "+12" dan "→8" - dan keduanya jarak antar-PANGGILAN, sehingga yang membaca
 * harus menebak sendiri mana yang berarti lamanya sidang dan mana jeda dari
 * perkara lain.
 *
 * Gantinya tiga angka BERNAMA, masing-masing menjawab satu pertanyaan:
 *
 *   Tunggu           sejak pihak mengambil nomor antrian (yang terawal di
 *                    antara kedua sisi) sampai perkaranya dipanggil masuk
 *   Dari sebelumnya  sejak perkara SEBELUMNYA di ruang yang sama dipanggil
 *                    sampai perkara ini dipanggil
 *   Lama sidang      sejak perkara ini dipanggil sampai perkara BERIKUTNYA
 *                    di ruang yang sama dipanggil
 *
 * "Dari sebelumnya" milik perkara ini SAMA dengan "Lama sidang" milik perkara
 * sebelumnya - keduanya jarak yang sama dilihat dari dua sisi. Itu disengaja:
 * yang satu dibaca orang yang menaksir giliran, yang lain orang yang menilai
 * lamanya persidangan, dan keduanya kini dapat diperiksa silang.
 *
 * ============================================================================
 * SATU BASIS WAKTU: JAM APLIKASI ANTRIAN
 * ============================================================================
 *
 * Seluruh waktu di sini berbentuk "YYYY-MM-DD HH:MM:SS" menurut jam dinding
 * server antrian (NOW() lokalnya, WITA) - dikirim bot apa adanya, diformat di
 * SQL supaya tidak tergeser zona waktu di jalan. Semuanya dibaca dengan
 * pembaca yang SAMA (bacaWaktu, sebagai UTC), sehingga selisihnya tepat
 * walau angka mutlaknya bukan UTC sungguhan: yang dipakai hanya bedanya.
 *
 * Waktu ALETA (UTC, toMysqlDate) TIDAK PERNAH masuk ke sini. Mengurangkan
 * dua basis waktu menghasilkan selisih delapan jam tanpa satu pun galat -
 * peringatan itu sudah tertulis di kehadiranAntrianService.
 *
 * Jam komputer petugas pun tidak dipakai sebagai patokan: yang sedang
 * berjalan dihitung dari "sekarang" menurut basis data antrian yang dikirim
 * bersama datanya, ditambah waktu yang berlalu sejak data itu diterima - lihat
 * komponen tiga-jarak-sidang.tsx.
 *
 * ============================================================================
 * PER RUANG, MENURUT WAKTU PANGGIL, ATAS SELURUH PERKARA HARI ITU
 * ============================================================================
 *
 * Dua ruang sidang berjalan bersamaan; menghitungnya sebagai satu deret
 * menghasilkan jeda satu menit yang tidak pernah terjadi di ruang mana pun.
 *
 * Dan dihitung atas SELURUH baris antrian hari itu - bukan atas baris yang
 * sedang tampil. Keluhan 23 September 2026 lahir tepat dari situ: "→35" dan
 * "+4" pada dua baris berurutan tampak bertengkar karena ada perkara ketiga
 * di antaranya yang sedang tersaring. Angka yang berubah karena tabelnya
 * disaring bukan angka tentang sidang.
 */

/** Satu baris waktu antrian, sebagaimana dikirim bot (rekaman + langsung). */
export type BarisWaktuAntrian = {
  tanggalSidang: string;
  perkaraId: string;
  nomorAntrian: number | null;
  noRuang: number | null;
  ruanganId: number | null;
  majelisKode?: string;
  /** "YYYY-MM-DD HH:MM:SS" basis antrian; kosong bila sisi itu belum mengambil. */
  ambilPihak1: string;
  ambilPihak2: string;
  ambilSaksi: string;
  /** Yang terawal di antara pihak 1 dan pihak 2 - dasar nomor antrian. */
  ambilTerawal: string;
  /** jam_sidang yang terlihat SEBELUM dipanggil, "HH:MM:SS"; kosong bila tak teramati. */
  jamJadwal: string;
  /** Panggilan pertama yang TERAMATI - bukan tentu panggilan pertama sungguhan. */
  panggilPertama: string;
  /** Panggilan terakhir - inilah "waktu sidang"-nya. */
  panggilTerakhir: string;
  jumlahPanggil: number;
  online: boolean | null;
  namaPetugas: string;
  sumber: "rekaman" | "langsung" | "gabungan";
};

/** Keadaan waktu antrian yang dikirim bersama jadwal sidang. */
export type WaktuAntrian = {
  /** Sekurang-kurangnya satu sumber (rekaman bot atau aplikasi antrian) terbaca. */
  terbaca: boolean;
  alasan: string;
  /** NOW() menurut basis data antrian saat dibaca; kosong bila tidak terbaca. */
  sekarang: string;
  /** CURDATE() menurut basis data antrian - penentu "hari ini". */
  hariIni: string;
  langsungTerbaca: boolean;
  rekamanTerbaca: boolean;
  baris: BarisWaktuAntrian[];
};

export const WAKTU_ANTRIAN_KOSONG: WaktuAntrian = {
  terbaca: false,
  alasan: "",
  sekarang: "",
  hariIni: "",
  langsungTerbaca: false,
  rekamanTerbaca: false,
  baris: [],
};

/**
 * selesai          angkanya sudah tetap
 * berjalan         masih dihitung - berdetak di layar
 * kosong           memang tidak ada pertanyaannya (belum ambil, belum dipanggil,
 *                  perkara pertama di ruangnya)
 * tidak-diketahui  ada pertanyaannya, tetapi tidak ada data yang menjawabnya
 * janggal          datanya bertentangan (selisih negatif) - TIDAK dipaksa nol
 */
export type KeadaanJarak = "selesai" | "berjalan" | "kosong" | "tidak-diketahui" | "janggal";

export type TetanggaJarak = {
  perkaraId: string;
  nomorAntrian: number | null;
  waktuPanggil: string;
};

export type Jarak = {
  keadaan: KeadaanJarak;
  /** Detik - hanya bila selesai. */
  detik: number | null;
  /** Saat mulai (ms, dibaca bacaWaktu) - hanya bila berjalan. */
  mulaiMs: number | null;
  /** Kedua ujung yang dipakai, apa adanya - disebut di title supaya dapat diperiksa. */
  dari: string;
  sampai: string;
  /** Perkara pembanding untuk "dari sebelumnya" dan "lama sidang". */
  tetangga: TetanggaJarak | null;
  /** Mengapa kosong, tidak diketahui, atau janggal - kalimat untuk title. */
  sebab: string;
};

export type TigaJarak = {
  kunci: string;
  /** Sebutan ruang untuk title - "Ruang 1", atau ruangan SIPP bila antrian tak menyebutnya. */
  ruang: string;
  /** Keberapa perkara ini dipanggil di ruangnya hari itu; null bila belum dipanggil. */
  urutanRuang: number | null;
  hariIni: boolean;
  tunggu: Jarak;
  dariSebelumnya: Jarak;
  lamaSidang: Jarak;
};

/** Kunci satu baris waktu: tanggal DAN perkara - satu perkara bersidang berkali-kali. */
export function kunciWaktu(tanggalSidang: string, perkaraId: string): string {
  return `${String(tanggalSidang || "").trim()}|${String(perkaraId || "").trim()}`;
}

/**
 * "YYYY-MM-DD HH:MM:SS" menjadi milidetik, DIBACA SEBAGAI UTC.
 *
 * Bukan karena waktunya UTC - ia jam dinding WITA - melainkan supaya semua
 * waktu dibaca dengan cara yang sama persis. new Date("2026-09-27 09:00:00")
 * dibaca sebagai waktu LOKAL peramban, dan itu berbeda di tiap komputer.
 */
export function bacaWaktu(teks: string | null | undefined): number | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(teks || "").trim());
  if (!cocok) return null;
  const [, th, bl, hr, jm, mn, dt] = cocok;
  const ms = Date.UTC(Number(th), Number(bl) - 1, Number(hr), Number(jm), Number(mn), Number(dt || 0));
  return Number.isFinite(ms) ? ms : null;
}

/** "HH:MM:SS" dari "YYYY-MM-DD HH:MM:SS" - untuk title. */
export function jamDari(teks: string | null | undefined): string {
  const cocok = /(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(teks || ""));
  if (!cocok) return "";
  return `${cocok[1]}:${cocok[2]}:${cocok[3] || "00"}`;
}

/**
 * Durasi selesai: "45 detik", "12 menit", "1 jam 5 menit".
 *
 * Menitnya DIBULATKAN KE BAWAH, sama dengan jam berjalan: yang berdetak
 * "12:50" lalu berhenti harus terbaca "12 menit", bukan "13 menit" - angka
 * yang naik sendiri pada saat berhenti terbaca sebagai hitungan yang salah.
 */
export function sebutanDurasi(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  if (d < 60) return `${d} detik`;
  const menit = Math.floor(d / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
}

/**
 * Durasi selesai dalam bentuk RINGKAS untuk pil di kolom Antrian: "45d",
 * "12m", "1j 19m", "2j".
 *
 * Diminta pengguna 28 September 2026: "1 jam 19 menit" di dalam lencana
 * bulat melipat menjadi tiga baris dan memaksa kolom Antrian/Jam melebar.
 * Pembulatannya SAMA dengan sebutanDurasi - ke bawah - supaya kedua bentuk
 * tidak pernah menyebut angka yang berbeda untuk jarak yang sama. Bentuk
 * lengkapnya tetap ada di title (sebutanDurasiLengkap).
 */
export function sebutanDurasiRingkas(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  if (d < 60) return `${d}d`;
  const menit = Math.floor(d / 60);
  if (menit < 60) return `${menit}m`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam}j` : `${jam}j ${sisa}m`;
}

/** Durasi lengkap sampai detiknya - untuk title, tempat orang memeriksa. */
export function sebutanDurasiLengkap(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  const jam = Math.floor(d / 3600);
  const menit = Math.floor((d % 3600) / 60);
  const sisa = d % 60;
  const bagian: string[] = [];
  if (jam) bagian.push(`${jam} jam`);
  if (menit) bagian.push(`${menit} menit`);
  if (sisa || bagian.length === 0) bagian.push(`${sisa} detik`);
  return bagian.join(" ");
}

/** Jam berjalan: "mm:dd" di bawah sejam, "j:mm:dd" di atasnya. */
export function jamBerjalan(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  const jam = Math.floor(d / 3600);
  const menit = Math.floor((d % 3600) / 60);
  const sisa = d % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  return jam > 0 ? `${jam}:${dua(menit)}:${dua(sisa)}` : `${dua(menit)}:${dua(sisa)}`;
}

/**
 * Pita warna "Tunggu" - netral di bawah ambang menunggu.
 *
 * Ambangnya DIKIRIM pemanggil, tidak ditulis di sini: layar jadwal sudah
 * punya AMBANG_MENUNGGU_MENIT (40, keputusan pengguna 22 September 2026) dan
 * penanda "menunggu lama" memakainya. Dua tetapan dengan nama yang sama di
 * dua berkas akan berselisih pada hari salah satunya diubah.
 *
 * Di atas ambang warnanya pita jarak yang sudah ada - merah sampai 60 menit,
 * merah gelap sesudahnya - sama persis dengan penanda "menunggu lama", supaya
 * angka yang sama tidak berwarna dua di satu layar.
 */
export function pitaTunggu(menit: number, ambangMenit: number) {
  if (!Number.isFinite(menit) || menit < 0) return null;
  return menit >= ambangMenit ? pitaJarak(menit) : null;
}

/** Pita "Dari sebelumnya" dan "Lama sidang" - pita jarak antar-panggilan yang terukur. */
export function pitaAntarPanggilan(menit: number) {
  return pitaJarak(menit);
}

function jarakKosong(sebab: string): Jarak {
  return { keadaan: "kosong", detik: null, mulaiMs: null, dari: "", sampai: "", tetangga: null, sebab };
}

function jarakTakDiketahui(sebab: string, dari = ""): Jarak {
  return { keadaan: "tidak-diketahui", detik: null, mulaiMs: null, dari, sampai: "", tetangga: null, sebab };
}

/** Selisih dua waktu; negatif menjadi "janggal", tidak pernah dipaksa nol. */
function jarakSelesai(
  dari: string,
  sampai: string,
  tetangga: TetanggaJarak | null,
  sebabJanggal: string
): Jarak {
  const a = bacaWaktu(dari);
  const b = bacaWaktu(sampai);
  if (a === null || b === null) return jarakTakDiketahui("Waktunya tidak terbaca.", dari);
  const detik = Math.round((b - a) / 1000);
  if (detik < 0) {
    return { keadaan: "janggal", detik: null, mulaiMs: null, dari, sampai, tetangga, sebab: sebabJanggal };
  }
  return { keadaan: "selesai", detik, mulaiMs: null, dari, sampai, tetangga, sebab: "" };
}

function jarakBerjalan(dari: string, sebab: string): Jarak {
  const mulai = bacaWaktu(dari);
  if (mulai === null) return jarakTakDiketahui("Waktunya tidak terbaca.", dari);
  return { keadaan: "berjalan", detik: null, mulaiMs: mulai, dari, sampai: "", tetangga: null, sebab };
}

function angkaRuang(nilai: number | null | undefined): number | null {
  if (nilai === null || nilai === undefined) return null;
  const n = Number(nilai);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Ruang satu baris - kunci pengelompokan dan sebutannya.
 *
 * Nomor ruang dari APLIKASI ANTRIAN didahulukan: di sanalah perkara itu
 * dipanggil. Ruangan SIPP hanya cadangan bagi baris yang aplikasi antriannya
 * tidak menyebut ruang sama sekali.
 */
function ruangBaris(baris: BarisWaktuAntrian, ruangSipp?: string): { kunci: string; sebutan: string } {
  const no = angkaRuang(baris.noRuang);
  if (no !== null) return { kunci: `no:${no}`, sebutan: `Ruang ${no}` };
  const id = angkaRuang(baris.ruanganId);
  if (id !== null) return { kunci: `id:${id}`, sebutan: ruangSipp || `ruangan ${id}` };
  const sipp = String(ruangSipp || "").trim();
  if (sipp) return { kunci: `sipp:${sipp.toLowerCase()}`, sebutan: sipp };
  return { kunci: "tanpa-ruang", sebutan: "ruang yang tidak tercatat" };
}

/** Pengurut deret satu ruang: waktu panggil, lalu nomor antrian, lalu perkara. */
function bandingkanPanggil(
  a: { ms: number; baris: BarisWaktuAntrian },
  b: { ms: number; baris: BarisWaktuAntrian }
): number {
  if (a.ms !== b.ms) return a.ms - b.ms;
  const na = a.baris.nomorAntrian ?? Number.POSITIVE_INFINITY;
  const nb = b.baris.nomorAntrian ?? Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  return String(a.baris.perkaraId).localeCompare(String(b.baris.perkaraId), "id", { numeric: true });
}

function tetanggaDari(baris: BarisWaktuAntrian): TetanggaJarak {
  return {
    perkaraId: String(baris.perkaraId),
    nomorAntrian: typeof baris.nomorAntrian === "number" ? baris.nomorAntrian : null,
    waktuPanggil: baris.panggilTerakhir,
  };
}

/**
 * Menghitung tiga jarak untuk seluruh baris waktu.
 *
 * @param opsi.hariIni  CURDATE() basis antrian. Hanya baris hari ini yang boleh
 *                      "berjalan"; hari lampau yang tidak punya pembanding
 *                      "tidak diketahui", bukan nol dan bukan berjalan.
 * @param opsi.selesai  kunciWaktu -> hasil sidangnya sudah tercatat di SIPP.
 *                      Perkara terakhir di ruangnya yang sudah selesai TIDAK
 *                      lagi berjalan - akhirnya ada, hanya jamnya tidak
 *                      tercatat di mana pun.
 * @param opsi.ruangSipp kunciWaktu -> ruangan SIPP, cadangan bila antrian tidak
 *                      menyebut ruang.
 */
export function hitungTigaJarak(
  baris: BarisWaktuAntrian[],
  opsi: { hariIni: string; selesai?: Record<string, boolean>; ruangSipp?: Record<string, string> }
): Record<string, TigaJarak> {
  const hariIni = String(opsi.hariIni || "").trim();
  const hasil: Record<string, TigaJarak> = {};

  // Deret per (hari, ruang), hanya yang sudah dipanggil.
  const deret = new Map<string, Array<{ kunci: string; ms: number; baris: BarisWaktuAntrian }>>();
  const ruangPerKunci = new Map<string, { kunci: string; sebutan: string }>();
  const unik = new Map<string, BarisWaktuAntrian>();

  for (const satu of Array.isArray(baris) ? baris : []) {
    const kunci = kunciWaktu(satu.tanggalSidang, satu.perkaraId);
    if (!satu.tanggalSidang || !satu.perkaraId) continue;
    // Kunci kembar: yang pertama dipakai, dan itu cukup - bot sudah
    // menyatukan rekaman dan pembacaan langsung per (tanggal, perkara).
    if (unik.has(kunci)) continue;
    unik.set(kunci, satu);
    const ruang = ruangBaris(satu, opsi.ruangSipp?.[kunci]);
    ruangPerKunci.set(kunci, ruang);
    const ms = bacaWaktu(satu.panggilTerakhir);
    if (ms === null) continue;
    const kunciDeret = `${satu.tanggalSidang}|${ruang.kunci}`;
    if (!deret.has(kunciDeret)) deret.set(kunciDeret, []);
    deret.get(kunciDeret)!.push({ kunci, ms, baris: satu });
  }

  const letak = new Map<string, { deret: Array<{ kunci: string; ms: number; baris: BarisWaktuAntrian }>; i: number }>();
  for (const isi of deret.values()) {
    isi.sort(bandingkanPanggil);
    isi.forEach((x, i) => letak.set(x.kunci, { deret: isi, i }));
  }

  for (const [kunci, satu] of unik) {
    const ruang = ruangPerKunci.get(kunci)!;
    const tanggal = String(satu.tanggalSidang);
    const iniHariIni = Boolean(hariIni) && tanggal === hariIni;
    const akanDatang = Boolean(hariIni) && tanggal > hariIni;
    const adaAmbil = bacaWaktu(satu.ambilTerawal) !== null;
    const adaPanggil = bacaWaktu(satu.panggilTerakhir) !== null;
    const posisi = letak.get(kunci);

    // ---- (a) TUNGGU ---------------------------------------------------------
    let tunggu: Jarak;
    if (!adaAmbil) {
      tunggu = jarakKosong(
        adaPanggil
          ? "Dipanggil tanpa tercatat mengambil nomor antrian."
          : "Belum ada pihak yang mengambil nomor antrian."
      );
    } else if (adaPanggil) {
      tunggu = jarakSelesai(
        satu.ambilTerawal,
        satu.panggilTerakhir,
        null,
        `Tercatat dipanggil ${jamDari(satu.panggilTerakhir)} SEBELUM mengambil nomor ${jamDari(
          satu.ambilTerawal
        )} - datanya bertentangan, dan tidak dipaksa menjadi nol.`
      );
    } else if (iniHariIni) {
      tunggu = jarakBerjalan(satu.ambilTerawal, "Sudah mengambil nomor dan belum dipanggil masuk.");
    } else if (akanDatang) {
      tunggu = jarakKosong("Hari sidangnya belum tiba.");
    } else {
      tunggu = jarakTakDiketahui(
        `Mengambil nomor ${jamDari(satu.ambilTerawal)} tetapi tidak tercatat dipanggil masuk.`,
        satu.ambilTerawal
      );
    }

    // ---- (b) DARI SIDANG SEBELUMNYA dan (c) LAMA SIDANG ------------------
    let dariSebelumnya: Jarak;
    let lamaSidang: Jarak;
    if (!posisi) {
      dariSebelumnya = jarakKosong("Belum dipanggil.");
      lamaSidang = jarakKosong("Belum dipanggil.");
    } else {
      const { deret: isi, i } = posisi;
      if (i === 0) {
        // Urutan pertama TIDAK dihitung - dan bukan nol. Nol berarti
        // "dipanggil pada detik yang sama dengan sebelumnya".
        dariSebelumnya = jarakKosong(
          `Perkara pertama yang dipanggil di ${ruang.sebutan} pada hari itu - tidak ada sidang sebelumnya.`
        );
      } else {
        const sebelum = isi[i - 1].baris;
        dariSebelumnya = jarakSelesai(sebelum.panggilTerakhir, satu.panggilTerakhir, tetanggaDari(sebelum), "");
      }

      if (i < isi.length - 1) {
        const berikut = isi[i + 1].baris;
        lamaSidang = jarakSelesai(satu.panggilTerakhir, berikut.panggilTerakhir, tetanggaDari(berikut), "");
      } else if (iniHariIni && !opsi.selesai?.[kunci]) {
        lamaSidang = jarakBerjalan(
          satu.panggilTerakhir,
          `Belum ada perkara berikutnya yang dipanggil di ${ruang.sebutan} - sidangnya dianggap masih berjalan.`
        );
      } else if (iniHariIni) {
        lamaSidang = jarakTakDiketahui(
          `Hasil sidangnya sudah dicatat, tetapi belum ada perkara berikutnya yang dipanggil di ${ruang.sebutan} - jam selesainya tidak tercatat di mana pun.`,
          satu.panggilTerakhir
        );
      } else {
        lamaSidang = jarakTakDiketahui(
          `Perkara terakhir yang dipanggil di ${ruang.sebutan} pada hari itu - tidak ada panggilan berikutnya yang menandai akhir sidangnya.`,
          satu.panggilTerakhir
        );
      }
    }

    hasil[kunci] = {
      kunci,
      ruang: ruang.sebutan,
      urutanRuang: posisi ? posisi.i + 1 : null,
      hariIni: iniHariIni,
      tunggu,
      dariSebelumnya,
      lamaSidang,
    };
  }

  return hasil;
}

/** Detik yang sedang berjalan, dari "sekarang" basis antrian. Negatif -> null. */
export function detikBerjalan(jarak: Jarak, sekarangMs: number): number | null {
  if (jarak.keadaan !== "berjalan" || jarak.mulaiMs === null) return null;
  const detik = Math.floor((sekarangMs - jarak.mulaiMs) / 1000);
  return detik < 0 ? null : detik;
}
