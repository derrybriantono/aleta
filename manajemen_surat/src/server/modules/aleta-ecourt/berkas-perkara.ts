import { halanganPenarik, jalankanSemuaPenarik } from "@/server/modules/aleta-ecourt/penarik";

/**
 * BERKAS PERKARA TERPADU - satu catatan perkara dari semua sumber.
 *
 * ============================================================================
 * MENGAPA SATU TEMPAT
 * ============================================================================
 *
 * SIPP, e-Court, dan APS Badilag menyimpan potongan perkara yang sama di tiga
 * tempat. Selama tiap fitur menarik datanya sendiri-sendiri, ketiganya akan
 * berselisih diam-diam - dan selisih yang tidak terlihat jauh lebih berbahaya
 * daripada selisih yang dilaporkan.
 *
 * Modul ini merakitnya sekali, lalu semua alat di atasnya membaca dari sini:
 * alat bantu tulis BAS, perakit putusan, analisis, dan kolom percakapan.
 *
 * ============================================================================
 * TIAP BUTIR MEMBAWA ASAL-USULNYA
 * ============================================================================
 *
 * Bukan hiasan. Yang menyusun BAS atau putusan harus dapat menjawab "dari mana
 * angka ini" tanpa membuka tiga aplikasi. Butir tanpa asal tidak boleh dipakai
 * menyusun apa pun - dan itu ditegakkan dengan menjadikan asal sebagai bagian
 * dari bentuk datanya, bukan sebagai catatan terpisah yang mudah terlupa.
 *
 * ============================================================================
 * SELISIH DISIMPAN, TIDAK DILEBUR
 * ============================================================================
 *
 * Bila SIPP mencatat tiga saksi sementara ABT memuat pemeriksaan lima orang,
 * keduanya disimpan dan bedanya disebutkan. Melebur diam-diam - memilih salah
 * satu sebagai "yang benar" - menghilangkan temuan justru pada saat ia paling
 * perlu dilihat.
 */

/**
 * Sistem yang dapat menjadi asal sebuah butir.
 *
 * "e-Court" sudah terdaftar di sini tetapi BELUM ada satu pun bagian yang
 * menariknya - lihat rakitBerkasPerkara di bawah. Ia disebut lebih dulu karena
 * bentuk asal-usulnya memang harus siap sebelum penariknya dibuat; yang tidak
 * boleh adalah layar mengaku menariknya padahal belum.
 */
export type Sistem = "SIPP" | "e-Court" | "APS Badilag" | "ALETA";

export type Asal = {
  sistem: Sistem;
  /** Tabel atau operasi yang menjadi sumbernya, untuk ditelusuri kembali. */
  sumber: string;
  /** Waktu pengambilan, supaya umur data terbaca. */
  diambil: string;
};

export type Bagian<T> = {
  ada: boolean;
  nilai: T;
  asal: Asal;
  /** Terisi bila bagian ini gagal diambil - bukan dilempar, supaya sisanya tetap terakit. */
  galat: string;
};

export type Selisih = {
  hal: string;
  menurut: Array<{ sistem: Sistem; nilai: string }>;
  keterangan: string;
};

export type BerkasPerkara = {
  ok: boolean;
  nomorPerkara: string;
  perkaraId: string;
  dirakitPada: string;
  identitas: Bagian<Record<string, unknown> | null>;
  paraPihak: Bagian<unknown[]>;
  majelis: Bagian<unknown[]>;
  panitera: Bagian<unknown[]>;
  jurusita: Bagian<unknown[]>;
  riwayatSidang: Bagian<unknown[]>;
  saksiTercatat: Bagian<unknown[]>;
  pemeriksaanSaksi: Bagian<Record<string, unknown> | null>;
  putusan: Bagian<Record<string, unknown> | null>;
  pertimbangan: Bagian<Record<string, unknown> | null>;
  /** Perbedaan antar sumber - ditampilkan, tidak dilebur. */
  selisih: Selisih[];
  /** Hal yang menghalangi pemakaian berkas ini, dalam bahasa yang terbaca petugas. */
  halangan: string[];
};

function kosong<T>(nilai: T, sistem: Sistem, sumber: string, galat = ""): Bagian<T> {
  return { ada: false, nilai, asal: { sistem, sumber, diambil: new Date().toISOString() }, galat };
}

/**
 * Membandingkan sumber yang seharusnya sepakat.
 *
 * Yang dibandingkan sengaja sedikit dan bermakna. Membandingkan segalanya
 * menghasilkan daftar panjang berisi perbedaan ejaan yang tidak berarti, dan
 * daftar yang terlalu panjang berhenti dibaca - lalu selisih yang sungguh
 * penting ikut terlewat.
 */
function bandingkan(berkas: BerkasPerkara): Selisih[] {
  const hasil: Selisih[] = [];

  const saksiSipp = Array.isArray(berkas.saksiTercatat.nilai) ? berkas.saksiTercatat.nilai.length : 0;
  const pemeriksaan = berkas.pemeriksaanSaksi.nilai as { jumlahSaksi?: number } | null;
  const saksiAbt = Number(pemeriksaan?.jumlahSaksi ?? 0);

  if (berkas.saksiTercatat.ada || berkas.pemeriksaanSaksi.ada) {
    if (saksiSipp !== saksiAbt) {
      hasil.push({
        hal: "Jumlah saksi",
        menurut: [
          { sistem: "SIPP", nilai: `${saksiSipp} orang tercatat` },
          { sistem: "APS Badilag", nilai: `${saksiAbt} orang diperiksa` },
        ],
        keterangan:
          saksiAbt > saksiSipp
            ? "Ada saksi yang sudah diperiksa tetapi belum tercatat di SIPP."
            : "Ada saksi tercatat di SIPP yang pemeriksaannya belum terekam di ABT.",
      });
    }
  }

  // Putusan sudah ada tetapi pertimbangannya belum ditulis - keadaan yang wajar
  // di tengah proses, tetapi harus terlihat sebelum berkas dianggap lengkap.
  if (berkas.putusan.ada && !berkas.pertimbangan.ada) {
    hasil.push({
      hal: "Pertimbangan hukum",
      menurut: [
        { sistem: "SIPP", nilai: "putusan sudah ada" },
        { sistem: "SIPP", nilai: "pertimbangan belum ditulis" },
      ],
      keterangan: "Putusan tercatat tanpa pertimbangan hukum di perkara_pertimbangan_hukum.",
    });
  }

  // --- Para pihak: dua tempat, satu kenyataan -------------------------------
  //
  // perkara.para_pihak adalah tulisan bebas yang dipakai SIPP untuk menampilkan
  // di daftar; perkara_pihak adalah daftar sesungguhnya. Keduanya diisi
  // terpisah, jadi keduanya dapat berselisih - dan yang dipakai ALETA untuk
  // menyusun BAS adalah yang kedua. Selisihnya harus terlihat, karena naskah
  // resmi akan memakai nama yang berbeda dari yang dibaca petugas di SIPP.
  const identitas = (berkas.identitas.nilai ?? {}) as Record<string, unknown>;
  const ringkasPihak = String(identitas.paraPihak ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const daftarPihak = Array.isArray(berkas.paraPihak.nilai)
    ? (berkas.paraPihak.nilai as Array<{ name?: string }>)
    : [];

  if (ringkasPihak && daftarPihak.length > 0) {
    const belumDisebut = daftarPihak
      .map((pihak) => String(pihak?.name ?? "").trim())
      .filter((nama) => nama && !ringkasPihak.toLowerCase().includes(nama.toLowerCase()));

    if (belumDisebut.length > 0) {
      hasil.push({
        hal: "Nama para pihak",
        menurut: [
          { sistem: "SIPP", nilai: `daftar pihak: ${belumDisebut.join(", ")}` },
          { sistem: "SIPP", nilai: `ringkasan perkara: ${ringkasPihak.slice(0, 120)}` },
        ],
        keterangan:
          "Nama pada daftar pihak tidak muncul pada ringkasan perkara. Naskah memakai daftar pihak.",
      });
    }
  }

  // --- Majelis: ada ketuanya atau tidak -------------------------------------
  //
  // Blangko menyebut ketua majelis sebagai yang memimpin sidang. Majelis tanpa
  // ketua yang tercatat berarti penandanya dibiarkan kosong pada naskah - dan
  // itu lebih baik diketahui sekarang daripada saat naskahnya dibuka.
  const majelis = Array.isArray(berkas.majelis.nilai)
    ? (berkas.majelis.nilai as Array<{ jabatan?: string; name?: string }>)
    : [];

  if (majelis.length > 0 && !majelis.some((h) => String(h?.jabatan ?? "").toLowerCase().includes("ketua"))) {
    hasil.push({
      hal: "Ketua majelis",
      menurut: [
        { sistem: "SIPP", nilai: `${majelis.length} hakim ditunjuk` },
        { sistem: "SIPP", nilai: "tidak satu pun berjabatan Hakim Ketua" },
      ],
      keterangan: "Penanda ketua majelis akan dibiarkan kosong pada naskah.",
    });
  }

  // --- Panitera pengganti ---------------------------------------------------
  if (berkas.majelis.ada && !berkas.panitera.ada) {
    hasil.push({
      hal: "Panitera pengganti",
      menurut: [
        { sistem: "SIPP", nilai: "majelis sudah ditunjuk" },
        { sistem: "SIPP", nilai: "panitera pengganti belum ditunjuk" },
      ],
      keterangan: "BAS menyebut panitera pengganti pada kepala dan penutupnya.",
    });
  }

  // --- Jadwal sidang: nomor yang melompat -----------------------------------
  //
  // Nomor sidang yang melompat berarti ada sidang yang tidak tercatat, dan BAS
  // untuk sidang itu tidak akan menemukan tanggalnya. Diperiksa di sini karena
  // hanya di sini seluruh rangkaian terlihat sekaligus.
  const jadwal = Array.isArray(berkas.riwayatSidang.nilai)
    ? (berkas.riwayatSidang.nilai as Array<Record<string, unknown>>)
    : [];
  const nomorSidang = jadwal
    .map((item) => Number(item.sidangKe ?? item.urutan) || 0)
    .filter((nomor) => nomor > 0)
    .sort((a, b) => a - b);

  if (nomorSidang.length > 0) {
    const hilang: number[] = [];
    for (let nomor = 1; nomor < nomorSidang[nomorSidang.length - 1]; nomor += 1) {
      if (!nomorSidang.includes(nomor)) hilang.push(nomor);
    }
    if (hilang.length > 0) {
      hasil.push({
        hal: "Rangkaian sidang",
        menurut: [
          { sistem: "SIPP", nilai: `sidang tercatat: ${nomorSidang.join(", ")}` },
          { sistem: "SIPP", nilai: `tidak ada nomor: ${hilang.join(", ")}` },
        ],
        keterangan: "BAS untuk sidang yang nomornya tidak ada tidak akan menemukan tanggalnya.",
      });
    }
  }

  // --- Keterangan saksi yang tidak menyebut pihak mana pun ------------------
  //
  // Keterangan yang tidak menyebut satu pun nama pihak biasanya keterangan yang
  // tersalin dari perkara lain. Diperiksa dengan longgar - hanya melaporkan
  // bila TIDAK SATU PUN nama muncul - supaya yang dilaporkan memang mencurigakan
  // dan bukan sekadar keterangan yang menyebut para pihak dengan sebutan.
  const pemeriksaanIsi = berkas.pemeriksaanSaksi.nilai as { saksi?: Array<Record<string, unknown>> } | null;
  const namaPihak = daftarPihak.map((p) => String(p?.name ?? "").trim()).filter(Boolean);

  if (namaPihak.length > 0 && Array.isArray(pemeriksaanIsi?.saksi)) {
    const seluruhTeks = pemeriksaanIsi.saksi
      .flatMap((saksi) => (Array.isArray(saksi.tanyaJawab) ? (saksi.tanyaJawab as Array<Record<string, unknown>>) : []))
      .map((baris) => `${String(baris.pertanyaan ?? "")} ${String(baris.jawaban ?? "")}`)
      .join(" ")
      .toLowerCase();

    const adaIsinya = seluruhTeks.trim().length > 200;
    const menyebutPihak = namaPihak.some((nama) => seluruhTeks.includes(nama.toLowerCase()));
    // Sebutan peran juga dihitung: banyak keterangan menulis "Penggugat" dan
    // "Tergugat", bukan namanya - dan itu wajar, bukan tanda tersalin.
    const menyebutPeran = /penggugat|tergugat|pemohon|termohon/.test(seluruhTeks);

    if (adaIsinya && !menyebutPihak && !menyebutPeran) {
      hasil.push({
        hal: "Keterangan saksi",
        menurut: [
          { sistem: "APS Badilag", nilai: "keterangan terekam" },
          { sistem: "SIPP", nilai: `nama pihak: ${namaPihak.join(", ")}` },
        ],
        keterangan:
          "Keterangan saksi tidak menyebut nama maupun sebutan para pihak perkara ini - periksa apakah tersalin dari perkara lain.",
      });
    }
  }

  return hasil;
}

/**
 * Merakit berkas perkara dari seluruh sumber.
 *
 * Seluruh bagian diambil BERSAMAAN, bukan berurutan. Delapan pembacaan
 * berurutan ke basis data yang sama menjadikan halaman perkara terasa berat
 * tanpa alasan - dan halaman yang terasa berat adalah halaman yang ditinggalkan.
 */
export async function rakitBerkasPerkara(perkaraId: string, nomorPerkara = ""): Promise<BerkasPerkara> {
  const id = String(perkaraId || "").trim();
  const dirakitPada = new Date().toISOString();

  if (!id) {
    return {
      ok: false,
      nomorPerkara,
      perkaraId: "",
      dirakitPada,
      identitas: kosong(null, "SIPP", "perkara", "perkara_id kosong"),
      paraPihak: kosong([], "SIPP", "perkara_pihak"),
      majelis: kosong([], "SIPP", "perkara_hakim_pn"),
      panitera: kosong([], "SIPP", "perkara_panitera_pn"),
      jurusita: kosong([], "SIPP", "perkara_jurusita"),
      riwayatSidang: kosong([], "SIPP", "perkara_jadwal_sidang"),
      saksiTercatat: kosong([], "SIPP", "perkara_saksi"),
      pemeriksaanSaksi: kosong(null, "APS Badilag", "abt_keterangan_saksi"),
      putusan: kosong(null, "SIPP", "perkara_putusan"),
      pertimbangan: kosong(null, "SIPP", "perkara_pertimbangan_hukum"),
      selisih: [],
      halangan: ["Nomor perkara tidak dikenali."],
    };
  }

  // Seluruh sumber ditarik BERSAMAAN lewat daftar penarik. Menambah sumber
  // berarti menambah satu baris di sana, bukan menyunting perakit ini - dan
  // yang lupa disunting bukan pemanggilannya melainkan hal-hal di sekitarnya.
  const bagian = await jalankanSemuaPenarik(id);

  const identitas = bagian.identitas as Bagian<Record<string, unknown> | null>;
  const paraPihak = bagian.paraPihak as Bagian<unknown[]>;
  const majelis = bagian.majelis as Bagian<unknown[]>;
  const panitera = bagian.panitera as Bagian<unknown[]>;
  const jurusita = bagian.jurusita as Bagian<unknown[]>;
  const riwayatSidang = bagian.riwayatSidang as Bagian<unknown[]>;
  const saksiTercatat = bagian.saksiTercatat as Bagian<unknown[]>;
  const pemeriksaanSaksi = bagian.pemeriksaanSaksi as Bagian<Record<string, unknown> | null>;
  const putusan = bagian.putusan as Bagian<Record<string, unknown> | null>;
  const pertimbangan = bagian.pertimbangan as Bagian<Record<string, unknown> | null>;

  const berkas: BerkasPerkara = {
    ok: identitas.ada,
    nomorPerkara: nomorPerkara || String((identitas.nilai as Record<string, unknown> | null)?.nomorPerkara ?? ""),
    perkaraId: id,
    dirakitPada,
    identitas,
    paraPihak,
    majelis,
    panitera,
    jurusita,
    riwayatSidang,
    saksiTercatat,
    pemeriksaanSaksi,
    putusan,
    pertimbangan,
    selisih: [],
    halangan: [],
  };

  berkas.selisih = bandingkan(berkas);

  // Halangan disebut dengan nama sistemnya, bukan "terjadi kesalahan". Petugas
  // yang tahu ABT sedang mati dapat meneruskan pekerjaannya; petugas yang hanya
  // melihat "gagal" akan berhenti dan bertanya.
  //
  // Sumber yang ketiadaannya wajar - jurusita pada perkara yang belum dipanggil
  // - sengaja TIDAK disebut. Daftar halangan yang selalu berisi berhenti dibaca.
  berkas.halangan.push(...halanganPenarik(bagian));

  return berkas;
}
