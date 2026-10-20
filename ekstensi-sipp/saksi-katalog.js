"use strict";

/**
 * ============================================================================
 * KATALOG SUSUN SAKSI - MESIN (skema saksi-katalog/1)
 * ============================================================================
 *
 * Berkas ini BERDIRI SENDIRI (tanpa DOM, tanpa chrome.*): dimuat sebagai skrip
 * ekstensi (menempel pada globalThis.AletaSaksiKatalog) DAN oleh Node/vitest
 * (module.exports). Isinya hanya fungsi murni:
 *
 *   periksaKatalog      memeriksa satu katalog terhadap skema (aturan SKEMA.md)
 *   kenaliKatalog       katalog yang memakai jenis perkara ini, atau null
 *   cocokKeadaan        syarat aktif x keadaan perkara
 *   pertanyaanAktif     butir yang diajukan menurut keadaan dan pihak saksi
 *   pilihJawaban        satu kalimat jawaban untuk (butir, jenis keterangan, saksi ke-n)
 *   susunSaksi          seluruh tanya-jawab beberapa saksi, dengan jaminan saksi 1 != saksi 2
 *
 * Perkara yang katalognya tidak ada TIDAK PERNAH diperlakukan sebagai cerai:
 * kenaliKatalog menjawab null dan pemanggil menyembunyikan tombolnya.
 *
 * Tidak ada acak: pemilih varian deterministik (nomor perkara + butir + jenis +
 * urutan saksi), jadi memuat ulang menghasilkan keterangan yang sama.
 */
(function (akar, pabrik) {
  const api = pabrik();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (akar) akar.AletaSaksiKatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : null, function () {
  const VERSI_SKEMA = "saksi-katalog/1";
  /** Katalog pihak yang didengar Hakim tetapi BUKAN saksi (dispensasi kawin: anak, calon, orang tua). SKEMA.md bagian 14. */
  const JENIS_KATALOG_KETERANGAN = "keterangan-pihak";
  const JENIS_KETERANGAN = Object.freeze(["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu", "berbeda"]);
  const JENIS_UMUM = Object.freeze(["mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]);
  const TINGKAT = Object.freeze(["inti", "pilihan", "jarang", "tambahan"]);
  const KELOMPOK = Object.freeze(["identitas", "hubungan", "pokok", "akibat", "upaya", "penutup"]);
  const KELOMPOK_TETAP = Object.freeze(["identitas", "hubungan", "penutup"]);
  const BEDA_PADA = Object.freeze(["waktu", "lama", "jumlah", "penyebab", "pelaku", "tempat", "peristiwa"]);
  const SLOT_BAKU = Object.freeze(["pengaju", "lawan", "sumber", "hal", "daftar", "isi", "lama", "sejak", "hubungan", "pihakSaksi", "lawanSaksi", "pelaku", "korban", "pekerjaan", "penghasilan"]);
  /** Variabel ABT "Hbgn. Saksi n dg. Pihak" - menurut pihak dan urutan saksi (abt-variabel.json). */
  const VARIABEL_HUBUNGAN = Object.freeze({
    P: Object.freeze([["1241"], ["1242"], ["6149"], ["8923", "6150"], ["8930"]]),
    T: Object.freeze([["1251"], ["1252"], ["8922"], ["8940"]]),
  });
  const STATUS_HUKUM = Object.freeze(["terverifikasi", "perlu-verifikasi"]);
  const MIN_VARIAN = 4;
  const AMBANG_MIRIP = 0.85;

  /** Kunci keadaan baku yang diturunkan mesin sendiri. */
  const KEADAAN_BAKU = Object.freeze({
    kehadiran: ["verstek", "kontradiktoir", "t-tidak-hadir-setelah-mediasi"],
    pihakSaksi: ["P", "T"],
    jumlahSaksi: ["2", "3", "4", "5"],
    kumulasi: ["hak-asuh", "nafkah-anak", "nafkah-iddah", "mutah", "nafkah-madliyah", "harta-bersama", "itsbat-nikah", "rekonvensi"],
    anak: ["ada", "tidak"],
  });
  const KEADAAN_BAKU_JAMAK = Object.freeze(["kumulasi"]);

  // ──────────────────────────────────────────────────────────────────────
  // Penolong
  // ──────────────────────────────────────────────────────────────────────

  function fnv1a32(teks) {
    let h = 0x811c9dc5;
    const s = String(teks);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function laRaya(x) {
    return x !== null && typeof x === "object" && !Array.isArray(x);
  }

  function daftar(x) {
    return Array.isArray(x) ? x : [];
  }

  function rapikan(teks) {
    return String(teks || "")
      .toLowerCase()
      .replace(/[.,;:!?"'()\-–]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const POLA_PENANDA = /#(\d{4})#/g;
  const POLA_SLOT = /\{([^{}]*)\}/g;

  function penandaDi(teks) {
    const hasil = [];
    for (const m of String(teks).matchAll(POLA_PENANDA)) hasil.push("#" + m[1] + "#");
    for (const m of String(teks).matchAll(POLA_SLOT)) hasil.push("{" + m[1] + "}");
    return hasil.sort();
  }

  /** Penanda yang membawa FAKTA: sebutan pihak (#0046#, #0047#, {pengaju}, {lawan}) tidak dihitung. */
  function penandaFakta(teks) {
    return penandaDi(teks).filter((p) => !["#0046#", "#0047#", "{pengaju}", "{lawan}", "{pihakSaksi}", "{lawanSaksi}", "{pelaku}", "{korban}"].includes(p));
  }

  const JENIS_NEGASI_KETAT = Object.freeze(["tidak-tahu", "sebagian", "de-auditu", "mendengar", "ragu"]);

  function angkaDi(teks) {
    const tanpaPenanda = String(teks).replace(POLA_PENANDA, " ");
    return (tanpaPenanda.match(/\d+/g) || []).sort();
  }

  function jumlahNegasi(teks) {
    return (String(teks).toLowerCase().match(/\b(tidak|bukan|belum|tanpa|tak|tiada|nihil|jangan)\b/g) || []).length;
  }

  function himpunanKata(teks) {
    return new Set(rapikan(String(teks).replace(POLA_PENANDA, " penanda ").replace(POLA_SLOT, " slot ")).split(" ").filter(Boolean));
  }

  function jaccard(a, b) {
    const A = himpunanKata(a);
    const B = himpunanKata(b);
    if (A.size === 0 && B.size === 0) return 1;
    let irisan = 0;
    for (const k of A) if (B.has(k)) irisan += 1;
    return irisan / (A.size + B.size - irisan);
  }

  // Kosakata penanda jenis keterangan (SKEMA.md bagian 7).
  const POLA_RAGU = /\b(ragu|tidak yakin|kurang yakin|lupa|tidak ingat|kurang pasti|kurang jelas|kira-kira|mungkin|rasanya|entah|belum pasti|tidak pasti|tidak begitu jelas|samar|tidak begitu ingat|kurang ingat)\b/i;
  const POLA_PENEGAS = /\b(pasti|memang|sungguh|jelas|yakin)\b/i;
  const POLA_CERITA = /\b(\w*cerita\w*|penuturan|dituturkan|diberi tahu|memberi tahu|diberitahu|memberitahu|dikatakan|katanya|dikabari|dikabarkan|dengar dari|mendengar dari|didengar dari|kabar|menurut)\b/i;
  const POLA_DENGAR = /\b(mendengar\w*|dengar\w*|didengar\w*|terdengar\w*|ucapan\w*|diucapkan|perkataan\w*|berkata|mengatakan)\b/i;
  const POLA_SEBAGIAN = /\b(hanya|sebagian|selebihnya|selain itu|lainnya|sisanya|sebatas|sepanjang|sejauh)\b/i;

  // ──────────────────────────────────────────────────────────────────────
  // Pemeriksa katalog
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Menormalkan "jawaban[jenis]" menjadi larik objek {keadaan, maksud, saksi1, saksi2, bedaPada}.
   * Menerima objek tunggal atau larik.
   */
  function bentukJawaban(nilai) {
    if (Array.isArray(nilai)) return nilai;
    if (laRaya(nilai)) return [nilai];
    return [];
  }

  /**
   * Memeriksa satu katalog.
   * @param {object} kat
   * @param {{namaBerkas?: string, variabelAda?: Set<string>|null}} [opsi]
   * @returns {{ok: boolean, galat: string[], peringatan: string[]}}
   */
  function periksaKatalog(kat, opsi) {
    const o = opsi || {};
    const galat = [];
    const peringatan = [];
    const g = (pesan) => galat.push(pesan);

    if (!laRaya(kat)) return { ok: false, galat: ["katalog bukan objek"], peringatan };
    if (kat.skema !== VERSI_SKEMA) g(`skema harus "${VERSI_SKEMA}"`);
    if (typeof kat.kunci !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kat.kunci)) g("kunci harus kebab-case");
    else if (o.namaBerkas && o.namaBerkas.replace(/\.json$/i, "") !== kat.kunci) g(`kunci "${kat.kunci}" tidak sama dengan nama berkas "${o.namaBerkas}"`);
    if (typeof kat.judul !== "string" || !kat.judul.trim()) g("judul kosong");
    if (!Number.isInteger(kat.versi) || kat.versi < 1) g("versi harus bilangan bulat >= 1");
    if (typeof kat.penulis !== "string" || !kat.penulis.trim()) g("penulis kosong");
    if (kat.tambahanUntuk !== undefined) {
      if (!Array.isArray(kat.tambahanUntuk) || !kat.tambahanUntuk.length || !kat.tambahanUntuk.every((x) => typeof x === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(x))) g("tambahanUntuk harus daftar kunci katalog utama");
      if (kat.urutanAwal !== undefined && (typeof kat.urutanAwal !== "number" || !Number.isFinite(kat.urutanAwal))) g("urutanAwal harus angka");
    }
    if (!laRaya(kat.syarat) || !daftar(kat.syarat.jenisPerkaraId).length) g("syarat.jenisPerkaraId kosong");
    else if (!kat.syarat.jenisPerkaraId.every((x) => /^\d+$/.test(String(x)))) g("syarat.jenisPerkaraId harus angka (string)");
    for (const kunciPola of ["polaNama", "kecualiPolaNama"]) {
      const pola = kat.syarat && kat.syarat[kunciPola];
      if (pola) {
        try {
          new RegExp(pola, "i");
        } catch {
          g(`syarat.${kunciPola} bukan regex sah`);
        }
      }
    }

    // ── seluruh teks yang bisa tampil dilarang memuat "Aleta" ──
    const semuaTeks = [];
    const kumpulkan = (x) => {
      if (typeof x === "string") semuaTeks.push(x);
      else if (Array.isArray(x)) x.forEach(kumpulkan);
      else if (laRaya(x)) Object.values(x).forEach(kumpulkan);
    };
    kumpulkan(kat);
    if (semuaTeks.some((t) => /aleta/i.test(t))) g('katalog memuat kata "Aleta"');
    // rujukan hukum yang belum terverifikasi hanya boleh jadi metadata: tidak boleh tercetak di pertanyaan/jawaban/catatan
    {
      const rujukanBelumPasti = daftar(kat.dasarHukum).filter((d) => laRaya(d) && d.status === "perlu-verifikasi" && typeof d.rujukan === "string").map((d) => d.rujukan);
      const tampil = [];
      for (const q of daftar(kat.pertanyaan)) {
        tampil.push(q && q.teks, ...daftar(q && q.teksVarian));
        for (const j of Object.keys(laRaya(q && q.jawaban) ? q.jawaban : {})) for (const x of bentukJawaban(q.jawaban[j])) tampil.push(...daftar(x.saksi1), ...daftar(x.saksi2));
      }
      for (const j of Object.keys(laRaya(kat.jawabanUmum) ? kat.jawabanUmum : {})) for (const x of bentukJawaban(kat.jawabanUmum[j])) tampil.push(...daftar(x.saksi1), ...daftar(x.saksi2));
      tampil.push(...daftar(kat.catatanPetugas));
      const gabung = tampil.filter((t) => typeof t === "string").join(String.fromCharCode(10)).toLowerCase();
      for (const r of rujukanBelumPasti) if (r.trim() && gabung.includes(r.toLowerCase())) g(`rujukan hukum belum terverifikasi tercetak di teks keluaran: "${r}"`);
    }

    if (kat.tanpaLawan !== undefined && typeof kat.tanpaLawan !== "boolean") g("tanpaLawan harus boolean");

    // ── dasar hukum ──
    const idDasar = new Set();
    daftar(kat.dasarHukum).forEach((d, i) => {
      if (!laRaya(d)) return g(`dasarHukum[${i}] bukan objek`);
      for (const f of ["id", "rujukan", "uraian", "sumber"]) if (typeof d[f] !== "string" || !d[f].trim()) g(`dasarHukum[${i}].${f} kosong`);
      if (!STATUS_HUKUM.includes(d.status)) g(`dasarHukum[${i}].status harus ${STATUS_HUKUM.join("|")}`);
      if (idDasar.has(d.id)) g(`dasarHukum id kembar: ${d.id}`);
      idDasar.add(d.id);
    });

    // ── keadaan ──
    const keadaanDek = laRaya(kat.keadaan) ? kat.keadaan : {};
    const nilaiSah = {};
    for (const [k, v] of Object.entries(KEADAAN_BAKU)) nilaiSah[k] = new Set(v);
    for (const [k, v] of Object.entries(keadaanDek)) {
      if (!laRaya(v)) {
        g(`keadaan.${k} bukan objek`);
        continue;
      }
      if (!["otomatis", "borang"].includes(v.sumber)) g(`keadaan.${k}.sumber harus salah satu nilai sumber keadaan yang dikenal`);
      if (!daftar(v.nilai).length) g(`keadaan.${k}.nilai kosong`);
      if (typeof v.label !== "string" || !v.label.trim()) g(`keadaan.${k}.label kosong`);
      if (v.sumber === "otomatis" && !KEADAAN_BAKU[k]) g(`keadaan.${k}: sumber otomatis hanya untuk kunci baku (${Object.keys(KEADAAN_BAKU).join(", ")})`);
      nilaiSah[k] = new Set(daftar(v.nilai).map(String));
    }
    const periksaSyarat = (syarat, lokasi) => {
      if (syarat === undefined || syarat === null) return;
      if (!laRaya(syarat)) return g(`${lokasi}: keadaan bukan objek`);
      for (const [kunciMentah, nilai] of Object.entries(syarat)) {
        const kunci = kunciMentah.replace(/^bukan:/, "");
        if (!nilaiSah[kunci]) {
          g(`${lokasi}: kunci keadaan "${kunci}" tidak dideklarasikan`);
          continue;
        }
        for (const n of [].concat(nilai)) if (!nilaiSah[kunci].has(String(n))) g(`${lokasi}: nilai "${n}" tidak sah untuk keadaan.${kunci}`);
      }
    };

    // ── pokok pembuktian ──
    const idPokok = new Set();
    const pokokWajib = [];
    daftar(kat.pokokPembuktian).forEach((p, i) => {
      if (!laRaya(p)) return g(`pokokPembuktian[${i}] bukan objek`);
      for (const f of ["id", "judul", "uraian"]) if (typeof p[f] !== "string" || !p[f].trim()) g(`pokokPembuktian[${i}].${f} kosong`);
      if (typeof p.wajib !== "boolean") g(`pokokPembuktian[${i}].wajib harus boolean`);
      if (idPokok.has(p.id)) g(`pokokPembuktian id kembar: ${p.id}`);
      idPokok.add(p.id);
      if (p.wajib) pokokWajib.push(p.id);
      if (p.wajib && !daftar(p.dasarHukum).length) g(`pokok ${p.id}: wajib tetapi dasarHukum kosong`);
      for (const d of daftar(p.dasarHukum)) if (!idDasar.has(d)) g(`pokok ${p.id}: dasarHukum "${d}" tidak ada`);
      periksaSyarat(p.keadaan, `pokok ${p.id}`);
    });
    if (!idPokok.size) g("pokokPembuktian kosong");

    // ── jawabanUmum ──
    const umum = laRaya(kat.jawabanUmum) ? kat.jawabanUmum : {};
    const periksaJawaban = (obj, lokasi, jenis, opsiJawab) => {
      const ja = opsiJawab || {};
      if (!laRaya(obj)) return g(`${lokasi}: bukan objek`);
      if (typeof obj.maksud !== "string" || !obj.maksud.trim()) g(`${lokasi}: maksud kosong`);
      periksaSyarat(obj.keadaan, lokasi);
      if (jenis === "berbeda" && !BEDA_PADA.includes(obj.bedaPada)) g(`${lokasi}: bedaPada harus ${BEDA_PADA.join("|")}`);
      const s1 = daftar(obj.saksi1);
      const s2 = daftar(obj.saksi2);
      if (s1.length < MIN_VARIAN) g(`${lokasi}: saksi1 hanya ${s1.length} varian (min ${MIN_VARIAN})`);
      if (s2.length < MIN_VARIAN) g(`${lokasi}: saksi2 hanya ${s2.length} varian (min ${MIN_VARIAN})`);
      const semua = [...s1, ...s2];
      const lihat = new Map();
      for (const [urutan, kal] of semua.entries()) {
        const tempat = `${lokasi} #${urutan + 1}`;
        if (typeof kal !== "string") {
          g(`${tempat}: bukan teks`);
          continue;
        }
        if (!kal.trim()) g(`${tempat}: kosong`);
        if (kal.length > 400) g(`${tempat}: lebih dari 400 huruf`);
        if (/[\r\n]/.test(kal)) g(`${tempat}: memuat ganti baris`);
        if (kal.includes("<") || kal.includes("${")) g(`${tempat}: memuat < atau \${`);
        if (/ya, /i.test(kal)) g(`${tempat}: memuat "ya, " (dimakan replace_ket_saksi ABT)`);
        if (/sayang/i.test(kal)) g(`${tempat}: memuat "sayang" (menjadi "saksing")`);
        if (/[.;,]\s*$/.test(kal)) g(`${tempat}: berakhir tanda baca`);
        if (/^[A-Z]/.test(kal)) g(`${tempat}: diawali huruf besar (ABT mengecilkan huruf pertama; tulis huruf kecil)`);
        if (/\s{2,}/.test(kal) || kal !== kal.trim()) g(`${tempat}: spasi ganda/tepi`);
        const sisaKurawal = kal.replace(POLA_SLOT, "");
        if (/[{}]/.test(sisaKurawal)) g(`${tempat}: kurung kurawal lepas`);
        for (const m of kal.matchAll(POLA_SLOT)) {
          if (!SLOT_BAKU.includes(m[1])) g(`${tempat}: slot tidak baku {${m[1]}}`);
        }
        if (/\{(hal|daftar|isi|lama|sejak|pekerjaan|penghasilan)\}\s*,/.test(kal)) g(`${tempat}: slot teks bebas langsung sebelum koma (isi slot yang berakhir "ya" dimakan ABT)`);
        if (/#/.test(kal.replace(POLA_PENANDA, ""))) g(`${tempat}: penanda # rusak`);
        const norm = rapikan(kal);
        if (lihat.has(norm)) g(`${tempat}: kembar dengan #${lihat.get(norm) + 1}`);
        else lihat.set(norm, urutan);
        // kosakata menurut jenis
        if (jenis === "ragu") {
          if (!POLA_RAGU.test(kal)) g(`${tempat}: jenis ragu tanpa kata ragu`);
          if (/\d/.test(kal.replace(POLA_PENANDA, ""))) g(`${tempat}: jenis ragu memuat angka`);
          const tanpaNegasiPenegas = kal.replace(/\b(tidak|kurang|belum|bukan)\s+(begitu\s+)?(pasti|jelas|yakin)\b/gi, " ");
          if (POLA_PENEGAS.test(tanpaNegasiPenegas)) g(`${tempat}: jenis ragu memuat penegas`);
        } else if (jenis === "tidak-tahu") {
          if (jumlahNegasi(kal) < 1) g(`${tempat}: jenis tidak-tahu tanpa negasi`);
        } else if (jenis === "de-auditu") {
          if (!POLA_CERITA.test(kal)) g(`${tempat}: jenis de-auditu tanpa kata cerita/diberi tahu`);
        } else if (jenis === "mendengar") {
          if (!POLA_DENGAR.test(kal)) g(`${tempat}: jenis mendengar tanpa kata dengar`);
          if (POLA_CERITA.test(kal)) g(`${tempat}: jenis mendengar memuat kata cerita (itu de-auditu)`);
        } else if (jenis === "sebagian") {
          if (!POLA_SEBAGIAN.test(kal)) g(`${tempat}: jenis sebagian tanpa kata hanya/sebagian/selebihnya`);
        } else if (jenis === "melihat") {
          if (POLA_RAGU.test(kal)) g(`${tempat}: jenis melihat memuat kata ragu`);
          if (/\b(\w*cerita\w*|katanya)\b/i.test(kal)) g(`${tempat}: jenis melihat memuat kata cerita`);
        }
        if (ja.wajibHal && !kal.includes("{hal}")) g(`${tempat}: jawaban umum wajib memuat {hal}`);
      }
      // invarian: satu himpunan penanda, angka, jumlah negasi (kecuali berbeda: per daftar)
      const kelompokInvarian = jenis === "berbeda" ? [s1, s2] : [semua];
      for (const kel of kelompokInvarian) {
        const teksValid = kel.filter((k) => typeof k === "string");
        if (!teksValid.length) continue;
        const dasarPenanda = JSON.stringify(penandaFakta(teksValid[0]));
        const dasarAngka = JSON.stringify(angkaDi(teksValid[0]));
        const dasarNegasi = jumlahNegasi(teksValid[0]);
        teksValid.forEach((k, i) => {
          if (JSON.stringify(penandaFakta(k)) !== dasarPenanda) g(`${lokasi}: himpunan penanda berbeda pada varian ${i + 1} (maksud harus sama)`);
          if (jenis !== "ragu" && JSON.stringify(angkaDi(k)) !== dasarAngka) g(`${lokasi}: himpunan angka berbeda pada varian ${i + 1}`);
          if (jumlahNegasi(k) !== dasarNegasi) {
            const pesanNegasi = `${lokasi}: jumlah kata negasi berbeda pada varian ${i + 1} (kata modal/negasi tidak boleh mengubah makna)`;
            if (JENIS_NEGASI_KETAT.includes(jenis)) g(pesanNegasi);
            else peringatan.push(pesanNegasi);
          }
        });
      }
      // beda kalimat: saksi1 x saksi2 tidak nyaris kembar
      for (const [i, a] of s1.entries()) {
        for (const [j, b] of s2.entries()) {
          if (typeof a !== "string" || typeof b !== "string") continue;
          if (rapikan(a) === rapikan(b)) g(`${lokasi}: saksi1 #${i + 1} sama dengan saksi2 #${j + 1}`);
          else if (jenis !== "berbeda" && jaccard(a, b) > AMBANG_MIRIP) g(`${lokasi}: saksi1 #${i + 1} nyaris kembar saksi2 #${j + 1} (kemiripan kata > ${AMBANG_MIRIP})`);
        }
      }
    };

    for (const jenis of JENIS_UMUM) {
      if (!(jenis in umum)) {
        g(`jawabanUmum.${jenis} tidak ada`);
        continue;
      }
      bentukJawaban(umum[jenis]).forEach((x, i) => periksaJawaban(x, `jawabanUmum.${jenis}[${i}]`, jenis, { wajibHal: true }));
    }
    for (const k of Object.keys(umum)) if (!JENIS_UMUM.includes(k)) g(`jawabanUmum.${k}: jenis tidak dikenal`);

    // ── pertanyaan ──
    const idQ = new Set();
    const urutanQ = new Set();
    const pokokDipakai = new Set();
    const variabelDipakai = new Set();
    daftar(kat.pertanyaan).forEach((q, i) => {
      const lok = `pertanyaan[${i}]${q && q.id ? ` (${q.id})` : ""}`;
      if (!laRaya(q)) return g(`${lok} bukan objek`);
      if (typeof q.id !== "string" || !/^q-[a-z0-9-]+$/.test(q.id)) g(`${lok}: id harus berawalan q- kebab-case`);
      if (idQ.has(q.id)) g(`${lok}: id kembar`);
      idQ.add(q.id);
      if (!idPokok.has(q.pokok)) g(`${lok}: pokok "${q.pokok}" tidak ada`);
      else pokokDipakai.add(q.pokok);
      if (typeof q.urutan !== "number" || !Number.isFinite(q.urutan)) g(`${lok}: urutan harus angka`);
      else if (urutanQ.has(q.urutan)) g(`${lok}: urutan ${q.urutan} kembar`);
      else urutanQ.add(q.urutan);
      if (!TINGKAT.includes(q.tingkat)) g(`${lok}: tingkat harus ${TINGKAT.join("|")}`);
      if (!KELOMPOK.includes(q.kelompok)) g(`${lok}: kelompok harus ${KELOMPOK.join("|")}`);
      const ps = daftar(q.pihakSaksi);
      if (!ps.length || !ps.every((x) => ["P", "T", "*"].includes(x))) g(`${lok}: pihakSaksi harus daftar dari P|T|*`);
      periksaSyarat(q.keadaan, lok);
      if (typeof q.teks !== "string" || !q.teks.trim()) g(`${lok}: teks kosong`);
      else {
        if (q.teks.length > 400) g(`${lok}: teks lebih dari 400 huruf`);
        if (/[\r\n<]/.test(q.teks) || q.teks.includes("${")) g(`${lok}: teks memuat ganti baris/</\${`);
        if (/aleta/i.test(q.teks)) g(`${lok}: teks memuat Aleta`);
      }
      const teksVarian = daftar(q.teksVarian);
      for (const [j, tv] of teksVarian.entries()) {
        if (typeof tv !== "string" || !tv.trim()) g(`${lok}: teksVarian[${j}] kosong`);
        else if (JSON.stringify(penandaDi(tv)) !== JSON.stringify(penandaDi(q.teks || ""))) g(`${lok}: teksVarian[${j}] himpunan penanda berbeda dari teks`);
      }
      if (q.menggantikan !== undefined) {
        if (!Array.isArray(q.menggantikan) || !q.menggantikan.length || !q.menggantikan.every((x) => typeof x === "string" && /^q-[a-z0-9-]+$/.test(x) && x !== q.id)) g(`${lok}: menggantikan harus daftar id butir lain (q-...)`);
      }
      const tb = daftar(q.tidakBerlaku);
      for (const x of tb) if (!JENIS_KETERANGAN.includes(x) || x === "melihat") g(`${lok}: tidakBerlaku memuat "${x}" (sah: ${JENIS_KETERANGAN.filter((y) => y !== "melihat").join(", ")})`);
      const tetap = KELOMPOK_TETAP.includes(q.kelompok);
      const dikecualikan = (j) => tetap || tb.includes(j);
      if (!laRaya(q.jawaban)) return g(`${lok}: jawaban bukan objek`);
      for (const kj of Object.keys(q.jawaban)) if (!JENIS_KETERANGAN.includes(kj)) g(`${lok}: jenis keterangan "${kj}" tidak dikenal`);
      if (!bentukJawaban(q.jawaban.melihat).length) g(`${lok}: jawaban.melihat wajib ada`);
      if (typeof q.hal !== "string" || !q.hal.trim()) {
        const perluHal = JENIS_UMUM.some((j) => !dikecualikan(j) && !bentukJawaban(q.jawaban[j]).length);
        if (perluHal) g(`${lok}: hal wajib karena ada jenis keterangan yang memakai jawabanUmum`);
      }
      for (const j of JENIS_KETERANGAN) {
        const ada = bentukJawaban(q.jawaban[j]);
        if (j === "melihat" || ada.length) {
          ada.forEach((x, n) => periksaJawaban(x, `${lok}.jawaban.${j}[${n}]`, j));
        } else if (!dikecualikan(j)) {
          if (j === "berbeda") g(`${lok}: jawaban.berbeda wajib ditulis khusus atau taruh "berbeda" di tidakBerlaku`);
          // lainnya: dari jawabanUmum, sudah diperiksa di atas
        }
      }
      // penanda # di butir ini
      const teksButir = [q.teks, ...teksVarian];
      for (const j of Object.keys(q.jawaban)) for (const x of bentukJawaban(q.jawaban[j])) teksButir.push(...daftar(x.saksi1), ...daftar(x.saksi2));
      const dipakai = new Set();
      for (const t of teksButir) for (const p of penandaDi(String(t))) if (p.startsWith("#")) dipakai.add(p.slice(1, 5));
      const dekl = new Set(daftar(q.variabelAbt).map(String));
      for (const kode of dipakai) {
        variabelDipakai.add(kode);
        if (!dekl.has(kode)) g(`${lok}: penanda #${kode}# dipakai tetapi tidak ada di variabelAbt`);
      }
      for (const kode of dekl) {
        variabelDipakai.add(kode);
        if (!/^\d{4}$/.test(kode)) g(`${lok}: variabelAbt "${kode}" bukan 4 digit`);
      }
    });
    if (!idQ.size) g("pertanyaan kosong");
    // butir yang digantikan harus ada: pada katalog tambahan berdiri sendiri butir utamanya tidak terlihat, jadi diperiksa
    // hanya pada katalog utuh (tanpa tambahanUntuk) atau hasil gabungan.
    if (!daftar(kat.tambahanUntuk).length || kat.digabungDari) {
      for (const q of daftar(kat.pertanyaan)) {
        if (!laRaya(q)) continue;
        for (const id of daftar(q.menggantikan)) if (!idQ.has(id)) g(`pertanyaan ${q.id}: menggantikan butir "${id}" yang tidak ada`);
      }
    }
    for (const p of pokokWajib) if (!pokokDipakai.has(p)) g(`pokok wajib ${p} tidak punya pertanyaan`);

    if (o.variabelAda) {
      const baru = new Set(daftar(kat.variabelBaru).map(String));
      for (const kode of baru) if (!/^\d{4}$/.test(kode)) g(`variabelBaru "${kode}" bukan 4 digit`);
      for (const kode of variabelDipakai) {
        if (!o.variabelAda.has(kode) && !baru.has(kode)) g(`variabel ABT #${kode}# tidak ada di abt-variabel.json (variabel baru dari paket ABT: daftarkan di "variabelBaru")`);
      }
    }

    // ── cakupan keadaan otomatis (peringatan) ──
    for (const [kunci, dek] of Object.entries(keadaanDek)) {
      if (kunci !== "kehadiran" || !dek || !Array.isArray(dek.nilai)) continue;
      for (const n of dek.nilai) {
        for (const p of pokokWajib) {
          const adaQ = daftar(kat.pertanyaan).some(
            (q) => {
              if (!laRaya(q) || q.pokok !== p) return false;
              // hanya kunci kehadiran yang diuji; kunci lain (alasan, kumulasi, ...) dianggap terpenuhi
              const sy = laRaya(q.keadaan) ? q.keadaan : {};
              const hanyaHadir = {};
              for (const kk of Object.keys(sy)) if (kk === "kehadiran" || kk === "bukan:kehadiran") hanyaHadir[kk] = sy[kk];
              return cocokKeadaan(hanyaHadir, { kehadiran: n });
            }
          );
          if (!adaQ) peringatan.push(`pokok wajib ${p} tidak punya pertanyaan untuk kehadiran=${n}`);
        }
      }
    }

    return { ok: galat.length === 0, galat, peringatan };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Syarat aktif x keadaan perkara.
   * syarat: {kunci: nilai|[nilai], "bukan:kunci": nilai|[nilai]}; DAN antar kunci, ATAU antar nilai.
   * keadaan: {kunci: nilai|[nilai]} (kunci jamak boleh larik).
   */
  function cocokKeadaan(syarat, keadaan) {
    if (!laRaya(syarat)) return true;
    const ada = laRaya(keadaan) ? keadaan : {};
    const nilaiDari = (k) => (ada[k] === undefined || ada[k] === null ? [] : [].concat(ada[k]).map(String));
    for (const [kunciMentah, perlu] of Object.entries(syarat)) {
      const negasi = kunciMentah.startsWith("bukan:");
      const kunci = negasi ? kunciMentah.slice(6) : kunciMentah;
      const punya = nilaiDari(kunci);
      const irisan = [].concat(perlu).map(String).some((n) => punya.includes(n));
      if (negasi ? irisan : !irisan) return false;
    }
    return true;
  }

  /** Kedalaman kekhususan syarat: banyaknya kunci. */
  function kekhususan(syarat) {
    return laRaya(syarat) ? Object.keys(syarat).length : 0;
  }

  /** Keadaan bawaan katalog (nilai bawaan tiap kunci yang dideklarasikan) digabung dengan yang diturunkan. */
  function keadaanBawaan(kat, turunan) {
    const hasil = {};
    const dek = laRaya(kat && kat.keadaan) ? kat.keadaan : {};
    for (const [k, v] of Object.entries(dek)) if (laRaya(v) && v.bawaan !== undefined) hasil[k] = v.bawaan;
    return Object.assign(hasil, laRaya(turunan) ? turunan : {});
  }

  // ──────────────────────────────────────────────────────────────────────
  // Pengenal jenis
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Katalog yang memakai jenis perkara ini. Perkara yang tidak punya katalog -> null
   * (TIDAK ada cadangan "cerai").
   * @param {object[]} katalog
   * @param {{jenisPerkaraId?: string|number, alurPerkaraId?: string|number, nama?: string}} perkara
   */
  function kenaliKatalog(katalog, perkara) {
    const p = perkara || {};
    const id = String(p.jenisPerkaraId === undefined || p.jenisPerkaraId === null ? "" : p.jenisPerkaraId).trim();
    if (!/^\d+$/.test(id)) return null;
    const alur = String(p.alurPerkaraId === undefined || p.alurPerkaraId === null ? "" : p.alurPerkaraId).trim();
    const nama = String(p.nama || "");
    let terbaik = null;
    let skorTerbaik = -1;
    for (const kat of daftar(katalog)) {
      if (!laRaya(kat) || kat.contoh === true || !laRaya(kat.syarat)) continue;
      if (daftar(kat.tambahanUntuk).length) continue; // katalog tambahan hanya menempel pada katalog utamanya
      if (!daftar(kat.syarat.jenisPerkaraId).map(String).includes(id)) continue;
      const alurSah = daftar(kat.syarat.alurPerkaraId).map(String);
      if (alurSah.length && alur && !alurSah.includes(alur)) continue;
      let skor = 1;
      if (alurSah.length && alur) skor += 1;
      if (kat.syarat.polaNama) {
        let cocok = false;
        try {
          cocok = new RegExp(kat.syarat.polaNama, "i").test(nama);
        } catch {
          cocok = false;
        }
        if (!cocok) continue;
        skor += 2;
      }
      if (kat.syarat.kecualiPolaNama) {
        try {
          if (new RegExp(kat.syarat.kecualiPolaNama, "i").test(nama)) continue;
        } catch {
          /* pola rusak diabaikan */
        }
      }
      if (skor > skorTerbaik) {
        terbaik = kat;
        skorTerbaik = skor;
      }
    }
    return terbaik;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Katalog tambahan (kumulasi, dsb.) yang menempel pada katalog utama
  // ──────────────────────────────────────────────────────────────────────

  const salin = (x) => JSON.parse(JSON.stringify(x));

  /**
   * Menggabungkan katalog utama dengan katalog tambahannya (tambahanUntuk memuat kunci utama).
   * Aturan: id yang sudah ada di utama TIDAK ditimpa (utama menang); keadaan digabung (nilai dilebur);
   * urutan butir tambahan digeser `urutanAwal` (bawaan 1000) supaya jatuh sesudah butir utama;
   * butir kelompok penutup selalu terakhir. jawabanUmum dan blangkoBas hanya dari utama.
   */
  function gabungKatalog(utama, tambahanDaftar) {
    const hasil = salin(utama);
    // Katalog keterangan pihak (anak, calon, orang tua) menempel pada katalog utama yang sama TETAPI bukan butir saksi:
    // dipakai tab sendiri lewat kenaliKeterangan/susunKeterangan, jadi tidak boleh melebur ke butir saksi (SKEMA.md 14.6).
    const tambahan = daftar(tambahanDaftar).filter((t) => laRaya(t) && t.jenisKatalog !== JENIS_KATALOG_KETERANGAN && daftar(t.tambahanUntuk).includes(utama.kunci));
    if (!tambahan.length) return hasil;
    hasil.digabungDari = tambahan.map((t) => t.kunci);
    const idDasar = new Set(daftar(hasil.dasarHukum).map((d) => d.id));
    const idPokok = new Set(daftar(hasil.pokokPembuktian).map((p) => p.id));
    const idQ = new Set(daftar(hasil.pertanyaan).map((q) => q.id));
    hasil.keadaan = laRaya(hasil.keadaan) ? hasil.keadaan : {};
    for (const t of tambahan) {
      for (const [kunci, dek] of Object.entries(laRaya(t.keadaan) ? t.keadaan : {})) {
        if (!hasil.keadaan[kunci]) hasil.keadaan[kunci] = salin(dek);
        else if (Array.isArray(hasil.keadaan[kunci].nilai) && Array.isArray(dek.nilai)) {
          for (const n of dek.nilai) if (!hasil.keadaan[kunci].nilai.map(String).includes(String(n))) hasil.keadaan[kunci].nilai.push(n);
          // tulisan nilai baru ikut terbawa; tulisan milik katalog utama tidak ditimpa
          if (laRaya(dek.labelNilai)) hasil.keadaan[kunci].labelNilai = Object.assign({}, dek.labelNilai, laRaya(hasil.keadaan[kunci].labelNilai) ? hasil.keadaan[kunci].labelNilai : {});
        }
      }
      hasil.dasarHukum = daftar(hasil.dasarHukum);
      for (const d of daftar(t.dasarHukum)) {
        if (idDasar.has(d.id)) continue;
        hasil.dasarHukum.push(salin(d));
        idDasar.add(d.id);
      }
      for (const p of daftar(t.pokokPembuktian)) {
        if (idPokok.has(p.id)) continue;
        hasil.pokokPembuktian.push(salin(p));
        idPokok.add(p.id);
      }
      const geser = typeof t.urutanAwal === "number" ? t.urutanAwal : 1000;
      for (const q of daftar(t.pertanyaan)) {
        if (idQ.has(q.id)) continue;
        const baru = salin(q);
        baru.urutan = (typeof q.urutan === "number" ? q.urutan : 0) + geser;
        // butir yang MENGGANTIKAN butir utama (mis. versi Tergugat) duduk tepat di belakang butir yang digantikannya
        const digantikan = daftar(q.menggantikan).map((id) => hasil.pertanyaan.find((x) => x && x.id === id)).find(Boolean);
        if (digantikan && typeof digantikan.urutan === "number") {
          const dipakai = new Set(hasil.pertanyaan.map((x) => x.urutan));
          let calon = digantikan.urutan + 1;
          while (dipakai.has(calon)) calon += 1;
          baru.urutan = calon;
        }
        hasil.pertanyaan.push(baru);
        idQ.add(q.id);
      }
      hasil.variabelBaru = Array.from(new Set([...daftar(hasil.variabelBaru), ...daftar(t.variabelBaru)].map(String)));
      hasil.catatanPetugas = Array.from(new Set([...daftar(hasil.catatanPetugas), ...daftar(t.catatanPetugas)]));
    }
    return hasil;
  }

  /** Katalog utama untuk perkara ini BESERTA tambahannya (sudah digabung), atau null. */
  function kenaliPaket(katalog, perkara) {
    const utama = kenaliKatalog(katalog, perkara);
    return utama ? gabungKatalog(utama, katalog) : null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Pertanyaan aktif dan pemilih jawaban
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Butir yang diajukan untuk saksi dari pihak `pihak` menurut keadaan perkara.
   * Urutan: urutan naik. tingkat "jarang" dan "tambahan" hanya bila `opsi.tingkat` memintanya
   * (tambahan: bila syarat keadaannya cocok).
   */
  function pertanyaanAktif(kat, keadaan, pihak, opsi) {
    const o = opsi || {};
    const tingkatBolehAda = new Set(o.tingkat || ["inti", "pilihan", "tambahan"]);
    const aktif = daftar(kat && kat.pertanyaan)
      .filter((q) => {
        if (!laRaya(q)) return false;
        const ps = daftar(q.pihakSaksi);
        if (pihak && !(ps.includes("*") || ps.includes(pihak))) return false;
        if (!tingkatBolehAda.has(q.tingkat)) return false;
        if (!cocokKeadaan(q.keadaan, keadaan)) return false;
        if (q.pokok) {
          const p = daftar(kat.pokokPembuktian).find((x) => x && x.id === q.pokok);
          if (p && !cocokKeadaan(p.keadaan, keadaan)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const akhirA = a.kelompok === "penutup" ? 1 : 0;
        const akhirB = b.kelompok === "penutup" ? 1 : 0;
        return akhirA - akhirB || a.urutan - b.urutan;
      });
    // Butir yang `menggantikan` butir lain (versi Tergugat atas harta bersama / kewarisan): bila butir pengganti aktif
    // untuk saksi ini, butir yang digantikannya tidak ditanyakan. Tanpa pihak (daftar utuh untuk borang) tidak dipangkas.
    if (!pihak) return aktif;
    const diganti = new Set();
    for (const q of aktif) for (const id of daftar(q.menggantikan)) diganti.add(id);
    return diganti.size ? aktif.filter((q) => !diganti.has(q.id)) : aktif;
  }

  /** Jenis keterangan yang masuk akal untuk butir ini. */
  function jenisKeteranganButir(q) {
    const tetap = KELOMPOK_TETAP.includes(q.kelompok);
    const tb = daftar(q.tidakBerlaku);
    return JENIS_KETERANGAN.filter((j) => j === "melihat" || (!tetap && !tb.includes(j)));
  }

  /** Pilih objek Jawaban yang berlaku menurut keadaan (yang paling spesifik). */
  function pilihObjekJawaban(kat, q, jenis, keadaan) {
    let sumber = bentukJawaban(q.jawaban && q.jawaban[jenis]);
    if (!sumber.length && JENIS_UMUM.includes(jenis)) sumber = bentukJawaban(kat.jawabanUmum && kat.jawabanUmum[jenis]);
    let terbaik = null;
    let skor = -1;
    for (const x of sumber) {
      if (!cocokKeadaan(x.keadaan, keadaan)) continue;
      const k = kekhususan(x.keadaan);
      if (k > skor) {
        terbaik = x;
        skor = k;
      }
    }
    return terbaik;
  }

  /**
   * Satu kalimat jawaban (penanda belum diganti).
   * ke: urutan saksi (1..5). Ganjil memakai saksi1, genap saksi2. `terpakai`: himpunan kalimat
   * (dirapikan) yang sudah dipakai saksi lain pada butir yang sama - tidak akan dipilih lagi.
   * @returns {{teks: string, objek: object}|null}
   */
  function pilihJawaban(kat, q, jenis, keadaan, ke, benih, terpakai) {
    const objek = pilihObjekJawaban(kat, q, jenis, keadaan);
    if (!objek) return null;
    const dipakaiSudah = terpakai instanceof Set ? terpakai : new Set();
    let daftarKalimat;
    if (jenis === "berbeda") daftarKalimat = ke === 1 ? daftar(objek.saksi1) : daftar(objek.saksi2);
    else daftarKalimat = ke % 2 === 1 ? daftar(objek.saksi1) : daftar(objek.saksi2);
    if (!daftarKalimat.length) return null;
    const mulai = fnv1a32([benih, q.id, jenis, ke].join("|")) % daftarKalimat.length;
    const cadangan = ke % 2 === 1 ? daftar(objek.saksi2) : daftar(objek.saksi1);
    for (let i = 0; i < daftarKalimat.length; i += 1) {
      const kal = daftarKalimat[(mulai + i) % daftarKalimat.length];
      if (!dipakaiSudah.has(rapikan(kal))) return { teks: kal, objek };
    }
    // saksi sebanyak itu melampaui daftarnya sendiri: ambil dari daftar lawannya
    for (const kal of cadangan) if (!dipakaiSudah.has(rapikan(kal))) return { teks: kal, objek };
    return { teks: daftarKalimat[mulai], objek };
  }

  /** Rumusan pertanyaan saksi ke-n: teksVarian bila ada (deterministik), selain itu teks. */
  function pilihTeksPertanyaan(q, ke, benih) {
    const alt = [q.teks, ...daftar(q.teksVarian)];
    if (alt.length === 1) return q.teks;
    return alt[fnv1a32([benih, q.id, "tanya", ke].join("|")) % alt.length];
  }

  // ──────────────────────────────────────────────────────────────────────
  // Penanda -> nilai
  // ──────────────────────────────────────────────────────────────────────

  /** Nilai slot yang kosong - penanda #nnnn# di dalam nilai slot SAH (diselesaikan sesudahnya). */
  function slotKosong(nilai) {
    const t = String(nilai === undefined || nilai === null ? "" : nilai).trim();
    return !t || /^[._\s-]+$/.test(t);
  }

  function tidakTerisi(nilai) {
    const s = String(nilai === undefined || nilai === null ? "" : nilai).trim();
    if (!s) return true;
    if (/^DATA_TIDAK_ADA$/i.test(s)) return true;
    if (/^#\d{4}#$/.test(s)) return true;
    if (/^[._\s-]+$/.test(s)) return true;
    return false;
  }

  /**
   * Mengganti {slot} dan #nnnn#. ctx = {
   *   variabel(kode) -> string|undefined,
   *   slot: {pengaju?, lawan?, sumber?, hal?, daftar?, isi?, lama?, sejak?}  (nilai teks siap pakai)
   * }. Yang tidak terisi menjadi "..." dan dicatat di `kosong`.
   */
  function isiPenanda(teks, ctx) {
    const c = ctx || {};
    const slot = c.slot || {};
    const kosong = [];
    // 20 Okt (S7): `mentah` = teks yang sama, tetapi bagian yang belum terisi tetap berupa penanda ⟦{slot}⟧ / ⟦#kode#⟧
    // (bukan "...") dan urutannya sama dengan di teks; dipakai pengisi jawaban dari data. Tidak ikut tersalin (non-enumerable)
    // sehingga pembanding hasil lama tidak berubah.
    const dalam = (tandai) => {
      const variabel = (kode) => {
        const v = typeof c.variabel === "function" ? c.variabel(kode) : undefined;
        return tidakTerisi(v) ? "" : String(v).trim();
      };
      const ganti = (t) =>
        t.replace(/\{([^{}]*)\}/g, (_semua, nama) => {
          let nilai = slot[nama];
          if (nama === "pengaju" && slotKosong(nilai)) nilai = "#0046#";
          if (nama === "lawan" && slotKosong(nilai)) nilai = "#0047#";
          if (slotKosong(nilai)) {
            if (!tandai) kosong.push("{" + nama + "}");
            return tandai ? "⟦{" + nama + "}⟧" : "...";
          }
          return String(nilai);
        });
      // Dua putaran: isi slot (mis. {hal}) boleh memuat slot lain ({pelaku}).
      let hasil = ganti(String(teks));
      if (/\{[^{}]*\}/.test(hasil.replace(/⟦\{[^{}]*\}⟧/g, ""))) hasil = ganti(hasil.replace(/⟦(\{[^{}]*\})⟧/g, "$1"));
      hasil = hasil.replace(/#(\d{4})#/g, (_semua, kode) => {
        const v = variabel(kode);
        if (!v) {
          if (!tandai) kosong.push("#" + kode + "#");
          return tandai ? "⟦#" + kode + "#⟧" : "...";
        }
        return v;
      });
      return hasil;
    };
    const keluar = { teks: dalam(false), kosong };
    Object.defineProperty(keluar, "mentah", { value: dalam(true), enumerable: false });
    return keluar;
  }

  /**
   * Mengamankan teks dari replace_ket_saksi ABT: "ya, " dimakan dan "sayang" menjadi "saksing".
   * Koma sesudah "...ya" dibuang ("anaknya, dan" -> "anaknya dan").
   */
  function amankanKeAbt(teks) {
    return String(teks).replace(/(ya),(\s)/gi, "$1$2").replace(/\s{2,}/g, " ").trim();
  }

  function tanpaKosongGanda(daftarKosong) {
    return Array.from(new Set(daftarKosong));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Penyusun
  // ──────────────────────────────────────────────────────────────────────

  /** Urutan saksi (0-based) di antara saksi sepihaknya. */
  function urutanDiPihak(saksi, indeks) {
    const pihak = saksi[indeks] && saksi[indeks].pihak === "T" ? "T" : "P";
    let n = 0;
    for (let i = 0; i < indeks; i += 1) if ((saksi[i] && saksi[i].pihak === "T" ? "T" : "P") === pihak) n += 1;
    return n;
  }

  /**
   * Menyusun tanya-jawab beberapa saksi dari satu katalog.
   *
   * @param {object} kat
   * @param {{
   *   keadaan?: object,                  // keadaan perkara (tanpa pihakSaksi - ditetapkan per saksi)
   *   benih?: string,                    // mis. nomor perkara
   *   saksi: Array<{ pihak: "P"|"T", jenis?: string, perButir?: Record<string,string>, berbeda?: string[] }>,
   *   variabel?: (kode:string)=>string|undefined,
   *   slot?: object,                     // nilai {slot} bersama
   *   slotSaksi?: Array<object>,         // nilai {slot} per saksi (indeks = ke-1), mis. {sumber, daftar}
   *   tingkat?: string[],
   * }} masukan
   * @returns {{saksi: Array<{ke:number,pihak:string,baris:object[]}>, peringatan: string[]}}
   *
   * Setiap saksi: `keadaan` (opsional) = keadaan khusus saksi itu yang menimpa keadaan perkara; `jenis` = jenis keterangan bawaan (default "melihat"); `perButir[idButir]`
   * menimpa untuk satu butir. Butir yang jenisnya tidak masuk akal (tidakBerlaku) jatuh ke "melihat".
   * Jaminan: pada satu butir, dua saksi tidak pernah mendapat kalimat jawaban yang sama
   * (setelah dirapikan), selama katalog lolos periksaKatalog.
   */
  function susunSaksi(kat, masukan) {
    const m = masukan || {};
    const benih = String(m.benih || "");
    const peringatan = [];
    const keadaanDasar = keadaanBawaan(kat, m.keadaan);
    const saksiMasuk = daftar(m.saksi);
    const jumlah = saksiMasuk.length;
    keadaanDasar.jumlahSaksi = String(Math.min(5, Math.max(2, jumlah || 2)));

    // kalimat jawaban terpakai per butir (lintas saksi)
    const terpakaiPerButir = new Map();
    const hasil = [];
    const ragu = new Map(); // butir -> jumlah saksi ragu/tidak tahu
    const pokokButir = new Map();

    saksiMasuk.forEach((s, indeks) => {
      const ke = indeks + 1;
      const pihak = s.pihak === "T" ? "T" : "P";
      // keadaan khusus saksi ini (mis. peran saksi pada pernikahan di itsbat nikah) menimpa keadaan perkara
      const keadaan = Object.assign({}, keadaanDasar, laRaya(s.keadaan) ? s.keadaan : {}, { pihakSaksi: pihak });
      const butir = pertanyaanAktif(kat, keadaan, pihak, { tingkat: m.tingkat });
      const slotSaksi = Object.assign({}, m.slot || {}, (m.slotSaksi && m.slotSaksi[indeks]) || {});
      if (slotKosong(slotSaksi.sumber)) slotSaksi.sumber = pihak === "T" ? "#0047#" : "#0046#";
      if (slotKosong(slotSaksi.pihakSaksi)) slotSaksi.pihakSaksi = pihak === "T" ? "#0047#" : "#0046#";
      if (slotKosong(slotSaksi.lawanSaksi)) slotSaksi.lawanSaksi = pihak === "T" ? "#0046#" : "#0047#";
      if (slotKosong(slotSaksi.pelaku)) slotSaksi.pelaku = "#0047#";
      if (slotKosong(slotSaksi.korban)) slotSaksi.korban = "#0046#";
      if (tidakTerisi(slotSaksi.hubungan) && typeof m.variabel === "function") {
        const kandidat = (VARIABEL_HUBUNGAN[pihak] || [])[urutanDiPihak(saksiMasuk, indeks)] || [];
        for (const kode of kandidat) {
          const v = m.variabel(kode);
          if (!tidakTerisi(v)) {
            slotSaksi.hubungan = v;
            break;
          }
        }
      }
      const baris = [];
      const ragaman = [];
      butir.forEach((q) => {
        const masuk = jenisKeteranganButir(q);
        let jenis = (s.perButir && s.perButir[q.id]) || s.jenis || "melihat";
        if (!JENIS_KETERANGAN.includes(jenis)) jenis = "melihat";
        if (!masuk.includes(jenis)) jenis = "melihat";
        // saksi "berbeda": hanya pada butir yang dipilih dan bila butir mendukungnya
        if (Array.isArray(s.berbeda) && s.berbeda.includes(q.id) && masuk.includes("berbeda")) jenis = "berbeda";
        const terpakai = terpakaiPerButir.get(q.id + "|" + jenis) || new Set();
        const pilih = pilihJawaban(kat, q, jenis, keadaan, ke, benih, terpakai);
        if (!pilih) {
          peringatan.push(`butir ${q.id} (${jenis}) tidak punya jawaban untuk keadaan ini`);
          return;
        }
        terpakai.add(rapikan(pilih.teks));
        terpakaiPerButir.set(q.id + "|" + jenis, terpakai);

        const slotButir = Object.assign({}, slotSaksi, { hal: q.hal || slotSaksi.hal });
        const tanya = isiPenanda(pilihTeksPertanyaan(q, ke, benih), { variabel: m.variabel, slot: slotButir });
        const jawab = isiPenanda(pilih.teks, { variabel: m.variabel, slot: slotButir });
        jawab.teks = amankanKeAbt(jawab.teks);
        tanya.teks = amankanKeAbt(tanya.teks);
        const kosong = tanpaKosongGanda([...tanya.kosong, ...jawab.kosong]);
        const barisIni = {
          no: baris.length + 1,
          butir: q.id,
          pokok: q.pokok,
          jenis,
          tanya: tanya.teks,
          jawab: jawab.teks,
          kosong,
          tandaKuning: jenis === "ragu" || jenis === "sebagian" || jenis === "berbeda",
        };
        // 20 Okt (S7): jawaban dengan penanda ⟦#kode#⟧/⟦{slot}⟧ di tempat yang belum terisi (non-enumerable)
        Object.defineProperty(barisIni, "jawabKode", { value: jawab.mentah || jawab.teks, enumerable: false });
        baris.push(barisIni);
        if (jenis === "ragu" || jenis === "tidak-tahu") {
          ragu.set(q.id, (ragu.get(q.id) || 0) + 1);
        }
        pokokButir.set(q.id, q.pokok);
        ragaman.push(q.id);
      });
      hasil.push({ ke, pihak, baris });
    });

    // pokok wajib yang SEMUA saksinya ragu/tidak tahu
    const pokokWajib = new Set(daftar(kat.pokokPembuktian).filter((p) => p && p.wajib).map((p) => p.id));
    const perPokok = new Map();
    for (const [idQ, banyak] of ragu.entries()) {
      const p = pokokButir.get(idQ);
      if (!pokokWajib.has(p)) continue;
      const rec = perPokok.get(p) || { butir: 0, semuaRagu: 0 };
      rec.butir += 1;
      if (banyak >= jumlah) rec.semuaRagu += 1;
      perPokok.set(p, rec);
    }
    for (const [p, rec] of perPokok.entries()) {
      if (rec.semuaRagu > 0) {
        const judul = (daftar(kat.pokokPembuktian).find((x) => x.id === p) || {}).judul || p;
        peringatan.push(`Pokok "${judul}": semua saksi ragu atau tidak tahu pada ${rec.semuaRagu} butir - pokok ini belum terbukti oleh keterangan saksi; pertimbangkan saksi tambahan.`);
      }
    }
    return { saksi: hasil, peringatan };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Keterangan pihak (anak, calon, orang tua) - bukan saksi (SKEMA.md bagian 14)
  // ──────────────────────────────────────────────────────────────────────

  /** Pokok yang baru tercetak sesudah petugas mengonfirmasi: kehamilan dan hubungan badan (sensitif; bawaan mati). */
  const POKOK_PERLU_KONFIRMASI = Object.freeze(["pp-kt-sebab"]);
  /** Pokok yang menentukan: ragu atau berselisih di sini pada anak atau calon harus digali lebih lanjut. */
  const POKOK_MENENTUKAN = Object.freeze(["pp-kt-kehendak", "pp-kt-kesiapan", "pp-kt-nasihat"]);
  const PERINGATAN_MENENTUKAN = "Pemberi keterangan ini ragu atau berselisih pada hal yang menentukan; gali lebih lanjut sebelum menetapkan.";
  /** Pilihan sumber cerita orang tua (jenis "berdasarkan cerita orang lain"); bawaan yang pertama. */
  const SUMBER_CERITA = Object.freeze(["anak saya", "keluarga", "tetangga", "guru"]);

  /**
   * Katalog keterangan pihak untuk katalog utama ini (menempel lewat tambahanUntuk), atau null: jenis perkara yang tidak
   * punya katalog keterangan tidak mendapat tab keterangan.
   */
  function kenaliKeterangan(katalogDaftar, utama) {
    const kunci = utama && utama.kunci;
    if (!kunci) return null;
    return daftar(katalogDaftar).find((t) => laRaya(t) && t.contoh !== true && t.jenisKatalog === JENIS_KATALOG_KETERANGAN && daftar(t.tambahanUntuk).includes(kunci)) || null;
  }

  /**
   * Rumusan untuk WALI (bukan orang tua kandung): "anak saya" menjadi "anak yang saya asuh" dan sebutan kandung menjadi wali.
   * Dikenakan pada kalimat yang sudah terisi.
   */
  function rumusWali(teks) {
    return String(teks)
      .replace(/\b(orang tua|ayah|ibu) kandung\b/gi, "wali")
      .replace(/\banak kandung saya\b/gi, (x) => (x[0] === "A" ? "Anak yang saya asuh" : "anak yang saya asuh"))
      .replace(/\banak saya\b/gi, (x) => (x[0] === "A" ? "Anak yang saya asuh" : "anak yang saya asuh"))
      .replace(/\borang tuanya\b/gi, "walinya")
      .replace(/\borang tua\b(?! atau wali)/gi, "wali");
  }

  /** Peran terurut menurut urutan periksa, dengan nomor urut GLOBAL pemberi keterangan pertama peran itu (anak 1, calon 2, ortu anak 3-4, ortu calon 5-6). */
  function peranTerurut(kat) {
    const defs = daftar(kat && kat.peranKeterangan)
      .filter((d) => laRaya(d) && typeof d.kode === "string")
      .slice()
      .sort((a, b) => (a.urutanPeriksa || 0) - (b.urutanPeriksa || 0));
    let n = 0;
    return defs.map((d) => {
      const mulaiKe = n + 1;
      n += d.boleh2 ? 2 : 1;
      return Object.assign({}, d, { mulaiKe });
    });
  }

  /**
   * Menyusun tanya-jawab keterangan anak, calon, dan orang tua dari katalog keterangan pihak.
   *
   * @param {object} kat katalog keterangan pihak (kenaliKeterangan)
   * @param {{
   *   keadaan?: object,                    // jenisKelaminAnak, sebabDK, calonJuga, sekolah, tidakHadir[], sebabTidakHadir, pendampingan[]
   *   benih?: string,
   *   konfirmasiSebab?: boolean,           // butir kehamilan dan hubungan badan baru tercetak bila true (bawaan false)
   *   periksa: Array<{ peran: string, hadir?: boolean, jumlah?: 1|2, jenis?: string, perButir?: object, berbeda?: string[], wali?: boolean, sumber?: string,
   *                    orang?: Array<{ jenis?: string, perButir?: object, berbeda?: string[], wali?: boolean, sumber?: string }> }>,
   *   variabel?: (kode:string)=>string|undefined,
   *   slot?: object,
   *   tingkat?: string[],
   * }} masukan
   * @returns {{pemberi: Array<{ke:number,peran:string,label:string,baris:object[]}>, peringatan: string[], ditahan: string[]}}
   *
   * Aturan: pemberi keterangan diurutkan menurut urutanPeriksa; `ke` = nomor GLOBAL (ganjil memakai saksi1, genap saksi2) sehingga
   * anak dan calon, ayah dan ibu tidak pernah berbunyi sama; jenis "berbeda" memakai versi B (saksi2) pada pemberi yang ditandai.
   */
  function susunKeterangan(kat, masukan) {
    const m = masukan || {};
    const benih = String(m.benih || "");
    const peringatan = [];
    const konfirmasi = m.konfirmasiSebab === true;
    const dasar = keadaanBawaan(kat, m.keadaan);
    const masuk = daftar(m.periksa).filter(laRaya);
    // pihak yang tidak hadir: dari keadaan, ditambah kartu yang ditandai tidak hadir (hanya peran yang memang dapat tidak hadir)
    const nilaiTidakHadir = new Set(daftar(kat && kat.keadaan && kat.keadaan.tidakHadir && kat.keadaan.tidakHadir.nilai).map(String));
    const tidakHadir = new Set([].concat(dasar.tidakHadir === undefined || dasar.tidakHadir === null ? [] : dasar.tidakHadir).map(String));
    for (const e of masuk) if (e.hadir === false && nilaiTidakHadir.has(String(e.peran))) tidakHadir.add(String(e.peran));
    dasar.tidakHadir = Array.from(tidakHadir);

    const terpakaiPerButir = new Map();
    const pemberi = [];
    const ditahan = new Set();
    for (const d of peranTerurut(kat)) {
      const entri = masuk.find((e) => e.peran === d.kode);
      if (!entri || entri.hadir === false || tidakHadir.has(d.kode)) continue;
      const banyak = d.boleh2 ? Math.min(2, Math.max(1, Number(entri.jumlah) || 1)) : 1;
      for (let i = 0; i < banyak; i += 1) {
        const ke = d.mulaiKe + i;
        const orang = laRaya(daftar(entri.orang)[i]) ? entri.orang[i] : {};
        const pilih = (kunci, cadangan) => (orang[kunci] !== undefined ? orang[kunci] : entri[kunci] !== undefined ? entri[kunci] : cadangan);
        const jenisDasar = pilih("jenis", "melihat");
        const perButir = Object.assign({}, entri.perButir, orang.perButir);
        const berbeda = daftar(orang.berbeda !== undefined ? orang.berbeda : entri.berbeda);
        const wali = pilih("wali", false) === true;
        const sumberCerita = String(pilih("sumber", "") || "").trim() || (d.kelas === "ortu" ? SUMBER_CERITA[0] : "keluarga");
        const keadaan = Object.assign({}, dasar, { peran: d.kode, pihakSaksi: "P" });
        const butir = pertanyaanAktif(kat, keadaan, "P", { tingkat: m.tingkat });
        const baris = [];
        let perluGali = false;
        for (const q of butir) {
          if (!konfirmasi && POKOK_PERLU_KONFIRMASI.includes(q.pokok)) {
            ditahan.add(q.id);
            continue;
          }
          const boleh = jenisKeteranganButir(q);
          let jenis = perButir[q.id] || jenisDasar || "melihat";
          if (!JENIS_KETERANGAN.includes(jenis)) jenis = "melihat";
          if (!boleh.includes(jenis)) jenis = "melihat";
          if (berbeda.includes(q.id) && boleh.includes("berbeda")) jenis = "berbeda";
          const terpakai = terpakaiPerButir.get(q.id + "|" + jenis) || new Set();
          // "berbeda": versi B (saksi2) untuk pemberi yang ditandai - aturan ke === 1 pada saksi tidak berlaku di sini (SKEMA 14.4)
          const pilihan = pilihJawaban(kat, q, jenis, keadaan, jenis === "berbeda" ? 2 : ke, benih, terpakai);
          if (!pilihan) {
            peringatan.push(`butir ${q.id} (${jenis}) tidak punya jawaban untuk keadaan ini`);
            continue;
          }
          terpakai.add(rapikan(pilihan.teks));
          terpakaiPerButir.set(q.id + "|" + jenis, terpakai);
          const slotButir = Object.assign({}, m.slot || {}, { hal: q.hal || (m.slot && m.slot.hal), sumber: sumberCerita });
          const tanya = isiPenanda(pilihTeksPertanyaan(q, ke, benih), { variabel: m.variabel, slot: slotButir });
          const jawab = isiPenanda(pilihan.teks, { variabel: m.variabel, slot: slotButir });
          tanya.teks = amankanKeAbt(wali ? rumusWali(tanya.teks) : tanya.teks);
          jawab.teks = amankanKeAbt(wali ? rumusWali(jawab.teks) : jawab.teks);
          const ragu = jenis === "ragu" || jenis === "berbeda";
          if (ragu && d.kelas === "diri" && POKOK_MENENTUKAN.includes(q.pokok)) perluGali = true;
          baris.push({
            no: baris.length + 1,
            butir: q.id,
            pokok: q.pokok,
            jenis,
            tanya: tanya.teks,
            jawab: jawab.teks,
            kosong: tanpaKosongGanda([...tanya.kosong, ...jawab.kosong]),
            tandaKuning: jenis === "ragu" || jenis === "sebagian" || jenis === "berbeda",
          });
        }
        const label = d.label + (banyak === 2 ? (i === 0 ? " (ayah)" : " (ibu)") : "") + (wali ? " - wali" : "");
        if (perluGali) peringatan.push(`${label}: ${PERINGATAN_MENENTUKAN}`);
        pemberi.push({ ke, peran: d.kode, orangKe: i, label, jenis: jenisDasar, wali, baris });
      }
    }
    return { pemberi, peringatan, ditahan: Array.from(ditahan) };
  }

  /** Teks siap tempel ke berita acara: "Pertanyaan ?Jawaban;" satu baris per butir (format blangko Derry). */
  function teksTanyaJawab(baris) {
    return daftar(baris)
      .map((b) => `${String(b.tanya || "").replace(/\s*\?\s*$/, "")} ?${String(b.jawab || "").trim()};`)
      .join("\n");
  }

  // ──────────────────────────────────────────────────────────────────────
  // Penolong tampilan (borang)
  // ──────────────────────────────────────────────────────────────────────

  /** Tulisan jenis keterangan untuk petugas - tanpa label teknis. */
  const LABEL_JENIS_KETERANGAN = Object.freeze({
    melihat: "Melihat sendiri",
    mendengar: "Mendengar sendiri",
    "de-auditu": "Tahu dari cerita orang lain",
    sebagian: "Hanya sebagian yang diketahui",
    "tidak-tahu": "Tidak tahu",
    ragu: "Ragu atau tidak yakin",
    berbeda: "Berbeda dari saksi lain",
  });

  const LABEL_KEADAAN_BAKU = Object.freeze({
    kehadiran: "Kehadiran Tergugat/Termohon",
    pihakSaksi: "Saksi dihadirkan oleh",
    jumlahSaksi: "Jumlah saksi",
    kumulasi: "Gugatan/permohonan yang digabung",
    anak: "Anak",
  });

  const LABEL_NILAI_BAKU = Object.freeze({
    verstek: "Tidak hadir (verstek)",
    kontradiktoir: "Hadir (kontradiktoir)",
    "t-tidak-hadir-setelah-mediasi": "Hadir sampai mediasi lalu tidak hadir",
    "hak-asuh": "Hak asuh anak",
    "nafkah-anak": "Nafkah anak",
    "nafkah-iddah": "Nafkah iddah",
    mutah: "Mut'ah",
    "nafkah-madliyah": "Nafkah lampau (madliyah)",
    "harta-bersama": "Harta bersama",
    "itsbat-nikah": "Itsbat nikah",
    rekonvensi: "Gugatan rekonvensi",
    ada: "Ada anak",
    tidak: "Tidak ada anak",
  });

  /** Kunci keadaan yang diturunkan dari jenis perkara dan TIDAK ditanyakan kepada petugas (mis. suami: cerai gugat = Tergugat, cerai talak = Pemohon). */
  const KEADAAN_TURUNAN = Object.freeze(["suami"]);

  /**
   * Kunci keadaan yang dipakai katalog (dideklarasikan atau disebut di syarat), untuk digambar sebagai isian borang.
   * pihakSaksi dan jumlahSaksi diatur borang sendiri, jadi tidak ikut.
   * @returns {Array<{kunci:string,label:string,nilai:string[],jamak:boolean,bawaan:any,sumber:string}>}
   */
  function keadaanUntukBorang(kat) {
    const hasil = new Map();
    const dek = laRaya(kat && kat.keadaan) ? kat.keadaan : {};
    for (const [kunci, v] of Object.entries(dek)) {
      if (!laRaya(v) || kunci === "pihakSaksi" || kunci === "jumlahSaksi" || KEADAAN_TURUNAN.includes(kunci)) continue;
      hasil.set(kunci, {
        kunci,
        label: String(v.label || LABEL_KEADAAN_BAKU[kunci] || kunci),
        nilai: daftar(v.nilai).map(String),
        jamak: Boolean(v.jamak) || KEADAAN_BAKU_JAMAK.includes(kunci),
        bawaan: v.bawaan,
        sumber: String(v.sumber),
      });
    }
    const sebut = (syarat) => {
      if (!laRaya(syarat)) return;
      for (const kunciMentah of Object.keys(syarat)) {
        const kunci = kunciMentah.replace(/^bukan:/, "");
        if (hasil.has(kunci) || kunci === "pihakSaksi" || kunci === "jumlahSaksi" || !KEADAAN_BAKU[kunci]) continue;
        hasil.set(kunci, {
          kunci,
          label: LABEL_KEADAAN_BAKU[kunci] || kunci,
          nilai: KEADAAN_BAKU[kunci].slice(),
          jamak: KEADAAN_BAKU_JAMAK.includes(kunci),
          bawaan: undefined,
          sumber: "otomatis",
        });
      }
    };
    for (const q of daftar(kat && kat.pertanyaan)) {
      sebut(q.keadaan);
      for (const j of Object.keys(laRaya(q.jawaban) ? q.jawaban : {})) for (const x of bentukJawaban(q.jawaban[j])) sebut(x.keadaan);
    }
    for (const p of daftar(kat && kat.pokokPembuktian)) sebut(p.keadaan);
    return Array.from(hasil.values());
  }

  /** Slot yang diisi petugas di borang (teks bebas). */
  const ISIAN_PETUGAS = Object.freeze(["daftar", "isi", "lama", "sejak", "pekerjaan", "penghasilan"]);

  /** Slot isian petugas yang benar-benar dipakai butir-butir ini. */
  function slotIsianDipakai(butir) {
    const dipakai = new Set();
    const lihat = (t) => {
      for (const m of String(t || "").matchAll(POLA_SLOT)) if (ISIAN_PETUGAS.includes(m[1])) dipakai.add(m[1]);
    };
    for (const q of daftar(butir)) {
      lihat(q.teks);
      for (const j of Object.keys(laRaya(q.jawaban) ? q.jawaban : {})) {
        for (const x of bentukJawaban(q.jawaban[j])) {
          daftar(x.saksi1).forEach(lihat);
          daftar(x.saksi2).forEach(lihat);
        }
      }
    }
    return ISIAN_PETUGAS.filter((k) => dipakai.has(k));
  }

  /** Ringkasan jumlah untuk laporan/uji: pertanyaan dan kombinasi (jawaban x jenis) dan kalimat varian. */
  function ringkasKatalog(kat) {
    let kombinasi = 0;
    let kalimat = 0;
    const perJenis = {};
    for (const q of daftar(kat && kat.pertanyaan)) {
      for (const j of Object.keys(laRaya(q.jawaban) ? q.jawaban : {})) {
        for (const x of bentukJawaban(q.jawaban[j])) {
          kombinasi += 1;
          kalimat += daftar(x.saksi1).length + daftar(x.saksi2).length;
          perJenis[j] = (perJenis[j] || 0) + 1;
        }
      }
    }
    for (const j of Object.keys(laRaya(kat && kat.jawabanUmum) ? kat.jawabanUmum : {})) {
      for (const x of bentukJawaban(kat.jawabanUmum[j])) {
        kombinasi += 1;
        kalimat += daftar(x.saksi1).length + daftar(x.saksi2).length;
      }
    }
    return { pertanyaan: daftar(kat && kat.pertanyaan).length, kombinasi, kalimat, perJenis };
  }

  // ─────────────────────────────────────────────────────────────────
  // Hukum acara satker pada rujukan yang ditampilkan
  // ─────────────────────────────────────────────────────────────────

  /**
   * Hukum acara perdata yang berlaku di satker: "RBg" (di luar Jawa dan Madura; bawaan SEMUA satker sekarang) atau "HIR". Satu-satunya tempat pengaturannya;
   * rencana RBg/HIR per wilayah cukup mengubah nilai ini (atau memberi argumen `hukumAcara` pada rujukanTampil). Data katalog TIDAK diubah: katalog menyimpan
   * pasangan "Pasal 171 ayat (1) dan (2) HIR / Pasal 308 ayat (1) dan (2) RBg" dan hanya tampilannya yang disaring.
   */
  const HUKUM_ACARA_SATKER = "RBg";
  const POLA_HUKUM_ACARA = Object.freeze({ RBg: /\bRBg\b/, HIR: /\bHIR\b/ });

  /**
   * Rujukan hukum untuk tampilan menurut hukum acara satker: segmen berpasangan ("A / B / C") yang hanya menyebut hukum acara LAIN dibuang, sehingga satker RBg
   * melihat "Pasal 308 ayat (1) dan (2) RBg" dan "Pasal 306 RBg / Pasal 1905 KUHPerdata" - tidak pernah "HIR/RBg". Penyebutan kembar dalam satu segmen ("HIR / RBg")
   * disusutkan ke hukum acara satker. Teks yang hanya menyebut hukum acara lain dan tidak punya padanan dikembalikan apa adanya (padanan tidak boleh dikarang).
   * @param {string} teks
   * @param {string} [hukumAcara] "RBg" | "HIR"; bawaan HUKUM_ACARA_SATKER
   */
  function rujukanTampil(teks, hukumAcara) {
    const asli = typeof teks === "string" ? teks : "";
    const pakai = hukumAcara === "HIR" || hukumAcara === "RBg" ? hukumAcara : HUKUM_ACARA_SATKER;
    const lain = pakai === "RBg" ? "HIR" : "RBg";
    if (!POLA_HUKUM_ACARA[lain].test(asli)) return asli;
    const segmen = asli.split(" / ");
    const tinggal = segmen.filter((s) => !(POLA_HUKUM_ACARA[lain].test(s) && !POLA_HUKUM_ACARA[pakai].test(s)));
    const dasar = tinggal.length ? tinggal : segmen;
    return dasar
      .join(" / ")
      .replace(new RegExp(`\\b${lain}\\s*/\\s*${pakai}\\b`, "g"), pakai)
      .replace(new RegExp(`\\b${pakai}\\s*/\\s*${lain}\\b`, "g"), pakai);
  }

  return Object.freeze({
    VERSI_SKEMA,
    HUKUM_ACARA_SATKER,
    rujukanTampil,
    JENIS_KETERANGAN,
    JENIS_UMUM,
    TINGKAT,
    KELOMPOK,
    SLOT_BAKU,
    VARIABEL_HUBUNGAN,
    KEADAAN_BAKU,
    KEADAAN_BAKU_JAMAK,
    MIN_VARIAN,
    fnv1a32,
    rapikan,
    jaccard,
    periksaKatalog,
    cocokKeadaan,
    keadaanBawaan,
    kenaliKatalog,
    kenaliPaket,
    gabungKatalog,
    pertanyaanAktif,
    jenisKeteranganButir,
    pilihObjekJawaban,
    pilihJawaban,
    pilihTeksPertanyaan,
    isiPenanda,
    amankanKeAbt,
    tidakTerisi,
    susunSaksi,
    JENIS_KATALOG_KETERANGAN,
    POKOK_PERLU_KONFIRMASI,
    POKOK_MENENTUKAN,
    PERINGATAN_MENENTUKAN,
    SUMBER_CERITA,
    kenaliKeterangan,
    susunKeterangan,
    peranTerurut,
    rumusWali,
    teksTanyaJawab,
    LABEL_JENIS_KETERANGAN,
    LABEL_KEADAAN_BAKU,
    LABEL_NILAI_BAKU,
    keadaanUntukBorang,
    slotIsianDipakai,
    ringkasKatalog,
    ISIAN_PETUGAS,
    KEADAAN_TURUNAN,
  });
});
