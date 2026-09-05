import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import {
  jangkarRujukan,
  kenaliRujukan,
  pecahPertimbangan,
  sidikButir,
  type Rujukan,
} from "@/server/modules/aleta-ecourt/pemecah-pertimbangan";

/**
 * PUSTAKA PERTIMBANGAN HUKUM (D1-D7).
 *
 * ============================================================================
 * INILAH YANG MENGGANTIKAN AI UNTUK SEBAGIAN BESAR PERKARA
 * ============================================================================
 *
 * Tanpa pustaka ini, tiap putusan harus dikarang dari nol dan AI menjadi
 * keharusan - dengan biaya, keraguan, dan risiko pasal karangan yang
 * menyertainya. Dengan pustaka, sebagian besar putusan dirakit dari
 * pertimbangan yang sudah pernah dipakai dan sudah pernah ditandatangani.
 *
 * ============================================================================
 * RISIKO TERBESAR PROYEK INI ADA DI SINI
 * ============================================================================
 *
 * Satu butir yang keliru - pasal salah kutip, syarat terlalu longgar - tidak
 * salah sekali, melainkan salah di SETIAP putusan yang memakainya, dengan rapi
 * dan meyakinkan. Karena itu:
 *
 *   - butir masuk sebagai USULAN, tidak pernah langsung dipakai;
 *   - pengesahannya mencatat siapa yang menekan DAN atas perintah siapa;
 *   - rujukan pasalnya diperiksa terhadap pustaka hukum sebelum disahkan; dan
 *   - versi baru MENGGANTIKAN, tidak menghapus - putusan lama merujuk yang
 *     berlaku saat itu.
 */

export type Butir = {
  id: string;
  sidik: string;
  teks: string;
  jenisPerkara: string;
  isu: string;
  syarat: Record<string, unknown>;
  jumlahPemakaian: number;
  keadaan: "usulan" | "disahkan" | "ditolak" | "diganti";
  disahkanOleh: string;
  atasPerintah: string;
  disahkanAt: string;
  alasanTolak: string;
  digantiOlehId: string;
  versi: number;
};

export type RujukanTersimpan = Rujukan & {
  id: string;
  butirId: string;
  jangkar: string;
  terbukti: boolean;
};

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function keadaanSah(nilai: unknown): Butir["keadaan"] {
  const isi = teks(nilai);
  return isi === "disahkan" || isi === "ditolak" || isi === "diganti" ? isi : "usulan";
}

function bacaSyarat(nilai: unknown): Record<string, unknown> {
  try {
    const isi = JSON.parse(String(nilai ?? "{}"));
    return isi && typeof isi === "object" ? (isi as Record<string, unknown>) : {};
  } catch {
    // Syarat yang rusak dibaca kosong, bukan dilempar. Satu butir yang rusak
    // tidak boleh menghalangi pembacaan sisanya - dan butir bersyarat kosong
    // tidak akan terpilih oleh perakit, jadi kerusakannya tidak menular.
    return {};
  }
}

function bentukButir(baris: Record<string, unknown>): Butir {
  return {
    id: teks(baris.id),
    sidik: teks(baris.sidik),
    teks: teks(baris.teks),
    jenisPerkara: teks(baris.jenis_perkara),
    isu: teks(baris.isu),
    syarat: bacaSyarat(baris.syarat),
    jumlahPemakaian: Number(baris.jumlah_pemakaian) || 0,
    keadaan: keadaanSah(baris.keadaan),
    disahkanOleh: teks(baris.disahkan_oleh),
    atasPerintah: teks(baris.atas_perintah),
    disahkanAt: teks(baris.disahkan_at),
    alasanTolak: teks(baris.alasan_tolak),
    digantiOlehId: teks(baris.diganti_oleh_id),
    versi: Number(baris.versi) || 1,
  };
}

export type HasilSerap = {
  ok: boolean;
  sebab: string;
  perkaraDibaca: number;
  alineaDibaca: number;
  butirBaru: number;
  butirBertambahPemakaian: number;
  rujukanDibaca: number;
  rujukanTersambung: number;
};

type PertimbanganSipp = {
  ada?: boolean;
  sebab?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  tanggal?: string;
  jenisPerkara?: string;
  naskah?: string;
  pertimbangan?: string;
  panjangHuruf?: number;
};

/**
 * Menyerap pertimbangan satu perkara menjadi butir pustaka (D1, D5).
 *
 * ============================================================================
 * ALINEA YANG SAMA HANYA MENJADI SATU BUTIR
 * ============================================================================
 *
 * Dikunci pada sidik alineanya, sesudah nama, tanggal, dan nomor perkara
 * dibuang. Perkara kedua yang memuat alinea yang sama TIDAK membuat butir
 * baru - ia menambah hitungan pemakaian dan mencatat asalnya.
 *
 * Hitungan itu yang membedakan alinea baku yang dipakai dua ratus kali dari
 * alinea khusus yang dipakai sekali, dan yang mengesahkan berhak tahu bedanya.
 */
export async function serapPertimbangan(
  db: AletaDatabase,
  actorUserId: string,
  perkaraId: string
): Promise<HasilSerap> {
  const kosong: HasilSerap = {
    ok: false,
    sebab: "",
    perkaraDibaca: 0,
    alineaDibaca: 0,
    butirBaru: 0,
    butirBertambahPemakaian: 0,
    rujukanDibaca: 0,
    rujukanTersambung: 0,
  };

  const id = teks(perkaraId);
  if (!id) return { ...kosong, sebab: "Perkara tidak dikenali." };

  // Naskah dan identitas perkara diambil BERSAMAAN. case.pertimbangan hanya
  // membawa naskahnya; nomor dan jenis perkara ada di case.detail - dan tanpa
  // jenis perkara, butir tidak dapat disaring saat perakit mencarinya.
  const [jawaban, detail] = await Promise.all([
    callAletaBotSippBridge<PertimbanganSipp>("case.pertimbangan", { perkaraId: id }),
    callAletaBotSippBridge<Record<string, unknown>>("case.detail", { perkaraId: id }),
  ]);

  const isi = jawaban.data;
  if (!jawaban.ok || !isi?.ada) {
    return { ...kosong, sebab: isi?.sebab ?? jawaban.error ?? "Pertimbangan tidak terbaca." };
  }

  const naskah = teks(isi.naskah ?? isi.pertimbangan);
  if (!naskah) return { ...kosong, sebab: "Pertimbangan kosong." };

  const nomorPerkara = teks(detail.data?.nomorPerkara ?? isi.nomorPerkara);
  const jenisPerkara = teks(detail.data?.jenisPerkara ?? isi.jenisPerkara);
  const tanggal = teks(isi.tanggal);
  const sekarang = new Date().toISOString();

  const hasil: HasilSerap = { ...kosong, ok: true, perkaraDibaca: 1 };

  for (const alinea of pecahPertimbangan(naskah)) {
    // Hanya alinea "Menimbang" yang menjadi butir. Kepala putusan, amar, dan
    // penutup bukan pertimbangan - memasukkannya berarti perakit kelak
    // menyisipkan amar di tengah pertimbangan.
    if (!alinea.menimbang) continue;
    // Alinea yang terlalu pendek hampir selalu potongan kalimat yang terpisah
    // oleh penyunting, bukan pertimbangan yang berdiri sendiri.
    if (alinea.teks.length < 80) continue;

    hasil.alineaDibaca += 1;
    const sidik = sidikButir(alinea.teks);
    if (!sidik) continue;

    const sudahAda = await db.queryOne<Record<string, unknown>>(
      `SELECT id, jumlah_pemakaian FROM aleta_pertimbangan_butir WHERE sidik = ?`,
      [sidik]
    );

    let butirId: string;
    if (sudahAda) {
      butirId = teks(sudahAda.id);
      await db.run(
        `UPDATE aleta_pertimbangan_butir SET jumlah_pemakaian = jumlah_pemakaian + 1, diubah_at = ? WHERE id = ?`,
        [sekarang, butirId]
      );
      hasil.butirBertambahPemakaian += 1;
    } else {
      butirId = randomUUID();
      await db.run(
        `INSERT INTO aleta_pertimbangan_butir
           (id, sidik, teks, jenis_perkara, jumlah_pemakaian, keadaan, dibuat_oleh, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, 1, 'usulan', ?, ?, ?)`,
        [butirId, sidik, alinea.teks, jenisPerkara, teks(actorUserId), sekarang, sekarang]
      );
      hasil.butirBaru += 1;

      for (const rujukan of kenaliRujukan(alinea.teks)) {
        hasil.rujukanDibaca += 1;
        const jangkar = jangkarRujukan(rujukan);
        if (jangkar) hasil.rujukanTersambung += 1;

        await db.run(
          `INSERT INTO aleta_pertimbangan_rujukan
             (id, butir_id, tertulis, pasal, ayat, huruf, peraturan, jangkar, terbukti, diperiksa_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
          [randomUUID(), butirId, rujukan.tertulis, rujukan.pasal, rujukan.ayat, rujukan.huruf, rujukan.peraturan, jangkar]
        );
      }
    }

    const asalAda = await db.queryOne<Record<string, unknown>>(
      `SELECT id FROM aleta_pertimbangan_asal WHERE butir_id = ? AND perkara_id = ? AND urutan_alinea = ?`,
      [butirId, id, alinea.urutan]
    );
    if (!asalAda) {
      await db.run(
        `INSERT INTO aleta_pertimbangan_asal (id, butir_id, perkara_id, nomor_perkara, tanggal, urutan_alinea)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), butirId, id, nomorPerkara, tanggal, alinea.urutan]
      );
    }
  }

  return hasil;
}

/**
 * Memeriksa rujukan butir terhadap pustaka hukum (D4, dan pintu menuju J1).
 *
 * Rujukan yang jangkarnya benar-benar ditemukan ditandai TERBUKTI. Yang tidak
 * ditemukan dibiarkan tidak terbukti - bukan dihapus, karena rujukan yang
 * hilang dari daftar terbaca seolah butir itu tidak merujuk apa pun.
 *
 * Inilah yang membuat "kutipan wajib terbukti" mungkin: butir yang menyebut
 * pasal yang tidak ada di pustaka dapat ditahan SEBELUM masuk, bukan ditemukan
 * belakangan di dalam putusan yang sudah ditandatangani.
 */
export async function periksaRujukan(db: AletaDatabase, butirId: string): Promise<{ diperiksa: number; terbukti: number }> {
  const id = teks(butirId);
  if (!id) return { diperiksa: 0, terbukti: 0 };

  const rujukan = await db.queryAll<Record<string, unknown>>(
    `SELECT id, jangkar FROM aleta_pertimbangan_rujukan WHERE butir_id = ?`,
    [id]
  );

  const sekarang = new Date().toISOString();
  let terbukti = 0;

  for (const baris of rujukan) {
    const jangkar = teks(baris.jangkar);
    let ada = false;
    if (jangkar) {
      const bagian = await db.queryOne<Record<string, unknown>>(
        `SELECT s.id FROM jlf_regulation_sections s
           JOIN jlf_regulations r ON r.id = s.regulation_id
          WHERE s.anchor = ? AND r.verification_status = 'verified'`,
        [jangkar]
      );
      ada = Boolean(bagian);
    }
    if (ada) terbukti += 1;

    await db.run(`UPDATE aleta_pertimbangan_rujukan SET terbukti = ?, diperiksa_at = ? WHERE id = ?`, [
      ada ? 1 : 0,
      sekarang,
      teks(baris.id),
    ]);
  }

  return { diperiksa: rujukan.length, terbukti };
}

/**
 * Mengesahkan butir (D6) - Super Admin atas perintah Ketua.
 *
 * DUA hal dicatat: siapa yang menekan, dan atas perintah siapa. Tanpa yang
 * kedua, jejaknya hanya menunjuk operator - dan pertanyaan yang sesungguhnya
 * saat sebuah butir dipersoalkan bukan "siapa yang mengetik" melainkan "atas
 * dasar apa ia masuk".
 */
export async function sahkanButir(
  db: AletaDatabase,
  actorUserId: string,
  args: { butirId: string; atasPerintah: string; isu?: string; syarat?: Record<string, unknown> }
): Promise<{ ok: boolean; sebab: string }> {
  const butirId = teks(args.butirId);
  const atasPerintah = teks(args.atasPerintah);
  if (!butirId) return { ok: false, sebab: "Butir tidak dikenali." };
  if (!atasPerintah) {
    return { ok: false, sebab: "Perintah pengesahan harus disebutkan - siapa yang memerintahkan butir ini masuk." };
  }

  const sekarang = new Date().toISOString();
  const hasil = await db.run(
    `UPDATE aleta_pertimbangan_butir
        SET keadaan = 'disahkan', disahkan_oleh = ?, atas_perintah = ?, disahkan_at = ?,
            isu = ?, syarat = ?, diubah_at = ?
      WHERE id = ? AND keadaan = 'usulan'`,
    [
      teks(actorUserId) || null,
      atasPerintah,
      sekarang,
      teks(args.isu),
      JSON.stringify(args.syarat ?? {}),
      sekarang,
      butirId,
    ]
  );

  if ((hasil.changes ?? 0) === 0) {
    return { ok: false, sebab: "Butir tidak ditemukan atau sudah tidak berstatus usulan." };
  }
  return { ok: true, sebab: "" };
}

export async function tolakButir(
  db: AletaDatabase,
  butirId: string,
  alasan: string
): Promise<{ ok: boolean; sebab: string }> {
  const alasanTolak = teks(alasan);
  if (!alasanTolak) {
    // Penolakan tanpa alasan berarti butir yang sama akan diusulkan lagi pada
    // penyerapan berikutnya, dan yang menolaknya lain kali tidak tahu mengapa
    // ia pernah ditolak.
    return { ok: false, sebab: "Alasan penolakan harus diisi." };
  }

  const hasil = await db.run(
    `UPDATE aleta_pertimbangan_butir SET keadaan = 'ditolak', alasan_tolak = ?, diubah_at = ? WHERE id = ?`,
    [alasanTolak, new Date().toISOString(), teks(butirId)]
  );
  return (hasil.changes ?? 0) > 0 ? { ok: true, sebab: "" } : { ok: false, sebab: "Butir tidak ditemukan." };
}

/**
 * Menggantikan butir dengan versi baru (D7).
 *
 * Butir lama TIDAK dihapus - ia ditandai diganti dan menunjuk penggantinya.
 * Putusan yang sudah dijatuhkan merujuk butir yang berlaku saat itu, dan
 * rujukan ke tempat kosong lebih buruk daripada rujukan ke butir yang sudah
 * tidak dipakai lagi: yang kedua setidaknya dapat dibaca dan dinilai.
 */
export async function gantikanButir(
  db: AletaDatabase,
  actorUserId: string,
  args: { butirId: string; teksBaru: string; atasPerintah: string; isu?: string; syarat?: Record<string, unknown> }
): Promise<{ ok: boolean; sebab: string; butirBaruId: string }> {
  const lamaId = teks(args.butirId);
  const teksBaru = teks(args.teksBaru);
  const atasPerintah = teks(args.atasPerintah);

  if (!lamaId || !teksBaru) return { ok: false, sebab: "Butir dan bunyi barunya harus diisi.", butirBaruId: "" };
  if (!atasPerintah) return { ok: false, sebab: "Perintah penggantian harus disebutkan.", butirBaruId: "" };

  const lama = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_pertimbangan_butir WHERE id = ?`, [lamaId]);
  if (!lama) return { ok: false, sebab: "Butir tidak ditemukan.", butirBaruId: "" };

  const sekarang = new Date().toISOString();
  const baruId = randomUUID();
  const sidik = sidikButir(teksBaru);

  await db.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan,
        disahkan_oleh, atas_perintah, disahkan_at, versi, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'disahkan', ?, ?, ?, ?, ?, ?, ?)`,
    [
      baruId,
      sidik,
      teksBaru,
      teks(lama.jenis_perkara),
      teks(args.isu) || teks(lama.isu),
      JSON.stringify(args.syarat ?? bacaSyarat(lama.syarat)),
      Number(lama.jumlah_pemakaian) || 0,
      teks(actorUserId) || null,
      atasPerintah,
      sekarang,
      (Number(lama.versi) || 1) + 1,
      teks(actorUserId),
      sekarang,
      sekarang,
    ]
  );

  for (const rujukan of kenaliRujukan(teksBaru)) {
    await db.run(
      `INSERT INTO aleta_pertimbangan_rujukan
         (id, butir_id, tertulis, pasal, ayat, huruf, peraturan, jangkar, terbukti, diperiksa_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
      [randomUUID(), baruId, rujukan.tertulis, rujukan.pasal, rujukan.ayat, rujukan.huruf, rujukan.peraturan, jangkarRujukan(rujukan)]
    );
  }

  await db.run(
    `UPDATE aleta_pertimbangan_butir SET keadaan = 'diganti', diganti_oleh_id = ?, diubah_at = ? WHERE id = ?`,
    [baruId, sekarang, lamaId]
  );

  return { ok: true, sebab: "", butirBaruId: baruId };
}

export type PilihanButir = {
  keadaan?: Butir["keadaan"];
  jenisPerkara?: string;
  cari?: string;
  /** Butir yang muncul sekurangnya sekian kali - menyaring yang tidak mapan. */
  minimalPemakaian?: number;
  batas?: number;
};

/**
 * Mencari butir pustaka.
 *
 * Bawaannya HANYA yang sudah disahkan. Yang menyusun putusan tidak boleh
 * menemukan butir yang belum dibaca seorang pun - dan bawaan yang aman lebih
 * baik daripada bawaan yang lengkap.
 */
export async function cariButir(db: AletaDatabase, pilihan: PilihanButir = {}): Promise<Butir[]> {
  const syarat: string[] = ["keadaan = ?"];
  const nilai: Array<string | number> = [pilihan.keadaan ?? "disahkan"];

  if (pilihan.jenisPerkara) {
    syarat.push("LOWER(jenis_perkara) = LOWER(?)");
    nilai.push(pilihan.jenisPerkara);
  }
  if (pilihan.cari) {
    syarat.push("LOWER(teks) LIKE LOWER(?)");
    nilai.push(`%${pilihan.cari}%`);
  }
  if (pilihan.minimalPemakaian) {
    syarat.push("jumlah_pemakaian >= ?");
    nilai.push(pilihan.minimalPemakaian);
  }

  const batas = Math.min(Math.max(pilihan.batas ?? 50, 1), 300);
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_pertimbangan_butir WHERE ${syarat.join(" AND ")} ORDER BY jumlah_pemakaian DESC LIMIT ${batas}`,
    nilai
  );
  return baris.map(bentukButir);
}

export async function bacaButir(db: AletaDatabase, butirId: string): Promise<Butir | null> {
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_pertimbangan_butir WHERE id = ?`, [
    teks(butirId),
  ]);
  return baris ? bentukButir(baris) : null;
}

export async function rujukanButir(db: AletaDatabase, butirId: string): Promise<RujukanTersimpan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_pertimbangan_rujukan WHERE butir_id = ? ORDER BY pasal`,
    [teks(butirId)]
  );
  return baris.map((item) => ({
    id: teks(item.id),
    butirId: teks(item.butir_id),
    tertulis: teks(item.tertulis),
    pasal: teks(item.pasal),
    ayat: teks(item.ayat),
    huruf: teks(item.huruf),
    peraturan: teks(item.peraturan),
    jangkar: teks(item.jangkar),
    terbukti: Number(item.terbukti) === 1,
  }));
}

export async function asalButir(
  db: AletaDatabase,
  butirId: string
): Promise<Array<{ perkaraId: string; nomorPerkara: string; tanggal: string }>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, nomor_perkara, tanggal FROM aleta_pertimbangan_asal WHERE butir_id = ? ORDER BY tanggal DESC LIMIT 100`,
    [teks(butirId)]
  );
  return baris.map((item) => ({
    perkaraId: teks(item.perkara_id),
    nomorPerkara: teks(item.nomor_perkara),
    tanggal: teks(item.tanggal),
  }));
}

/** Berapa butir di tiap keadaan - untuk layar pengesahan dan ukuran K4. */
export async function ringkasPustaka(db: AletaDatabase): Promise<Record<string, number>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT keadaan, COUNT(*) AS jumlah FROM aleta_pertimbangan_butir GROUP BY keadaan`
  );
  const hasil: Record<string, number> = { usulan: 0, disahkan: 0, ditolak: 0, diganti: 0 };
  for (const item of baris) hasil[teks(item.keadaan)] = Number(item.jumlah) || 0;
  return hasil;
}
