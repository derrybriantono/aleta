import { petaJarakAntarSidang, petaJarakBerikutSidang } from "@/lib/jarak-antar-sidang";
import {
  kunciWaktu,
  type BarisWaktuAntrian,
  type Jarak,
  type TigaJarak,
} from "@/lib/tiga-jarak-sidang";

/**
 * ============================================================================
 * MENYUSUN REKAMAN ANTRIAN - BAGIAN YANG TIDAK MENYENTUH BASIS DATA
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: ALETA menyimpan sendiri urutan antrian
 * sidang, pengambilannya, siapa yang mengambil, dan jarak antara satu perkara
 * dengan perkara berikutnya. Sebab lengkapnya ada di 0048_rekam_antrian.sql.
 *
 * Berkas ini hanya MENYUSUN barisnya - dari daftar sidang dan peta antrian
 * yang sama persis dengan yang dipakai layar. Penulisannya ke basis data ada
 * di server/modules/aleta-ecourt/rekam-antrian.ts.
 *
 * Dipisah begitu supaya perhitungan urutan dan jaraknya - satu-satunya bagian
 * yang dapat salah diam-diam - dapat diuji tanpa satu pun basis data, dan
 * diuji atas angka yang sama dengan yang dilihat orang di layar.
 */

/** Satu baris sidang, sebatas yang diperlukan rekaman. */
export type SidangUntukRekam = {
  perkaraId: string;
  nomorPerkara: string;
  sidangId: string;
  tanggalSidang: string;
  ruangan?: string;
};

/** Satu baris antrian, sebatas yang diperlukan rekaman. */
export type AntrianUntukRekam = {
  nomor: number | null;
  tanggalSidang: string;
  waktuAmbil?: string;
  jamPanggil?: string;
  online?: boolean;
  keadaan?: string;
  namaPetugas?: string;
};

/** Satu baris siap tulis. */
export type BarisRekamAntrian = {
  id: string;
  tanggalSidang: string;
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  ruangan: string;
  nomorAntrian: number | null;
  urutanRuang: number | null;
  waktuAmbil: string;
  jamPanggil: string;
  online: boolean;
  keadaan: string;
  namaPetugas: string;
  jarakSebelumMenit: number | null;
  jarakBerikutMenit: number | null;
  // --- 0051: presisi detik dan tiga jarak waktu --------------------------
  //
  // Waktu "YYYY-MM-DD HH:MM:SS" menurut jam APLIKASI ANTRIAN (WITA), bukan
  // UTC - lihat drizzle/0051_rekam_antrian_detik.sql.
  waktuAmbilLengkap: string;
  jamJadwal: string;
  waktuPanggilPertama: string;
  waktuPanggilLengkap: string;
  jumlahPanggil: number;
  menungguDetik: number | null;
  jarakSebelumDetik: number | null;
  lamaSidangDetik: number | null;
  /**
   * Kedelapan kolom 0051 di atas berasal dari buku waktu antrian untuk BARIS
   * INI. Diputuskan per baris, bukan per pemuatan (temuan penelaah 27 Sep
   * 2026): waktu antrian yang terbaca belum tentu punya baris untuk perkara
   * ini. false berarti tidak ada - dan tulisannya TIDAK boleh menimpa angka
   * yang sudah tersimpan dengan kosong. Tidak disimpan.
   */
  adaWaktu: boolean;
  /**
   * Ada sumber antrian untuk baris ini - baris antrian hari itu, atau buku
   * waktu bot. Tidak disimpan; dipakai rute untuk tidak menimpa rekaman hari
   * lampau dengan kosong.
   */
  bersumber: boolean;
  /**
   * Hari sidangnya sudah lewat. Rekaman hari lampau hanya boleh BERTAMBAH
   * lengkap - lihat gabungRekamLampau. Tidak disimpan.
   */
  lampau?: boolean;
};

/** Waktu antrian yang ikut dipakai menyusun rekaman - lihat susunRekamAntrian. */
export type WaktuUntukRekam = {
  terbaca: boolean;
  baris: BarisWaktuAntrian[];
  /** Hasil hitungTigaJarak atas baris yang SAMA, berkunci kunciWaktu. */
  tiga: Record<string, TigaJarak>;
  /** "Hari ini" menurut jam aplikasi antrian - penentu baris hari lampau. */
  hariIni?: string;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

/** Detik sebuah jarak yang SUDAH tetap. Berjalan, kosong, janggal: null. */
function detikTetap(jarak: Jarak | undefined): number | null {
  return jarak && jarak.keadaan === "selesai" && typeof jarak.detik === "number" ? jarak.detik : null;
}

/** "HH:MM" dari "YYYY-MM-DD HH:MM:SS" - bentuk kolom lama. */
function jamMenit(waktu: string): string {
  const cocok = /\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/.exec(String(waktu || ""));
  return cocok ? `${cocok[1]}:${cocok[2]}` : "";
}

/** Kunci baris - lihat sebabnya di 0048_rekam_antrian.sql. */
export function kunciRekam(tanggalSidang: string, sidangId: string): string {
  return `${teks(tanggalSidang)}|${teks(sidangId)}`;
}

/**
 * Menyusun baris rekaman dari daftar sidang dan peta antrian.
 *
 * ============================================================================
 * YANG BELUM MENGAMBIL NOMOR TETAP DIREKAM
 * ============================================================================
 *
 * Dan itu disengaja. "Perkara ini tidak pernah mengambil nomor antrian"
 * adalah keterangan, bukan ketiadaan keterangan - ia yang menjawab pertanyaan
 * berapa banyak sidang yang berjalan di luar antrian. Merekam hanya yang
 * bernomor membuat angka itu mustahil dihitung, sebab yang hilang tidak
 * terbedakan dari yang belum sempat direkam.
 *
 * Yang TIDAK direkam hanya baris tanpa sidang_id: tanpa itu ia tidak punya
 * kunci, dan baris tanpa kunci akan saling menimpa.
 *
 * ============================================================================
 * WAKTU ANTRIAN (27 September 2026) - SUMBER KEDUA, DAN SUMBER TIGA JARAKNYA
 * ============================================================================
 *
 * Bila `waktu` terbaca, kolom 0051 diisi darinya dan kolom jarak LAMA ikut
 * diturunkan dari tiga jarak yang sama - supaya satu baris rekaman tidak
 * pernah memuat dua jarak yang dihitung dengan dua cara yang berbeda.
 *
 * Buku waktu bot juga menjadi CADANGAN bagi kolom lama: baris antrian hari
 * lampau biasanya sudah tidak ada di aplikasi antrian, dan tanpa cadangan ini
 * membuka jadwal hari lampau menimpa rekaman hari itu dengan nomor kosong.
 *
 * ============================================================================
 * PER BARIS, DAN HANYA BILA BUKU WAKTUNYA SELARAS (temuan penelaah 27 Sep)
 * ============================================================================
 *
 * "Waktu antrian terbaca" TIDAK berarti buku waktu punya baris untuk tiap
 * perkara. Hari sebelum 2.39 terpasang, hari pencatatnya dimatikan, dan
 * panggilan sesudah jam kerja pencatat tidak ada di buku - tetapi masih ada
 * di aplikasi antrian. Diputuskan sekali per pemuatan, hari-hari itu ditulis
 * ulang dengan urutan dan jarak NULL, menimpa rekaman yang benar.
 *
 * Karena itu:
 *
 *   - kolom 0051 hanya diisi bila buku punya baris untuk PERKARA ITU;
 *   - waktu panggil buku hanya dipakai bila SELARAS dengan aplikasi antrian
 *     (jam panggil yang sama sampai menitnya) - buku yang tidak melihat
 *     panggilan ulang sesudah 18.00 menyimpan panggilan yang sudah basi;
 *   - urutan dan jarak antar-perkara diambil dari tiga jarak hanya bila buku
 *     selaras untuk SELURUH perkara yang dipanggil hari itu. Satu panggilan
 *     yang tidak teramati sudah cukup membuat tetangga seseorang keliru, dan
 *     pada hari seperti itu hitungan lama dari aplikasi antrian yang dipakai.
 */
export function susunRekamAntrian(
  sidang: SidangUntukRekam[],
  peta: Record<string, AntrianUntukRekam> | undefined,
  waktu?: WaktuUntukRekam
): BarisRekamAntrian[] {
  const pakai = sidang.filter((x) => teks(x.sidangId) && teks(x.tanggalSidang));
  const pakaiWaktu = Boolean(waktu?.terbaca);
  const petaWaktu = new Map<string, BarisWaktuAntrian>();
  for (const b of waktu?.baris ?? []) petaWaktu.set(kunciWaktu(b.tanggalSidang, b.perkaraId), b);
  const waktuBaris = (baris: SidangUntukRekam) =>
    petaWaktu.get(kunciWaktu(teks(baris.tanggalSidang), teks(baris.perkaraId)));

  const antrianLangsung = (baris: SidangUntukRekam): AntrianUntukRekam | undefined => {
    const punya = peta?.[teks(baris.perkaraId)];
    if (!punya) return undefined;
    // Aturan yang sama dengan layar: peta antrian berkunci perkara, bukan
    // sidang. Perkara yang bersidang dua kali dalam rentang yang dibuka akan
    // mendapat baris antrian hari LAIN bila tanggalnya tidak diperiksa.
    if (!punya.tanggalSidang || !baris.tanggalSidang) return undefined;
    return punya.tanggalSidang === baris.tanggalSidang ? punya : undefined;
  };

  // Baris antrian hari itu lebih dulu; buku waktu bot hanya bila tidak ada.
  const antrianBaris = (baris: SidangUntukRekam): AntrianUntukRekam | undefined => {
    const langsung = antrianLangsung(baris);
    if (langsung) return langsung;
    const w = waktuBaris(baris);
    if (!w) return undefined;
    return {
      nomor: typeof w.nomorAntrian === "number" ? w.nomorAntrian : null,
      tanggalSidang: w.tanggalSidang,
      waktuAmbil: jamMenit(w.ambilTerawal),
      jamPanggil: jamMenit(w.panggilTerakhir),
      online: w.online === true,
      keadaan: w.panggilTerakhir ? "dipanggil" : w.ambilTerawal ? "menunggu" : "belum-ambil",
      namaPetugas: w.namaPetugas,
    };
  };

  // ==========================================================================
  // JARAK DIHITUNG PER HARI, BUKAN ATAS SELURUH RENTANG
  // ==========================================================================
  //
  // Rentang seminggu yang dihitung sekaligus menghasilkan "jarak" antara
  // sidang terakhir hari Senin dan sidang pertama hari Selasa - angka yang
  // tidak pernah dialami siapa pun, dan yang akan terbaca sebagai ruang
  // menganggur dua puluh jam.
  const perHari = new Map<string, SidangUntukRekam[]>();
  for (const baris of pakai) {
    const hari = teks(baris.tanggalSidang);
    if (!perHari.has(hari)) perHari.set(hari, []);
    perHari.get(hari)!.push(baris);
  }

  const hasil: BarisRekamAntrian[] = [];
  for (const [, deret] of perHari) {
    const bahan = deret.map((baris) => ({
      kunci: kunciRekam(baris.tanggalSidang, baris.sidangId),
      ruangan: teks(baris.ruangan),
      jamPanggil: teks(antrianBaris(baris)?.jamPanggil),
    }));
    const sebelum = petaJarakAntarSidang(bahan);
    const berikut = petaJarakBerikutSidang(bahan);

    // Urutan di dalam ruang - keberapa perkara ini duduk di ruangnya menurut
    // jam panggil. Yang belum punya jam panggil tidak diberi urutan sama
    // sekali: menaruhnya di nomor terakhir berarti mengaku tahu urutan yang
    // belum ditentukan siapa pun.
    const urutan = new Map<string, number>();
    const perRuang = new Map<string, Array<{ kunci: string; jam: string }>>();
    for (const b of bahan) {
      if (!b.jamPanggil) continue;
      if (!perRuang.has(b.ruangan)) perRuang.set(b.ruangan, []);
      perRuang.get(b.ruangan)!.push({ kunci: b.kunci, jam: b.jamPanggil });
    }
    for (const isi of perRuang.values()) {
      isi.sort((a, b) => a.jam.localeCompare(b.jam));
      isi.forEach((x, i) => urutan.set(x.kunci, i + 1));
    }

    // Buku waktu bot untuk baris ini - hanya bila waktunya terbaca.
    const bukuBaris = (baris: SidangUntukRekam) => (pakaiWaktu ? waktuBaris(baris) : undefined);

    // Panggilan menurut buku SAMA dengan panggilan menurut aplikasi antrian.
    // Baris yang tidak dipanggil menurut aplikasi antrian - atau yang tidak
    // punya baris di sana - tidak dapat berselisih dengan buku.
    const selaras = (baris: SidangUntukRekam) => {
      const langsung = antrianLangsung(baris);
      if (!langsung || teks(langsung.keadaan) !== "dipanggil" || !teks(langsung.jamPanggil)) return true;
      const w = bukuBaris(baris);
      return Boolean(w?.panggilTerakhir) && jamMenit(w!.panggilTerakhir) === teks(langsung.jamPanggil).slice(0, 5);
    };
    const waktuSelarasHari = pakaiWaktu && deret.every(selaras);

    for (const baris of deret) {
      const kunci = kunciRekam(baris.tanggalSidang, baris.sidangId);
      const punya = antrianBaris(baris);
      const w = bukuBaris(baris);
      const tiga = w ? waktu?.tiga[kunciWaktu(teks(baris.tanggalSidang), teks(baris.perkaraId))] : undefined;
      // Panggilan baris ini menurut buku boleh dipakai: bukunya punya baris
      // ini dan tidak berselisih dengan aplikasi antrian.
      const panggilanSah = Boolean(w) && selaras(baris);
      // Menit kolom lama DITURUNKAN dari detik yang sama bila waktunya
      // terbaca - dibulatkan ke bawah, sama dengan yang tampil di layar.
      const menitDari = (jarak: Jarak | undefined) => {
        const detik = detikTetap(jarak);
        return detik === null ? null : Math.floor(detik / 60);
      };
      const tanggal = teks(baris.tanggalSidang);
      hasil.push({
        id: kunci,
        tanggalSidang: tanggal,
        sidangId: teks(baris.sidangId),
        perkaraId: teks(baris.perkaraId),
        nomorPerkara: teks(baris.nomorPerkara),
        ruangan: teks(baris.ruangan),
        nomorAntrian: typeof punya?.nomor === "number" ? punya.nomor : null,
        urutanRuang: waktuSelarasHari ? (tiga?.urutanRuang ?? null) : (urutan.get(kunci) ?? null),
        waktuAmbil: teks(punya?.waktuAmbil),
        jamPanggil: teks(punya?.jamPanggil),
        online: Boolean(punya?.online),
        keadaan: teks(punya?.keadaan),
        namaPetugas: teks(punya?.namaPetugas),
        jarakSebelumMenit: waktuSelarasHari ? menitDari(tiga?.dariSebelumnya) : (sebelum[kunci] ?? null),
        jarakBerikutMenit: waktuSelarasHari ? menitDari(tiga?.lamaSidang) : (berikut[kunci] ?? null),
        waktuAmbilLengkap: teks(w?.ambilTerawal),
        jamJadwal: teks(w?.jamJadwal),
        waktuPanggilPertama: teks(w?.panggilPertama),
        waktuPanggilLengkap: panggilanSah ? teks(w?.panggilTerakhir) : "",
        jumlahPanggil: Math.max(0, Number(w?.jumlahPanggil) || 0),
        menungguDetik: panggilanSah ? detikTetap(tiga?.tunggu) : null,
        jarakSebelumDetik: waktuSelarasHari ? detikTetap(tiga?.dariSebelumnya) : null,
        lamaSidangDetik: waktuSelarasHari ? detikTetap(tiga?.lamaSidang) : null,
        adaWaktu: Boolean(w),
        bersumber: Boolean(antrianLangsung(baris) || w),
        lampau: Boolean(waktu?.hariIni) && tanggal < teks(waktu?.hariIni),
      });
    }
  }
  return hasil;
}

/** Rekaman yang sudah tersimpan, sebagaimana dibaca kembali. */
export type RekamLama = Omit<BarisRekamAntrian, "adaWaktu" | "bersumber" | "lampau">;

/** Tingkat keadaan antrian - yang lebih tinggi lebih jauh berjalan. */
function tingkatKeadaan(keadaan: string): number {
  return { "belum-ambil": 1, menunggu: 2, dipanggil: 3 }[teks(keadaan)] ?? 0;
}

/** "HH:MM" panggilan satu sisi - dari waktu berdetiknya, atau jam menitnya. */
function jamPanggilSisi(b: RekamLama): string {
  return jamMenit(b.waktuPanggilLengkap) || teks(b.jamPanggil).slice(0, 5);
}

/** Yang terawal di antara dua teks waktu berbentuk tetap; kosong diabaikan. */
function terawalTeks(a: string, b: string): string {
  const x = teks(a);
  const y = teks(b);
  if (x && y) return x <= y ? x : y;
  return x || y;
}

const kosongAtau = <T,>(nilai: T | null | undefined, cadangan: T | null | undefined): T | null =>
  nilai === null || nilai === undefined || nilai === ("" as unknown as T) ? (cadangan ?? null) : nilai;

/**
 * ============================================================================
 * REKAMAN HARI LAMPAU HANYA BERTAMBAH LENGKAP - TIDAK PERNAH MUNDUR
 * ============================================================================
 *
 * Temuan penelaah 27 September 2026. Sesudah harinya lewat, sumber-sumbernya
 * hanya dapat KEHILANGAN keterangan: aplikasi antrian memakai ulang barisnya,
 * buku waktu berhenti di jam kerja pencatat. Rekaman yang ditulis pada hari
 * itu sendiri - dari data langsung - kerap yang paling lengkap, dan pemuatan
 * esok harinya tidak boleh menimpanya dengan yang lebih sedikit.
 *
 * Tetapi yang baru JUGA dapat lebih lengkap: layar ditutup pukul 16.00,
 * sidangnya berjalan sampai 17.00, dan buku waktu melihat panggilan terakhir
 * itu. Maka aturannya bukan "yang lama menang", melainkan:
 *
 *   - yang kosong tidak pernah menimpa yang terisi;
 *   - PANGGILAN yang dipakai adalah yang paling jauh berjalan: dipanggil di
 *     atas menunggu, di atas belum-ambil; di antara dua panggilan, yang lebih
 *     AKHIR (panggilan ulang); pada panggilan yang sama, yang berdetik;
 *   - urutan dan jarak ikut panggilan itu - jarak milik panggilan 09.10 tidak
 *     dicampur ke panggilan 18.30. Keduanya saling melengkapi hanya bila
 *     menyebut panggilan yang SAMA;
 *   - waktu ambil dan panggilan pertama: yang terawal; hitungan panggilan:
 *     yang terbesar.
 */
export function gabungRekamLampau(
  lama: RekamLama | null | undefined,
  baru: BarisRekamAntrian
): BarisRekamAntrian {
  if (!lama) return baru;

  const tl = tingkatKeadaan(lama.keadaan);
  const tb = tingkatKeadaan(baru.keadaan);
  const jl = jamPanggilSisi(lama);
  const jb = jamPanggilSisi(baru);
  let pakaiBaru: boolean;
  if (tb !== tl) pakaiBaru = tb > tl;
  else if (jl !== jb) pakaiBaru = jb > jl;
  else pakaiBaru = Boolean(teks(baru.waktuPanggilLengkap)) || !teks(lama.waktuPanggilLengkap);

  const p: RekamLama = pakaiBaru ? baru : lama;
  const q: RekamLama = pakaiBaru ? lama : baru;
  // Saling melengkapi hanya bila keduanya menyebut panggilan yang SAMA.
  const sama = tb === tl && jl === jb;
  const isi = <K extends keyof RekamLama>(ruas: K) =>
    (sama ? kosongAtau(p[ruas], q[ruas]) : kosongAtau(p[ruas], null)) as RekamLama[K];

  return {
    ...baru,
    // --- kelompok panggilan: dari sisi yang terpilih ------------------------
    keadaan: teks(isi("keadaan")),
    jamPanggil: teks(isi("jamPanggil")),
    waktuPanggilLengkap: teks(isi("waktuPanggilLengkap")),
    urutanRuang: isi("urutanRuang"),
    jarakSebelumMenit: isi("jarakSebelumMenit"),
    jarakBerikutMenit: isi("jarakBerikutMenit"),
    menungguDetik: isi("menungguDetik"),
    jarakSebelumDetik: isi("jarakSebelumDetik"),
    lamaSidangDetik: isi("lamaSidangDetik"),
    // --- yang lain: yang kosong tidak menimpa ------------------------------
    nomorAntrian: kosongAtau(baru.nomorAntrian, lama.nomorAntrian),
    waktuAmbil: terawalTeks(lama.waktuAmbil, baru.waktuAmbil),
    waktuAmbilLengkap: terawalTeks(lama.waktuAmbilLengkap, baru.waktuAmbilLengkap),
    waktuPanggilPertama: terawalTeks(lama.waktuPanggilPertama, baru.waktuPanggilPertama),
    jamJadwal: teks(lama.jamJadwal) || teks(baru.jamJadwal),
    online: Boolean(lama.online) || Boolean(baru.online),
    namaPetugas: teks(baru.namaPetugas) || teks(lama.namaPetugas),
    jumlahPanggil: Math.max(Number(lama.jumlahPanggil) || 0, Number(baru.jumlahPanggil) || 0),
    // Hasil gabungan memuat seluruh kolom 0051 yang diketahui kedua sisi -
    // penulisnya boleh menulis semuanya.
    adaWaktu: true,
    lampau: true,
  };
}
