"use strict";

/**
 * ============================================================================
 * PERIKSA SEBELUM CETAK - SATU DAFTAR (Blangko ABT by Derry Briantono, G1 30 Okt 2026)
 * ============================================================================
 *
 * Temuan yang dulu tersebar (di bawah kotak isian, di pengingat sesudah Cetak, di dialog sisa blangko) dikumpulkan menjadi SATU
 * daftar di langkah Cetak. Tiap butir punya tombol "Perbaiki" yang membuka/menggulir dan menyorot isian terkait (atau pratinjau
 * naskah). Daftar ini TIDAK menahan cetak - yang menahan tetap yang lama (isian penting kosong + penanda tersisa lewat pengingat
 * Cetak, dialog sisa blangko). Tanpa temuan, daftar tidak tampil (tidak menambah klik).
 *
 * Aturan TIDAK diulang di sini - semua bahan datang dari pemeriksa yang sudah ada:
 *   - saksi tanpa tanya jawab & verstek padahal SIPP mencatat hadir: blok lama (#bd-saksikosong, #bd-temuanhadir) di dalam daftar;
 *   - huruf alasan kosong / tidak dikenali: peringatan kotak huruf alasan (blangko-derry-isian.js peringatan8503);
 *   - isian penting kosong: kosongRinci (sama dengan pengingat Cetak);
 *   - titik koma di tengah: aturan rapi isian 30 Okt (rapiSimpan = blangko-derry-saksi.js rapiIsian/rapiButir);
 *   - sisa #nnnn# / kurung siku / titik-titik / tulisan merah / catatan perbaikan: deteksi-sisa-blangko.js periksaRtf atas naskah
 *     yang sudah disiapkan (tanpa meminta naskah baru ke ABT).
 * Dua pemeriksaan naskah yang BELUM ada di mana pun ditambahkan di sini (aturan baru, keduanya hanya membaca naskah):
 *   - perkara prodeo tetapi amar/rincian memuat nominal biaya "sejumlah RpN" (N > 0);
 *   - tanggal panggilan tertulis ganda ("tanggal X dan tanggal X") - gejala yang diperbaiki paket ABT prodeo-panggilan-29okt.
 * Bunyi penanda ABT yang dikenali: "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" dan "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]"
 * (paket abt-paket/agama-belum-diubah-30okt), juga bunyi lama "TIDAK BENAR QUERY NYA ...".
 *
 * Murni: tanpa DOM, tanpa jaringan. Teks tampil tanpa nomor variabel.
 */
(function periksaCetakModul(akar) {
  if (!akar || akar.AletaPeriksaCetak) return;

  const teks = (v) => (v === null || v === undefined ? "" : String(v));
  const BATAS_ISIAN = 8;

  /** Bunyi penanda di naskah -> jenis temuan. Bunyi baru dan lama. */
  const POLA_HURUF = /\[HURUF ALASAN PERCERAIAN BELUM DIPILIH\]|TIDAK BENAR QUERY NYA \/ BELUM ISI ALASAN|BELUM ISI ALASAN DI KOLOM ABT/i;
  const POLA_AGAMA = /\[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP\]|ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP/i;
  const POLA_QUERY_LAMA = /TIDAK BENAR QUERY NYA/i;
  /** 31 Okt (keputusan pengguna 9): cabang terakhir 8529 - daftar bukti surat tanpa KTP/surat domisili (paket bukti-8529-31okt). */
  const POLA_BUKTI = /\[BUKTI SURAT KTP\/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI\]/i;
  /**
   * Nominal biaya pada perkara prodeo: "biaya perkara ... sejumlah Rp290.000,00" (bukan Rp0), atau terbilang di belakang DIPA
   * ("... DIPA Pengadilan Agama Donggala Tahun 2026 (dua puluh ribu Nihil)" - bunyi blangko sebelum paket prodeo-panggilan-29okt,
   * terukur pada naskah render 9558 dan 10083).
   */
  const POLA_BIAYA_NOMINAL = /biaya\s+perkara[^.;]{0,160}?sejumlah\s+Rp\.?\s*0*[1-9][\d.]*|DIPA[^.;\n]{0,140}?\((?!\s*nihil\s*\))[^)]{0,120}?\b(?:ribu|ratus|juta)\b[^)]{0,60}\)/i;
  /**
   * "tanggal 26 Oktober 2026 dan (tanggal) 26 Oktober 2026" - tanggal panggilan yang sama tertulis dua kali. Diukur atas banding
   * paket prodeo-panggilan-29okt (1.889 perkara, 3.778 kalimat tanggal P/T): bunyi lama 1.652 kena, bunyi baru 0.
   */
  const POLA_TANGGAL_GANDA = /tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*,?\s+dan\s+(?:tanggal\s+)?\1(?!\d)/i;

  const potong = (t, n) => {
    const s = teks(t).replace(/\s+/g, " ").trim();
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
  };

  /**
   * bahan:
   *   huruf     { ada: boolean (isian huruf alasan ada di blangko), nilai, dikenal: boolean } | null
   *   kosong    [{ kode, nama }] isian PENTING yang kosong (tanpa tanya jawab saksi - itu blok saksi)
   *   titikKoma [{ kode, nama }] isian tersimpan yang memuat titik koma di tengah
   *   naskah    { teks, temuanSisa: [{ jenis, label, cocok }] } | null - hanya bila naskah sudah disiapkan dan masih segar
   *   prodeo    boolean
   *   kodeAda   Set kode isian blangko (memetakan #kode# di naskah ke isiannya)
   *   namaIsian Map kode -> nama isian tampil (opsional; untuk menyebut isian, bukan nomornya)
   *   relaas    { ada, P: [iso], T: [iso] } tanggal relaas SIPP per pihak (opsional; butir 50), sebutanP/sebutanT, jenisNaskah put|bas
   *   bertentangan [{ kode, nama, isi, usulan }] isian pihak vs usulan PASTI keterangan kedua saksi (keputusan 17; peringatan pasif)
   * -> [{ jenis, teks, perbaiki: { aksi: "isian"|"rapikan"|"pratinjau", kode? } | null, judulTombol }]
   */
  function kumpulkan(bahan) {
    const b = bahan || {};
    const hasil = [];
    const kodeAda = b.kodeAda instanceof Set ? b.kodeAda : new Set();
    const naskah = b.naskah && typeof b.naskah === "object" ? b.naskah : null;
    const isiNaskah = teks(naskah && naskah.teks);
    const sudah = new Set();

    // 1. Huruf alasan perceraian (isian blangko, atau bunyi penandanya di naskah).
    const h = b.huruf;
    const hurufKosong = Boolean(h && h.ada && !teks(h.nilai).trim());
    const hurufTakDikenal = Boolean(h && h.ada && teks(h.nilai).trim() && h.dikenal === false);
    // Bunyi lama "TIDAK BENAR QUERY NYA" tanpa keterangan agama = huruf alasan kosong (cabang terakhir 10 variabel alasan).
    const hurufDiNaskah = POLA_HURUF.test(isiNaskah) || POLA_QUERY_LAMA.test(isiNaskah.replace(/(?:TIDAK BENAR QUERY NYA\s*\/\s*)?ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP/gi, ""));
    // Huruf sudah dipilih dan dikenali, tetapi naskah tetap memuat bunyi "belum dipilih": ada pertimbangan yang belum punya bunyi
    // untuk huruf itu, atau bunyi itu sebenarnya cabang lain (terukur 30 Okt malam: 8529 pertimbangan bukti surat berbunyi demikian bila
    // daftar bukti surat tidak memuat KTP/surat domisili - bukan soal huruf). Bukan kotak hurufnya yang salah.
    if (hurufDiNaskah && !hurufKosong && !hurufTakDikenal && h && h.ada) {
      hasil.push({
        jenis: "huruf-cabang",
        teks: `Huruf alasan perceraian "${potong(h.nilai, 30)}" sudah dipilih, tetapi naskah masih memuat "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" - pada ABT yang belum diperbarui biasanya di pertimbangan bukti surat, karena daftar bukti surat belum memuat KTP atau surat domisili. Periksa bagian itu di pratinjau.`,
        perbaiki: { aksi: "pratinjau" },
        judulTombol: "Membuka pratinjau naskah",
      });
      sudah.add("8503");
    } else if (hurufKosong || hurufTakDikenal || hurufDiNaskah) {
      const keIsian = Boolean(h && h.ada);
      hasil.push({
        jenis: "huruf",
        teks: hurufTakDikenal
          ? `Huruf alasan perceraian "${potong(h.nilai, 30)}" tidak dikenali ABT - pertimbangan alasan perceraian tercetak "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]".`
          : "Huruf alasan perceraian belum dipilih - pertimbangan alasan perceraian tercetak \"[HURUF ALASAN PERCERAIAN BELUM DIPILIH]\".",
        perbaiki: keIsian ? { aksi: "isian", kode: "8503" } : { aksi: "pratinjau" },
        judulTombol: keIsian ? "Membuka kotak huruf alasan perceraian" : "Membuka pratinjau naskah di bagian yang belum terisi",
      });
      sudah.add("8503");
    }
    // 2. Alasan H: agama pihak di SIPP belum diubah.
    if (POLA_AGAMA.test(isiNaskah)) {
      hasil.push({
        jenis: "agama",
        teks: "Alasan perceraian huruf H (murtad) dipilih, tetapi agama pihak di SIPP belum diubah - naskah memuat \"[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]\". Ubah agama pihak itu di SIPP, lalu muat ulang.",
        perbaiki: { aksi: "pratinjau" },
        judulTombol: "Membuka pratinjau naskah",
      });
    }
    // 2b. Daftar bukti surat tanpa KTP/surat domisili (bunyi 8529 sesudah paket bukti-8529-31okt).
    if (POLA_BUKTI.test(isiNaskah)) {
      const keBukti = kodeAda.has("1214");
      hasil.push({
        jenis: "bukti",
        teks: "Daftar bukti surat belum memuat KTP atau surat domisili - pertimbangan bukti surat tercetak \"[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]\".",
        perbaiki: keBukti ? { aksi: "isian", kode: "1214" } : { aksi: "pratinjau" },
        judulTombol: keBukti ? "Membuka daftar bukti surat" : "Membuka pratinjau naskah",
      });
    }
    // 2c. Keputusan pengguna 17 (31 Okt): isian yang meninggalkan rumah bertentangan dengan keterangan KEDUA saksi (usulan pasti).
    //     Peringatan PASIF: isian tidak diubah; Perbaiki hanya membuka isiannya.
    for (const x of Array.isArray(b.bertentangan) ? b.bertentangan : []) {
      const beda = pihakBerbeda(x.isi, x.usulan);
      if (!beda || sudah.has(teks(x.kode))) continue;
      sudah.add(teks(x.kode));
      hasil.push({
        jenis: "bertentangan",
        teks:
          beda === "pihak"
            ? `${teks(x.nama)}: isian berbunyi "${potong(x.isi, 40)}", tetapi keterangan kedua saksi menyebut ${potong(x.usulan, 40)}.`
            : `${teks(x.nama)}: isian berbunyi "${potong(x.isi, 40)}" - menurut keterangan kedua saksi sebutan pihaknya ${potong(x.usulan, 40)}.`,
        perbaiki: { aksi: "isian", kode: teks(x.kode) },
        judulTombol: "Membuka isian ini (tidak diubah sendiri)",
      });
    }
    // 3. Prodeo tetapi naskah memuat nominal biaya.
    if (b.prodeo === true && POLA_BIAYA_NOMINAL.test(isiNaskah)) {
      const m = isiNaskah.match(POLA_BIAYA_NOMINAL);
      hasil.push({
        jenis: "prodeo",
        teks: `Perkara prodeo, tetapi naskah memuat nominal biaya ("${potong(m[0], 90)}"). Pada perkara prodeo biaya perkara dibebankan kepada DIPA.`,
        perbaiki: { aksi: "pratinjau" },
        judulTombol: "Membuka pratinjau naskah",
      });
    }
    // 4. Tanggal panggilan tertulis ganda.
    const g = isiNaskah.match(POLA_TANGGAL_GANDA);
    if (g) {
      hasil.push({
        jenis: "tanggal",
        teks: `Tanggal panggilan tertulis dua kali ("tanggal ${g[1]} dan tanggal ${g[1]}") - tanggal panggilan seharusnya sebanyak relaas.`,
        perbaiki: { aksi: "pratinjau" },
        judulTombol: "Membuka pratinjau naskah",
      });
    }
    // 4b. Tanggal panggilan di naskah dibandingkan dengan tanggal relaas di SIPP (butir 50, 30 Okt malam).
    if (!g && b.relaas && b.relaas.ada) {
      for (const t of bandingRelaas(isiNaskah, b.relaas, { sebutanP: b.sebutanP, sebutanT: b.sebutanT, jenisNaskah: b.jenisNaskah })) hasil.push(t);
    }
    // 5. Sisa blangko di naskah (deteksi-sisa-blangko), dikelompokkan per jenis. Kurung huruf/agama sudah disebut di atas.
    const kelompok = new Map();
    for (const t of Array.isArray(naskah && naskah.temuanSisa) ? naskah.temuanSisa : []) {
      if (!t || !t.jenis) continue;
      const cocok = teks(t.cocok);
      if (POLA_HURUF.test(cocok) || POLA_AGAMA.test(cocok) || POLA_BUKTI.test(cocok)) continue;
      const k = kelompok.get(t.jenis) || { label: teks(t.label) || "Sisa blangko", contoh: [], jumlah: 0, kode: "" };
      k.jumlah += 1;
      // Tanda isian "#nnnn#" tidak dikutip (teks tampil tanpa nomor variabel): yang disebut nama isiannya bila ada di blangko.
      const tanpaNomor = cocok.replace(/#\d{3,5}#/g, "").trim();
      if (k.contoh.length < 3 && tanpaNomor && !/^[#\s]*$/.test(tanpaNomor)) k.contoh.push(potong(cocok.replace(/#\d{3,5}#/g, "…"), 40));
      const p = cocok.match(/#(\d{4,5})#/);
      if (p && !k.kode && kodeAda.has(p[1]) && !sudah.has(p[1])) {
        k.kode = p[1];
        const nm = b.namaIsian instanceof Map ? teks(b.namaIsian.get(p[1])) : "";
        if (nm && k.contoh.length < 3) k.contoh.push(nm);
      }
      kelompok.set(t.jenis, k);
    }
    for (const [jenis, k] of kelompok) {
      hasil.push({
        jenis: `sisa-${jenis}`,
        teks: `${k.label} di naskah (${k.jumlah})${k.contoh.length ? `: ${k.contoh.map((c) => `"${c}"`).join(", ")}` : ""}.`,
        perbaiki: k.kode ? { aksi: "isian", kode: k.kode } : { aksi: "pratinjau" },
        judulTombol: k.kode ? "Membuka isian terkait" : "Membuka pratinjau naskah",
      });
    }
    // 6. Titik koma di tengah isian.
    for (const x of Array.isArray(b.titikKoma) ? b.titikKoma : []) {
      if (!x || !x.kode || sudah.has(teks(x.kode))) continue;
      sudah.add(teks(x.kode));
      hasil.push({
        jenis: "titikkoma",
        teks: `${teks(x.nama)}: titik koma di tengah isian (seharusnya koma; titik koma hanya di akhir).`,
        perbaiki: { aksi: "rapikan", kode: teks(x.kode) },
        judulTombol: "Merapikan isian ini (titik koma di tengah menjadi koma) lalu menyimpannya",
      });
    }
    // 7. Isian penting yang masih kosong (sama dengan pengingat Cetak).
    const kos = (Array.isArray(b.kosong) ? b.kosong : []).filter((x) => x && x.kode && !sudah.has(teks(x.kode)));
    for (const x of kos.slice(0, BATAS_ISIAN)) {
      hasil.push({ jenis: "kosong", teks: `${teks(x.nama)} masih kosong (tercetak titik-titik).`, perbaiki: { aksi: "isian", kode: teks(x.kode) }, judulTombol: "Membuka isian ini" });
    }
    if (kos.length > BATAS_ISIAN) {
      const sisa = kos.length - BATAS_ISIAN;
      hasil.push({ jenis: "kosong-lain", teks: `${sisa} isian penting lain masih kosong.`, perbaiki: { aksi: "isian", kode: teks(kos[BATAS_ISIAN].kode) }, judulTombol: "Membuka isian kosong berikutnya" });
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tanggal panggilan vs relaas SIPP (butir 50, jawaban pengguna 30 Okt malam)
  // ──────────────────────────────────────────────────────────────────────────
  const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  const POLA_TGL = /(\d{1,2})\s+(Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|Nopember|November|Desember)\s+(\d{4})/gi;
  const keIso = (d, b, y) => {
    const i = BULAN.indexOf(String(b).toLowerCase().replace("pebruari", "februari").replace("nopember", "november"));
    return i < 0 ? "" : `${y}-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const tampil = (iso) => {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1].replace(/^./, (c) => c.toUpperCase())} ${m[1]}` : iso;
  };
  const daftarTgl = (l) => (l.length < 2 ? l.map(tampil).join("") : `${l.slice(0, -1).map(tampil).join(", ")} dan ${tampil(l[l.length - 1])}`);
  /**
   * Kalimat panggilan di naskah: kalimat yang memuat "relaas"/"surat panggilan"/"dipanggil" beserta tanggal. Tanggal yang dihitung
   * hanya yang berada SESUDAH kata relaas/panggilan pertama di kalimat itu. Pihak = subjek "<pihak> (telah) dipanggil" / "memanggil
   * <pihak>" / "kepada <pihak>"; bila tidak ada, satu-satunya sebutan pihak yang disebut; selain itu kalimat dilewati (ragu).
   * -> [{ pihak: "P"|"T", tanggal: [iso...], kalimat }]
   */
  function kalimatPanggilan(isi, sebutanP, sebutanT) {
    const P = sebutanP || "Penggugat";
    const T = sebutanT || (P === "Pemohon" ? "Termohon" : "Tergugat");
    const hasil = [];
    for (const k of teks(isi).replace(/\s+/g, " ").split(/;\s|\.\s(?=[A-Z])|\n/)) {
      const kata = k.search(/relaas|surat panggilan|dipanggil|panggilan/i);
      if (kata < 0) continue;
      // Hanya tanggal RELAAS: didahului "relaas"/"surat panggilan"/"dipanggil ... pada tanggal" tanpa kata sidang/tunda/hari di
      // antaranya, atau sambungan "dan tanggal"/", tanggal" dari tanggal relaas sebelumnya. Tanggal sidang ("ditunda sampai dengan
      // hari Senin tanggal ... untuk memanggil Tergugat") tidak dihitung - salah tangkap yang terukur pada render 9558 dan 10187.
      const tgl = [];
      let ujungSebelum = -1;
      let relSebelum = false;
      for (const m of k.matchAll(POLA_TGL)) {
        const awal = m.index;
        const depan = k.slice(Math.max(0, awal - 90), awal);
        const kunci = depan.search(/relaas|surat panggilan|dipanggil[^;]{0,60}pada\s+(?:hari\s+\w+\s*,?\s*)?tanggal\s*$/i);
        let rel = kunci >= 0 && !/sidang|ditunda|tunda|dibacakan|putus/i.test(depan.slice(kunci).replace(/^(relaas|surat panggilan)/i, ""));
        if (!rel && relSebelum && ujungSebelum >= 0 && /^\s*(?:,|dan|,\s*dan)\s*(?:tanggal\s*)?$/i.test(k.slice(ujungSebelum, awal))) rel = true;
        ujungSebelum = awal + m[0].length;
        relSebelum = rel;
        const iso = rel ? keIso(m[1], m[2], m[3]) : "";
        if (iso && !tgl.includes(iso)) tgl.push(iso);
      }
      if (!tgl.length) continue;
      const subjek = new RegExp(`(${P}|${T})\\s+(?:telah\\s+|sudah\\s+)?(?:dipanggil|dipanggilkan)|(?:memanggil|kepada)\\s+(${P}|${T})\\b`, "g");
      const pihak = new Set([...k.matchAll(subjek)].map((m) => ((m[1] || m[2]) === P ? "P" : "T")));
      let p = pihak.size === 1 ? [...pihak][0] : "";
      if (!p && !pihak.size) {
        const adaP = new RegExp(`\\b${P}\\b`).test(k);
        const adaT = new RegExp(`\\b${T}\\b`).test(k);
        p = adaP && !adaT ? "P" : adaT && !adaP ? "T" : "";
      }
      if (p) hasil.push({ pihak: p, tanggal: tgl, kalimat: k.slice(0, 200) });
    }
    return hasil;
  }
  /**
   * relaas: { P: [iso], T: [iso] } dari SIPP (aleta_bot/services/relaasPanggilanService.js = aturan 11120/11121).
   * Putusan: tanggal di naskah harus SAMA dengan semua relaas pihak itu (beda tanggal atau jumlah = temuan). BAS: hanya tanggal di naskah
   * yang tidak ada di relaas (BAS sidang tertentu hanya menyebut relaas sidang itu).
   */
  function bandingRelaas(isi, relaas, o) {
    const opsi = o || {};
    const keluar = [];
    const per = { P: new Set(), T: new Set() };
    for (const k of kalimatPanggilan(isi, opsi.sebutanP, opsi.sebutanT)) for (const t of k.tanggal) per[k.pihak].add(t);
    const nama = { P: opsi.sebutanP || "Penggugat", T: opsi.sebutanT || "Tergugat" };
    for (const pihak of ["P", "T"]) {
      const n = [...per[pihak]].sort();
      if (!n.length) continue;
      const r = (Array.isArray(relaas[pihak]) ? relaas[pihak] : []).slice().sort();
      const asing = n.filter((t) => !r.includes(t));
      const kurang = opsi.jenisNaskah === "bas" ? [] : r.filter((t) => !n.includes(t));
      if (!asing.length && !kurang.length) continue;
      keluar.push({
        jenis: "relaas",
        teks: `Tanggal panggilan ${nama[pihak]} di naskah (${daftarTgl(n)}) tidak sama dengan relaas di SIPP (${r.length ? daftarTgl(r) : "belum ada relaas"})${
          asing.length ? `; tidak ada di relaas: ${daftarTgl(asing)}` : ""
        }${kurang.length ? `; belum disebut: ${daftarTgl(kurang)}` : ""}.`,
        perbaiki: { aksi: "pratinjau" },
        judulTombol: "Membuka pratinjau naskah",
      });
    }
    return keluar;
  }

  /**
   * Isian pihak (mis. yang meninggalkan rumah) dibandingkan dengan usulan saksi: "pihak" bila kedudukannya berbeda (pihak pertama
   * Penggugat/Pemohon vs pihak kedua Tergugat/Termohon), "sebutan" bila kedudukannya sama tetapi sebutannya lain, "" bila sama/tak terbaca.
   * Terukur 31 Okt atas data 28 Okt: 318 isian berusulan pasti, 33 beda pihak, 1 beda sebutan (cerai talak berisi "Tergugat").
   */
  function pihakBerbeda(isi, usulan) {
    const sebut = (t) => {
      const m = teks(t).match(/\b(Penggugat|Tergugat|Pemohon|Termohon)\b/i);
      return m ? m[1].toLowerCase() : "";
    };
    const a = sebut(isi);
    const u = sebut(usulan);
    if (!a || !u || a === u) return "";
    const kedudukan = (x) => (x === "penggugat" || x === "pemohon" ? 1 : 2);
    return kedudukan(a) !== kedudukan(u) ? "pihak" : "sebutan";
  }

  /** Titik koma di TENGAH teks (ada huruf/angka sesudahnya); titik koma di akhir boleh. */
  function adaTitikKomaTengah(nilai) {
    return /;(?=[^;]*[\p{L}\p{N}])/u.test(teks(nilai));
  }

  /** HTML daftar temuan (tanpa wadah). esc = pengaman HTML panel. */
  function html(daftar, esc) {
    const e = typeof esc === "function" ? esc : (x) => teks(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    return (Array.isArray(daftar) ? daftar : [])
      .map((t) => {
        const p = t.perbaiki;
        const tombol = p
          ? ` <button type="button" class="bd-btn kecil" data-bd2="perbaiki" data-aksi="${e(p.aksi)}"${p.kode ? ` data-kode="${e(p.kode)}"` : ""} title="${e(t.judulTombol || "Perbaiki")}">Perbaiki</button>`
          : "";
        return `<li class="bd-periksabutir" data-periksa="${e(t.jenis)}"><span>${e(t.teks)}</span>${tombol}</li>`;
      })
      .join("");
  }

  akar.AletaPeriksaCetak = Object.freeze({ kumpulkan, html, adaTitikKomaTengah, bandingRelaas, kalimatPanggilan, pihakBerbeda, POLA_BUKTI, POLA_HURUF, POLA_AGAMA, POLA_BIAYA_NOMINAL, POLA_TANGGAL_GANDA, BATAS_ISIAN });
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null);
