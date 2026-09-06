/**
 * ============================================================================
 * PENYUSUN PERINTAH PENULISAN PUTUSAN
 * ============================================================================
 *
 * Merangkai keterangan perkara dari SIPP menjadi satu perintah utuh untuk
 * Project Claude "ALETA AI PA CLAUDE", mengikuti susunan A sampai E yang
 * sudah dipakai di pengadilan ini.
 *
 * ============================================================================
 * MENGAPA PERANGKAIANNYA DI SINI, BUKAN DI PELADEN
 * ============================================================================
 *
 * Peladen mengirim BAHAN; berkas ini yang merangkainya. Akibatnya kalimat
 * perintah berubah seketika tiap kali penyusun mengubah arah putusan atau
 * mencentang rekonvensi - tanpa satu pun perjalanan pulang ke peladen. Yang
 * menulis putusan dapat membaca dahulu apa yang akan ia kirim.
 *
 * ============================================================================
 * BATAS YANG JUJUR: APA YANG TIDAK ADA DI SIPP
 * ============================================================================
 *
 * Diperiksa pada SIPP yang berjalan, bukan diperkirakan:
 *
 *   - Rincian Pasal 1 sampai sekian kesepakatan mediasi ADA pada sebagian
 *     perkara saja. Dari 752 baris mediasi, 209 punya isian, dan isinya pun
 *     tidak seragam: perkara 9956 memuat pasal-pasalnya, sedangkan perkara
 *     9862 - contoh yang dipakai menyusun layar ini - hanya memuat ringkasan
 *     laporan mediator. Karena itu kolomnya DAPAT DISUNTING: yang ada terisi
 *     sendiri, yang tidak ada ditempel oleh penyusun.
 *   - Isinya HTML, bukan teks biasa. Menempelkannya mentah-mentah akan
 *     mengirim "<li>" dan "<strong>" ke dalam perintah.
 *   - Nama berkas datang dari arsip e-Court ALETA, dan HANYA bila berkasnya
 *     benar-benar terbaca di disk. Bila belum terunduh, yang disajikan judul
 *     dokumennya - ditandai bukan nama berkas, supaya yang membaca perintah
 *     tidak mencari berkas yang tidak pernah ada. `perkara_dokumen` milik
 *     SIPP kosong sama sekali dan tidak dipakai.
 *   - Arah putusan, blangko, dan berkas acuan TIDAK diambil dari mana pun.
 *     Itu keputusan dan pilihan orang yang menulis putusan.
 */

export type BerkasBahan = {
  judul: string;
  jenis: string;
  diunggahOleh: string;
  tanggalSidang: string;
  agenda: string;
  adaPdf: boolean;
  adaWord: boolean;
  /** Nama berkas sungguhan, kosong bila berkasnya belum terunduh. */
  namaBerkasPdf: string;
  namaBerkasWord: string;
};

export type BahanPrompt = {
  ok: boolean;
  alasan?: string;
  identitas: {
    perkaraId: string;
    nomorPerkara: string;
    jenisPerkara: string;
    tanggalDaftar: string;
    gugatan: boolean;
  };
  pihak: {
    penggugat: { nama: string; alamat: string }[];
    tergugat: { nama: string; alamat: string }[];
  };
  kuasa: { nama: string; klien: string; pihak: string }[];
  sidang: {
    tanggal: string;
    tanggalTerbaca: string;
    agenda: string;
    alasanDitunda: string;
    kehadiran: string;
  }[];
  mediasi: {
    ada: boolean;
    mediator: string;
    tanggalMulai: string;
    tanggalMulaiTerbaca: string;
    tanggalLaporan: string;
    tanggalLaporanTerbaca: string;
    tanggalKesepakatan: string;
    tanggalKesepakatanTerbaca: string;
    kodeHasil: string;
    hasilTerbaca: string;
    isiKesepakatan: string;
    biaya: { uraian: string; jumlah: number; tanggal: string }[];
  };
  saksi: { nama: string; pihak: string }[];
  berkas: BerkasBahan[];
  putusan: { tanggalPutusan: string; verstek: boolean; adaAmar: boolean };
};

export type PilihanPrompt = {
  arahPutusan: string;
  adaRekonvensi: boolean;
  hasilMediasi: string;
  isiKesepakatan: string;
  berkasBlangko: string;
  berkasAcuan: string;
  buktiSurat: string;
  saksiManual: string;
  termohonAdaBukti: boolean;
  adaBuktiElektronik: boolean;
  adaReplik: boolean;
  adaDuplik: boolean;
  lampiranTambahan: string;
  catatanKhusus: string;
  mintaAnalisaAwal: boolean;
  mintaBerkasDoc: boolean;
};

export const PILIHAN_ARAH: { kunci: string; label: string; kalimat: string }[] = [
  { kunci: "kabul", label: "Kabul seluruhnya", kalimat: "Kabul seluruhnya" },
  { kunci: "kabul-sebagian", label: "Kabul sebagian", kalimat: "Kabul sebagian" },
  { kunci: "tolak", label: "Tolak", kalimat: "Tolak" },
  {
    kunci: "tidak-diterima",
    label: "Tidak dapat diterima (NO)",
    kalimat: "Tidak dapat diterima (niet ontvankelijke verklaard)",
  },
  { kunci: "cabut", label: "Dicabut", kalimat: "Dicabut" },
  { kunci: "gugur", label: "Gugur", kalimat: "Gugur" },
];

export const PILIHAN_MEDIASI: { kunci: string; label: string }[] = [
  { kunci: "tidak-ada", label: "Tidak ada mediasi" },
  { kunci: "tidak-berhasil", label: "Mediasi tidak berhasil" },
  { kunci: "berhasil-sebagian", label: "Mediasi berhasil sebagian" },
  { kunci: "berhasil", label: "Mediasi berhasil seluruhnya" },
];

/**
 * Mengubah HTML SIPP menjadi teks berbutir.
 *
 * Isi kesepakatan mediasi disimpan sebagai HTML - `<ol><li>` pada sebagian
 * perkara, `<p><strong>Pasal 1</strong></p>` pada sebagian yang lain.
 * Menempelkannya mentah akan mengirim tanda kurung siku ke dalam perintah,
 * dan yang membaca perintah itu bukan peramban.
 *
 * Pemisah butir dipasang SEBELUM tanda dibuang, karena setelah dibuang tidak
 * ada lagi yang menandai di mana satu butir berakhir.
 */
export function bersihkanHtml(html: string): string {
  if (!html) return "";
  return (
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      // Entitas yang benar-benar muncul pada isian SIPP.
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .split("\n")
      .map((baris) => baris.replace(/\s+/g, " ").trim())
      .filter((baris) => baris && baris !== "-")
      .join("\n")
  );
}

/**
 * Sebutan pihak di seluruh badan putusan.
 *
 * Cerai talak dan permohonan memakai Pemohon/Termohon; gugatan lain memakai
 * Penggugat/Tergugat. Salah sebutan merusak seluruh uraian, jadi ini dibaca
 * dari jenis perkara, bukan ditebak dari nomornya saja.
 */
export function sebutanPihak(bahan: BahanPrompt): { satu: string; dua: string } {
  const jenis = (bahan.identitas.jenisPerkara || "").toLowerCase();
  const nomor = bahan.identitas.nomorPerkara || "";
  const permohonan = jenis.includes("talak") || jenis.includes("permohonan") || /\/Pdt\.P\//i.test(nomor);
  return permohonan
    ? { satu: "Pemohon", dua: "Termohon" }
    : { satu: "Penggugat", dua: "Tergugat" };
}

/** Nilai awal borang - yang sudah ada di SIPP terisi, sisanya kosong. */
export function pilihanAwal(bahan: BahanPrompt): PilihanPrompt {
  const kode = (bahan.mediasi.kodeHasil || "").toUpperCase();
  const hasilMediasi = !bahan.mediasi.ada
    ? "tidak-ada"
    : kode === "S"
      ? "berhasil-sebagian"
      : kode === "T"
        ? "tidak-berhasil"
        : "";

  const agenda = bahan.sidang.map((s) => (s.agenda || "").toLowerCase());
  const berkas = bahan.berkas.map((b) => `${b.judul} ${b.jenis}`.toLowerCase());
  const punya = (kata: string) =>
    agenda.some((a) => a.includes(kata)) || berkas.some((b) => b.includes(kata));

  return {
    arahPutusan: "",
    adaRekonvensi: false,
    hasilMediasi,
    isiKesepakatan: bersihkanHtml(bahan.mediasi.isiKesepakatan),
    berkasBlangko: "",
    berkasAcuan: "",
    buktiSurat: "",
    saksiManual: "",
    termohonAdaBukti: false,
    adaBuktiElektronik: false,
    // Agenda "Replik" kerap dijadwalkan lalu tidak jadi diajukan - contoh
    // perkara 359 begitu. Karena itu ini hanya NILAI AWAL yang boleh dicabut,
    // bukan kesimpulan.
    adaReplik: punya("replik"),
    adaDuplik: punya("duplik"),
    lampiranTambahan: "",
    catatanKhusus: "",
    mintaAnalisaAwal: true,
    mintaBerkasDoc: true,
  };
}

export type BerkasLampiran = {
  nama: string;
  penjelas: string;
  /**
   * Benar bila `nama` adalah nama berkas sungguhan yang harus disalin persis
   * - hanya yang begini dibungkus petik balik. Judul dokumen dari arsip
   * e-Court BUKAN nama berkas, dan membungkusnya seperti nama berkas membuat
   * pembacanya mencari berkas yang tidak pernah ada.
   */
  berkasNyata: boolean;
};

/**
 * Daftar dokumen e-Court yang layak dilampirkan.
 *
 * Nama berkas sungguhan dipakai bila berkasnya sudah terunduh dan terbaca -
 * itulah yang dapat dilampirkan apa adanya. Bila belum, yang disajikan judul
 * dokumennya, ditandai BUKAN nama berkas: penyusun jadi tahu dokumen apa
 * yang harus ia cari sendiri, bukan mengira ada berkas bernama begitu.
 */
export function daftarBerkas(bahan: BahanPrompt): BerkasLampiran[] {
  const keluar: BerkasLampiran[] = [];
  const terlihat = new Set<string>();
  for (const b of bahan.berkas) {
    const berkasNyata = b.namaBerkasPdf || b.namaBerkasWord;
    const nama = (berkasNyata || b.judul).trim();
    if (!nama || terlihat.has(nama)) continue;
    terlihat.add(nama);

    // Judul dokumen kerap sama persis dengan agendanya - "Duplik Termohon -
    // Duplik Termohon" hanya membuat daftarnya lebih sulit dibaca.
    const bentuk = [b.adaPdf ? "PDF" : "", b.adaWord ? "Word" : ""].filter(Boolean).join("/");
    const judulLain = berkasNyata && b.judul.trim() !== nama ? b.judul.trim() : "";
    const agenda = b.agenda && b.agenda !== nama && b.agenda !== judulLain ? b.agenda : "";
    const penjelas = [judulLain, agenda, bentuk].filter(Boolean).join(" - ");
    keluar.push({ nama, penjelas, berkasNyata: Boolean(berkasNyata) });
  }
  return keluar;
}

function baris(...isi: (string | false | null | undefined)[]): string {
  return isi.filter(Boolean).join("\n");
}

/**
 * Merangkai perintahnya.
 *
 * Bagian yang tidak berlaku DIHILANGKAN, bukan diisi "tidak ada". Perintah
 * yang memuat baris kosong mengajari yang membacanya bahwa sebagian isian
 * boleh diabaikan - dan itu menular ke bagian yang tidak boleh diabaikan.
 */
export function susunPrompt(bahan: BahanPrompt, pilihan: PilihanPrompt): string {
  const { satu, dua } = sebutanPihak(bahan);
  const nomor = bahan.identitas.nomorPerkara;
  const arah = PILIHAN_ARAH.find((a) => a.kunci === pilihan.arahPutusan);
  const mediasi = PILIHAN_MEDIASI.find((m) => m.kunci === pilihan.hasilMediasi);
  // Labelnya dipakai di dalam kalimat yang sudah menyebut kata "mediasi",
  // sehingga awalannya dibuang - "Hasilnya mediasi mediasi berhasil sebagian".
  const hasilMediasiSingkat = (mediasi?.label || "").replace(/^Mediasi\s+/i, "").toLowerCase();
  const adaMediasi = pilihan.hasilMediasi !== "tidak-ada" && Boolean(pilihan.hasilMediasi);
  const berhasilSebagian = pilihan.hasilMediasi === "berhasil-sebagian";
  const isiKesepakatan = pilihan.isiKesepakatan.trim();

  const bagian: string[] = [];

  bagian.push(
    baris(
      `Saya ingin membuat putusan lengkap untuk perkara Nomor ${nomor}.`,
      "Berikut adalah deskripsi keadaan perkara, aturan penulisan, dan referensi file yang harus dipatuhi untuk menyusun draf Putusan tingkat pertama:"
    )
  );

  /* ---------------------------------------------------------------- A ---- */
  // Yang dikabulkan atau ditolak adalah permohonan/gugatannya, bukan
  // "perkara"-nya. Sebutannya mengikuti kedudukan pihak: Pemohon mengajukan
  // permohonan, Penggugat mengajukan gugatan.
  const tuntutan = satu === "Pemohon" ? "permohonan" : "gugatan";
  const arahKalimat = arah
    ? `Arah putusannya adalah ${arah.kalimat} ${tuntutan}${
        bahan.identitas.jenisPerkara ? ` ${bahan.identitas.jenisPerkara.toLowerCase()}` : ""
      } ${satu}.`
    : "Arah putusannya BELUM DITENTUKAN - mohon tanyakan lebih dahulu sebelum menyusun.";

  const aRek = pilihan.adaRekonvensi
    ? `**PERHATIAN:** Perkara ini memuat gugatan Rekonvensi. Susun Konvensi dan Rekonvensi secara terpisah sesuai format.`
    : `**PERHATIAN:** Perkara ini murni Konvensi dan tidak ada gugatan Rekonvensi. Abaikan segala hal dan format yang berkaitan dengan rekonvensi.`;

  bagian.push(
    baris(
      "**A. ARAH PUTUSAN & ANALISA AWAL**\n",
      `* **Arah Putusan:** ${arahKalimat}${
        adaMediasi && berhasilSebagian
          ? ` Sesuaikan juga amar putusan dengan kesepakatan hasil mediasi (${hasilMediasiSingkat}) terkait akibat perceraian.`
          : ""
      } ${aRek}`,
      pilihan.mintaAnalisaAwal &&
        `* **Analisa Pra-Putusan:** SEBELUM menghasilkan teks putusan secara utuh, berikan terlebih dahulu analisa perkara, kesimpulan, serta rumusan pembebanan hukuman/hak pasca perceraian${
          adaMediasi ? " berdasarkan hasil mediasi" : ""
        }.`
    )
  );

  /* ---------------------------------------------------------------- B ---- */
  const dokumenJawab = [
    "Gugatan/Permohonan",
    `Jawaban ${dua}`,
    pilihan.adaReplik ? `Replik ${satu}` : "",
    pilihan.adaDuplik ? `Duplik ${dua}` : "",
  ].filter(Boolean);

  const catatanTidakAda = [
    !pilihan.adaReplik ? `Replik ${satu} tidak ada` : "",
    !pilihan.adaDuplik ? `Duplik ${dua} tidak ada` : "",
  ].filter(Boolean);

  const jadwal = bahan.sidang.map((s) => {
    const tunda = s.alasanDitunda ? ` (Ditunda: ${s.alasanDitunda})` : "";
    return `* ${s.tanggalTerbaca || s.tanggal}: ${s.agenda || "-"}${tunda}`;
  });

  const kuasaKalimat = bahan.kuasa.length
    ? `Berdasarkan data SIPP, pihak berikut diwakili kuasa hukum: ${bahan.kuasa
        .map((k) => `${k.pihak} (${k.klien}) oleh ${k.nama}`)
        .join("; ")}. Sesuaikan penyebutan kuasa pada putusan dengan Berita Acara Sidang.`
    : `Berdasarkan data SIPP tidak tercatat kuasa hukum, sehingga ${satu} dan ${dua} hadir menghadap sendiri (prinsipal) di persidangan. Abaikan penyebutan data Kuasa Hukum pada blangko/referensi dan sesuaikan dengan kehadiran riil pihak.`;

  bagian.push(
    baris(
      "**B. ATURAN PENYUSUNAN DUDUK PERKARA & PERTIMBANGAN HUKUM**\n",
      `* **Pengutipan Dokumen Jawab-Menjawab:** Ekstrak bagian posita dari file ${dokumenJawab.join(
        ", "
      )}.${
        catatanTidakAda.length ? ` (Catatan: ${catatanTidakAda.join("; ")}).` : ""
      } **JANGAN PERNAH mengubah isi teks aslinya walaupun terdapat kesalahan kalimat atau *typo* (salah ketik). Kutip persis seperti aslinya.** Bagian kata pembuka, identitas pihak, dan kata penutup tidak perlu diambil untuk dimasukkan ke dalam Duduk Perkara.`,
      pilihan.berkasAcuan.trim() &&
        `* **Format Susunan Putusan:** Gunakan file referensi \`${pilihan.berkasAcuan.trim()}\` sebagai acuan tata letak. Ambil struktur susunan Duduk Perkara dan Pertimbangan Hukumnya. Buang bagian pertimbangan yang tidak relevan dengan perkara ini, dan buat pertimbangan hukum baru yang menyesuaikan dengan fakta-fakta spesifik di perkara ini${
          pilihan.adaRekonvensi ? "" : " (khususnya penyesuaian karena tidak ada rekonvensi)"
        }.`,
      `* **Penyebutan Pihak:** Gunakan penyebutan pihak secara standar yaitu "${satu}" dan "${dua}" di seluruh uraian${
        pilihan.adaRekonvensi
          ? ", dan tambahkan sebutan Penggugat Rekonvensi/Tergugat Rekonvensi pada bagian rekonvensi"
          : ", karena tidak ada rekonvensi"
      }.`,
      `* **Tanda Baca:** Di tengah-tengah paragraf uraian Pertimbangan Hukum, dilarang menggunakan tanda titik koma (;) sebagai pemisah. Gunakan tanda koma (,) atau kata "atau". Pengecualian: pada akhir paragraf pertimbangan hukum, tanda titik koma (;) tetap harus dipertahankan/digunakan.`,
      adaMediasi &&
        baris(
          `* **Riwayat Mediasi (Sangat Penting):** ${[
            bahan.mediasi.mediator ? `Mediasi dipimpin oleh ${bahan.mediasi.mediator}` : "",
            bahan.mediasi.tanggalMulaiTerbaca
              ? `dilaksanakan mulai tanggal ${bahan.mediasi.tanggalMulaiTerbaca}`
              : "",
            bahan.mediasi.tanggalLaporanTerbaca
              ? `dan laporan hasil mediasi tertanggal ${bahan.mediasi.tanggalLaporanTerbaca}`
              : "",
          ]
            .filter(Boolean)
            .join(", ")}. Hasilnya ${hasilMediasiSingkat || "-"}.${
            isiKesepakatan
              ? ` **Sesuaikan uraian di bagian Duduk Perkara, Pertimbangan Hukum, dan Amar Putusan secara cermat dengan poin-poin hasil mediasi berikut ini:**`
              : ""
          }`,
          isiKesepakatan &&
            isiKesepakatan
              .split("\n")
              .map((b) => `  * *${b.replace(/^[-*]\s*/, "")}*`)
              .join("\n")
        ),
      jadwal.length > 0 &&
        baris(
          "* **Agenda & Jadwal Persidangan:** Gunakan acuan riwayat persidangan berdasarkan SIPP berikut ini ke dalam bagian yang relevan pada putusan:",
          "",
          jadwal.join("\n")
        ),
      `* **Identitas Kuasa Hukum Pihak:** ${kuasaKalimat}`
    )
  );

  /* ---------------------------------------------------------------- C ---- */
  const saksiSatu = bahan.saksi.filter((s) => s.pihak === "Penggugat/Pemohon");
  const saksiDua = bahan.saksi.filter((s) => s.pihak === "Tergugat/Termohon");
  const basBerkas = bahan.berkas.find((b) => /\bbas\b|berita acara/i.test(b.judul));

  const kalimatSaksi = (daftar: typeof bahan.saksi, sebutan: string) =>
    daftar.length
      ? `keterangan ${daftar.length} (${["nol", "satu", "dua", "tiga", "empat", "lima", "enam"][daftar.length] || daftar.length}) orang saksi ${sebutan} (${daftar
          .map((s) => s.nama)
          .join(" dan ")})`
      : "";

  bagian.push(
    baris(
      "**C. ATURAN KETERANGAN SAKSI & PEMBUKTIAN**\n",
      `* **Alat Bukti ${satu}:** Ekstrak ${[
        pilihan.buktiSurat.trim() ? `bukti surat (${pilihan.buktiSurat.trim()})` : "bukti surat",
        kalimatSaksi(saksiSatu, satu),
      ]
        .filter(Boolean)
        .join(" serta ")}${
        basBerkas
          ? basBerkas.namaBerkasPdf || basBerkas.namaBerkasWord
            ? ` langsung dari file \`${basBerkas.namaBerkasPdf || basBerkas.namaBerkasWord}\``
            : ` langsung dari dokumen "${basBerkas.judul}"`
          : " dari Berita Acara Sidang"
      }.`,
      baris(
        "* **Format Keterangan Saksi:** Format keterangan di dalam putusan wajib menggunakan *bullet points* dengan tanda hubung (-) persis seperti kerangka berikut:",
        "",
        `  * Bahwa saksi kenal dengan ${satu} karena saksi adalah ...;`,
        `  * Bahwa ${satu} menghadap di persidangan ini untuk ...;`,
        "",
        "  *(Lanjutkan ekstraksi persis sesuai tanya jawab di BAS)*"
      ),
      saksiDua.length
        ? `* **Bukti ${dua}:** ${kalimatSaksi(saksiDua, dua)} - masukkan ke dalam pertimbangan.`
        : pilihan.termohonAdaBukti
          ? `* **Bukti ${dua}:** Masukkan ke dalam pertimbangan alat bukti yang diajukan ${dua} sesuai Berita Acara Sidang.`
          : `* **Bukti ${dua}:** Masukkan ke dalam pertimbangan bahwa ${dua} secara tegas menyatakan tidak mengajukan alat bukti apa pun di persidangan.`,
      pilihan.adaBuktiElektronik
        ? "* **Bukti Elektronik:** Terdapat pengajuan bukti elektronik. Susun sub-bab Bukti Elektronik tersendiri sesuai ketentuan."
        : "* **Bukti Elektronik:** Tidak ada pengajuan bukti elektronik (screenshot/USB/dsb) dalam perkara ini, sehingga sub-bab Bukti Elektronik tidak perlu dibuat.",
      pilihan.saksiManual.trim() && `* **Catatan saksi tambahan:** ${pilihan.saksiManual.trim()}`,
      bahan.saksi.length === 0 &&
        "* **Catatan:** SIPP tidak mencatat satu pun saksi pada perkara ini. Ambil keterangan saksi seluruhnya dari Berita Acara Sidang."
    )
  );

  /* ---------------------------------------------------------------- D ---- */
  bagian.push(
    baris(
      "**D. PENGGUNAAN FILE BLANGKO & OUTPUT AKHIR (FULL PUTUSAN)**\n",
      pilihan.mintaAnalisaAwal
        ? "* Setelah menyajikan analisa di tahap awal, buatlah teks draf Putusan Utuh dari awal sampai akhir."
        : "* Buatlah teks draf Putusan Utuh dari awal sampai akhir.",
      pilihan.berkasBlangko.trim() &&
        `* Gunakan file blangko \`${pilihan.berkasBlangko.trim()}\` sebagai kerangka untuk diedit.`,
      pilihan.berkasBlangko.trim() &&
        `* **CATATAN PENTING:** Blangko dapat memuat unsur yang tidak sesuai perkara ini${
          pilihan.adaRekonvensi ? "" : " (misalnya format rekonvensi dari template, padahal perkara ini murni Konvensi)"
        }. Periksa bagian identitas pihak - bila sudah benar, pertahankan - lalu rombak isi pertimbangan serta amar putusannya agar sesuai dengan realita persidangan${
          adaMediasi ? ", kesepakatan hasil mediasi," : ""
        } dan fakta perkara.`,
      "* Putusan utuh ini harus mencakup: Kepala Putusan, Identitas Pihak, Duduk Perkara, Pertimbangan Hukum, Kaki Putusan, hingga rincian Biaya Perkara sesuai format Pengadilan Agama.",
      pilihan.mintaBerkasDoc &&
        `* **OUTPUT DOKUMEN:** Buat dan hasilkan format putusan utuh tersebut secara langsung ke dalam bentuk file dokumen (Google Doc / format .doc)${
          pilihan.berkasBlangko.trim() ? ` agar model persis dengan \`${pilihan.berkasBlangko.trim()}\`` : ""
        } dan bisa langsung saya *download* / unduh.`
    )
  );

  /* ---------------------------------------------------------------- E ---- */
  const lampiran: BerkasLampiran[] = [
    ...daftarBerkas(bahan),
    ...pilihan.lampiranTambahan
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean)
      .map((nama) => ({ nama, penjelas: "", berkasNyata: true })),
    ...(pilihan.berkasBlangko.trim()
      ? [
          {
            nama: pilihan.berkasBlangko.trim(),
            penjelas: "Sebagai Blangko draf identitas pihak",
            berkasNyata: true,
          },
        ]
      : []),
    ...(pilihan.berkasAcuan.trim()
      ? [
          {
            nama: pilihan.berkasAcuan.trim(),
            penjelas: "Sebagai Referensi Susunan/Tata Letak",
            berkasNyata: true,
          },
        ]
      : []),
  ];

  if (lampiran.length) {
    bagian.push(
      baris(
        "**E. DAFTAR LAMPIRAN FILE (Sebagai dasar analisa):**\n",
        lampiran
          .map(
            (b, i) =>
              `${i + 1}. ${b.berkasNyata ? `\`${b.nama}\`` : b.nama}${
                b.penjelas ? ` (${b.penjelas})` : ""
              }`
          )
          .join("\n"),
        // Judul dokumen bukan nama berkas. Dikatakan terus terang supaya yang
        // membaca perintah tidak mencari berkas yang tidak pernah ada.
        lampiran.some((b) => !b.berkasNyata) &&
          "*(Butir yang tidak ditulis dalam tanda petik balik adalah JUDUL dokumen pada arsip e-Court, bukan nama berkasnya - berkasnya belum terunduh, jadi lampirkan sendiri.)*"
      )
    );
  }

  if (pilihan.catatanKhusus.trim()) {
    bagian.push(baris("**CATATAN KHUSUS DARI MAJELIS:**\n", pilihan.catatanKhusus.trim()));
  }

  bagian.push(
    "Berdasarkan seluruh instruksi di atas dan file-file yang terlampir, silakan mulai berikan hasil analisa serta draf putusan selengkapnya beserta tautan unduhan dokumennya."
  );

  return bagian.join("\n\n");
}

/**
 * Isian yang masih kosong padahal menentukan.
 *
 * Dipisah dari penyusunan supaya layar dapat memperingatkan SEBELUM perintah
 * disalin - bukan setelah jawabannya terlanjur salah.
 */
export function isianKurang(bahan: BahanPrompt, pilihan: PilihanPrompt): string[] {
  const kurang: string[] = [];
  if (!pilihan.arahPutusan) kurang.push("Arah putusan belum dipilih.");
  if (!pilihan.hasilMediasi) {
    kurang.push(
      `Hasil mediasi belum dipilih${
        bahan.mediasi.kodeHasil ? ` (SIPP mencatat kode "${bahan.mediasi.kodeHasil}" yang tidak baku)` : ""
      }.`
    );
  }
  if (
    pilihan.hasilMediasi === "berhasil-sebagian" ||
    pilihan.hasilMediasi === "berhasil"
  ) {
    if (!pilihan.isiKesepakatan.trim()) {
      kurang.push("Isi kesepakatan mediasi kosong - SIPP tidak menyimpannya untuk perkara ini, tempelkan sendiri.");
    }
  }
  if (!pilihan.berkasBlangko.trim()) kurang.push("Nama file blangko belum diisi.");
  if (!bahan.sidang.length) kurang.push("SIPP tidak mencatat satu pun jadwal sidang.");
  return kurang;
}
