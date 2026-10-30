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
    if (hurufKosong || hurufTakDikenal || hurufDiNaskah) {
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
    // 5. Sisa blangko di naskah (deteksi-sisa-blangko), dikelompokkan per jenis. Kurung huruf/agama sudah disebut di atas.
    const kelompok = new Map();
    for (const t of Array.isArray(naskah && naskah.temuanSisa) ? naskah.temuanSisa : []) {
      if (!t || !t.jenis) continue;
      const cocok = teks(t.cocok);
      if (POLA_HURUF.test(cocok) || POLA_AGAMA.test(cocok)) continue;
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

  akar.AletaPeriksaCetak = Object.freeze({ kumpulkan, html, adaTitikKomaTengah, POLA_HURUF, POLA_AGAMA, POLA_BIAYA_NOMINAL, POLA_TANGGAL_GANDA, BATAS_ISIAN });
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null);
