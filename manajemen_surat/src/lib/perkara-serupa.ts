/**
 * PERKARA SERUPA (G5) - pola fakta yang sama, dicari tanpa model.
 *
 * ============================================================================
 * YANG DIBANDINGKAN ADALAH POLA FAKTA, BUKAN BUNYI PUTUSAN
 * ============================================================================
 *
 * Membandingkan naskah putusan menghasilkan daftar perkara yang kalimatnya
 * mirip - dan kalimat putusan memang mirip pada hampir semua perkara, karena
 * disusun dari templat yang sama. Hasilnya: dua ratus "perkara serupa" yang
 * tidak satu pun serupa faktanya.
 *
 * Yang dibandingkan di sini adalah pola faktanya: jenis perkara, hadir atau
 * tidaknya tergugat, berapa saksi, ada tidaknya anak, alasan yang didalilkan.
 * Dua perkara dengan pola yang sama memang pantas diputus serupa - dan itulah
 * gunanya daftar ini: menjaga keajekan antarmajelis.
 *
 * ============================================================================
 * NAMA, TANGGAL, DAN NOMOR TIDAK PERNAH MASUK SIDIK
 * ============================================================================
 *
 * Bukan sekadar demi kerahasiaan. Fakta yang unik bagi satu perkara membuat
 * tiap perkara serupa hanya dengan dirinya sendiri, dan pencariannya selalu
 * mengembalikan kosong. Sidik yang berguna justru sidik yang sengaja
 * melupakan yang membedakan.
 *
 * ============================================================================
 * KEMIRIPAN SELALU DISERTAI SEBABNYA
 * ============================================================================
 *
 * Angka kemiripan tanpa keterangan adalah ramalan: hakim diminta percaya
 * bahwa dua perkara mirip tanpa dapat memeriksanya. Maka tiap hasil membawa
 * fakta mana yang sama dan fakta mana yang berbeda, sehingga yang membacanya
 * dapat menolak kemiripan itu dalam sekali lihat.
 */

/** Fakta yang boleh masuk sidik - selain ini diabaikan. */
export type FaktaPola = Record<string, string | number | boolean | null | undefined>;

export type SidikPerkara = {
  perkaraId: string;
  nomorPerkara: string;
  /** Pasangan "kunci=nilai" yang sudah dibakukan, terurut. */
  butir: string[];
  sidik: string;
};

export type Kemiripan = {
  perkaraId: string;
  nomorPerkara: string;
  /** 0..1 - Jaccard atas butir pola. */
  skor: number;
  sama: string[];
  beda: string[];
};

/**
 * Kunci fakta yang TIDAK BOLEH masuk sidik.
 *
 * Daftarnya disebut sebagai pola, bukan nama tepat, karena fakta datang dari
 * banyak sumber dengan penamaan yang berbeda-beda. Yang terlewat di sini akan
 * membuat sidiknya unik dan pencariannya sia-sia - kegagalan yang tenang,
 * karena hasil kosong terlihat seperti "memang tidak ada yang serupa".
 */
const POLA_DILARANG = [
  /nama/i,
  /nomor/i,
  /tanggal/i,
  /nik/i,
  /alamat/i,
  /^id$/i,
  /perkaraid/i,
  /telepon/i,
  /email/i,
];

function bolehMasukSidik(kunci: string): boolean {
  return !POLA_DILARANG.some((pola) => pola.test(kunci));
}

function bakukan(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "boolean") return nilai ? "ya" : "tidak";
  if (typeof nilai === "number") return Number.isFinite(nilai) ? String(nilai) : "";
  return String(nilai).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Menyusun sidik pola dari fakta perkara.
 *
 * Fakta bernilai kosong TIDAK menjadi butir. Butir "alasan=" pada dua perkara
 * yang sama-sama belum mengisi alasannya akan terhitung sebagai kesamaan -
 * padahal yang sama hanyalah kekosongannya.
 */
export function susunSidik(perkaraId: string, nomorPerkara: string, fakta: FaktaPola): SidikPerkara {
  const butir: string[] = [];
  for (const [kunci, nilai] of Object.entries(fakta ?? {})) {
    if (!bolehMasukSidik(kunci)) continue;
    const isi = bakukan(nilai);
    if (!isi) continue;
    butir.push(`${kunci.trim().toLowerCase()}=${isi}`);
  }
  butir.sort();
  return {
    perkaraId: String(perkaraId ?? "").trim(),
    nomorPerkara: String(nomorPerkara ?? "").trim(),
    butir,
    sidik: butir.join("|"),
  };
}

/**
 * Mencari perkara dengan pola paling mirip.
 *
 * Perkara itu sendiri selalu dibuang dari hasil - perkara yang paling mirip
 * dengan dirinya sendiri adalah jawaban yang benar dan tidak berguna.
 *
 * Skor nol tidak dikembalikan. Daftar yang selalu berisi sepuluh baris membuat
 * pembacanya berhenti membedakan kemiripan yang berarti dari yang tidak.
 */
export function cariSerupa(
  acuan: SidikPerkara,
  pustaka: SidikPerkara[],
  pilihan: { batas?: number; skorMinimal?: number } = {}
): Kemiripan[] {
  const batas = Math.min(Math.max(pilihan.batas ?? 10, 1), 100);
  const minimal = pilihan.skorMinimal ?? 0.5;
  const acuanSet = new Set(acuan.butir);
  if (!acuanSet.size) return [];

  const hasil: Kemiripan[] = [];
  for (const satu of pustaka ?? []) {
    if (satu.perkaraId === acuan.perkaraId) continue;
    const lawan = new Set(satu.butir);
    if (!lawan.size) continue;

    const sama = [...acuanSet].filter((butir) => lawan.has(butir));
    const gabungan = new Set([...acuanSet, ...lawan]);
    const skor = sama.length / gabungan.size;
    if (skor < minimal) continue;

    const beda = [
      ...[...acuanSet].filter((butir) => !lawan.has(butir)).map((butir) => `perkara ini: ${butir}`),
      ...[...lawan].filter((butir) => !acuanSet.has(butir)).map((butir) => `perkara itu: ${butir}`),
    ].sort();

    hasil.push({
      perkaraId: satu.perkaraId,
      nomorPerkara: satu.nomorPerkara,
      skor: Number(skor.toFixed(3)),
      sama: sama.sort(),
      beda,
    });
  }

  // Nomor perkara menjadi pemutus terakhir supaya urutannya ajeg: daftar yang
  // berubah urutannya tiap kali dibuka tidak dapat dijadikan rujukan.
  return hasil
    .sort((a, b) => b.skor - a.skor || a.nomorPerkara.localeCompare(b.nomorPerkara))
    .slice(0, batas);
}
