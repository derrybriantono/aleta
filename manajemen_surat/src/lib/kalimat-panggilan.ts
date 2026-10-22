/**
 * ============================================================================
 * KALIMAT PANGGILAN PENGERAS SUARA - SATU TEMPAT (22 Okt 2026, W59)
 * ============================================================================
 *
 * Permintaan hakim: papan panggil antrian memisahkan majelis hakim dan
 * panitera sidang, memanggil tiap hakim dengan namanya, dan SETIAP panggilan
 * menyebut nama, jabatan, dan ruang. Panggilan para pihak menyebut nomor
 * antrian, nomor perkara, jenis perkara, nama para pihak dengan sebutannya
 * ("... sebagai Penggugat melawan ... sebagai Tergugat"), ruang sidang, dan
 * panggilan keberapa.
 *
 * Semua kalimat disusun di sini - fungsi murni tanpa React, tanpa jaringan -
 * supaya layar dan uji memakai bunyi yang SAMA persis.
 *
 * Aturan yang dijaga:
 *   - Sebutan pihak TIDAK ditebak di sini. Yang datang adalah `peran` dari
 *     rute sasaran, yang sudah memakai sebutan-pihak.ts (alur/jenis perkara,
 *     satu sumber). Kata "melawan" dipakai bila ADA pihak kedua - bukan bila
 *     perkaranya bernama gugatan: cerai talak bersebutan Pemohon/Termohon
 *     tetapi tetap berhadapan, sedangkan permohonan murni (dispensasi kawin,
 *     istbat nikah) hanya punya Pemohon.
 *   - Kuasa hukum tidak ikut dipanggil sebagai pihak. Hanya NAMA dan sebutan
 *     yang diucapkan; NIK, alamat, dan telepon tidak pernah masuk kalimat.
 *   - Nama diucapkan apa adanya ("bin", "binti", "alias" tetap terdengar).
 *   - Nomor perkara diucapkan dalam bentuk yang enak bagi pengucap suara:
 *     "perkara nomor enam ratus sembilan, P D T G, tahun dua ribu dua puluh
 *     enam".
 */

import { kunciOrang } from "@/lib/orang-unik";

// ============================================================================
// ANGKA DAN URUTAN
// ============================================================================

const SATUAN = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** 2026 -> "dua ribu dua puluh enam". Bilangan bulat 0 sampai 999.999.999. */
export function terbilang(nilai: number): string {
  const n = Math.floor(Number(nilai));
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluh]} puluh${sisa ? ` ${SATUAN[sisa]}` : ""}`;
  }
  if (n < 200) return `seratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
  if (n < 1_000_000) return `${terbilang(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
  if (n < 1_000_000_000) {
    return `${terbilang(Math.floor(n / 1_000_000))} juta${n % 1_000_000 ? ` ${terbilang(n % 1_000_000)}` : ""}`;
  }
  return String(n);
}

const URUTAN = ["", "pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh"];

/** 1 -> "pertama", 2 -> "kedua" ... 11 -> "ke sebelas". Nol dianggap pertama. */
export function urutanPanggilan(ke: number): string {
  const n = Math.max(1, Math.floor(Number(ke) || 1));
  return n < URUTAN.length ? URUTAN[n] : `ke ${terbilang(n)}`;
}

/**
 * "609/Pdt.G/2026/PA.Dgl" -> "perkara nomor enam ratus sembilan, P D T G,
 * tahun dua ribu dua puluh enam". Nomor yang bentuknya tak dikenal diucapkan
 * apa adanya, bukan dibuang: lebih baik terdengar janggal daripada hilang.
 */
export function ucapkanNomorPerkara(nomorPerkara: string | null | undefined): string {
  const nomor = String(nomorPerkara ?? "").replace(/\s+/g, " ").trim();
  if (!nomor) return "";
  const cocok = /^(\d{1,9})\s*\/\s*([A-Za-z][A-Za-z.\s]*)\s*\/\s*(\d{4})\b/.exec(nomor);
  if (!cocok) return `perkara nomor ${nomor}`;
  const huruf = cocok[2].replace(/[^A-Za-z]/g, "").toUpperCase().split("").join(" ");
  return `perkara nomor ${terbilang(Number(cocok[1]))}, ${huruf}, tahun ${terbilang(Number(cocok[3]))}`;
}

// ============================================================================
// BAHAN
// ============================================================================

/** Satu orang pada jawaban sasaran (rute /api/aleta-ecourt/panggil/sasaran). */
export type OrangPanggil = {
  kunci?: string;
  nama: string;
  peran: string;
  golongan: string;
};

function bersih(teks: unknown): string {
  return String(teks ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, " dan ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Ruang Sidang 2", atau "ruang sidang" bila ruangnya belum ditetapkan. */
export function sebutRuangSidang(noRuang: number | null | undefined): string {
  return noRuang && noRuang > 0 ? `Ruang Sidang ${noRuang}` : "ruang sidang";
}

/** Tujuan panggilan mediator. Ruang mediasi tidak bernomor di antrian. */
export const RUANG_MEDIASI = "ruang mediasi";

function dan(daftar: string[]): string {
  if (daftar.length <= 1) return daftar[0] ?? "";
  if (daftar.length === 2) return `${daftar[0]} dan ${daftar[1]}`;
  return `${daftar.slice(0, -1).join(", ")}, dan ${daftar[daftar.length - 1]}`;
}

/** Batas banyaknya nama yang disebut satu per satu; lebihnya "dan kawan-kawan". */
export const BATAS_NAMA_PIHAK = 3;

/** "A", "A dan B", "A, B, dan C", dan lebih dari tiga: "A dan kawan-kawan". */
export function daftarNama(nama: readonly string[]): string {
  const rapi = nama.map(bersih).filter(Boolean);
  if (rapi.length > BATAS_NAMA_PIHAK) return `${rapi[0]} dan kawan-kawan`;
  return dan(rapi);
}

// ============================================================================
// PARA PIHAK
// ============================================================================

function bukanKuasa(o: OrangPanggil): boolean {
  return !/^kuasa/i.test(String(o.kunci ?? "")) && !/^kuasa\b/i.test(String(o.peran ?? ""));
}

function sisiPihak(orang: readonly OrangPanggil[], golongan: string): { peran: string; nama: string[] } | null {
  const anggota = orang.filter((o) => o.golongan === golongan && bukanKuasa(o) && bersih(o.nama));
  if (anggota.length === 0) return null;
  return { peran: bersih(anggota[0].peran), nama: anggota.map((o) => bersih(o.nama)) };
}

function klausaPihak(sisi: { peran: string; nama: string[] }): string {
  return `${daftarNama(sisi.nama)}${sisi.peran ? ` sebagai ${sisi.peran}` : ""}`;
}

/**
 * Bagian pihak pada panggilan: "A sebagai Penggugat melawan B sebagai Tergugat".
 * Tanpa pihak kedua: "A sebagai Pemohon" (permohonan, tanpa "melawan").
 * Turut tergugat / intervensi ditambahkan di belakang dengan "serta".
 */
export function kalimatPihakBerperkara(orang: readonly OrangPanggil[]): string {
  const satu = sisiPihak(orang, "pihak1");
  const dua = sisiPihak(orang, "pihak2");
  const turut = sisiPihak(orang, "pihak4");
  const intervensi = sisiPihak(orang, "pihak3");

  let teks = "";
  if (satu && dua) teks = `${klausaPihak(satu)} melawan ${klausaPihak(dua)}`;
  else if (satu) teks = klausaPihak(satu);
  else if (dua) teks = klausaPihak(dua);

  const tambahan = [turut, intervensi].filter((x): x is { peran: string; nama: string[] } => Boolean(x)).map(klausaPihak);
  if (tambahan.length > 0) teks = teks ? `${teks}, serta ${dan(tambahan)}` : dan(tambahan);
  return teks;
}

export type MasukanPanggilanPihak = {
  nomorAntrian: number | null;
  noRuang: number | null;
  /** Panggilan keberapa nomor ini hari ini, termasuk yang sedang dilakukan. */
  panggilanKe: number;
  nomorPerkara?: string;
  jenisPerkara?: string;
  orang?: readonly OrangPanggil[];
};

/** "Nama Jenis/Lain" -> "Nama Jenis atau Lain" - garis miring dibaca "slash" oleh pengucap. */
export function ucapkanJenisPerkara(jenis: string | null | undefined): string {
  return bersih(jenis).replace(/\s*\/\s*/g, " atau ");
}

/**
 * Kalimat lengkap panggilan nomor antrian untuk para pihak.
 *
 * Contoh:
 *   "Panggilan pertama. Nomor antrian 3, perkara nomor enam ratus sembilan,
 *    P D T G, tahun dua ribu dua puluh enam, Cerai Gugat, Adi bin Budi
 *    sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat. Silakan
 *    menuju Ruang Sidang 2."
 *
 * Bahan yang tidak ada (rute sasaran belum menjawab) dilewati: kalimat
 * kembali menjadi nomor antrian dan ruang saja, seperti sebelumnya.
 */
export function kalimatPanggilPihak(m: MasukanPanggilanPihak): string {
  const bagian: string[] = [];
  const kepala = m.nomorAntrian !== null ? `Nomor antrian ${m.nomorAntrian}` : "";
  const perkara = ucapkanNomorPerkara(m.nomorPerkara);
  const jenis = ucapkanJenisPerkara(m.jenisPerkara);
  const pihak = kalimatPihakBerperkara(m.orang ?? []);

  const isi = [kepala, perkara, jenis, pihak].filter(Boolean).join(", ");
  if (isi) bagian.push(isi);

  const tujuan = m.noRuang && m.noRuang > 0 ? `Silakan menuju ${sebutRuangSidang(m.noRuang)}.` : "Silakan memasuki ruang sidang.";
  return `Panggilan ${urutanPanggilan(m.panggilanKe)}. ${bagian.length ? `${bagian.join(" ")}. ` : ""}${tujuan}`;
}

// ============================================================================
// PETUGAS
// ============================================================================

/** "Hakim Ketua" -> "Ketua Majelis"; jabatan lain diucapkan apa adanya. */
export function jabatanHakim(peran: string | null | undefined): string {
  const teks = bersih(peran);
  if (!teks) return "Hakim Anggota";
  if (/ketua/i.test(teks)) return "Ketua Majelis";
  return teks;
}

/** "<nama>, <jabatan>, dimohon menuju <tujuan>." Beberapa nama satu jabatan digabung. */
export function kalimatPetugas(jabatan: string, nama: readonly string[], tujuan: string): string {
  const daftar = nama.map(bersih).filter(Boolean);
  const kepala = daftar.length > 0 ? `${dan(daftar)}, ${jabatan}` : jabatan;
  return `${kepala}, dimohon menuju ${tujuan}.`;
}

/** Satu hakim: "Yang Mulia <nama>, Ketua Majelis, dimohon menuju Ruang Sidang 2." */
export function kalimatHakim(nama: string, peran: string, tujuan: string): string {
  return `Yang Mulia ${bersih(nama)}, ${jabatanHakim(peran)}, dimohon menuju ${tujuan}.`;
}

/** Seluruh majelis dalam satu kalimat. */
export function kalimatSemuaMajelis(majelis: ReadonlyArray<{ nama: string; peran: string }>, tujuan: string): string {
  const daftar = majelis.filter((h) => bersih(h.nama));
  if (daftar.length === 0) return `Majelis hakim, dimohon memasuki ${tujuan}.`;
  const sebut = daftar.map((h) => `Yang Mulia ${bersih(h.nama)}, ${jabatanHakim(h.peran)}`);
  return `Majelis hakim, ${dan(sebut)}, dimohon menuju ${tujuan}.`;
}

export type HakimSidangPilihan = { hakimNama?: string; anggotaMajelis?: boolean } | null | undefined;

/**
 * Hakim yang dipanggil. Bila sidang keliling hari itu menyala dan satu hakim
 * dipilih untuk perkara ini (bukan majelis penuh), dialah satu-satunya yang
 * dipanggil: ia memakai jabatannya di majelis bila anggota majelis, dan
 * "Hakim Pengganti" bila bukan.
 */
export function hakimYangDipanggil(
  majelis: ReadonlyArray<{ nama: string; peran: string }>,
  pilihan: HakimSidangPilihan,
  kelilingAktif: boolean
): Array<{ nama: string; peran: string; pengganti: boolean }> {
  const dipilih = bersih(pilihan?.hakimNama);
  if (kelilingAktif && dipilih) {
    const kunci = kunciOrang(dipilih);
    const anggota = majelis.find((h) => kunciOrang(h.nama) === kunci);
    if (anggota) return [{ nama: bersih(anggota.nama), peran: anggota.peran, pengganti: false }];
    return [{ nama: dipilih, peran: "Hakim Pengganti", pengganti: true }];
  }
  return majelis.filter((h) => bersih(h.nama)).map((h) => ({ nama: bersih(h.nama), peran: h.peran, pengganti: false }));
}

/** Panitera sidang: "<nama>, Panitera Pengganti, dimohon menuju Ruang Sidang 2." */
export function kalimatPanitera(nama: readonly string[], tujuan: string): string {
  return kalimatPetugas("Panitera Pengganti", nama, tujuan);
}

export function kalimatJuruSita(nama: readonly string[], tujuan: string): string {
  return kalimatPetugas("Juru Sita", nama, tujuan);
}

/** Rohaniwan tidak tercatat di SIPP: nama dari isian petugas; tanpa nama, jabatannya saja. */
export function kalimatRohaniwan(nama: string, tujuan: string): string {
  return kalimatPetugas("Petugas Rohaniwan", [nama], tujuan);
}

export function kalimatPetugasMediasi(nama: string, tujuan: string): string {
  return kalimatPetugas("Petugas Mediasi", [nama], tujuan);
}

export function kalimatPetugasPersidangan(nama: string, tujuan: string): string {
  return kalimatPetugas("Petugas Persidangan", [nama], tujuan);
}

/** Mediator dipanggil ke RUANG MEDIASI, bukan ruang sidang. */
export function kalimatMediator(nama: readonly string[]): string {
  return kalimatPetugas("Mediator", nama, RUANG_MEDIASI);
}

// ============================================================================
// SAKSI
// ============================================================================

/** "Saksi Penggugat" -> "Penggugat". Peran tanpa awalan "Saksi" dipakai apa adanya. */
export function sisiSaksi(peran: string | null | undefined): string {
  return bersih(peran).replace(/^saksi\s+/i, "");
}

/** "<nama>, saksi dari pihak Penggugat, dimohon menuju Ruang Sidang 2." */
export function kalimatSaksi(saksi: { nama: string; peran: string }, tujuan: string): string {
  const sisi = sisiSaksi(saksi.peran);
  return `${bersih(saksi.nama)}, saksi${sisi ? ` dari pihak ${sisi}` : ""}, dimohon menuju ${tujuan}.`;
}

/** Satu kalimat per saksi, urutan daftar dipertahankan - diucapkan berurutan. */
export function kalimatSemuaSaksi(saksi: ReadonlyArray<{ nama: string; peran: string }>, tujuan: string): string[] {
  return saksi.filter((s) => bersih(s.nama)).map((s) => kalimatSaksi(s, tujuan));
}

/** Saksi yang belum tercatat, nama diketik petugas. Kalimat tetap seperti sebelumnya. */
export function kalimatSaksiKetik(nama: string, tujuan: string): string {
  return `Saksi atas nama ${bersih(nama)}, dimohon memasuki ${tujuan}.`;
}
