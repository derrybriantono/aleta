import { terbilang } from "@/lib/biaya-perkara";
import {
  nilaiFungsi,
  penandaDalam,
  sisipkanPenanda,
  urutanPenyelesaian,
  type DefinisiSelesai,
} from "@/lib/penyelesai-variabel";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import type { AletaDatabase } from "@/server/db/client";

/**
 * PENYELESAI BERTINGKAT (Tahap 2 - Kemandirian Blangko).
 *
 * ============================================================================
 * SATU KALI JALAN TIDAK PERNAH CUKUP
 * ============================================================================
 *
 * 178 dari 466 kueri kamus memuat penanda lain di dalam dirinya. Perakit yang
 * mengganti penanda satu kali jalan akan menjalankan kueri yang masih memuat
 * "#0046#" apa adanya - dan MySQL akan mencarinya sebagai teks lalu
 * mengembalikan kosong. Hasilnya tampak sah dan tidak berarti apa pun.
 *
 * Karena itu variabel diselesaikan menurut urutan ketergantungannya, dan kueri
 * yang masih bertanda ditolak jembatan sebelum dijalankan.
 *
 * ============================================================================
 * YANG GAGAL TIDAK MENULARKAN KEKOSONGAN
 * ============================================================================
 *
 * Variabel yang bergantung pada variabel yang gagal TIDAK diselesaikan dengan
 * bagian yang kosong - ia ikut gagal, dan penandanya tetap terlihat di naskah.
 * Kalimat yang separuh terisi jauh lebih sulit ketahuan keliru daripada
 * penanda yang masih utuh.
 */

export type NilaiSelesai = {
  noVar: string;
  nilai: string;
  /** Dari mana nilainya - supaya dapat ditelusuri tanpa membuka SIPP. */
  asal: string;
};

export type HasilSelesai = {
  ok: boolean;
  nilai: Map<string, NilaiSelesai>;
  /** Variabel yang tidak dapat diselesaikan beserta sebabnya. */
  gagal: Array<{ noVar: string; sebab: string }>;
  lingkaran: string[];
  takDikenal: string[];
  /** Berapa kali jembatan dipanggil - dipakai menjaga biaya penyelesaian. */
  jumlahKueri: number;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

type BarisKamus = Record<string, unknown>;

function keDefinisi(baris: BarisKamus): DefinisiSelesai {
  const bersarang = teks(baris.bersarang);
  const kelas = teks(baris.kelas);
  return {
    noVar: teks(baris.no_var),
    nama: teks(baris.nama),
    jenis: teks(baris.jenis),
    sqlQuery: String(baris.sql_query ?? ""),
    dataTabel: teks(baris.data_tabel),
    dataKolom: teks(baris.data_kolom),
    kelas: (kelas === "A" || kelas === "B" ? kelas : "C") as "A" | "B" | "C",
    bersarang: bersarang ? bersarang.split(",").filter(Boolean) : [],
  };
}

/**
 * Mengumpulkan definisi yang dibutuhkan beserta seluruh yang disebutnya.
 *
 * Menelusuri turun sampai tidak ada lagi yang baru: meminta hanya penanda yang
 * tampak di naskah akan meninggalkan variabel bersarang tanpa definisi, dan
 * penyelesaiannya berhenti di lapis pertama.
 */
export async function kumpulkanDefinisi(
  db: AletaDatabase,
  penanda: string[]
): Promise<Map<string, DefinisiSelesai>> {
  const kamus = new Map<string, DefinisiSelesai>();
  let antre = [...new Set(penanda.map(teks).filter(Boolean))];

  // Batas kedalaman: kamus yang saling menunjuk berputar tak berkesudahan di
  // sini bahkan sebelum pendeteksi lingkaran sempat bekerja.
  for (let lapis = 0; lapis < 12 && antre.length > 0; lapis += 1) {
    const berikutnya: string[] = [];
    for (const noVar of antre) {
      if (kamus.has(noVar)) continue;
      const baris = await db.queryOne<BarisKamus>(`SELECT * FROM aleta_kamus_variabel WHERE no_var = ?`, [noVar]);
      if (!baris) continue;
      const def = keDefinisi(baris);
      kamus.set(noVar, def);
      for (const anak of def.bersarang) if (!kamus.has(anak)) berikutnya.push(anak);
    }
    antre = [...new Set(berikutnya)];
  }

  return kamus;
}

export type MasukanSelesai = {
  perkaraId: string;
  /** Penanda yang diminta - biasanya seluruh penanda sebuah blangko. */
  penanda: string[];
  /** Nilai Kelas B yang sudah tersimpan (Tahap 3), dan nilai yang dipaksakan. */
  isian?: Record<string, string>;
};

/**
 * Menyelesaikan seluruh penanda yang diminta untuk satu perkara.
 *
 * Kelas A dijalankan mesin; Kelas B diambil dari isian yang sudah tersimpan;
 * Kelas C tidak pernah diisi - ia memang tidak dapat diisi siapa pun.
 */
export async function selesaikanPenanda(
  db: AletaDatabase,
  masukan: MasukanSelesai
): Promise<HasilSelesai> {
  const perkaraId = teks(masukan.perkaraId);
  const isian = masukan.isian ?? {};
  const kamus = await kumpulkanDefinisi(db, masukan.penanda);
  const { urutan, lingkaran, takDikenal } = urutanPenyelesaian(kamus);

  const nilai = new Map<string, NilaiSelesai>();
  const gagal: Array<{ noVar: string; sebab: string }> = [];
  let jumlahKueri = 0;

  const nilaiMentah = () => new Map([...nilai].map(([k, v]) => [k, v.nilai]));

  for (const noVar of urutan) {
    const def = kamus.get(noVar);
    if (!def) continue;

    // Isian yang sudah tersimpan menang atas apa pun: ia keterangan yang
    // diberikan manusia yang menyidangkan, dan tidak ada sumber yang lebih
    // berhak daripada itu.
    if (Object.prototype.hasOwnProperty.call(isian, noVar)) {
      nilai.set(noVar, { noVar, nilai: String(isian[noVar] ?? ""), asal: "Isian perkara" });
      continue;
    }

    if (def.kelas === "B") {
      gagal.push({ noVar, sebab: `"${def.nama}" hanya diketahui hakim atau panitera - belum diisi.` });
      continue;
    }
    if (def.kelas === "C") {
      gagal.push({ noVar, sebab: `"${def.nama || noVar}" tidak dapat diisi siapa pun - tidak berdefinisi di ABT.` });
      continue;
    }

    // Bahan yang belum siap membuat variabel ini ikut gagal - BUKAN
    // diselesaikan dengan bagian yang kosong.
    const kurang = def.bersarang.filter((x) => !nilai.has(x));
    if (kurang.length > 0) {
      gagal.push({ noVar, sebab: `menunggu ${kurang.map((x) => `#${x}#`).join(", ")} yang belum selesai.` });
      continue;
    }

    const jenis = def.jenis.toLowerCase();

    if (jenis === "terbilang") {
      const sumber = def.bersarang[0] ? nilai.get(def.bersarang[0])?.nilai ?? "" : "";
      const angka = Number(String(sumber).replace(/[^\d]/g, ""));
      if (!Number.isFinite(angka) || angka <= 0) {
        gagal.push({ noVar, sebab: "angka sumbernya belum ada atau bukan bilangan." });
        continue;
      }
      nilai.set(noVar, { noVar, nilai: terbilang(angka), asal: `ALETA - terbilang dari #${def.bersarang[0]}#` });
      continue;
    }

    const fungsi = nilaiFungsi(jenis, def.bersarang[0] ? nilai.get(def.bersarang[0])?.nilai ?? "" : "");
    if (fungsi !== null) {
      if (!fungsi) {
        gagal.push({ noVar, sebab: "tanggal sumbernya belum ada atau tidak terbaca." });
        continue;
      }
      nilai.set(noVar, { noVar, nilai: fungsi, asal: `ALETA - ${jenis}` });
      continue;
    }

    if (jenis === "data_sipp") {
      jumlahKueri += 1;
      const jawaban = await callAletaBotSippBridge<{ ada?: boolean; kosong?: boolean; nilai?: unknown; sebab?: string }>(
        "kamus.bacaKolom",
        { tabel: def.dataTabel, kolom: def.dataKolom, perkaraId }
      );
      if (!jawaban.ok || !jawaban.data?.ada) {
        gagal.push({ noVar, sebab: teks(jawaban.data?.sebab) || "kolom SIPP tidak terbaca." });
        continue;
      }
      const isi = teks(jawaban.data?.nilai);
      if (!isi) {
        gagal.push({ noVar, sebab: `${def.dataTabel}.${def.dataKolom} kosong untuk perkara ini.` });
        continue;
      }
      nilai.set(noVar, { noVar, nilai: isi, asal: `SIPP - ${def.dataTabel}.${def.dataKolom}` });
      continue;
    }

    if (jenis === "data_sql") {
      const sisip = sisipkanPenanda(def.sqlQuery, nilaiMentah(), { untukSql: true });
      if (sisip.tersisa.length > 0) {
        gagal.push({ noVar, sebab: `kueri masih menyebut ${sisip.tersisa.map((x) => `#${x}#`).join(", ")}.` });
        continue;
      }
      jumlahKueri += 1;
      const jawaban = await callAletaBotSippBridge<{ ada?: boolean; kosong?: boolean; nilai?: unknown; sebab?: string }>(
        "kamus.jalankanKueri",
        { sql: sisip.teks, perkaraId }
      );
      if (!jawaban.ok || !jawaban.data?.ada) {
        gagal.push({ noVar, sebab: teks(jawaban.data?.sebab) || "kueri gagal dijalankan." });
        continue;
      }
      const isi = teks(jawaban.data?.nilai);
      if (!isi) {
        gagal.push({ noVar, sebab: "kueri tidak mengembalikan nilai untuk perkara ini." });
        continue;
      }
      nilai.set(noVar, { noVar, nilai: isi, asal: `Kamus #${noVar}# - kueri atas SIPP` });
      continue;
    }

    gagal.push({ noVar, sebab: `jenis "${def.jenis}" belum ditangani penyelesai.` });
  }

  for (const noVar of lingkaran) {
    gagal.push({ noVar, sebab: "terkurung lingkaran ketergantungan - tidak dapat diselesaikan." });
  }

  return { ok: gagal.length === 0, nilai, gagal, lingkaran, takDikenal, jumlahKueri };
}

/**
 * Mengisi sebuah naskah dengan nilai yang sudah diselesaikan.
 *
 * Penanda yang tidak ada nilainya DIBIARKAN utuh dan disebutkan - aturan yang
 * sama dengan seluruh ALETA.
 */
export function isiNaskah(
  naskah: string,
  hasil: HasilSelesai
): { naskah: string; tersisa: string[]; jumlahTerisi: number } {
  const peta = new Map([...hasil.nilai].map(([k, v]) => [k, v.nilai]));
  const diminta = penandaDalam(naskah);
  const sisip = sisipkanPenanda(naskah, peta);
  return {
    naskah: sisip.teks,
    tersisa: sisip.tersisa,
    jumlahTerisi: diminta.length - sisip.tersisa.length,
  };
}
