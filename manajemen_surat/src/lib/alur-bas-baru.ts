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
 * TIDAK mengubah tentukanAlurBas / tentukanAlurBasKumulasi (peta ALUR 01-13 dan 945/946) maupun pilihan yang sudah ada:
 *   - mode "ganti"  = jenis yang dulu tanpa BAS (PAW, perwalian, wali adhal, pengangkatan anak, HB, waris, poligami, itsbat
 *                     kontensius), lanjutan itsbat/DK/AUA (sidang ke-2 dst.), tidak hadir/gugur/NO/cabut permohonan, kumulasi
 *                     itsbat verstek dan kumulasi hak asuh kontradiktoir -> menjadi usulan (kecuali admin memetakan blangko lain);
 *   - mode "tambah" = sidang 1 itsbat/DK/AUA yang ditunda: varian baru hanya ditawarkan, usulan lama tetap.
 * Murni: tanpa jaringan dan tanpa basis data.
 */
import { tentukanAlurBas } from "@/lib/alur-bas";
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
  | "hb" | "waris" | "poligami" | "cerai-gugat" | "cerai-talak" | "";

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
    case "itsbat-kontensius":
      return itsbatKontensius(m, n, agenda);
    default:
      return permohonan(jenis, m, n, agenda);
  }
}

/* === AKHIR G3 === */
