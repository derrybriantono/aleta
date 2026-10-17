/* === G3 15 Okt === */
/**
 * ============================================================================
 * PEMILIHAN BAS BARU DI FOLDER JENIS (G3, 15 Okt 2026)
 * ============================================================================
 *
 * Tiga paket ABT 14 Okt menambah 93 BAS Derry LANGSUNG di folder jenis (bukan salinan; paket A3 abt-susunan-satu-folder sudah
 * menyembunyikan menu ALUR):
 *   D3 abt-bas-paw         ALUR 14 (Penetapan Ahli Waris, folder "9 Penetapan Ahli Waris")
 *   D3 abt-bas-permohonan  ALUR 15 permohonan umum (9b), 16 perwalian, 17 itsbat 2+ sidang, 18 pengangkatan anak, 19 wali adhal
 *                          (folder baru "7 Wali Adhal", menu 114), lanjutan ALUR 12 dispensasi kawin dan ALUR 13 asal usul anak
 *   E3 abt-bas-gugatan     ALUR 30/31 harta bersama, 32/33 kewarisan, 34 poligami, 35 itsbat kontensius,
 *                          36 cerai kumulasi itsbat (verstek), 37 cerai gugat kumulasi hak asuh (kontradiktoir)
 * Daftar berkasnya dibangkitkan ke alur-bas-baru-data.ts; berkas ini memilih langkahnya menurut jenis perkara + keadaan sidang
 * (urutan sidang, kehadiran, agenda, hasil akhir bila diketahui, kumulasi, nomor perkara Pdt.G/Pdt.P).
 *
 * F21 17 Okt: tiga paket jenis baru menambah ALUR 38 (hak asuh anak), 39 (pembatalan perkawinan), 40 (ekonomi syariah gugatan sederhana).
 * F22 17 Okt: ALUR 41 (pencegahan perkawinan, permohonan Pdt.P), 42 (wasiat), 43 (ekonomi syariah ACARA BIASA, nomor Pdt.G; gugatan sederhana Pdt.G.S tetap ALUR 40).
 *
 * TIDAK mengubah tentukanAlurBas / tentukanAlurBasKumulasi (peta ALUR 01-13 dan 945/946) maupun pilihan yang sudah ada:
 *   - mode "ganti"  = jenis yang dulu tanpa BAS (PAW, perwalian, wali adhal, pengangkatan anak, HB, waris, poligami, itsbat
 *                     kontensius), lanjutan itsbat/DK/AUA (sidang ke-2 dst.), tidak hadir/gugur/NO/cabut permohonan, kumulasi
 *                     itsbat verstek dan kumulasi hak asuh kontradiktoir -> menjadi usulan (kecuali admin memetakan blangko lain);
 *   - mode "tambah" = sidang 1 itsbat/DK/AUA yang ditunda: varian baru hanya ditawarkan, usulan lama tetap.
 * Murni: tanpa jaringan dan tanpa basis data.
 */
import { alurBasMenurutId, tentukanAlurBas } from "@/lib/alur-bas";
import { butirKumulasiAlur, tentukanAlurBasKumulasi, type MasukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";
import { ALUR_BAS_BARU, type AlurBasBaru, type LangkahBasBaru, type MenuBasBaru } from "@/lib/alur-bas-baru-data";
import { semuaSalinanBas } from "@/lib/salinan-bas-jenis";

export { ALUR_BAS_BARU };
export type { AlurBasBaru, LangkahBasBaru, MenuBasBaru };

export type MasukanBasBaru = MasukanAlurBasKumulasi & {
  /** "123/Pdt.G/2026/PA.Dgl" - membedakan itsbat kontensius (Pdt.G) dari permohonan (Pdt.P). */
  nomorPerkara?: string;
};

export type AlurBasBaruRingkas = { id: string; nomor: number; nama: string; folder: string; menu: MenuBasBaru };

export type HasilBasBaru = {
  alur: AlurBasBaruRingkas;
  langkah: LangkahBasBaru;
  /** Langkah lain di alur yang sama yang mungkin. */
  alternatif: LangkahBasBaru[];
  perkiraan: boolean;
  sebab: string;
  mode: "ganti" | "tambah";
};

type JenisBaru =
  | "paw" | "perwalian" | "wali-adhal" | "angkat-anak" | "itsbat" | "itsbat-kontensius" | "dk" | "aua"
  | "hb" | "waris" | "poligami" | "cerai-gugat" | "cerai-talak" | "hak-asuh" | "pembatalan" | "es" | "pencegahan" | "wasiat" | "es-biasa" | "";

/** Jenis perkara SIPP -> jenis yang dikenal berkas ini. Itsbat dipilah menurut nomor (Pdt.G = kontensius). */
export function jenisBasBaru(jenisPerkara: unknown, nomorPerkara?: unknown): JenisBaru {
  const j = String(jenisPerkara ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!j) return "";
  if (j.includes("cerai gugat")) return "cerai-gugat";
  if (j.includes("cerai talak")) return "cerai-talak";
  if (j.includes("ahli waris") || j.includes("p3hp")) return "paw";
  if (j.includes("kewarisan") || /\bwaris\b/.test(j)) return "waris";
  if (j.includes("harta bersama")) return "hb";
  if (j.includes("poligami")) return "poligami";
  if (/wali\s*ad[hl]/.test(j)) return "wali-adhal";
  if (j.includes("perwalian")) return "perwalian";
  // F21 17 Okt: hak asuh anak (349 "Penguasaan Anak"), pembatalan perkawinan (344), ekonomi syariah gugatan sederhana (370, Pdt.G.S).
  if (j.includes("penguasaan anak") || j.includes("hak asuh") || j.includes("hadhanah")) return "hak-asuh";
  if (j.includes("pembatalan perkawinan")) return "pembatalan";
  if (j.includes("ekonomi syariah")) {
    // Gugatan sederhana (Pdt.G.S) = ALUR 40; acara biasa (Pdt.G) = ALUR 43 (F22 17 Okt); nomor yang belum diketahui tidak ditebak.
    const nomor = String(nomorPerkara ?? "");
    if (/\/Pdt\.G\.S\//i.test(nomor)) return "es";
    return /\/Pdt\.G\//i.test(nomor) ? "es-biasa" : "";
  }
  // F22 17 Okt: pencegahan perkawinan (342, Pdt.P) dan wasiat (365).
  if (j.includes("pencegahan")) return "pencegahan";
  if (/\bwasiat\b/.test(j)) return "wasiat";
  // Gugatan hak asuh PA Donggala terdaftar sebagai "Lain-Lain" (369) bernomor Pdt.G; pengangkatan anak selalu permohonan (Pdt.P).
  if (j.includes("lain-lain") && /\/Pdt\.G\//i.test(String(nomorPerkara ?? ""))) return "hak-asuh";
  if (j.includes("lain-lain") || j.includes("pengangkatan anak")) return "angkat-anak";
  if (j.includes("dispensasi")) return "dk";
  if (j.includes("asal usul") || j.includes("asal-usul")) return "aua";
  if (j.includes("istbat") || j.includes("itsbat") || j.includes("pengesahan perkawinan")) {
    return /\/Pdt\.G\//i.test(String(nomorPerkara ?? "")) ? "itsbat-kontensius" : "itsbat";
  }
  return "";
}

const alurMenurutId = (id: string): AlurBasBaru => ALUR_BAS_BARU.find((a) => a.id === id)!;
const ringkas = (a: AlurBasBaru): AlurBasBaruRingkas => ({ id: a.id, nomor: a.nomor, nama: a.nama, folder: a.folder, menu: a.menu });

function buat(
  id: string,
  kode: string,
  alt: string[],
  perkiraan: boolean,
  sebab: string,
  mode: "ganti" | "tambah" = "ganti"
): HasilBasBaru | null {
  const alur = alurMenurutId(id);
  const langkah = alur?.langkah.find((l) => l.kode === kode);
  if (!alur || !langkah) return null;
  const alternatif = alt
    .filter((k) => k !== kode)
    .map((k) => alur.langkah.find((l) => l.kode === k))
    .filter((l): l is LangkahBasBaru => Boolean(l));
  return { alur: ringkas(alur), langkah, alternatif, perkiraan, sebab, mode };
}

const SEMUA_KODE = (id: string) => alurMenurutId(id).langkah.map((l) => l.kode);

const RX_PERBAIKAN = /perbaikan/i;
const RX_ORTU = /orang\s*tua|kandung/i;
const RX_SAKSI = /saksi/i;
const RX_BUKTI = /bukti|pembuktian/i;
const RX_PUTUS = /putusan|penetapan|pengucapan|musyawarah/i;
const RX_CABUT = /cabut/i;
const RX_DAMAI = /perdamaian|damai|mediasi\s+berhasil/i;
const RX_SELA = /putusan\s+sela/i;
const RX_SITA = /sita|insidentil/i;
const RX_SETEMPAT = /setempat/i;

/** Kode langkah keluarga permohonan "pemeriksaan - lanjutan - pembacaan penetapan" menurut urutan sidang dan agenda. */
function kodeKeluarga(id: string, n: number, agenda: string): { kode: string; perkiraan: boolean } {
  const ada = (k: string) => alurMenurutId(id).langkah.some((l) => l.kode === k);
  const pilih = (k: string, fallback: string) => (ada(k) ? k : fallback);
  const putus = RX_PUTUS.test(agenda) && !/pembacaan\s+permohonan/i.test(agenda);
  if (n <= 1) {
    if (RX_PERBAIKAN.test(agenda) && ada("1c")) return { kode: "1c", perkiraan: false };
    if (RX_ORTU.test(agenda) && ada("1d")) return { kode: "1d", perkiraan: false };
    if (RX_BUKTI.test(agenda) && !RX_SAKSI.test(agenda) && ada("1b")) return { kode: "1b", perkiraan: true };
    return { kode: pilih("1a", "1"), perkiraan: true };
  }
  if (n === 2) {
    if (RX_PERBAIKAN.test(agenda)) return { kode: pilih("2a", "2"), perkiraan: false };
    if (putus && !RX_SAKSI.test(agenda)) return { kode: "3", perkiraan: false };
    if (RX_SAKSI.test(agenda) && !putus) return { kode: "2", perkiraan: false };
    return { kode: "3", perkiraan: true };
  }
  if (RX_SAKSI.test(agenda) && !putus) return { kode: "2", perkiraan: false };
  return { kode: "3", perkiraan: !putus };
}

const ID_KELUARGA: Record<string, string> = {
  paw: "alur-14", perwalian: "alur-16", "wali-adhal": "alur-19", "angkat-anak": "alur-18", itsbat: "alur-17", dk: "alur-12l", aua: "alur-13l",
};

function permohonan(jenis: JenisBaru, m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  const h = m.dihadiriOleh;
  const id = ID_KELUARGA[jenis];
  const namaJenis = jenis === "dk" ? "Dispensasi kawin" : jenis === "aua" ? "Asal usul anak" : jenis === "itsbat" ? "Itsbat nikah" : "Permohonan";

  // Itsbat gugur/cabut sudah dilayani peta 946 (alur-bas-kumulasi): tidak diubah.
  if (jenis === "itsbat" && (akhir === "cabut" || akhir === "gugur")) return null;

  if (akhir === "cabut") {
    return jenis === "dk"
      ? buat("alur-12l", "C", [], false, "Dispensasi kawin dicabut sesudah nasihat hakim.")
      : buat("alur-15", "C", [], false, `${namaJenis} dicabut: BAS permohonan umum.`);
  }
  if (akhir === "gugur") return buat("alur-15", "G", ["T", "N"], false, `${namaJenis} gugur (Pemohon tidak pernah hadir): BAS permohonan umum.`);
  if (akhir === "no") {
    return jenis === "paw"
      ? buat("alur-14", "NO", [], false, "Permohonan kabur dan tidak diperbaiki: tidak dapat diterima.")
      : buat("alur-15", "N", ["G"], false, `${namaJenis} tidak dapat diterima (SEMA 1/2022).`);
  }
  if (h === 4) {
    // Itsbat sidang ke-2 dst. tanpa Pemohon: sudah dilayani peta 946 [G].
    if (jenis === "itsbat" && n >= 2) return null;
    return n <= 1
      ? buat("alur-15", "T", ["G", "N"], true, `${namaJenis}: Pemohon tidak hadir - tunda panggil Pemohon.`)
      : buat("alur-15", "G", ["T", "N"], true, `${namaJenis}: Pemohon tidak hadir lagi - gugur bila tidak pernah hadir (G), NO SEMA 1/2022 bila pernah hadir (N), atau tunda panggil lagi (T).`);
  }
  if (!id) return null;

  const { kode, perkiraan } = kodeKeluarga(id, n, agenda);
  const lain = SEMUA_KODE(id).filter((k) => k !== kode);
  if (jenis === "dk") {
    // Sidang 1 DK sudah dilayani ALUR 12 (putus di sidang 1); varian TUNDA (1t...) hanya ditawarkan. Sidang 2 dst. = pembacaan penetapan.
    if (n <= 1) {
      const lainDk = ["1t", "1at", "2t", "2at"];
      return buat(id, "1t", lainDk, true, "Dispensasi kawin sidang 1 ditunda pembacaan penetapannya: pilih menurut anak (perempuan/laki-laki) dan keadaannya.", "tambah");
    }
    return buat(id, "3", ["C"], perkiraan, "Dispensasi kawin sidang lanjutan: pembacaan penetapan.");
  }
  if ((jenis === "itsbat" || jenis === "aua") && n <= 1) {
    return buat(id, "1a", ["1b", "1c"], true, `${namaJenis} sidang 1 yang ditunda: varian tunda pembacaan penetapan / tunda saksi / tunda perbaikan.`, "tambah");
  }
  const sebab =
    n <= 1
      ? `${namaJenis} sidang 1 (kabul 1x sidang [1], atau ditunda [1a]/[1b]/[1c]).`
      : `${namaJenis} sidang ke-${n}: ${kode === "3" ? "pembacaan penetapan" : kode === "2" ? "pemeriksaan saksi sidang lanjutan" : "lanjutan"}.`;
  return buat(id, kode, lain, perkiraan, sebab);
}

/** Salinan BAS ALUR 04 (kontradiktoir) di folder jenis harta bersama / kewarisan, dibaca dari tabel salinan A3. */
function salinanAlur04(folderJenis: string, m: MasukanBasBaru): HasilBasBaru | null {
  const dasar = tentukanAlurBas({ ...m, jenisPerkara: "Cerai Gugat", dihadiriOleh: 1, tergugatPernahHadir: true, akhir: null, sidangIkrarTalak: false });
  if (!dasar.alur || !dasar.langkah) return null;
  const alurJenis = ALUR_BAS_BARU.find((a) => a.folder === folderJenis);
  if (!alurJenis) return null;
  const ambilSalinan = (berkas: string): LangkahBasBaru | null => {
    const s = semuaSalinanBas(dasar.alur!.folder, berkas).find((x) => x.folder === folderJenis);
    return s ? { kode: "", berkas: s.berkas, keterangan: "" } : null;
  };
  const utama = ambilSalinan(dasar.langkah.berkas);
  if (!utama) return null;
  const jadi = (l: LangkahBasBaru, asal: { kode: string; keterangan: string }): LangkahBasBaru => ({ kode: asal.kode, berkas: l.berkas, keterangan: asal.keterangan });
  const alternatif = dasar.alternatif
    .map((a) => {
      const s = ambilSalinan(a.berkas);
      return s ? jadi(s, a) : null;
    })
    .filter((l): l is LangkahBasBaru => Boolean(l));
  return {
    alur: { id: dasar.alur.id, nomor: dasar.alur.nomor, nama: `${dasar.alur.nama} (salinan di folder jenis)`, folder: folderJenis, menu: alurJenis.menu },
    langkah: jadi(utama, dasar.langkah),
    alternatif,
    perkiraan: dasar.perkiraan || m.dihadiriOleh !== 1,
    sebab: `${dasar.sebab} Gugatan ini memakai BAS kontradiktoir ALUR 04 yang disalin ke folder jenisnya.`,
    mode: "ganti",
  };
}

/** Harta bersama (ALUR 30/31) dan kewarisan (32/33): sidang insidentil, pemeriksaan setempat, damai, cabut, P tidak hadir, NO. */
function gugatanKebendaan(jenis: "hb" | "waris", m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const id30 = jenis === "hb" ? "alur-30" : "alur-32";
  const id31 = jenis === "hb" ? "alur-31" : "alur-33";
  const nama = jenis === "hb" ? "Harta bersama" : "Kewarisan";
  const h = m.dihadiriOleh;
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  if (akhir === "no") return buat(id31, "NO", ["TP"], false, `${nama}: Penggugat dua kali tidak hadir - tidak dapat diterima (SEMA 1/2022).`);
  if (akhir === "cabut") return buat(id31, "CB", ["AP"], false, `${nama}: gugatan dicabut.`);
  if (RX_DAMAI.test(agenda)) return buat(id31, "AP", ["CB"], false, `${nama}: mediasi berhasil - akta perdamaian (atau gugatan dicabut).`);
  if (h === 3 || h === 4) return buat(id31, "TP", ["NO"], true, `${nama}: Penggugat tidak hadir - tunda panggil P; bila sudah dua kali tidak hadir: putusan NO.`);
  if (RX_SETEMPAT.test(agenda)) return buat(id30, "PS", ["I2"], false, `${nama}: sidang pemeriksaan setempat di lokasi objek.`);
  if (RX_SELA.test(agenda)) return buat(id30, "I2", ["PS"], false, `${nama}: pembacaan putusan sela (sita atau pemeriksaan setempat).`);
  if (RX_SITA.test(agenda)) return buat(id30, "I1", ["I2"], false, `${nama}: sidang insidentil - pemeriksaan permohonan sita.`);
  return salinanAlur04(alurMenurutId(id30).folder, { ...m, urutanSidang: n });
}

/**
 * F21 17 Okt - hak asuh anak (ALUR 38) dan pembatalan perkawinan (ALUR 39): gugatan cerai-lanjutan yang sering verstek. Sidang yang dihadiri
 * kedua pihak memakai salinan BAS kontradiktoir ALUR 04-09 di folder jenisnya (seperti HB/waris); T tidak hadir, mediasi berhasil, cabut,
 * P tidak hadir, dan NO memakai BAS khusus ALUR 38/39. Perdamaian (akta) hanya hak asuh; pembatalan perkawinan tidak dapat didamaikan.
 */
function gugatanKeluarga(jenis: "hak-asuh" | "pembatalan" | "wasiat" | "es-biasa", m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  // F22 17 Okt: wasiat (ALUR 42) dan ES acara biasa (ALUR 43) berpola sama dengan hak asuh: mediasi dan akta perdamaian ada; hanya pembatalan yang tidak.
  const asuh = jenis !== "pembatalan";
  const id = { "hak-asuh": "alur-38", pembatalan: "alur-39", wasiat: "alur-42", "es-biasa": "alur-43" }[jenis];
  const nama = { "hak-asuh": "Hak asuh anak", pembatalan: "Pembatalan perkawinan", wasiat: "Wasiat", "es-biasa": "Ekonomi syariah (acara biasa)" }[jenis];
  const h = m.dihadiriOleh;
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  if (akhir === "no") return buat(id, "NO", ["TP"], false, `${nama}: Penggugat dua kali tidak hadir - tidak dapat diterima (SEMA 1/2022).`);
  // I7 17 Okt: pembatalan perkawinan DIKECUALIKAN dari mediasi (PERMA 1/2016 Pasal 4 ayat (2) huruf d); BAS "Mediasi Berhasil - Gugatan Dicabut" dan
  // semua BAS mediasi salinan ALUR 04-08 dipindah ke derry_briantono/terhapus. Cabut/damai pada 344 tidak diusulkan BAS mediasi dari folder mana pun.
  if (akhir === "cabut") return asuh ? buat(id, "CB", ["AP"], false, `${nama}: gugatan dicabut.`) : null;
  if (RX_DAMAI.test(agenda)) {
    return asuh ? buat(id, "AP", ["CB"], false, `${nama}: mediasi berhasil - akta perdamaian (atau gugatan dicabut).`) : null;
  }
  if (h === 3 || h === 4) return buat(id, "TP", ["NO"], true, `${nama}: Penggugat tidak hadir - tunda panggil P; bila sudah dua kali tidak hadir: putusan NO.`);
  // T tidak hadir dan tidak pernah hadir: verstek (sidang 1 tunda panggil T, sidang 2 pembuktian dan putusan verstek).
  if (h === 2 && m.tergugatPernahHadir !== true) {
    return n <= 1
      ? buat(id, "V1", ["V2"], false, `${nama} sidang 1: Penggugat hadir, Tergugat tidak hadir - tunda panggil T.`)
      : buat(id, "V2", ["V1"], n > 2, `${nama} sidang ke-${n}: Tergugat tetap tidak hadir - pembuktian dan putusan verstek.`);
  }
  if (jenis === "pembatalan" && n <= 1) return pembatalanSidangPertama(m);
  return salinanAlur04(alurMenurutId(id).folder, { ...m, urutanSidang: n });
}

/**
 * I7 17 Okt: sidang pertama pembatalan perkawinan yang dihadiri kedua pihak. BAS "Mediasi" ([1] ALUR 04/05/06) tidak ada lagi di folder 5a;
 * "Laporan Mediasi dan Pemeriksaan Pokok Perkara" ALUR 04 [2] (tertulis/e-litigasi) dan "Pembacaan Gugatan dan Jawab Menjawab Lisan" ALUR 05 [2]
 * (lisan) - namanya tetap, isinya kini pengecualian mediasi + pemeriksaan pokok dalam sidang TERTUTUP - menjadi BAS sidang itu.
 */
function pembatalanSidangPertama(m: MasukanBasBaru): HasilBasBaru | null {
  const folderJenis = alurMenurutId("alur-39").folder;
  const ambil = (idAlur: string): { alur: ReturnType<typeof alurBasMenurutId>; langkah: LangkahBasBaru } | null => {
    const alur = alurBasMenurutId(idAlur);
    const asal = alur?.langkah.find((l) => l.kode === "2");
    if (!alur || !asal) return null;
    const s = semuaSalinanBas(alur.folder, asal.berkas).find((x) => x.folder === folderJenis);
    return s ? { alur, langkah: { kode: asal.kode, berkas: s.berkas, keterangan: asal.keterangan } } : null;
  };
  const utama = ambil("alur-04");
  const lisan = ambil("alur-05");
  if (!utama?.alur) return null;
  const jenisAlur = alurMenurutId("alur-39");
  return {
    alur: { id: utama.alur.id, nomor: utama.alur.nomor, nama: `${utama.alur.nama} (salinan di folder jenis)`, folder: folderJenis, menu: jenisAlur.menu },
    langkah: utama.langkah,
    alternatif: lisan ? [lisan.langkah] : [],
    perkiraan: m.dihadiriOleh !== 1,
    sebab:
      "Pembatalan perkawinan dikecualikan dari mediasi (PERMA 1/2016 Pasal 4 ayat (2) huruf d): sidang pertama P & T hadir langsung memeriksa pokok perkara (BAS ALUR 04 [2] " +
      "untuk acara tertulis/e-litigasi, ALUR 05 [2] untuk acara lisan).",
    mode: "ganti",
  };
}

/**
 * F22 17 Okt - pencegahan perkawinan (ALUR 41, permohonan Pdt.P tanpa Termohon): sidang 1 menurut kehadiran calon mempelai ([1]/[1a] hadir, [1b] tidak hadir ->
 * tunda panggil), lanjutan [2]/[2b], pembacaan penetapan [3]; Pemohon tidak hadir [T], gugur [G], NO SEMA [N], cabut [C]. Calon mempelai bukan pihak di SIPP,
 * jadi kehadiran mereka tidak terbaca dari dihadiri_oleh: pilihan sidang 1 selalu perkiraan (agenda menentukan bila menyebut tunda/putus).
 */
function pencegahanPerkawinan(m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const h = m.dihadiriOleh;
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  const id = "alur-41";
  if (akhir === "cabut") return buat(id, "C", [], false, "Pencegahan perkawinan: Pemohon hadir mencabut permohonan.");
  if (akhir === "gugur") return buat(id, "G", ["T", "N"], false, "Pencegahan perkawinan: Pemohon tidak pernah hadir - permohonan gugur.");
  if (akhir === "no") return buat(id, "N", ["G"], false, "Pencegahan perkawinan: Pemohon hadir lalu dua kali tidak hadir - tidak dapat diterima (SEMA 1/2022).");
  if (h === 4) {
    return n <= 1
      ? buat(id, "T", ["G", "N"], true, "Pencegahan perkawinan: Pemohon tidak hadir - tunda panggil Pemohon.")
      : buat(id, "G", ["T", "N"], true, "Pencegahan perkawinan: Pemohon tidak hadir lagi - gugur bila tidak pernah hadir (G), NO SEMA 1/2022 bila pernah hadir (N), atau tunda panggil lagi (T).");
  }
  const putus = RX_PUTUS.test(agenda) && !/pembacaan\s+permohonan/i.test(agenda);
  const tundaPanggil = /tidak\s+hadir|panggil/i.test(agenda) && /tunda|panggil/i.test(agenda);
  if (n <= 1) {
    if (tundaPanggil) return buat(id, "1b", ["1", "1a"], true, "Pencegahan perkawinan sidang 1: calon mempelai tidak hadir - bukti surat, tunda panggil.");
    return putus
      ? buat(id, "1", ["1a", "1b"], false, "Pencegahan perkawinan sidang 1: calon mempelai hadir, bukti dan 2 saksi, penetapan dibacakan.")
      : buat(id, "1a", ["1", "1b"], true, "Pencegahan perkawinan sidang 1: calon mempelai hadir, bukti dan 2 saksi, penetapan ditunda (bila langsung dibacakan: [1]; bila calon tidak hadir: [1b]).");
  }
  if (n === 2) {
    return putus
      ? buat(id, "2b", ["2", "3"], false, "Pencegahan perkawinan sidang 2: calon mempelai dan 2 saksi, penetapan dibacakan.")
      : buat(id, "2", ["2b", "3"], true, "Pencegahan perkawinan sidang 2: calon mempelai dan 2 saksi, penetapan ditunda.");
  }
  return buat(id, "3", ["2b"], !putus, `Pencegahan perkawinan sidang ke-${n}: pembacaan penetapan.`);
}

/** Ekonomi syariah gugatan sederhana (ALUR 40, hakim tunggal): sidang 1 menurut kehadiran, sidang 2 pembuktian/verstek, lalu pengucapan putusan. */
function ekonomiSyariah(m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const h = m.dihadiriOleh;
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  if (akhir === "cabut") return buat("alur-40", "C", [], false, "Ekonomi syariah gugatan sederhana: Penggugat mencabut gugatan.");
  if (akhir === "gugur") return buat("alur-40", "1c", [], false, "Ekonomi syariah gugatan sederhana: Penggugat tidak hadir - gugatan gugur.");
  if (akhir === "no") return buat("alur-40", "1d", [], false, "Ekonomi syariah gugatan sederhana: Tergugat tidak diketahui tempat tinggalnya - tidak dapat diterima.");
  if (RX_DAMAI.test(agenda)) return buat("alur-40", "1a", ["1"], false, "Ekonomi syariah gugatan sederhana: damai berhasil di hadapan hakim - akta perdamaian.");
  if (/pengucapan|pembacaan\s+putusan|putusan\s+dibacakan/i.test(agenda)) return buat("alur-40", "3", ["2a"], false, "Ekonomi syariah gugatan sederhana: pengucapan putusan.");
  if (h === 3 || h === 4) return buat("alur-40", "1c", ["1"], true, "Ekonomi syariah gugatan sederhana: Penggugat tidak hadir - gugatan gugur (periksa kehadirannya).");
  if (n <= 1) {
    return h === 2
      ? buat("alur-40", "1b", ["1d", "1"], false, "Ekonomi syariah gugatan sederhana sidang 1: Tergugat tidak hadir - panggil Tergugat kedua kali (bila tempat tinggalnya tidak diketahui: [1d] NO).")
      : buat("alur-40", "1", ["1a", "1d"], h !== 1, "Ekonomi syariah gugatan sederhana sidang 1: P & T hadir, damai gagal, gugatan dan jawaban (damai berhasil: [1a]).");
  }
  if (n === 2) {
    return h === 2
      ? buat("alur-40", "2a", ["2"], false, "Ekonomi syariah gugatan sederhana sidang 2: Tergugat tetap tidak hadir - bukti dan putusan verstek.")
      : buat("alur-40", "2", ["2a", "3"], h !== 1, "Ekonomi syariah gugatan sederhana sidang 2: P & T hadir - pembuktian, tunda putusan.");
  }
  return buat("alur-40", "3", ["2a"], true, `Ekonomi syariah gugatan sederhana sidang ke-${n}: pengucapan putusan.`);
}

function izinPoligami(m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  if (akhir === "cabut") return buat("alur-34", "CB", ["S2"], false, "Izin poligami: mediasi berhasil, permohonan dicabut.");
  const perkiraan = m.dihadiriOleh !== 1;
  if (n <= 1) return buat("alur-34", "S1", ["S2"], perkiraan, "Izin poligami sidang 1: P & T hadir, mediasi.");
  if (n === 2) return buat("alur-34", "S2", ["S3", "CB"], perkiraan, "Izin poligami sidang 2: laporan mediasi, permohonan, jawaban Termohon dan calon istri.");
  return buat("alur-34", "S3", ["S2"], perkiraan, `Izin poligami sidang ke-${n}: pembuktian dan pengucapan putusan.`);
}

function itsbatKontensius(m: MasukanBasBaru, n: number, agenda: string): HasilBasBaru | null {
  const h = m.dihadiriOleh;
  const akhir = m.akhir ?? (RX_CABUT.test(agenda) ? "cabut" : null);
  if (akhir === "no") return buat("alur-35", "NO", ["TP"], false, "Itsbat nikah kontensius: Penggugat dua kali tidak hadir - tidak dapat diterima (SEMA 1/2022).");
  if (akhir === "cabut") return buat("alur-35", "CB", [], false, "Itsbat nikah kontensius: P & T hadir, gugatan dicabut.");
  if (h === 3 || h === 4) return buat("alur-35", "TP", ["NO"], true, "Itsbat nikah kontensius: Penggugat tidak hadir - tunda panggil P; bila sudah dua kali tidak hadir: putusan NO.");
  if (n <= 1) {
    const putus = RX_PUTUS.test(agenda) || (RX_BUKTI.test(agenda) && !/tunda/i.test(agenda));
    return putus
      ? buat("alur-35", "S1P", ["S1T"], false, "Itsbat kontensius sidang 1: Tergugat mengakui, pembuktian dan putusan.")
      : buat("alur-35", "S1T", ["S1P", "CB"], true, "Itsbat kontensius sidang 1: Tergugat mengakui, pembuktian ditunda (bila langsung dibuktikan dan diputus: [S1P]).");
  }
  return buat("alur-35", "S2", ["S1P"], h !== 1, `Itsbat kontensius sidang ke-${n}: pembuktian dan putusan.`);
}

const PETA_KUMULASI_ITSBAT: Record<string, Record<string, string>> = {
  "alur-02": { "1": "S1", "1a": "S1", "2": "P2", "2a": "P3", "2b": "P3", "2c": "P3" },
  "alur-03": { "1": "S1", "1a": "S1", "2": "L", "3": "P2", "3a": "P3", "3b": "P3", "3c": "P3" },
};
const PETA_KUMULASI_ASUH: Record<string, string> = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "5a": "5", "6": "6", "6a": "6", "6b": "6", "6c": "6", "7": "7", "7a": "7", "7b": "7", "8": "8", "9": "9" };

/** Cerai + kumulasi: itsbat verstek (ALUR 36, folder 1c) dan hak asuh kontradiktoir (ALUR 37, folder 1d). */
function ceraiKumulasi(jenis: JenisBaru, m: MasukanBasBaru): HasilBasBaru | null {
  if (m.akhir) return null;
  const butir = butirKumulasiAlur(m.kumulasi);
  const ada = (k: string) => butir.some((b) => b.kode === k);
  const dasar = tentukanAlurBasKumulasi(m);
  if (!dasar.alur || !dasar.langkah) return null;
  if (jenis === "cerai-gugat" && ada("hak-asuh-anak") && dasar.alur.id === "alur-04") {
    const kode = PETA_KUMULASI_ASUH[dasar.langkah.kode];
    if (!kode) return null;
    const sebagian = kode === "2" && /berhasil\s+sebagian|kesepakatan\s+sebagian|hak\s+asuh/i.test(String(m.agenda ?? ""));
    return buat(
      "alur-37",
      sebagian ? "2m" : kode,
      kode === "2" ? (sebagian ? ["2"] : ["2m"]) : [],
      dasar.perkiraan,
      `${dasar.sebab} Kumulasi hak asuh anak kontradiktoir: BAS ALUR 37 (folder 1d).`
    );
  }
  if ((jenis === "cerai-gugat" || jenis === "cerai-talak") && ada("itsbat-nikah") && !ada("hak-asuh-anak")) {
    const kode = PETA_KUMULASI_ITSBAT[dasar.alur.id]?.[dasar.langkah.kode];
    if (!kode) return null;
    const dariPetitum = butir.some((b) => b.kode === "itsbat-nikah" && b.sumber === "petitum");
    return buat(
      "alur-36",
      kode,
      kode === "P2" ? ["P3"] : kode === "P3" ? ["P2"] : [],
      dasar.perkiraan,
      `${dasar.sebab} Kumulasi itsbat nikah verstek: BAS ALUR 36 (folder 1c) memuat amar itsbat.` +
        (dariPetitum ? " Kumulasi baru terbaca dari petitum - lengkapi data kumulasi di SIPP." : "")
    );
  }
  return null;
}

/**
 * BAS baru untuk satu sidang, atau null bila tidak ada yang berubah (jenis/keadaan lama tetap dilayani peta ALUR 01-13 dan
 * pilihan katalog yang sudah ada).
 */
export function tentukanBasBaru(m: MasukanBasBaru): HasilBasBaru | null {
  const jenis = jenisBasBaru(m.jenisPerkara, m.nomorPerkara);
  if (!jenis) return null;
  const n = Number.isFinite(m.urutanSidang) && m.urutanSidang > 0 ? Math.floor(m.urutanSidang) : 1;
  const agenda = String(m.agenda ?? "");
  switch (jenis) {
    case "cerai-gugat":
    case "cerai-talak":
      return ceraiKumulasi(jenis, m);
    case "hb":
    case "waris":
      return gugatanKebendaan(jenis, m, n, agenda);
    case "poligami":
      return izinPoligami(m, n, agenda);
    case "hak-asuh":
    case "pembatalan":
    case "wasiat":
    case "es-biasa":
      return gugatanKeluarga(jenis, m, n, agenda);
    case "pencegahan":
      return pencegahanPerkawinan(m, n, agenda);
    case "es":
      return ekonomiSyariah(m, n, agenda);
    case "itsbat-kontensius":
      return itsbatKontensius(m, n, agenda);
    default:
      return permohonan(jenis, m, n, agenda);
  }
}

/* === AKHIR G3 === */
