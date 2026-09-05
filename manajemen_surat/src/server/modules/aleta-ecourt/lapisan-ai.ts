import { randomUUID } from "node:crypto";

import { periksaTarikan, type HasilTarik, type MasukanTarik } from "@/lib/fakta-tak-berpola";
import {
  jawabanKosong,
  jawabanModel,
  jawabanPustaka,
  pilihSumber,
  siapkanKiriman,
  type Jawaban,
  type Kiriman,
} from "@/lib/penjawab";
import { type AturanBatas } from "@/lib/batas-data";
import { buatPenyamar } from "@/lib/penyamaran";
import { hitungSaklar, periksaSaklar, type Keputusan, type Saklar } from "@/lib/saklar-ai";
import { periksaUsulan, type UsulanButir } from "@/lib/usulan-pertimbangan";
import type { AletaDatabase } from "@/server/db/client";
import { bukaJangkar, cariPasal } from "@/server/modules/aleta-ecourt/pustaka-hukum";
import { cariButir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";

/**
 * LAPISAN AI (I1-I5) - empat pekerjaan, dan hanya empat.
 *
 * ============================================================================
 * BASIS DATA DULU, MODEL TERAKHIR, DAN SELALU DISEBUT SIAPA YANG MENJAWAB
 * ============================================================================
 *
 * Tiap jalur di berkas ini menempuh urutan yang sama: cari di pustaka, dan
 * hanya bila pustaka menjawab kosong barulah model dipanggil. Urutan itu bukan
 * demi hemat - kalau alasannya hemat, ia akan dilonggarkan pada hari pagunya
 * masih longgar. Alasannya jawaban pustaka dapat ditelusuri dan jawaban model
 * tidak.
 *
 * ============================================================================
 * MEMANGGIL MODEL = MENGIRIM BERKAS KE LUAR GEDUNG
 * ============================================================================
 *
 * Itu persis keadaan yang J5 dan J6 dibuat untuknya, jadi keduanya dipakai di
 * sini apa adanya - tidak diulang, tidak dilonggarkan. Satu ruas yang belum
 * punya aturan batas menahan SELURUH kiriman, dan garam penyamarannya berbeda
 * tiap permintaan sehingga dua kiriman tidak dapat disatukan kembali menjadi
 * satu jati diri.
 *
 * ============================================================================
 * YANG DICATAT NAMA RUASNYA, BUKAN ISINYA
 * ============================================================================
 *
 * Menyimpan isi kiriman berarti membuat salinan kedua data pribadi yang justru
 * sedang dijaga - di tabel yang lebih mudah dibaca daripada berkas aslinya.
 * Pertanyaan yang perlu dijawab kelak adalah "ruas apa saja yang pernah
 * keluar", dan nama ruas sudah cukup menjawabnya.
 */

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** Penyedia model - disuntikkan supaya berkas ini dapat diuji tanpa jaringan. */
export type PemanggilModel = (perintah: string, isi: Record<string, unknown>) => Promise<{
  ok: boolean;
  teks: string;
  data?: unknown;
  penyedia: string;
  model: string;
  sebab?: string;
}>;

export type KeadaanAi = { menyala: boolean; sebab: string };

// =============================================================================
// I5 - PENJAWAB: PUSTAKA DULU, MODEL TERAKHIR
// =============================================================================

export type HasilJawab = {
  jawaban: Jawaban;
  kiriman: Kiriman | null;
  penyedia: string;
  model: string;
};

/**
 * Menjawab satu pertanyaan tentang perkara.
 *
 * Pustaka dicoba lebih dulu SELALU. Bila ia menjawab, model tidak dipanggil
 * sama sekali - bukan dipanggil lalu dibandingkan. Membandingkan berarti isi
 * berkas tetap terkirim ke luar pada tiap pertanyaan, dan biaya serta
 * risikonya tetap terbayar meski jawabannya dibuang.
 */
export async function jawab(
  db: AletaDatabase,
  masukan: {
    pertanyaan: string;
    jenisPerkara?: string;
    /** Fakta perkara yang mungkin perlu dikirim bila model dipanggil. */
    fakta?: Record<string, unknown>;
    ai: KeadaanAi;
    panggilModel?: PemanggilModel;
    /**
     * Aturan batas yang berlaku, termasuk keputusan pengadilan yang tersimpan.
     *
     * Sempat tidak diterima di sini sementara jalur penarikan fakta sudah
     * membacanya - akibatnya satu ruas yang sengaja diizinkan pengadilan
     * lolos di satu jalur dan tertahan di jalur lain, tanpa keterangan apa
     * pun. Keputusan yang tercatat harus berlaku di seluruh jalur.
     */
    aturanBatas?: AturanBatas[];
  }
): Promise<HasilJawab> {
  const pertanyaan = bersih(masukan.pertanyaan);
  if (!pertanyaan) {
    return { jawaban: jawabanKosong("Pertanyaan kosong."), kiriman: null, penyedia: "", model: "" };
  }

  // ── Pustaka lebih dulu ─────────────────────────────────────────────────
  const butir = await cariButir(db, { cari: pertanyaan, jenisPerkara: masukan.jenisPerkara, batas: 5 });
  const pasal = butir.length ? [] : await cariPasal(db, pertanyaan);

  const dariPustaka = {
    jumlah: butir.length + pasal.length,
    isi: butir.length
      ? butir.map((item) => item.teks).join("\n\n")
      : pasal.map((item) => `${item.sebutan}\n${item.isi}`).join("\n\n"),
    rujukan: butir.length ? butir.map((item) => item.id) : pasal.map((item) => item.jangkar),
    // Butir dari cariButir sudah tersaring 'disahkan'; pasal dari cariPasal
    // pun bawaannya hanya yang disahkan. Keduanya sudah pernah dibaca manusia.
    disahkan: true,
  };

  const sumber = pilihSumber(dariPustaka, { menyala: masukan.ai.menyala, sebab: masukan.ai.sebab });

  if (sumber === "pustaka") {
    return { jawaban: jawabanPustaka(dariPustaka), kiriman: null, penyedia: "", model: "" };
  }

  if (sumber === "tidakDijawab" || !masukan.panggilModel) {
    return {
      jawaban: jawabanKosong(
        masukan.ai.menyala
          ? "Pustaka belum memuat jawabannya, dan penyedia model tidak tersedia."
          : masukan.ai.sebab || "Pustaka belum memuat jawabannya, dan AI sedang dimatikan.",
      ),
      kiriman: null,
      penyedia: "",
      model: "",
    };
  }

  // ── Baru sesudah itu model, dan hanya lewat saringan ───────────────────
  const penyamar = buatPenyamar(randomUUID());
  const kiriman = siapkanKiriman({ pertanyaan, ...(masukan.fakta ?? {}) }, penyamar, masukan.aturanBatas);

  if (!kiriman.boleh) {
    return { jawaban: jawabanKosong(kiriman.sebab), kiriman, penyedia: "", model: "" };
  }

  const hasil = await masukan.panggilModel(
    "Jawab pertanyaan berikut untuk membantu petugas pengadilan agama. Bila tidak yakin, katakan tidak yakin.",
    kiriman.isi
  );

  if (!hasil.ok) {
    return {
      jawaban: jawabanKosong(hasil.sebab || "Model tidak menjawab."),
      kiriman,
      penyedia: hasil.penyedia,
      model: hasil.model,
    };
  }

  // Kutipan model diperiksa dengan alat yang sama dengan kutipan hakim.
  const diperiksa = periksaUsulan({ teks: hasil.teks }, await jangkarYangAda(db, hasil.teks));

  return {
    jawaban: jawabanModel({
      isi: hasil.teks,
      kutipanTakTerbukti: [...diperiksa.takTerbukti, ...diperiksa.tanpaJangkar].map(
        (item) => item.tertulis || item.jangkar
      ),
      namaModel: hasil.model,
    }),
    kiriman,
    penyedia: hasil.penyedia,
    model: hasil.model,
  };
}

/**
 * Jangkar yang benar-benar ada di pustaka, dari kutipan sebuah naskah.
 *
 * Dibuka satu per satu saat diperiksa, bukan dipercaya dari daftar yang
 * disimpan: peraturan dapat dimuat maupun dicabut di antara dua permintaan.
 */
async function jangkarYangAda(db: AletaDatabase, teks: string): Promise<Set<string>> {
  const { jangkarRujukan, kenaliRujukan } = await import(
    "@/server/modules/aleta-ecourt/pemecah-pertimbangan"
  );
  const ada = new Set<string>();
  for (const rujukan of kenaliRujukan(teks)) {
    const jangkar = jangkarRujukan(rujukan);
    if (jangkar && (await bukaJangkar(db, jangkar))) ada.add(jangkar);
  }
  return ada;
}

// =============================================================================
// I3 - PERCAKAPAN YANG TAHU PERKARA MANA YANG TERBUKA
// =============================================================================

export type Pesan = {
  id: string;
  urutan: number;
  peran: "pemakai" | "sistem";
  isi: string;
  dijawabOleh: string;
  usulan: boolean;
  rujukan: string[];
  peringatan: string[];
  ruasDikirim: string[];
  ruasDitahan: string[];
  penyedia: string;
  model: string;
};

export async function bukaPercakapan(
  db: AletaDatabase,
  masukan: { perkaraId: string; nomorPerkara: string; oleh: string }
): Promise<string> {
  const sekarang = new Date().toISOString();
  const id = randomUUID();
  await db.run(
    `INSERT INTO aleta_ai_percakapan (id, perkara_id, nomor_perkara, judul, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bersih(masukan.perkaraId),
      bersih(masukan.nomorPerkara),
      `Perkara ${bersih(masukan.nomorPerkara) || bersih(masukan.perkaraId)}`,
      bersih(masukan.oleh),
      sekarang,
      sekarang,
    ]
  );
  return id;
}

export async function pesanPercakapan(db: AletaDatabase, percakapanId: string): Promise<Pesan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_ai_pesan WHERE percakapan_id = ? ORDER BY urutan ASC`,
    [bersih(percakapanId)]
  );
  return baris.map((item) => ({
    id: bersih(item.id),
    urutan: Number(item.urutan ?? 0),
    peran: (bersih(item.peran) || "pemakai") as Pesan["peran"],
    isi: bersih(item.isi),
    dijawabOleh: bersih(item.dijawab_oleh),
    usulan: Number(item.usulan ?? 1) === 1,
    rujukan: uraikan(item.rujukan),
    peringatan: uraikan(item.peringatan),
    ruasDikirim: uraikan(item.ruas_dikirim),
    ruasDitahan: uraikan(item.ruas_ditahan),
    penyedia: bersih(item.penyedia),
    model: bersih(item.model),
  }));
}

function uraikan(nilai: unknown): string[] {
  try {
    const hasil = JSON.parse(bersih(nilai) || "[]");
    return Array.isArray(hasil) ? hasil.map(bersih).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan satu putaran percakapan: pertanyaan pemakai dan jawabannya.
 *
 * Keduanya disimpan bersama, sebab jawaban tanpa pertanyaannya tidak dapat
 * dinilai kelak - dan yang paling sering dinilai kelak justru jawaban model.
 */
export async function catatPutaran(
  db: AletaDatabase,
  masukan: { percakapanId: string; pertanyaan: string; hasil: HasilJawab }
): Promise<void> {
  const percakapanId = bersih(masukan.percakapanId);
  const sekarang = new Date().toISOString();

  const terakhir = await db.queryOne<{ urutan: number }>(
    `SELECT urutan FROM aleta_ai_pesan WHERE percakapan_id = ? ORDER BY urutan DESC LIMIT 1`,
    [percakapanId]
  );
  let urutan = Number(terakhir?.urutan ?? -1);

  urutan += 1;
  await db.run(
    `INSERT INTO aleta_ai_pesan (id, percakapan_id, urutan, peran, isi, dijawab_oleh, usulan, dibuat_at)
     VALUES (?, ?, ?, 'pemakai', ?, '', 0, ?)`,
    [randomUUID(), percakapanId, urutan, bersih(masukan.pertanyaan), sekarang]
  );

  const { jawaban, kiriman, penyedia, model } = masukan.hasil;
  urutan += 1;
  await db.run(
    `INSERT INTO aleta_ai_pesan
       (id, percakapan_id, urutan, peran, isi, dijawab_oleh, usulan, rujukan, peringatan,
        ruas_dikirim, ruas_ditahan, penyedia, model, dibuat_at)
     VALUES (?, ?, ?, 'sistem', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      percakapanId,
      urutan,
      jawaban.isi,
      jawaban.dijawabOleh,
      jawaban.usulan ? 1 : 0,
      JSON.stringify(jawaban.rujukan),
      JSON.stringify(jawaban.peringatan),
      // Nama ruasnya saja - nilainya tidak disalin ke sini.
      JSON.stringify(Object.keys(kiriman?.isi ?? {})),
      JSON.stringify((kiriman?.ditahan ?? []).map((item) => item.ruas)),
      bersih(penyedia),
      bersih(model),
      sekarang,
    ]
  );

  await db.run(`UPDATE aleta_ai_percakapan SET diubah_at = ? WHERE id = ?`, [sekarang, percakapanId]);
}

// =============================================================================
// I1 - MENARIK FAKTA TAK BERPOLA
// =============================================================================

/**
 * Menyimpan fakta yang lolos pemeriksaan kutipan.
 *
 * Yang dibuang penarik TIDAK disimpan sama sekali - bukan disimpan dengan
 * tanda ragu. Yang tersimpan akhirnya muncul di layar, dan yang muncul di
 * layar akhirnya dipakai.
 */
export async function simpanFakta(
  db: AletaDatabase,
  masukan: {
    perkaraId: string;
    sumberBerkas: string;
    hasil: HasilTarik;
    oleh: string;
    penyedia: string;
    model: string;
  }
): Promise<number> {
  const perkaraId = bersih(masukan.perkaraId);
  if (!perkaraId) return 0;
  const sekarang = new Date().toISOString();

  let tersimpan = 0;
  for (const fakta of masukan.hasil.fakta) {
    await db.run(
      `INSERT INTO aleta_ai_fakta
         (id, perkara_id, sumber_berkas, nama, jenis, nilai, kutipan, halaman,
          ditarik_oleh, penyedia, model, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        perkaraId,
        bersih(masukan.sumberBerkas),
        fakta.nama,
        fakta.jenis,
        fakta.nilai,
        fakta.kutipan,
        fakta.halaman,
        bersih(masukan.oleh),
        bersih(masukan.penyedia),
        bersih(masukan.model),
        sekarang,
      ]
    );
    tersimpan += 1;
  }
  return tersimpan;
}

export async function faktaPerkara(
  db: AletaDatabase,
  perkaraId: string
): Promise<Array<{ id: string; nama: string; nilai: string; kutipan: string; halaman: number; disahkan: boolean }>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_ai_fakta WHERE perkara_id = ? ORDER BY nama ASC`,
    [bersih(perkaraId)]
  );
  return baris.map((item) => ({
    id: bersih(item.id),
    nama: bersih(item.nama),
    nilai: bersih(item.nilai),
    kutipan: bersih(item.kutipan),
    halaman: Number(item.halaman ?? 0),
    disahkan: Number(item.disahkan ?? 0) === 1,
  }));
}

/**
 * Menegaskan satu fakta.
 *
 * Sebelum ditegaskan, fakta di tabel ini hanya BACAAN MODEL - ia tidak boleh
 * dipakai pemeriksaan perkara maupun perakit putusan. Penegasan menuntut nama
 * orangnya, bukan akun: yang menyatakan sebuah bacaan benar adalah petugas,
 * dan akun bukan petugas.
 */
export async function sahkanFakta(
  db: AletaDatabase,
  masukan: { faktaId: string; olehNama: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const nama = bersih(masukan.olehNama);
  if (!nama) return { ok: false, sebab: "Sebutkan nama yang menegaskan fakta ini." };

  const hasil = await db.run(
    `UPDATE aleta_ai_fakta SET disahkan = 1, disahkan_oleh = ?, disahkan_at = ? WHERE id = ?`,
    [nama, new Date().toISOString(), bersih(masukan.faktaId)]
  );
  return hasil.changes ? { ok: true } : { ok: false, sebab: "Fakta tidak ditemukan." };
}

// =============================================================================
// I4 - MENGUSULKAN BUTIR PUSTAKA, HAKIM YANG MENGESAHKAN
// =============================================================================

/**
 * Memasukkan alinea susunan model ke pustaka sebagai USULAN.
 *
 * Tiga penolakan sebelum ia boleh masuk:
 *
 *   - kutipan yang tidak terbukti di pustaka hukum menolak seluruh usulan,
 *     bukan hanya kutipannya. Alinea yang mengutip satu pasal karangan tidak
 *     menjadi benar dengan membuang kutipannya - yang salah penalarannya;
 *   - alinea yang sidiknya sudah ada TIDAK ditambahkan lagi, sebab pustaka
 *     dikunci pada sidik alinea, dan usulan kembar akan disahkan dua kali; dan
 *   - keadaannya 'usulan', selalu. Tidak ada parameter yang membuatnya lahir
 *     disahkan.
 *
 * Asalnya dicatat di dibuat_oleh sebagai model yang menyusunnya - bukan
 * sebagai akun yang menekan. Yang mengesahkan berhak tahu kalimat itu tidak
 * pernah ditulis hakim mana pun.
 */
export async function usulkanButirKePustaka(
  db: AletaDatabase,
  masukan: {
    usulan: UsulanButir;
    jenisPerkara: string;
    penyedia: string;
    model: string;
  }
): Promise<{ ok: boolean; butirId: string; sebab?: string }> {
  if (!masukan.usulan.layakDiusulkan) {
    return { ok: false, butirId: "", sebab: masukan.usulan.sebab || "Usulan belum layak." };
  }

  const { sidikButir } = await import("@/server/modules/aleta-ecourt/pemecah-pertimbangan");
  const sidik = sidikButir(masukan.usulan.teks);

  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id, keadaan FROM aleta_pertimbangan_butir WHERE sidik = ?`,
    [sidik]
  );
  if (sudahAda) {
    return {
      ok: false,
      butirId: bersih(sudahAda.id),
      sebab: `Alinea dengan bunyi yang sama sudah ada di pustaka (${bersih(sudahAda.keadaan)}).`,
    };
  }

  const butirId = randomUUID();
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan,
        atas_perintah, versi, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, '{}', 0, 'usulan', '', 1, ?, ?, ?)`,
    [
      butirId,
      sidik,
      masukan.usulan.teks,
      bersih(masukan.jenisPerkara),
      masukan.usulan.isu,
      `model:${bersih(masukan.penyedia)}/${bersih(masukan.model)}`,
      sekarang,
      sekarang,
    ]
  );

  // Rujukannya ikut disimpan supaya periksaRujukan dan pembekuan dasar (J1)
  // memperlakukannya sama dengan butir tulisan hakim.
  for (const kutipan of masukan.usulan.kutipan) {
    await db.run(
      `INSERT INTO aleta_pertimbangan_rujukan
         (id, butir_id, tertulis, pasal, ayat, huruf, peraturan, jangkar, terbukti, diperiksa_at)
       VALUES (?, ?, ?, '', '', '', '', ?, 1, ?)`,
      [randomUUID(), butirId, kutipan.tertulis, kutipan.jangkar, sekarang]
    );
  }

  return { ok: true, butirId };
}

// =============================================================================
// I6 - SAKLAR MATI: PER PENGADILAN, PER PERAN, ATAU PER PERKARA
// =============================================================================

export async function bacaSaklar(db: AletaDatabase): Promise<Saklar[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT lingkup, kunci, menyala, alasan, diputuskan_oleh FROM aleta_ai_saklar`
  );
  return baris.map((item) => ({
    lingkup: bersih(item.lingkup) as Saklar["lingkup"],
    kunci: bersih(item.kunci),
    menyala: Number(item.menyala ?? 1) === 1,
    alasan: bersih(item.alasan),
    diputuskanOleh: bersih(item.diputuskan_oleh),
  }));
}

/**
 * Keadaan AI untuk satu konteks - dibaca SETIAP KALI, tidak disimpan.
 *
 * Saklar mati yang baru berlaku sesudah singgahan kedaluwarsa bukan saklar
 * mati. Hakim yang menekannya pada perkara yang sedang disorot berharap
 * pengiriman berhenti saat itu juga, bukan sepuluh menit lagi - dan sepuluh
 * menit sudah cukup untuk beberapa pertanyaan.
 */
export async function keadaanAi(
  db: AletaDatabase,
  konteks: { peran: string; perkaraId: string },
  globalMenyala: boolean
): Promise<Keputusan> {
  return hitungSaklar(await bacaSaklar(db), konteks, globalMenyala);
}

/**
 * Menyimpan satu saklar.
 *
 * Ditimpa bila lingkup dan kuncinya sudah ada - dua baris yang bertentangan
 * untuk satu kunci akan membuat keadaan AI bergantung urutan baca, dan urutan
 * baca bukan sesuatu yang pernah diputuskan siapa pun.
 */
export async function simpanSaklar(
  db: AletaDatabase,
  masukan: { lingkup: string; kunci: string; menyala: boolean; alasan: string; oleh: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const periksa = periksaSaklar(masukan);
  if (!periksa.ok) return periksa;

  const lingkup = bersih(masukan.lingkup);
  const kunci = lingkup === "pengadilan" ? "" : bersih(masukan.kunci);
  const sekarang = new Date().toISOString();

  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_ai_saklar WHERE lingkup = ? AND kunci = ?`,
    [lingkup, kunci]
  );

  if (sudahAda) {
    await db.run(
      `UPDATE aleta_ai_saklar SET menyala = ?, alasan = ?, diputuskan_oleh = ?, diubah_at = ? WHERE id = ?`,
      [masukan.menyala ? 1 : 0, bersih(masukan.alasan), bersih(masukan.oleh), sekarang, bersih(sudahAda.id)]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_ai_saklar (id, lingkup, kunci, menyala, alasan, diputuskan_oleh, dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        lingkup,
        kunci,
        masukan.menyala ? 1 : 0,
        bersih(masukan.alasan),
        bersih(masukan.oleh),
        sekarang,
        sekarang,
      ]
    );
  }
  return { ok: true };
}

export { periksaTarikan, periksaUsulan };
export type { HasilTarik, MasukanTarik, UsulanButir, Keputusan, Saklar };
