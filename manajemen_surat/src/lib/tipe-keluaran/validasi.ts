import { CABANG_JAWABAN_MODUS } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import {
  AMBANG_UKUR,
  BATAS_DAFTAR,
  DAFTAR_TIPE,
  adalahKunciDaftar,
  type DataEntri,
  type JenisUkur,
  type KunciDaftar,
} from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * VALIDASI ENTRI TIPE KELUARAN (K2, K6)
 * ============================================================================
 *
 * Dipakai DUA tempat dengan aturan yang sama: modul peladen (penjagaan yang
 * sesungguhnya) dan formulir usul di layar (supaya penolakan terbaca sebelum
 * dikirim). Karena itu berkas ini murni - tanpa impor peladen.
 *
 * Yang ditolak untuk SEMUA daftar, sebab masing-masing sudah pernah atau
 * pasti akan merusak keluaran tanpa galat:
 *   - '${'           penyisipan templat; bot menyusun kalimat dari templat
 *   - '<'            potongan HTML/tag di dalam naskah
 *   - baris baru     memecah satu butir menjadi dua di BAS/putusan
 *   - > 400 huruf    batas saring bot (K6); portal menolaknya lebih dulu
 *   - sebutan pihak berhuruf kecil di awal kalimat ('penggugat dan Tergugat')
 *                    - terukur 454 dari 2.196 jawaban ALETA, 208 dari 66.506
 *                    pada tulisan manusia
 *   - 'X dan X'      kata ganda ('perselisihan dan perselisihan', 21 kali)
 *   - penanda di luar daftar penanda yang sah bagi daftarnya
 * Daftar yang tidak terdaftar adalah GALAT (GalatDaftarTakTerdaftar, 400) -
 * bukan jawaban kosong.
 */

export class GalatDaftarTakTerdaftar extends Error {
  readonly status = 400;

  constructor(daftar: unknown) {
    super(`Daftar tipe keluaran "${String(daftar)}" tidak terdaftar.`);
    this.name = "GalatDaftarTakTerdaftar";
  }
}

/** Menuntut nama daftar yang terdaftar - atau melempar galat 400. */
export function pastikanDaftar(daftar: unknown): KunciDaftar {
  if (!adalahKunciDaftar(daftar)) throw new GalatDaftarTakTerdaftar(daftar);
  return daftar;
}

export type MasukanEntri = { kunci?: unknown; nilai?: unknown; data?: unknown };

export type EntriSah = { kunci: string; nilai: string; data: DataEntri };

export type HasilValidasi = { ok: true; entri: EntriSah } | { ok: false; alasan: string[] };

const SEBUTAN_PIHAK = "penggugat|tergugat|pemohon|termohon|pelawan|terlawan|pembanding|terbanding";
const POLA_SEBUTAN_KECIL = new RegExp(`(^|[.!?]\\s+)(${SEBUTAN_PIHAK})\\b`);
// Huruf Latin termasuk beraksen, ditulis sebagai rentang: target tsconfig ES2017
// belum mengenal \p{L}.
const POLA_KATA_GANDA = /(^|[^A-Za-zÀ-ɏ])([A-Za-zÀ-ɏ]{3,})\s+dan\s+\2(?![A-Za-zÀ-ɏ])/i;
const POLA_PENANDA_KURAWAL = /\{[^{}]*\}/g;
const POLA_PENANDA_VARIABEL = /#\d{4}#/g;
const POLA_SATU_PENANDA_VARIABEL = /^#\d{4}#$/;
const POLA_KATA_POLOS = /^[a-z]+( [a-z]+)*$/;
const POLA_PENUNJUK_NAMA = /^[a-z]*\[name="[A-Za-z0-9_-]+(\[\])?"\]$/;
const POLA_PENUNJUK_ID = /^#[A-Za-z][\w-]*$/;
const POLA_KUNCI_TANYA = /^[a-z0-9#]+( [a-z0-9#]+)*$/;

function objekPolos(nilai: unknown): nilai is Record<string, unknown> {
  return Boolean(nilai) && typeof nilai === "object" && !Array.isArray(nilai);
}

/** Seluruh string di dalam data, sedalam apa pun - aturan umum berlaku padanya juga. */
function stringDiDalam(nilai: unknown, keluar: string[] = []): string[] {
  if (typeof nilai === "string") keluar.push(nilai);
  else if (Array.isArray(nilai)) for (const x of nilai) stringDiDalam(x, keluar);
  else if (objekPolos(nilai)) for (const x of Object.values(nilai)) stringDiDalam(x, keluar);
  return keluar;
}

function aturanUmumTeks(label: string, teks: string, alasan: string[]) {
  if (teks.includes("${")) alasan.push(`${label} memuat '\${' - penyisipan templat tidak diterima.`);
  if (teks.includes("<")) alasan.push(`${label} memuat '<' - potongan HTML tidak diterima.`);
  if (/[\r\n]/.test(teks)) alasan.push(`${label} memuat baris baru - satu entri harus satu baris.`);
}

function periksaPenanda(teks: string, sah: readonly string[], alasan: string[]) {
  const bolehVariabel = sah.includes("#dddd#");
  const ditemukan = [...(teks.match(POLA_PENANDA_KURAWAL) ?? []), ...(teks.match(POLA_PENANDA_VARIABEL) ?? [])];
  const asing = ditemukan.filter((p) => !(sah.includes(p) || (bolehVariabel && POLA_SATU_PENANDA_VARIABEL.test(p))));
  if (asing.length) {
    alasan.push(
      `Penanda ${[...new Set(asing)].join(", ")} tidak dikenal daftar ini` +
        (sah.length ? ` (yang sah: ${sah.join(", ")}).` : " (daftar ini tidak memakai penanda).")
    );
  }
  const sisa = teks.replace(POLA_PENANDA_KURAWAL, "");
  if (/[{}]/.test(sisa)) alasan.push("Kurung kurawal tidak berpasangan.");
}

function kunciDataDikenal(data: Record<string, unknown>, dikenal: readonly string[], alasan: string[]) {
  const asing = Object.keys(data).filter((k) => !dikenal.includes(k));
  if (asing.length) {
    alasan.push(
      dikenal.length
        ? `Ruas data ${asing.join(", ")} tidak dikenal (yang dikenal: ${dikenal.join(", ")}).`
        : `Daftar ini tidak memakai data (ditemukan: ${asing.join(", ")}).`
    );
  }
}

function panjangAntara(label: string, teks: string, min: number, maks: number, alasan: string[]) {
  const n = [...teks].length;
  if (n < min || n > maks) alasan.push(`${label} harus ${min}-${maks} huruf (kini ${n}).`);
}

function teksWajib(label: string, nilai: unknown, alasan: string[], maks = 200): string {
  if (typeof nilai !== "string" || !nilai.trim()) {
    alasan.push(`${label} wajib diisi.`);
    return "";
  }
  if ([...nilai].length > maks) alasan.push(`${label} paling panjang ${maks} huruf.`);
  if (nilai !== nilai.trim()) alasan.push(`${label} tidak boleh diawali atau diakhiri spasi.`);
  return nilai;
}

/** Bentuk baku jenis perkara: huruf kecil, satu spasi, tanpa spasi tepi. */
function bakuJenis(teks: string): string {
  return teks.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Memeriksa satu entri calon tambahan untuk sebuah daftar.
 *
 * Melempar GalatDaftarTakTerdaftar bila daftarnya tidak terdaftar; selain itu
 * menjawab {ok:false, alasan:[...]} dengan SEMUA alasan sekaligus - petugas
 * yang memperbaiki satu per satu lalu ditolak lagi oleh alasan berikutnya
 * akan berhenti mengisi.
 */
export function validasiEntri(daftar: unknown, masukan: MasukanEntri): HasilValidasi {
  const kunciDaftar = pastikanDaftar(daftar);
  const ketentuan = DAFTAR_TIPE[kunciDaftar];
  const alasan: string[] = [];

  const kunci = masukan.kunci === undefined || masukan.kunci === null ? "" : masukan.kunci;
  const nilai = masukan.nilai;
  const dataMentah = masukan.data === undefined || masukan.data === null ? {} : masukan.data;

  if (typeof kunci !== "string") alasan.push("Kunci harus berupa teks.");
  if (typeof nilai !== "string") alasan.push("Nilai harus berupa teks.");
  if (!objekPolos(dataMentah)) alasan.push("Data harus berupa objek.");
  if (alasan.length) return { ok: false, alasan };

  const k = kunci as string;
  const v = nilai as string;
  const data = dataMentah as Record<string, unknown>;

  // ---- aturan umum ----
  aturanUmumTeks("Kunci", k, alasan);
  aturanUmumTeks("Nilai", v, alasan);
  for (const s of stringDiDalam(data)) aturanUmumTeks("Data", s, alasan);
  if ([...v].length > BATAS_DAFTAR.hurufNilai) {
    alasan.push(`Nilai paling panjang ${BATAS_DAFTAR.hurufNilai} huruf (kini ${[...v].length}).`);
  }
  if (JSON.stringify(data).length > 4000) alasan.push("Data terlalu besar (lebih dari 4.000 huruf).");
  for (const teks of [v, ...stringDiDalam(data)]) {
    const kecil = teks.match(POLA_SEBUTAN_KECIL);
    if (kecil) {
      alasan.push(`Sebutan pihak '${kecil[2]}' ditulis huruf kecil di awal kalimat - tulis '${kecil[2].charAt(0).toUpperCase()}${kecil[2].slice(1)}'.`);
      break;
    }
  }
  for (const teks of [v, ...stringDiDalam(data)]) {
    const ganda = teks.match(POLA_KATA_GANDA);
    if (ganda) {
      alasan.push(`Kata ganda '${ganda[2]} dan ${ganda[2]}'.`);
      break;
    }
  }
  periksaPenanda(v, ketentuan.penanda, alasan);

  // ---- aturan per daftar ----
  switch (kunciDaftar) {
    case "bas.saksi.pembuka": {
      if (k !== "") alasan.push("Kunci pembuka harus kosong.");
      panjangAntara("Pembuka", v, 3, 40, alasan);
      if (!v.endsWith(", ")) alasan.push("Pembuka harus diakhiri ', ' (koma dan spasi).");
      kunciDataDikenal(data, ["bobot", "saksi"], alasan);
      if (data.bobot !== undefined && !(typeof data.bobot === "number" && data.bobot > 0 && data.bobot <= 100)) {
        alasan.push("Bobot harus angka lebih dari 0 dan paling besar 100.");
      }
      if (data.saksi !== undefined && data.saksi !== 1 && data.saksi !== 2) alasan.push("Saksi harus 1 atau 2.");
      break;
    }
    case "bas.saksi.ragam-kata": {
      if (k !== "") alasan.push("Kunci ganti kata harus kosong.");
      kunciDataDikenal(data, ["ganti", "abaikanBesarKecil"], alasan);
      if (!POLA_KATA_POLOS.test(v) || v.length > 30) {
        alasan.push("Kata harus kata polos berhuruf kecil (a-z dan spasi), paling panjang 30 huruf - regex tidak diterima.");
      }
      if (typeof data.ganti !== "string" || !POLA_KATA_POLOS.test(data.ganti) || data.ganti.length > 30) {
        alasan.push("Ganti harus kata polos berhuruf kecil (a-z dan spasi), paling panjang 30 huruf.");
      } else if (data.ganti === v) {
        alasan.push("Ganti sama dengan katanya.");
      }
      if (data.abaikanBesarKecil !== undefined && data.abaikanBesarKecil !== true) {
        alasan.push("abaikanBesarKecil hanya boleh true atau tidak diisi.");
      }
      break;
    }
    case "bas.saksi.jawaban-modus": {
      if (!Object.prototype.hasOwnProperty.call(CABANG_JAWABAN_MODUS, k)) {
        alasan.push(
          `Kunci '${k}' tidak punya cabang kode (yang ada: ${Object.keys(CABANG_JAWABAN_MODUS).join(", ")}).`
        );
      }
      panjangAntara("Templat jawaban", v, 20, 240, alasan);
      kunciDataDikenal(data, [], alasan);
      break;
    }
    case "bas.saksi.bentuk": {
      if (!POLA_KUNCI_TANYA.test(k) || k.length > 200) alasan.push("Kunci harus kunciTanya (huruf kecil, angka, '#', spasi).");
      panjangAntara("Varian", v, 3, BATAS_DAFTAR.hurufNilai, alasan);
      kunciDataDikenal(data, ["syarat", "asalKorpus"], alasan);
      if (data.syarat !== undefined) {
        if (!objekPolos(data.syarat)) alasan.push("syarat harus objek.");
        else kunciDataDikenal(data.syarat, ["jenisPerkaraId", "alur"], alasan);
      }
      if (data.asalKorpus !== undefined) {
        const a = data.asalKorpus;
        if (!objekPolos(a) || typeof a.kemunculan !== "number" || typeof a.perkara !== "number") {
          alasan.push("asalKorpus harus {kemunculan, perkara} berupa angka.");
        }
      }
      break;
    }
    case "bas.saksi.profil": {
      if (!POLA_KUNCI_TANYA.test(k) || k.length > 200) alasan.push("Kunci harus kunciTanya (huruf kecil, angka, '#', spasi).");
      if (v !== "") alasan.push("Nilai profil harus kosong; isinya di data.");
      kunciDataDikenal(data, ["peluangRagam", "rumusan"], alasan);
      if (typeof data.peluangRagam !== "number" || data.peluangRagam < 0 || data.peluangRagam > 1) {
        alasan.push("peluangRagam harus angka 0 sampai 1.");
      }
      if (data.rumusan !== undefined && typeof data.rumusan !== "boolean") alasan.push("rumusan harus true/false.");
      break;
    }
    case "bas.saksi.alasan-pilihan": {
      teksWajib("Kunci ciri", k, alasan, 60);
      teksWajib("Label", v, alasan, 80);
      kunciDataDikenal(data, [], alasan);
      break;
    }
    case "bas.kehadiran.bunyi": {
      if (k !== "") alasan.push("Kunci bunyi kehadiran harus kosong.");
      teksWajib("Bunyi kehadiran", v, alasan, 200);
      kunciDataDikenal(data, [], alasan);
      break;
    }
    case "bersama.alasan.frasa": {
      teksWajib("Kunci ciri", k, alasan, 60);
      panjangAntara("Frasa", v, 3, 240, alasan);
      kunciDataDikenal(data, ["urutan", "akibat", "setara"], alasan);
      if (typeof data.urutan !== "number" || !Number.isInteger(data.urutan) || data.urutan < 0) {
        alasan.push("urutan harus bilangan bulat 0 atau lebih.");
      }
      if (data.akibat !== undefined && typeof data.akibat !== "boolean") alasan.push("akibat harus true/false.");
      if (data.setara !== undefined && (!Array.isArray(data.setara) || data.setara.some((x) => typeof x !== "string" || !x))) {
        alasan.push("setara harus daftar teks.");
      }
      break;
    }
    case "putusan.upaya-damai.bunyi": {
      if (!["gagal", "berhasil", "belum-ada"].includes(k)) alasan.push("Kunci harus 'gagal', 'berhasil', atau 'belum-ada'.");
      panjangAntara("Bunyi upaya damai", v, 10, BATAS_DAFTAR.hurufNilai, alasan);
      kunciDataDikenal(data, [], alasan);
      break;
    }
    case "putusan.alasan.ciri": {
      teksWajib("Kunci ciri", k, alasan, 60);
      kunciDataDikenal(data, ["kata"], alasan);
      const kata = data.kata;
      if (!Array.isArray(kata) || kata.length === 0 || kata.some((x) => typeof x !== "string" || !x.trim())) {
        alasan.push("data.kata harus daftar kata pemicu yang tidak kosong.");
      } else if (v !== kata.join(" + ")) {
        alasan.push("Nilai harus sama dengan data.kata digabung ' + '.");
      }
      break;
    }
    case "putusan.sumber-hukum.sebutan": {
      teksWajib("Kunci sumber hukum", k, alasan, 80);
      teksWajib("Sebutan", v, alasan, 200);
      kunciDataDikenal(data, [], alasan);
      break;
    }
    case "putusan.medan-borang": {
      if (k !== "putusan-akhir") alasan.push("Kunci medan blangko harus 'putusan-akhir'.");
      teksWajib("Label medan", v, alasan, 100);
      kunciDataDikenal(data, ["penunjuk", "banyak", "pintu"], alasan);
      const penunjuk = data.penunjuk;
      if (typeof penunjuk !== "string" || !penunjuk || penunjuk.length > 300) {
        alasan.push("Penunjuk wajib diisi, paling panjang 300 huruf.");
      } else {
        if (!POLA_PENUNJUK_NAMA.test(penunjuk) && !POLA_PENUNJUK_ID.test(penunjuk)) {
          alasan.push("Penunjuk harus berbentuk [name=\"...\"] (boleh diawali nama tag) atau #id.");
        }
        if (/simpan|submit/i.test(penunjuk)) {
          alasan.push("Penunjuk tombol Simpan/submit tidak diterima - panel tidak boleh menekan Simpan lewat daftar ini.");
        }
      }
      if (data.banyak !== undefined && typeof data.banyak !== "boolean") alasan.push("banyak harus true/false.");
      if (data.pintu !== undefined && typeof data.pintu !== "boolean") alasan.push("pintu harus true/false.");
      break;
    }
    case "putusan.bawaan-medan": {
      teksWajib("Label medan", k, alasan, 100);
      teksWajib("Nilai bawaan", v, alasan, 200);
      kunciDataDikenal(data, ["jenisPerkara"], alasan);
      if (typeof data.jenisPerkara !== "string" || !data.jenisPerkara.trim() || data.jenisPerkara.length > 40) {
        alasan.push("data.jenisPerkara wajib diisi (mis. 'gugat', 'talak').");
      }
      break;
    }
    case "putusan.peta-blangko": {
      teksWajib("Jenis perkara", k, alasan, 80);
      if (k && bakuJenis(k) !== k) alasan.push("Kunci jenis harus huruf kecil dengan satu spasi.");
      teksWajib("Berkas blangko", v, alasan, 200);
      kunciDataDikenal(data, ["jenisAsli", "blangko", "blangkoLain", "catatan"], alasan);
      if (typeof data.jenisAsli !== "string" || !data.jenisAsli.trim()) alasan.push("data.jenisAsli wajib diisi.");
      if (data.blangko !== undefined && typeof data.blangko !== "string") alasan.push("blangko harus teks.");
      if (
        data.blangkoLain !== undefined &&
        (!Array.isArray(data.blangkoLain) || data.blangkoLain.some((x) => typeof x !== "string" || !x))
      ) {
        alasan.push("blangkoLain harus daftar teks.");
      }
      if (data.catatan !== undefined && typeof data.catatan !== "string") alasan.push("catatan harus teks.");
      break;
    }
    case "putusan.padanan-jenis": {
      teksWajib("Jenis baku", k, alasan, 80);
      teksWajib("Nama lain", v, alasan, 120);
      if (k && bakuJenis(k) !== k) alasan.push("Kunci jenis harus huruf kecil dengan satu spasi.");
      if (v && bakuJenis(v) !== v) alasan.push("Nama lain harus huruf kecil dengan satu spasi.");
      if (k && k === v) alasan.push("Nama lain sama dengan jenis bakunya.");
      kunciDataDikenal(data, [], alasan);
      break;
    }
    default: {
      const tidakTertangani: never = kunciDaftar;
      throw new GalatDaftarTakTerdaftar(tidakTertangani);
    }
  }

  return alasan.length ? { ok: false, alasan } : { ok: true, entri: { kunci: k, nilai: v, data: data as DataEntri } };
}

/**
 * Gerbang ukur (K13): apakah hasil_ukur sebuah daftar 'deteksi' LULUS.
 * Daftar 'tulis' tidak bergerbang (selalu lulus).
 */
export function nilaiHasilUkur(daftar: KunciDaftar, hasil: unknown): { lulus: boolean; sebab: string } {
  const ketentuan = DAFTAR_TIPE[daftar];
  const ukur: JenisUkur | null = ketentuan.ukur;
  if (ketentuan.jenis !== "deteksi" || !ukur) return { lulus: true, sebab: "" };
  if (!objekPolos(hasil)) return { lulus: false, sebab: "Daftar deteksi butuh ukur: belum ada hasil ukur." };
  if (hasil.jenis !== ukur) {
    return { lulus: false, sebab: `Hasil ukur berjenis '${String(hasil.jenis)}', padahal daftar ini butuh '${ukur}'.` };
  }
  switch (ukur) {
    case "ciri": {
      const contoh = Number(hasil.contoh);
      const salah = Number(hasil.salah);
      if (!Number.isFinite(contoh) || contoh < AMBANG_UKUR.ciri.minimumContoh) {
        return { lulus: false, sebab: `Contoh yang diperiksa ${contoh || 0}, kurang dari ${AMBANG_UKUR.ciri.minimumContoh}.` };
      }
      if (!Number.isFinite(salah) || salah < 0 || salah / contoh > AMBANG_UKUR.ciri.maksimumSalah) {
        return { lulus: false, sebab: `Contoh yang ditandai salah ${salah} dari ${contoh}, lebih dari 10%.` };
      }
      return { lulus: true, sebab: "" };
    }
    case "sebutan": {
      const sampel = Number(hasil.sampel);
      const sebelum = Number(hasil.samaSebelum);
      const sesudah = Number(hasil.samaSesudah);
      const tambahan = Number(hasil.salahTambahan);
      if (!Number.isFinite(sampel) || sampel < AMBANG_UKUR.sebutan.minimumSampel) {
        return { lulus: false, sebab: `Sampel ${sampel || 0}, kurang dari ${AMBANG_UKUR.sebutan.minimumSampel}.` };
      }
      if (!Number.isFinite(sebelum) || !Number.isFinite(sesudah) || sesudah < sebelum) {
        return { lulus: false, sebab: `Sama persis turun dari ${sebelum} ke ${sesudah}.` };
      }
      if (!Number.isFinite(tambahan) || tambahan < 0 || tambahan / sampel > AMBANG_UKUR.sebutan.maksimumSalahTambahan) {
        return { lulus: false, sebab: `Salah tambahan ${tambahan} dari ${sampel}, lebih dari 2%.` };
      }
      return { lulus: true, sebab: "" };
    }
    case "padanan": {
      return hasil.adaDiSipp === true
        ? { lulus: true, sebab: "" }
        : { lulus: false, sebab: "Nama lain itu tidak terbaca di jenis perkara SIPP." };
    }
    default: {
      const tidakTertangani: never = ukur;
      return { lulus: false, sebab: `Gerbang ukur '${String(tidakTertangani)}' tidak dikenal.` };
    }
  }
}
