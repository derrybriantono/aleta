"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - ALETA Ai SEBAGAI ALAT BANTU (1 Nov 2026)
 * ============================================================================
 *
 * Keputusan pengguna 77-78: ALETA Ai di panel Blangko Derry sebagai ALAT BANTU. Semua fitur lama berjalan persis seperti sebelumnya
 * saat saklar mati atau saldo habis; tombol AI tidak tampil saat mati.
 *
 *   - SAKLAR di dekat nama akun pada kepala panel. Bawaan MATI, diingat per pengguna (chrome.storage.local, kunci memuat id akun),
 *     bukan per perkara. Saldo pengguna habis (dan tidak sedang gratis) -> saklar mati, abu-abu, tidak dapat diklik, "saldo habis".
 *   - SALDO di pojok kiri bawah: saldo PENGGUNA; diklik berganti saldo SATKER (sisa pagu pemakaian bulan ini), ikon mengikuti
 *     jenisnya (orang / gedung); diklik lagi kembali.
 *   - BILAH fitur bantu (hanya saat saklar menyala). Tiap fitur membuka jendela: bahan dibaca dari panel, PERKIRAAN BIAYA tampil
 *     lebih dulu, baru dijalankan petugas. Hasil = USULAN bertanda; hanya masuk ke isian/tanya jawab atas klik petugas, tidak pernah
 *     menimpa isian yang sudah berisi tanpa persetujuan, dan tidak menyentuh salinan teks para pihak.
 *   - JALUR yang dipakai: rute ALETA Ai portal yang SUDAH ADA (percakapan -> perkiraan -> pesan SSE) dengan sesi ALETA seasal.
 *     Ekstensi tidak memegang kunci API. Penyamaran nama/NIK/alamat dilakukan server sebelum keluar ke layanan AI; pesan tugas
 *     disusun server (lib/aleta-ai/fitur-blangko.ts). Titik sambung proyek: `proyekId` (kunci blangkoDerryAiProyek) ikut terkirim.
 *   - Tanpa kata "Aleta" di hasil yang masuk ke naskah; hasil dibersihkan dari Markdown tebal dan kata itu sebelum ditampilkan.
 *
 * Murni (dapat diuji tanpa DOM): globalThis.AletaBdAi.murni.
 */
(function (akar) {
  if (!akar || akar.AletaBdAiInti || !akar.AletaBdAi) return;

  const API = "/aleta/api/aleta-ai";
  const KUNCI_PROYEK = "blangkoDerryAiProyek";
  const KUNCI_TUR = "blangkoDerryAiTur";
  const ID_TUR = "bd-ai-tur";
  const ID_SAKLAR = "bd-ai-saklar";
  const ID_BILAH = "bd-ai-bilah";
  const ID_SALDO = "bd-ai-saldo";
  const ID_JENDELA = "bd-ai-jendela";
  const UMUR_RINGKAS_MS = 60 * 1000;

  const teks = (v) => (v === null || v === undefined ? "" : String(v));
  const esc = (v) => teks(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

  // ──────────────────────────────────────────────────────────────────────────
  // Daftar fitur (cermin lib/aleta-ai/fitur-blangko.ts: kode, bagian bahan, bagian wajib; diuji sama)
  // ──────────────────────────────────────────────────────────────────────────
  const KELOMPOK = ["Saksi", "BAS", "Isian", "Putusan", "Periksa", "Tanya"];
  /**
   * masukan: kotak ketikan petugas ({label, bantu, wajib}); acuan: kotak putusan acuan; pakai: cara hasil dipakai
   * (saksi | isian | teksisian | salin).
   */
  const FITUR = [
    { kode: "A1", kel: "Saksi", judul: "Susun keterangan saksi untuk keadaan baru", tahap: 1, keluaran: "saksi", pakai: "saksi",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "masukan"], wajib: ["perkara"],
      masukan: { label: "Keadaan yang ingin disusun keterangannya", bantu: "Contoh: saksi melihat sendiri pihak lawan meninggalkan rumah", wajib: true } },
    { kode: "A2", kel: "Saksi", judul: "Pertanyaan susulan untuk saksi", tahap: 2, keluaran: "saksi", pakai: "saksi",
      butuh: ["perkara", "posita", "teksPihak", "saksi", "masukan"], wajib: ["saksi"],
      masukan: { label: "Hal yang ingin digali (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "A4", kel: "Saksi", judul: "Bandingkan keterangan saksi satu dan dua", tahap: 2, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "saksi"], wajib: ["saksi"], masukan: null },
    { kode: "A5", kel: "Saksi", judul: "Dalil yang belum dikuatkan saksi", tahap: 2, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "posita", "teksPihak", "saksi"], wajib: ["posita", "saksi"], masukan: null },
    { kode: "A3", kel: "BAS", judul: "Rapikan catatan kasar menjadi keterangan BAS", tahap: 1, keluaran: "teks", pakai: "teksisian",
      butuh: ["perkara", "masukan"], wajib: ["masukan"],
      masukan: { label: "Catatan kasar", bantu: "Ketik atau ambil dari isian yang sudah berisi catatan.", wajib: true, ambilDariIsian: true } },
    { kode: "E2", kel: "BAS", judul: "Ringkasan bahan musyawarah", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "masukan"], wajib: ["posita"],
      masukan: { label: "Catatan musyawarah (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "B1", kel: "Isian", judul: "Usul isi variabel yang masih kosong", tahap: 1, keluaran: "isian", pakai: "isian",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "kosong"], wajib: ["kosong"], masukan: null },
    { kode: "B2", kel: "Isian", judul: "Rangkum pokok jawaban, replik, duplik, dan kesimpulan", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "teksPihak", "posita"], wajib: ["teksPihak"], masukan: null },
    { kode: "B3", kel: "Isian", judul: "Rincian alasan perceraian yang tidak tertangkap", tahap: 2, keluaran: "teks", pakai: "teksisian",
      butuh: ["perkara", "posita", "teksPihak", "saksi", "isian", "masukan"], wajib: ["posita"],
      masukan: { label: "Catatan tambahan (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "B4", kel: "Isian", judul: "Uraian bukti dari nama berkas", tahap: 2, keluaran: "teks", pakai: "teksisian",
      butuh: ["perkara", "masukan"], wajib: ["masukan"],
      masukan: { label: "Nama berkas bukti (satu baris satu berkas)", bantu: "Contoh: P-1 KTP Penggugat.pdf", wajib: true } },
    { kode: "B5", kel: "Isian", judul: "Isi identitas dari teks KTP", tahap: 2, keluaran: "isian", pakai: "isian",
      butuh: ["perkara", "kosong", "masukan"], wajib: ["masukan", "kosong"],
      masukan: { label: "Teks KTP (salin dari KTP atau hasil baca)", bantu: "Tempel tulisan pada KTP: nama, NIK, tempat lahir, alamat, dan seterusnya.", wajib: true } },
    { kode: "C1", kel: "Putusan", judul: "Draf pertimbangan per dalil", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "masukan"], wajib: ["posita"],
      masukan: { label: "Arah atau catatan majelis (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "C2", kel: "Putusan", judul: "Draf amar dari petitum dan arah putusan", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "posita", "isian", "masukan"], wajib: ["masukan"],
      masukan: { label: "Arah putusan dan catatan", bantu: "Contoh: mengabulkan sebagian; nafkah iddah sesuai kemampuan.", wajib: true } },
    { kode: "C3", kel: "Putusan", judul: "Pertimbangan pembuktian", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "saksi", "isian", "masukan"], wajib: ["saksi"],
      masukan: { label: "Catatan (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "C4", kel: "Putusan", judul: "Pertimbangan rekonvensi", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "masukan"], wajib: ["teksPihak"],
      masukan: { label: "Tuntutan dan nominal (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "C5", kel: "Putusan", judul: "Saran pasal dari naskah terverifikasi", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "posita", "isian", "masukan"], wajib: ["posita"],
      masukan: { label: "Hal yang dicari dasar hukumnya (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "C6", kel: "Putusan", judul: "Penilaian pembuktian lanjutan", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "posita", "teksPihak", "saksi", "temuan", "masukan"], wajib: ["temuan"],
      masukan: { label: "Catatan majelis (boleh dikosongkan)", bantu: "", wajib: false } },
    { kode: "D1", kel: "Periksa", judul: "Periksa konsistensi naskah", tahap: 1, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "sidang", "naskah", "isian"], wajib: ["naskah"], masukan: null },
    { kode: "D2", kel: "Periksa", judul: "Cek pertimbangan, amar, dan petitum", tahap: 2, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "posita", "naskah", "isian"], wajib: ["naskah"], masukan: null },
    { kode: "D3", kel: "Periksa", judul: "Cek bahasa naskah", tahap: 2, keluaran: "temuan", pakai: "salin",
      butuh: ["naskah", "teksPihak"], wajib: ["naskah"], masukan: null },
    { kode: "D4", kel: "Periksa", judul: "Jelaskan sisa merah dan temuan pengingat", tahap: 1, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "temuan", "naskah"], wajib: ["temuan"], masukan: null },
    { kode: "D5", kel: "Periksa", judul: "Banding dengan putusan mirip", tahap: 2, keluaran: "temuan", pakai: "salin",
      butuh: ["perkara", "naskah", "acuan"], wajib: ["naskah", "acuan"], masukan: null,
      acuan: { label: "Putusan acuan (tempel teksnya)", wajib: true } },
    { kode: "E1", kel: "Tanya", judul: "Tanya jawab tentang perkara ini", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "naskah", "masukan"], wajib: ["masukan"],
      masukan: { label: "Pertanyaan Anda", bantu: "", wajib: true } },
    { kode: "E3", kel: "Tanya", judul: "Draf penetapan atau relaas tanpa blangko", tahap: 2, keluaran: "teks", pakai: "salin",
      butuh: ["perkara", "sidang", "isian", "masukan"], wajib: ["masukan"],
      masukan: { label: "Jenis dan keperluan naskah", bantu: "Contoh: penetapan pencabutan perkara karena Penggugat tidak hadir.", wajib: true } },
  ];
  const cariFitur = (kode) => FITUR.find((f) => f.kode === teks(kode).toUpperCase()) || null;

  // ─── Menu proyek (pemicu ALETA_05) disaring menurut konteks perkara ────────
  const POLA_SELALU = /peta perkara|duduk perkara|ringkas|rangkum|bantuan|help/i;
  const POLA_PUTUSAN = /pertimbangan|amar|putusan|debat|diskusi|uji posisi|komparasi|analisa putusan|koreksi|ultra petita|bank paragraf/i;
  const POLA_SAKSI = /saksi|pembuktian|bukti/i;
  const POLA_SIDANG = /sidang|panduan|agenda|persiapan|berita acara|mediasi/i;
  const POLA_HITUNG = /kalkulator|nafkah|iddah|mut'?ah|hadhanah|harta bersama|biaya|panjar/i;
  const POLA_PERKARA_CERAI = /cerai|talak|gugat|harta|hadhanah|nafkah/i;
  /**
   * Konteks: { jenisBlangko: "put"|"bas"|"rel"|"" (blangko yang dipilih), jenisPerkara, agenda (sidang yang dipilih) }.
   * Peta/Duduk Perkara selalu tampil; pertimbangan/amar dst. hanya saat blangko putusan; keterangan saksi/bukti saat blangko putusan atau
   * BAS sidang pembuktian; panduan sidang saat BAS atau belum ada blangko; hitungan hanya untuk perkara cerai/gugat atau putusan.
   * Sisanya tetap ada di `semua`. Mengembalikan { utama, semua } (daftar yang sama urutannya, `utama` subset).
   */
  function saringMenu(daftar, konteks) {
    const k = konteks || {};
    const jenis = teks(k.jenisBlangko);
    const pembuktian = /pembuktian|saksi|bukti/i.test(teks(k.agenda));
    const semua = (Array.isArray(daftar) ? daftar : []).filter((p) => p && teks(p.kode) && teks(p.label));
    const utama = semua.filter((p) => {
      const l = teks(p.label);
      if (POLA_SELALU.test(l)) return true;
      if (POLA_PUTUSAN.test(l)) return jenis === "put";
      if (POLA_SAKSI.test(l)) return jenis === "put" || (jenis === "bas" && pembuktian);
      if (POLA_SIDANG.test(l)) return jenis === "bas" || jenis === "";
      if (POLA_HITUNG.test(l)) return jenis === "put" || POLA_PERKARA_CERAI.test(teks(k.jenisPerkara));
      return false;
    });
    return { utama, semua };
  }
  /** Tombol menu proyek diperlakukan seperti fitur: bahan seluruh perkara, pemicu dikirim terpisah. */
  function fiturDariPemicu(p) {
    return {
      kode: `M-${teks(p.kode)}`,
      pemicu: teks(p.kode),
      kel: "Menu proyek",
      judul: teks(p.label),
      tahap: 2,
      keluaran: "teks",
      pakai: "salin",
      butuh: ["perkara", "sidang", "posita", "teksPihak", "saksi", "isian", "naskah", "masukan"],
      wajib: ["perkara"],
      masukan: { label: "Catatan tambahan (boleh dikosongkan)", bantu: "", wajib: false },
    };
  }

  const NAMA_BAGIAN = {
    perkara: "data perkara", sidang: "riwayat sidang", posita: "posita atau gugatan", teksPihak: "teks jawaban, replik, duplik, atau kesimpulan para pihak",
    saksi: "keterangan saksi", isian: "isian blangko", kosong: "isian yang masih kosong", naskah: "naskah blangko", temuan: "temuan pemeriksa",
    masukan: "masukan Anda", acuan: "putusan acuan",
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Murni
  // ──────────────────────────────────────────────────────────────────────────

  // Logika kunci saklar dimiliki pemuat ringan (blangko-derry-ai.js) supaya tersedia tanpa memuat berkas ini.
  const dompetTersedia = (ringkas) => akar.AletaBdAi.murni.dompetTersedia(ringkas);
  const keadaanSaklar = (ringkas, tersimpan) => akar.AletaBdAi.murni.keadaanSaklar(ringkas, tersimpan);

  // Pojok saldo (tampilan, ikon, penyegaran saat mati) dimiliki pemuat ringan; inti hanya membaca dompet yang dipilih.
  const modeDompet = () => akar.AletaBdAi.mode();
  const aturMode = (m) => akar.AletaBdAi.aturMode(m);

  /** Kata kunci Aleta dan Markdown tebal dibuang dari hasil (aturan keras: tanpa tanda ALETA di naskah). */
  function bersihkan(t) {
    return teks(t)
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/aleta(?:\s+ai\b)?/gi, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +([,.;:])/g, "$1")
      .trim();
  }

  function bacaArray(t) {
    const s = teks(t);
    const a = s.indexOf("[");
    const b = s.lastIndexOf("]");
    if (a < 0 || b <= a) return null;
    try {
      const x = JSON.parse(s.slice(a, b + 1));
      return Array.isArray(x) ? x : null;
    } catch {
      return null;
    }
  }
  /** [{kode, nilai, alasan}] - hanya kode di `diizinkan` (Set atau array). null bila bukan JSON. */
  function uraiIsian(t, diizinkan) {
    const a = bacaArray(t);
    if (!a) return null;
    const boleh = diizinkan ? new Set(Array.from(diizinkan, String)) : null;
    const hasil = [];
    for (const e of a) {
      const o = e && typeof e === "object" ? e : {};
      const kode = teks(o.kode).replace(/\D/g, "");
      const nilai = bersihkan(o.nilai);
      if (!kode || !nilai || (boleh && !boleh.has(kode)) || hasil.some((h) => h.kode === kode)) continue;
      hasil.push({ kode, nilai, alasan: bersihkan(o.alasan) });
    }
    return hasil;
  }
  function uraiSaksi(t) {
    const a = bacaArray(t);
    if (!a) return null;
    return a.map((e) => ({ tanya: bersihkan(e && e.tanya), jawab: bersihkan(e && e.jawab) })).filter((x) => x.tanya || x.jawab);
  }
  function uraiTemuan(t) {
    const a = bacaArray(t);
    if (!a) return null;
    return a.map((e) => ({ judul: bersihkan(e && e.judul), uraian: bersihkan(e && e.uraian), saran: bersihkan(e && e.saran) })).filter((x) => x.judul || x.uraian);
  }

  const POLA_PASAL = /\bPasal\s+\d+[A-Z]?(?:\s+(?:ayat\s*\(\d+\)|huruf\s+[a-z]))*(?:\s+(?:Kompilasi\s+Hukum\s+Islam|KHI|KUH\s*Perdata|BW|HIR|RBg|R\.Bg\.?))?/g;
  const bakukanPasal = (s) => teks(s).toLowerCase().replace(/\s+/g, " ");
  /** Pasal yang tidak ada di bahan diberi penanda verifikasi (hasil AI tidak dianggap sumber hukum). */
  function tandaiRujukan(hasil, bahanTeks) {
    const acuan = bakukanPasal(bahanTeks);
    return teks(hasil).replace(POLA_PASAL, (m, letak, utuh) => {
      const dasar = bakukanPasal(m.match(/^Pasal\s+\d+[A-Z]?/i)[0]);
      if (acuan.includes(dasar)) return m;
      return /^\s*\[\s*PERLU\s+VERIFIKASI/i.test(utuh.slice(letak + m.length)) ? m : `${m} [PERLU VERIFIKASI]`;
    });
  }

  /** Nilai identitas pada teks KTP yang harus ikut disamarkan sebelum dikirim (nama, NIK, alamat, tempat/tanggal lahir). */
  function samaranDariKtp(t) {
    const hasil = [];
    for (const baris of teks(t).split(/\r?\n/)) {
      const m = /^\s*(nama|nik|alamat|tempat\s*\/?\s*(?:tgl|tanggal)?\s*lahir|tempat\s+lahir|tgl\.?\s*lahir)(?:\s*[:=]\s*|\s+)(.+?)\s*$/i.exec(baris);
      if (!m) continue;
      const kunci = m[1].toLowerCase();
      const jenis = kunci === "nama" ? "NAMA" : kunci === "nik" ? "NIK" : kunci === "alamat" ? "ALAMAT" : "LAHIR";
      if (m[2].length >= 3) hasil.push({ jenis, nilai: m[2] });
    }
    return hasil.slice(0, 20);
  }

  const BATAS_GAMBAR_KTP = 6 * 1024 * 1024;
  const API_BACA_KTP = "/aleta/api/aleta-ecourt/saksi-scan";

  /** Medan identitas hasil baca gambar KTP (OCR di server) -> teks berlabel yang dapat dikoreksi petugas. Medan kosong dilewati. */
  function teksDariMedanKtp(m) {
    const x = m && typeof m === "object" ? m : {};
    const baris = [
      ["Nama", x.nama],
      ["NIK", x.nik],
      ["Tempat lahir", x.tempatLahir],
      ["Tanggal lahir", x.tanggalLahir],
      ["Jenis kelamin", x.jenisKelamin === "L" ? "Laki-laki" : x.jenisKelamin === "P" ? "Perempuan" : ""],
      ["Agama", x.agama],
      ["Status perkawinan", x.statusKawin],
      ["Pekerjaan", x.pekerjaan],
      ["Kewarganegaraan", x.kewarganegaraan],
      ["Alamat", x.alamat],
      ["RT/RW", x.rt || x.rw ? `${teks(x.rt)}/${teks(x.rw)}` : ""],
      ["Kelurahan/Desa", x.kelurahan],
      ["Kecamatan", x.kecamatan],
      ["Kabupaten/Kota", x.kabupaten],
      ["Provinsi", x.provinsi],
    ];
    return baris
      .filter(([, v]) => teks(v).trim())
      .map(([k, v]) => `${k} : ${teks(v).trim()}`)
      .join("\n");
  }

  /** Nilai identitas hasil baca KTP yang harus disamarkan sebelum teksnya dikirim ke layanan AI (NIK, nama, alamat, lahir, telepon). */
  function samaranDariMedanKtp(m) {
    const x = m && typeof m === "object" ? m : {};
    const hasil = [];
    const tambah = (jenis, nilai) => {
      const v = teks(nilai).trim();
      if (v.length >= 3) hasil.push({ jenis, nilai: v });
    };
    tambah("NAMA", x.nama);
    tambah("NIK", teks(x.nik).replace(/[ .]/g, ""));
    tambah("ALAMAT", x.alamat);
    tambah("LAHIR", [x.tempatLahir, x.tanggalLahir].filter(Boolean).join(", "));
    tambah("LAHIR", x.tanggalLahir);
    tambah("TELEPON", x.telepon);
    return hasil;
  }

  /** Badan permintaan perkiraan/pesan: hanya bagian yang dibutuhkan fitur, ditambah masukan petugas dan titik sambung proyek. */
  function susunBadan(fitur, bahan, isian, proyekId, dompet) {
    const sumber = { ...(bahan || {}) };
    if (fitur.masukan && teks(isian && isian.masukan).trim()) sumber.masukan = teks(isian.masukan).trim();
    // A1 (1 Nov): draf aturan pertimbangan/amar ikut sebagai MASUKAN PETUGAS fitur C1-C4 (catatan petugas lebih dulu).
    if (fitur.butuh.includes("masukan") && teks(sumber.masukanAturan).trim()) sumber.masukan = [teks(sumber.masukan).trim(), teks(sumber.masukanAturan).trim()].filter(Boolean).join("\n\n");
    if (fitur.acuan && teks(isian && isian.acuan).trim()) sumber.acuan = teks(isian.acuan).trim();
    const ambil = {};
    for (const k of fitur.butuh) if (teks(sumber[k]).trim()) ambil[k] = sumber[k];
    const samarkan = [...((bahan && bahan.samarkan) || []), ...((bahan && bahan.samarkanAturan) || [])];
    if (fitur.kode === "B5") samarkan.push(...samaranDariKtp(sumber.masukan), ...samaranDariMedanKtp(isian && isian.medanKtp));
    ambil.samarkan = samarkan;
    const sambung = { ...(teks(proyekId).trim() ? { proyekId: teks(proyekId).trim() } : {}), ...(dompet === "satker" ? { dompet: "satker" } : {}) };
    if (fitur.pemicu) {
      // Menu proyek: pemicu dikirim terpisah, catatan petugas menjadi teks; data perkara tetap di bahan.
      delete ambil.masukan;
      return { pemicu: fitur.pemicu, teks: teks(isian && isian.masukan).trim(), bahan: ambil, ...sambung };
    }
    return { fitur: fitur.kode, bahan: ambil, ...sambung };
  }

  /** Bagian wajib yang belum ada: kalimat siap tampil, atau "" bila lengkap. */
  function kekuranganBahan(fitur, bahan, isian) {
    const sumber = { ...(bahan || {}) };
    if (teks(isian && isian.masukan).trim()) sumber.masukan = isian.masukan;
    if (teks(isian && isian.acuan).trim()) sumber.acuan = isian.acuan;
    const kurang = fitur.wajib.filter((k) => !teks(sumber[k]).trim());
    if (fitur.kode === "C6" && kurang.includes("temuan")) return "Tabel penilaian pembuktian belum terbaca. Buka Bahan musyawarah majelis > Penilaian pembuktian pada panel ini dulu.";
    if (fitur.masukan && fitur.masukan.wajib && !kurang.includes("masukan") && !teks(sumber.masukan).trim()) kurang.push("masukan");
    return kurang.length ? `Belum ada ${kurang.map((k) => NAMA_BAGIAN[k] || k).join(" dan ")}.` : "";
  }

  /** Memecah teks SSE menjadi peristiwa JSON (blok `data:`); blok rusak dilewati. */
  function uraiBlokSse(blok) {
    const data = teks(blok)
      .split(/\r?\n/)
      .filter((b) => b.startsWith("data:"))
      .map((b) => b.slice(5).replace(/^ /, ""))
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return null;
    try {
      const x = JSON.parse(data);
      return x && typeof x === "object" && "jenis" in x ? x : null;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────────
  const K = {
    akar: null,
    ringkas: null,
    ringkasSaat: 0,
    janjiRingkas: null,
    tersimpan: false,
    idAkun: "",
    mode: "pengguna",
    menu: "",
    jendela: null, // keadaan jendela yang terbuka
    proyekId: "",
    tandaBilah: "", // tanda keadaan yang terakhir digambar bilah: bila sama, bilah tidak dirender ulang
    semuaMenu: false, // menu proyek: tampilkan semua pemicu, bukan hanya yang cocok dengan konteks
    turDilihat: false, // panduan bergambar sudah pernah tampil untuk akun ini
    tur: null, // { langkah } saat panduan terbuka
  };

  const bacaSimpan = (kunci) => akar.AletaBdAi.bacaSimpan(kunci);
  const tulisSimpan = (isi) => akar.AletaBdAi.tulisSimpan(isi);

  const derry = () => akar.aletaBlangkoDerry || null;
  const isianApi = () => akar.aletaBlangkoDerryIsian || null;
  const cari = (selektor, dari) => (dari || K.akar).querySelector(selektor);
  const akunSekarang = () => {
    try {
      const d = derry();
      const a = d && typeof d.akun === "function" ? d.akun() : null;
      return a && a.id ? String(a.id) : "";
    } catch {
      return "";
    }
  };

  // ─── Jaringan ──────────────────────────────────────────────────────────────
  async function ambilJson(alamat, opsi) {
    const r = await akar.fetch(alamat, { credentials: "include", cache: "no-store", ...(opsi || {}) });
    let isi = null;
    try {
      isi = await r.json();
    } catch {
      isi = null;
    }
    if (!r.ok || !isi || isi.ok === false) {
      const g = new Error((isi && isi.error && isi.error.message) || (r.status === 401 ? "Masuk ke ALETA dulu." : "Layanan belum dapat dihubungi."));
      g.status = r.status;
      throw g;
    }
    return isi.data;
  }
  const kirimJson = (alamat, metode, badan) =>
    ambilJson(alamat, { method: metode, headers: { "Content-Type": "application/json" }, body: badan === undefined ? undefined : JSON.stringify(badan) });

  /** Ringkasan ALETA Ai (saldo, fitur yang boleh). Disinggahkan semenit; `paksa` membacanya lagi. */
  function muatRingkas(paksa) {
    if (!paksa && K.ringkas && Date.now() - K.ringkasSaat < UMUR_RINGKAS_MS) return Promise.resolve(K.ringkas);
    if (K.janjiRingkas) return K.janjiRingkas;
    K.janjiRingkas = ambilJson(`${API}/ringkas`)
      .then((d) => {
        K.ringkas = d;
        K.ringkasSaat = Date.now();
        // Ringkasan ringan disimpan supaya kunci saklar dapat digambar saat saklar mati tanpa membaca jaringan.
        void akar.AletaBdAi.sinkron({ ringkas: d });
        return d;
      })
      .catch(() => {
        if (!K.ringkas) K.ringkas = null;
        return K.ringkas;
      })
      .then((d) => {
        K.janjiRingkas = null;
        return d;
      });
    return K.janjiRingkas;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tampilan: saklar, bilah, saldo
  // ──────────────────────────────────────────────────────────────────────────

  /** Bilah dan pojok saldo dibuat SEKALI per panel (dihapus saat saklar mati); isinya dirender hanya bila keadaannya berubah. */
  function buatKomponen(akarEl) {
    const layar = akarEl.querySelector(".bd-layar");
    const atas = akarEl.querySelector(".bd-atas");
    if (layar && atas && !akarEl.querySelector(`#${ID_BILAH}`)) {
      const bilah = akar.document.createElement("div");
      bilah.id = ID_BILAH;
      bilah.className = "bd-ai-bilah";
      bilah.hidden = true;
      bilah.setAttribute("role", "toolbar");
      bilah.setAttribute("aria-label", "Alat bantu ALETA Ai");
      atas.insertAdjacentElement("afterend", bilah);
      bilah.addEventListener("click", saatKlikBilah);
      bilah.addEventListener("change", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-ai-proyek")) {
          K.proyekId = teks(t.value).trim();
          void tulisSimpan({ [KUNCI_PROYEK]: K.proyekId });
          tutupJendela();
          gambarBilah();
        }
      });
    }
  }

  // Pendengar hanya terpasang selama saklar menyala.
  const pendengar = { klik: null, tombol: null, perkara: null, simpan: null };
  function pasangPendengar(akarEl) {
    if (pendengar.klik) return;
    pendengar.klik = (e) => {
      // Lintasan peristiwa dibaca dari sebelum bilah digambar ulang (target-nya sudah terlepas dari bilah saat pendengar ini jalan).
      const jalur = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (K.menu && !jalur.some((x) => x && x.id === ID_BILAH)) {
        K.menu = "";
        gambarBilah();
      }
    };
    pendengar.tombol = (e) => {
      if (e.key === "Escape" && K.menu) {
        K.menu = "";
        gambarBilah();
      }
    };
    pendengar.perkara = () => gambarBilah();
    akarEl.addEventListener("click", pendengar.klik);
    akarEl.addEventListener("keydown", pendengar.tombol);
    if (akar.document) akar.document.addEventListener("aleta-bd-perkara", pendengar.perkara);
    try {
      if (akar.chrome && akar.chrome.storage && akar.chrome.storage.onChanged) {
        pendengar.simpan = (ubah, tempat) => {
          if (tempat === "local" && K.idAkun && ubah[KUNCI_PROYEK]) {
            K.proyekId = teks(ubah[KUNCI_PROYEK].newValue).trim();
            gambarBilah();
          }
        };
        akar.chrome.storage.onChanged.addListener(pendengar.simpan);
      }
    } catch {
      pendengar.simpan = null;
    }
  }
  function lepasPendengar() {
    if (!pendengar.klik) return;
    try {
      if (K.akar) {
        K.akar.removeEventListener("click", pendengar.klik);
        K.akar.removeEventListener("keydown", pendengar.tombol);
      }
      if (akar.document) akar.document.removeEventListener("aleta-bd-perkara", pendengar.perkara);
      if (pendengar.simpan && akar.chrome.storage.onChanged.removeListener) akar.chrome.storage.onChanged.removeListener(pendengar.simpan);
    } catch {
      /* sudah terlepas */
    }
    pendengar.klik = pendengar.tombol = pendengar.perkara = pendengar.simpan = null;
  }

  /**
   * Mengaktifkan alat bantu untuk panel ini (saklar menyala): pilihan tersimpan dibaca, ringkasan dibaca SEKALI (disinggahkan
   * semenit di memori), lalu bilah dan saldo digambar. `o.tersimpan` = true bila dipanggil karena pilihan tersimpan akun.
   */
  async function aktifkan(akarEl, o) {
    if (!akarEl) return;
    K.akar = akarEl;
    const id = teks(o && o.idAkun);
    if (id && id !== K.idAkun) {
      K.idAkun = id;
      K.tersimpan = false;
      const s = await bacaSimpan([KUNCI_PROYEK, `${KUNCI_TUR}:${id}`]);
      K.proyekId = teks(s[KUNCI_PROYEK]).trim();
      K.turDilihat = s[`${KUNCI_TUR}:${id}`] === true;
    }
    K.tersimpan = true;
    buatKomponen(akarEl);
    pasangPendengar(akarEl);
    await muatRingkas(false);
    // Saldo sendiri habis tetapi saldo satker dapat dipakai: langsung memakai saldo satker (dapat dikembalikan lewat klik saldo).
    if (K.ringkas && K.ringkas.gratis !== true && modeDompet() === "pengguna") {
      const d = dompetTersedia(K.ringkas);
      if (!d.pengguna && d.satker) aturMode("satker");
    }
    const kead = keadaanSaklar(K.ringkas, true);
    // Terkunci (saldo habis, peran belum dibuka): saklar dimatikan dan pilihan tersimpan ikut mati.
    if (kead.terkunci) {
      K.tersimpan = false;
      await akar.AletaBdAi.sinkron({ tersimpan: false });
      matikan();
      akar.AletaBdAi.gambarSaklar(kead, K.ringkas);
      return;
    }
    akar.AletaBdAi.gambarSaklar(kead, K.ringkas);
    gambarBilah();
    gambarSaldo();
  }

  /** Saklar baru saja dinyalakan petugas: ringkasan segar dibaca, kunci dinilai, pilihan disimpan, panduan pertama tampil sekali. */
  async function nyalakan(akarEl, o) {
    K.ringkasSaat = 0;
    K.janjiRingkas = null;
    await aktifkan(akarEl, o);
    const kead = keadaanSaklar(K.ringkas, true);
    if (kead.terkunci) return kead;
    await akar.AletaBdAi.sinkron({ tersimpan: true });
    akar.AletaBdAi.gambarSaklar(kead, K.ringkas);
    // Panduan bergambar tampil SEKALI, saat saklar pertama kali dinyalakan akun ini; sesudahnya lewat tanda (?).
    if (!K.turDilihat) {
      K.turDilihat = true;
      await tulisSimpan({ [`${KUNCI_TUR}:${K.idAkun}`]: true });
      mulaiTur();
    }
    return kead;
  }

  /** Saklar mati: semua yang digambar alat bantu dihapus dari halaman dan pendengarnya dilepas (tinggal saklar kecil di kepala panel). */
  function matikan() {
    tutupJendela();
    tutupTur();
    K.menu = "";
    K.tersimpan = false;
    lepasPendengar();
    const akarEl = K.akar;
    if (akarEl) {
      for (const id of [ID_BILAH]) {
        const e = akarEl.querySelector(`#${id}`);
        if (e) e.remove();
      }
    }
    K.tandaBilah = "";
  }

  function gambarSaklar() {
    const kead = K.idAkun ? keadaanSaklar(K.ringkas, K.tersimpan) : null;
    akar.AletaBdAi.gambarSaklar(kead, K.ringkas);
  }

  const nyala = () => Boolean(K.idAkun && keadaanSaklar(K.ringkas, K.tersimpan).aktif);

  function fiturBoleh() {
    const izin = K.ringkas && Array.isArray(K.ringkas.fiturBlangko) ? new Set(K.ringkas.fiturBlangko) : null;
    return FITUR.filter((f) => !izin || izin.has(f.kode));
  }

  /**
   * Dompet yang SEDANG dipilih (klik saldo kiri bawah) dan apakah dapat dipakai sekarang. Saldo satker habis / belum berhak /
   * batas bulanan habis = fitur terkunci selama satker dipilih; saldo sendiri tetap bisa dengan memilihnya kembali.
   */
  function dompetAktif() {
    const r = K.ringkas;
    if (!r) return { mode: modeDompet(), bisa: false, alasan: "" };
    if (r.gratis === true) return { mode: "pengguna", bisa: true, alasan: "" };
    const d = dompetTersedia(r);
    if (modeDompet() === "satker") {
      const s = r.satker || {};
      const alasan = d.satker ? "" : s.boleh !== true ? "Anda belum berhak memakai saldo satker" : Number(s.saldoRp) < (Number(r.minimumRp) > 0 ? Number(r.minimumRp) : 1) ? "Saldo satker habis" : "Batas pemakaian saldo satker Anda bulan ini habis";
      return { mode: "satker", bisa: d.satker, alasan };
    }
    return { mode: "pengguna", bisa: d.pengguna, alasan: d.pengguna ? "" : "Saldo Anda habis" };
  }

  /** Proyek kelolaan Super Admin yang boleh dipakai akun ini (dari ringkasan server). */
  const proyekBoleh = () => (K.ringkas && Array.isArray(K.ringkas.proyekPilihan) ? K.ringkas.proyekPilihan : []);
  /** Proyek yang dipakai: pilihan tersimpan bila masih ada di daftar yang boleh, selain itu proyek bawaan satker (""). */
  function proyekAktif() {
    const id = teks(K.proyekId).trim();
    return id && proyekBoleh().some((p) => p && p.id === id) ? id : "";
  }

  /** Menu proyek untuk konteks perkara/blangko yang sedang dibuka. */
  function menuProyek() {
    const daftar = K.ringkas && Array.isArray(K.ringkas.pemicu) ? K.ringkas.pemicu : [];
    let jenisBlangko = "";
    let jenisPerkara = "";
    let agenda = "";
    try {
      const api = isianApi();
      const ke = api && typeof api.keadaan === "function" ? api.keadaan() : null;
      jenisBlangko = teks(ke && ke.blangko && ke.blangko.jenis);
      const pt = derry() && derry().perkaraTerpilih ? derry().perkaraTerpilih() : null;
      jenisPerkara = teks(pt && pt.perkara && pt.perkara.jenisPerkara);
      agenda = teks(pt && pt.sidangDipilih && (pt.sidangDipilih.agenda || pt.sidangDipilih.ket));
    } catch {
      /* tanpa konteks: hanya menu yang selalu tampil dan menu sidang */
    }
    return saringMenu(daftar, { jenisBlangko, jenisPerkara, agenda });
  }

  function gambarBilah() {
    const bilah = K.akar && cari(`#${ID_BILAH}`);
    if (!bilah) return;
    if (!nyala()) {
      bilah.hidden = true;
      bilah.innerHTML = "";
      K.menu = "";
      K.tandaBilah = "";
      return;
    }
    const ada0 = !!(derry() && derry().perkaraTerpilih && derry().perkaraTerpilih());
    const dom = dompetAktif();
    const ada = ada0 && dom.bisa;
    // Render hanya bila keadaan yang menentukan isinya berubah (peristiwa perkara datang berulang). Menu terbuka ikut tanda karena isinya
    // bergantung pada blangko/agenda yang sedang dipilih.
    const ke = K.menu === "Menu proyek" ? menuProyek() : null;
    const tanda = JSON.stringify([ada0, dom.mode, dom.bisa, dom.alasan, K.menu, K.semuaMenu, proyekAktif(), proyekBoleh().map((p) => p.id), fiturBoleh().length, K.ringkas && K.ringkas.pemicu ? K.ringkas.pemicu.length : 0, ke ? ke.utama.map((p) => p.kode) : 0]);
    if (tanda === K.tandaBilah && !bilah.hidden) return;
    K.tandaBilah = tanda;
    const alasanMati = !ada0 ? "Pilih perkara dulu." : `${dom.alasan}${dom.mode === "satker" ? "; klik saldo di kiri bawah untuk memakai saldo Anda." : "."}`;
    const boleh = fiturBoleh();
    const grup = KELOMPOK.map((nama) => ({ nama, isi: boleh.filter((f) => f.kel === nama) })).filter((g) => g.isi.length);
    const adaMenuProyek = Boolean(K.ringkas && Array.isArray(K.ringkas.pemicu) && K.ringkas.pemicu.length);
    const htmlMenuProyek = () => {
      const menu = ke || menuProyek();
      const daftar = K.semuaMenu ? menu.semua : menu.utama;
      const butir = daftar.map((p) => `<button type="button" role="menuitem" class="bd-ai-butir" data-ai-menu="${esc(p.kode)}">${esc(p.label)}</button>`).join("");
      const banyak = menu.semua.length > menu.utama.length;
      return (
        `<span class="bd-ai-menu" role="menu">${butir || `<span class="bd-catat">Belum ada menu yang cocok dengan perkara ini.</span>`}` +
        (banyak ? `<button type="button" class="bd-ai-butir bd-ai-semua" data-ai-semua="1">${K.semuaMenu ? "Hanya yang cocok dengan perkara ini" : "Semua menu…"}</button>` : "") +
        `</span>`
      );
    };
    bilah.innerHTML =
      `<span class="bd-ai-judul">ALETA Ai</span>` +
      (proyekBoleh().length
        ? `<label class="bd-ai-proyek">Proyek <select data-ai-proyek="1" aria-label="Proyek ALETA Ai"><option value="">Proyek bawaan satker</option>${proyekBoleh()
            .map((p) => `<option value="${esc(p.id)}"${p.id === proyekAktif() ? " selected" : ""} title="${esc(p.deskripsi || "")}">${esc(p.nama)}</option>`)
            .join("")}</select></label>`
        : "") +
      `<button type="button" class="bd-btn kecil bd-ai-bantu" data-ai-tur="1" aria-label="Panduan ALETA Ai" title="Panduan bergambar langkah demi langkah">?</button>` +
      grup
        .map(
          (g) =>
            `<span class="bd-ai-grup"><button type="button" class="bd-btn kecil bd-ai-tmb" data-ai-grup="${esc(g.nama)}" aria-expanded="${K.menu === g.nama}" aria-haspopup="menu"${ada ? "" : ` disabled title="${esc(alasanMati)}"`}>${esc(g.nama)} ▾</button>` +
            (K.menu === g.nama
              ? `<span class="bd-ai-menu" role="menu">${g.isi.map((f) => `<button type="button" role="menuitem" class="bd-ai-butir" data-ai-fitur="${esc(f.kode)}">${esc(f.judul)}</button>`).join("")}</span>`
              : "") +
            `</span>`
        )
        .join("") +
      (adaMenuProyek
        ? `<span class="bd-ai-grup"><button type="button" class="bd-btn kecil bd-ai-tmb" data-ai-grup="Menu proyek" aria-expanded="${K.menu === "Menu proyek"}" aria-haspopup="menu"${ada ? "" : ` disabled title="${esc(alasanMati)}"`}>Menu proyek ▾</button>${K.menu === "Menu proyek" ? htmlMenuProyek() : ""}</span>`
        : "") +
      `<span class="bd-ai-pesan">${ada0 && !dom.bisa ? esc(`${dom.alasan}. ${dom.mode === "satker" ? "Klik saldo di kiri bawah untuk memakai saldo Anda." : ""}`.trim()) : "Hasil berupa usulan; Anda yang memutuskan."}</span>`;
    bilah.hidden = false;
  }

  function saatKlikBilah(e) {
    const t = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!t) return;
    const grup = t.getAttribute("data-ai-grup");
    if (grup) {
      K.menu = K.menu === grup ? "" : grup;
      gambarBilah();
      return;
    }
    if (t.getAttribute("data-ai-tur")) {
      K.menu = "";
      gambarBilah();
      mulaiTur();
      return;
    }
    if (t.getAttribute("data-ai-semua")) {
      K.semuaMenu = !K.semuaMenu;
      gambarBilah();
      return;
    }
    const kodeMenu = t.getAttribute("data-ai-menu");
    if (kodeMenu) {
      const p = menuProyek().semua.find((x) => x.kode === kodeMenu);
      K.menu = "";
      gambarBilah();
      if (p) void bukaFitur(fiturDariPemicu(p));
      return;
    }
    const kode = t.getAttribute("data-ai-fitur");
    if (kode) {
      K.menu = "";
      gambarBilah();
      void bukaFitur(kode);
    }
  }

  const gambarSaldo = () => akar.AletaBdAi.gambarSaldo();

  // ──────────────────────────────────────────────────────────────────────────
  // Jendela fitur
  // ──────────────────────────────────────────────────────────────────────────
  function tutupJendela() {
    const j = K.jendela;
    if (j && j.batal) {
      try {
        j.batal.abort();
      } catch {
        /* sudah selesai */
      }
    }
    K.jendela = null;
    const el = K.akar && cari(`#${ID_JENDELA}`);
    if (el) el.remove();
  }

  const labelWaktu = (f) => (f.pemicu ? f.judul : `${f.kode} · ${f.judul}`);

  async function bukaFitur(kode) {
    const f = kode && typeof kode === "object" ? kode : cariFitur(kode);
    if (!f || !nyala() || !dompetAktif().bisa) return;
    tutupJendela();
    const J = (K.jendela = { f, bahan: null, peta: null, masukan: "", acuan: "", sumberIsian: "", perkiraan: null, hitung: 0, jalan: false, hasil: null, galat: "", batal: null, catatan: "" });
    const el = akar.document.createElement("div");
    el.id = ID_JENDELA;
    el.className = "bd-modal bd-ai-tirai";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", labelWaktu(f));
    K.akar.appendChild(el);
    el.addEventListener("click", saatKlikJendela);
    el.addEventListener("input", saatMasukJendela);
    el.addEventListener("change", saatUbahJendela);
    el.addEventListener("paste", saatTempelJendela);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupJendela();
    });
    gambarJendela();
    await muatBahan(J);
    if (K.jendela !== J) return;
    gambarJendela();
    void hitungPerkiraan(J);
  }

  async function muatBahan(J) {
    const api = isianApi();
    if (!api || typeof api.bahanAi !== "function") {
      J.galat = "Panel isian belum siap. Pilih perkara dan blangko dulu.";
      return;
    }
    try {
      const h = await api.bahanAi(J.f.butuh, J.f.kode);
      if (!h || !h.ok) {
        J.galat = (h && h.pesan) || "Pilih perkara dulu.";
        return;
      }
      J.bahan = h.bahan;
      J.peta = h.peta || {};
      await bahanAturanA1(J);
    } catch (e) {
      J.galat = `Bahan belum terbaca: ${teks(e && e.message)}`;
    }
  }

  // ─── Sambungan draf aturan (A1) dan pemeriksa rak peraturan (C1-C6) ────────
  const API_DRAF_A1 = "/aleta/api/aleta-ecourt/draf-putusan-a1";
  const FITUR_A1 = new Set(["C1", "C2", "C3", "C4"]);
  /**
   * C1-C4: draf pertimbangan & amar yang sudah disusun aturan (draf H-7) menjadi bahan MASUKAN PETUGAS, supaya ALETA Ai
   * menyempurnakan, bukan menyusun dari nol. Tanpa draf (belum disusun / bukan hakim) fitur tetap berjalan seperti sebelumnya.
   */
  async function bahanAturanA1(J) {
    const pid = teks(J.peta && J.peta.perkaraId);
    if (!FITUR_A1.has(J.f.kode) || !/^\d+$/.test(pid) || !J.bahan) return;
    try {
      const d = await ambilJson(`${API_DRAF_A1}?${new URLSearchParams({ perkaraId: pid, fitur: J.f.kode }).toString()}`);
      if (!d || !d.ada || !d.ai || !teks(d.ai.masukan).trim()) return;
      J.bahan = { ...J.bahan, masukanAturan: teks(d.ai.masukan), samarkanAturan: Array.isArray(d.ai.samarkan) ? d.ai.samarkan : [] };
      J.drafA1 = { perkaraId: pid, varian: teks(d.varian) || "dikabulkan" };
    } catch {
      /* draf aturan belum ada atau akun tidak berhak: fitur berjalan dengan bahan panel saja */
    }
  }

  /**
   * Hasil AI diperiksa server terhadap rak peraturan SEBELUM tampil: C1-C4 (bila draf aturan dipakai) lewat draf-putusan-a1,
   * C5 & C6 lewat periksa-hasil. Gagal diperiksa -> hasil tetap tampil dengan penanda bawaan panel dan satu catatan.
   */
  async function periksaHasilRak(J, teksHasil) {
    const k = J.f.kode;
    let jalur = null;
    if (FITUR_A1.has(k) && J.drafA1) jalur = { alamat: API_DRAF_A1, badan: { perkaraId: J.drafA1.perkaraId, varian: J.drafA1.varian, teks: teksHasil } };
    else if (k === "C5") jalur = { alamat: `${API}/periksa-hasil`, badan: { fitur: "C5", teks: teksHasil } };
    else if (k === "C6") jalur = { alamat: `${API}/periksa-hasil`, badan: { fitur: "C6", teks: teksHasil, baris: (J.peta && J.peta.barisPenilaian) || [] } };
    if (!jalur) return null;
    try {
      const h = await kirimJson(jalur.alamat, "POST", jalur.badan);
      if (!h || typeof h.teks !== "string") throw new Error("kosong");
      const catatan = Array.isArray(h.catatan) ? h.catatan.map(teks) : [];
      if (Array.isArray(h.pasalDitandai) && h.pasalDitandai.length) catatan.push(`${h.pasalDitandai.length} rujukan belum terverifikasi di rak peraturan dan diberi tanda [PERLU VERIFIKASI].`);
      for (const x of (Array.isArray(h.temuanKutipan) ? h.temuanKutipan : []).slice(0, 10)) catatan.push(`Bunyi ${teks(x.rujukan)}: ${teks(x.pesan)}`);
      for (const x of (Array.isArray(h.kutipanBerubah) ? h.kutipanBerubah : []).slice(0, 10)) catatan.push(`Kutipan dalil angka ${teks(x.nomor)} tidak sama dengan teks para pihak; sesuaikan dengan aslinya.`);
      return { teks: h.teks, catatan };
    } catch {
      return { teks: null, catatan: ["Pemeriksaan rak peraturan belum dapat dijalankan; periksa sendiri dasar hukum pada usulan ini."] };
    }
  }

  function badanSekarang(J) {
    const dom = dompetAktif();
    return susunBadan(J.f, J.bahan, { masukan: J.masukan, acuan: J.acuan, medanKtp: J.ktp && J.ktp.medan }, proyekAktif(), dom.mode === "satker" && !(K.ringkas && K.ringkas.gratis === true) ? "satker" : "");
  }

  let pewaktuPerkiraan = null;
  function jadwalkanPerkiraan(J) {
    clearTimeout(pewaktuPerkiraan);
    J.perkiraan = null;
    pewaktuPerkiraan = setTimeout(() => void hitungPerkiraan(J), 700);
  }

  async function hitungPerkiraan(J) {
    if (!J.bahan || J.jalan || J.hasil) return;
    const kurang = kekuranganBahan(J.f, J.bahan, { masukan: J.masukan, acuan: J.acuan });
    if (kurang) {
      J.perkiraan = { ok: false, alasan: kurang, tunggu: true };
      gambarKendali(J);
      return;
    }
    const nomor = ++J.hitung;
    J.perkiraan = { memuat: true };
    gambarKendali(J);
    try {
      const d = await kirimJson(`${API}/perkiraan`, "POST", badanSekarang(J));
      if (K.jendela !== J || nomor !== J.hitung) return;
      J.perkiraan = { ok: true, ...d };
    } catch (e) {
      if (K.jendela !== J || nomor !== J.hitung) return;
      J.perkiraan = { ok: false, alasan: teks(e && e.message) || "Perkiraan biaya belum dapat dihitung." };
    }
    gambarKendali(J);
  }

  function kalimatPerkiraan(p) {
    if (!p) return "";
    if (p.memuat) return "Menghitung perkiraan biaya…";
    if (!p.ok) return p.alasan || "";
    const biaya = p.gratis ? "gratis (tidak mengurangi saldo)" : `sekitar ${rupiah(p.perkiraanRp)}`;
    const dompet = p.dompet === "satker" ? `dipotong dari saldo satker ${rupiah(p.saldoRp)}` : `saldo ${rupiah(p.saldoRp)}`;
    return `Perkiraan biaya: ${biaya} · mode ${teks(p.label) || "Teliti"} · ${dompet}.${p.bolehJalan === false ? ` ${teks(p.alasan)}` : ""}`;
  }

  function gambarJendela() {
    const el = K.akar && cari(`#${ID_JENDELA}`);
    const J = K.jendela;
    if (!el || !J) return;
    const f = J.f;
    const m = f.masukan;
    const kotak = [];
    if (m) {
      const ambil = m.ambilDariIsian && isianApi() && isianApi().aiIsianTeks ? isianApi().aiIsianTeks().filter((x) => !x.kosong) : [];
      kotak.push(
        `<label class="bd-ai-lbl" for="bd-ai-masukan">${esc(m.label)}${m.wajib ? "" : ""}</label>` +
          (ambil.length
            ? `<select id="bd-ai-ambil" aria-label="Ambil catatan dari isian"><option value="">Ambil dari isian yang sudah berisi…</option>${ambil.map((x) => `<option value="${esc(x.kode)}"${J.sumberIsian === x.kode ? " selected" : ""}>${esc(x.nama)}</option>`).join("")}</select>`
            : "") +
          `<textarea id="bd-ai-masukan" rows="${f.kode === "B5" || f.kode === "A3" ? 6 : 3}" placeholder="${esc(m.bantu || "")}">${esc(J.masukan)}</textarea>`
      );
    }
    if (f.kode === "B5") {
      kotak.push(
        `<label class="bd-ai-lbl" for="bd-ai-ktp">Gambar KTP (unggah fotonya, atau tempel dengan Ctrl+V)</label>` +
          `<input type="file" id="bd-ai-ktp" accept="image/*" aria-describedby="bd-ai-ktp-status">` +
          `<p class="bd-catat" id="bd-ai-ktp-status" role="status">${esc(J.ktp && J.ktp.pesan ? J.ktp.pesan : "Gambar dibaca di server kantor lalu hasilnya ditampilkan di kotak teks untuk Anda koreksi. Gambarnya tidak disimpan dan tidak dikirim ke layanan AI; yang dikirim hanya teksnya, dengan NIK, nama, dan alamat disamarkan.")}</p>`
      );
    }
    if (f.acuan) kotak.push(`<label class="bd-ai-lbl" for="bd-ai-acuan">${esc(f.acuan.label)}</label><textarea id="bd-ai-acuan" rows="6">${esc(J.acuan)}</textarea>`);
    el.innerHTML =
      `<div class="bd-ai-kotak"><div class="bd-ai-kepala"><b>${esc(labelWaktu(f))}</b><button type="button" class="bd-btn kecil" data-ai="tutup" aria-label="Tutup">Tutup</button></div>` +
      `<div class="bd-ai-badan">` +
      `<p class="bd-catat">Hasilnya berupa usulan bertanda. Nama, NIK, dan alamat disamarkan sebelum dikirim, dan tidak ada yang ditulis ke ABT atau SIPP sebelum Anda memakainya.</p>` +
      (J.galat ? `<p class="bd-peringatan" role="alert">${esc(J.galat)}</p>` : J.bahan ? "" : `<p class="bd-catat" role="status">Membaca data dari panel…</p>`) +
      (J.bahan ? `<p class="bd-catat" id="bd-ai-bahan">${esc(ringkasBahan(J))}</p>` : "") +
      kotak.join("") +
      `<div id="bd-ai-kendali"></div><div id="bd-ai-hasil" aria-live="polite"></div>` +
      `</div></div>`;
    gambarKendali(J);
    gambarHasil(J);
  }

  function ringkasBahan(J) {
    const b = J.bahan || {};
    const bagian = J.f.butuh.filter((k) => k !== "masukan" && k !== "acuan" && teks(b[k]).trim()).map((k) => NAMA_BAGIAN[k]);
    const p = J.peta || {};
    const catatan = [];
    if (p.naskahBelum && J.f.butuh.includes("naskah")) catatan.push("naskah belum disiapkan");
    return `Bahan dari panel: ${bagian.join(", ") || "belum ada"}${catatan.length ? `; ${catatan.join("; ")}` : ""}.`;
  }

  function gambarKendali(J) {
    const el = K.akar && cari("#bd-ai-kendali");
    if (!el || K.jendela !== J) return;
    if (J.hasil || J.jalan) {
      el.innerHTML = "";
      return;
    }
    const p = J.perkiraan;
    const p0 = J.peta || {};
    const siapkan = J.bahan && p0.naskahBelum && J.f.butuh.includes("naskah") && J.f.wajib.includes("naskah");
    const boleh = Boolean(p && p.ok && p.bolehJalan !== false);
    el.innerHTML =
      `<p class="bd-ai-perkiraan${p && !p.ok && !p.memuat && !p.tunggu ? " galat" : ""}" role="status">${esc(kalimatPerkiraan(p))}</p>` +
      `<div class="bd-ai-aksi">` +
      (siapkan ? `<button type="button" class="bd-btn kecil kuning" data-ai="siapkan">Siapkan naskah dulu</button>` : "") +
      `<button type="button" class="bd-btn" data-ai="jalan"${boleh ? "" : " disabled"}>Jalankan</button>` +
      `<button type="button" class="bd-btn kecil" data-ai="tutup">Batal</button></div>`;
  }

  function setStatusKtp(J, pesan) {
    J.ktp = { ...(J.ktp || {}), pesan };
    const el = K.akar && cari("#bd-ai-ktp-status");
    if (el) el.textContent = pesan;
  }

  const bacaSebagaiUrlData = (berkas) =>
    new Promise((selesai, tolak) => {
      const FR = akar.FileReader;
      if (typeof FR !== "function") return tolak(new Error("Pembaca berkas tidak tersedia."));
      const r = new FR();
      r.onload = () => selesai(String(r.result || ""));
      r.onerror = () => tolak(new Error("Berkas tidak terbaca."));
      r.readAsDataURL(berkas);
    });

  /**
   * Gambar KTP -> OCR di server kantor (rute baca KTP yang sudah ada; Tesseract) -> teks berlabel di kotak masukan untuk dikoreksi.
   * Berjalan di latar (async): panel tidak membeku. Gambar TIDAK dikirim ke layanan AI dan tidak disimpan; yang nanti dikirim ke AI
   * hanyalah teksnya, dengan NIK/nama/alamat disamarkan.
   */
  async function bacaGambarKtp(J, berkas) {
    if (!berkas) return;
    if (!/^image\//i.test(teks(berkas.type))) return setStatusKtp(J, "Berkas itu bukan gambar. Pilih foto atau hasil pindai KTP.");
    if (berkas.size > BATAS_GAMBAR_KTP) return setStatusKtp(J, "Gambar terlalu besar (paling besar 6 MB). Kecilkan fotonya lalu coba lagi.");
    setStatusKtp(J, "Membaca gambar KTP…");
    let hasil = null;
    try {
      const url = await bacaSebagaiUrlData(berkas);
      hasil = await kirimJson(API_BACA_KTP, "POST", { gambar: url });
    } catch (e) {
      if (K.jendela === J) setStatusKtp(J, `Gambar belum dapat dibaca: ${teks(e && e.message) || "coba lagi"}. Ketik atau tempel teks KTP di kotak.`);
      return;
    }
    if (K.jendela !== J) return;
    if (!hasil || hasil.ok !== true) {
      setStatusKtp(J, `${teks(hasil && hasil.pesan) || "Gambar belum dapat dibaca."} Ketik atau tempel teks KTP di kotak.`);
      return;
    }
    const isi = teksDariMedanKtp(hasil.medan) || teks(hasil.teks);
    J.ktp = { medan: hasil.medan || null, pesan: "Hasil baca gambar ada di kotak teks. Periksa dan koreksi dulu, lalu lanjutkan." };
    J.masukan = isi;
    const ta = cari("#bd-ai-masukan");
    if (ta) ta.value = isi;
    setStatusKtp(J, J.ktp.pesan);
    jadwalkanPerkiraan(J);
    gambarKendali(J);
  }

  function saatTempelJendela(e) {
    const J = K.jendela;
    if (!J || J.f.kode !== "B5" || !e.clipboardData) return;
    const butir = Array.from(e.clipboardData.items || []).find((x) => /^image\//i.test(teks(x.type)));
    const berkas = butir && typeof butir.getAsFile === "function" ? butir.getAsFile() : null;
    if (!berkas) return;
    e.preventDefault();
    void bacaGambarKtp(J, berkas);
  }

  function saatMasukJendela(e) {
    const J = K.jendela;
    if (!J || !e.target) return;
    if (e.target.id === "bd-ai-masukan") J.masukan = e.target.value;
    else if (e.target.id === "bd-ai-acuan") J.acuan = e.target.value;
    else return;
    jadwalkanPerkiraan(J);
    gambarKendali(J);
  }

  function saatUbahJendela(e) {
    const J = K.jendela;
    if (!J || !e.target) return;
    if (e.target.id === "bd-ai-ktp") {
      const berkas = e.target.files && e.target.files[0];
      void bacaGambarKtp(J, berkas);
      return;
    }
    if (e.target.id === "bd-ai-ambil") {
      const kode = e.target.value;
      const x = (isianApi().aiIsianTeks() || []).find((i) => i.kode === kode);
      if (!x) return;
      J.sumberIsian = kode;
      J.masukan = x.nilai || "";
      const ta = cari("#bd-ai-masukan");
      if (ta) ta.value = J.masukan;
      jadwalkanPerkiraan(J);
      gambarKendali(J);
    }
  }

  async function saatKlikJendela(e) {
    const J = K.jendela;
    const t = e.target && e.target.closest ? e.target.closest("[data-ai]") : null;
    if (!J || !t) {
      if (e.target && e.target.id === ID_JENDELA) tutupJendela();
      return;
    }
    const aksi = t.getAttribute("data-ai");
    if (aksi === "tutup") return tutupJendela();
    if (aksi === "siapkan") {
      const api = isianApi();
      t.disabled = true;
      t.textContent = "Menyiapkan naskah…";
      try {
        await api.siapkanNaskah("niat");
      } catch {
        /* galat disampaikan panel; bahan dibaca ulang di bawah */
      }
      await muatBahan(J);
      if (K.jendela !== J) return;
      gambarJendela();
      void hitungPerkiraan(J);
      return;
    }
    if (aksi === "jalan") return void jalankan(J);
    if (aksi === "salin") return void salinHasil(J);
    if (aksi === "pakai-teks") return void pakaiTeks(J);
    if (aksi === "pakai-isian") return void pakaiIsian(J);
    if (aksi === "pakai-saksi") return pakaiSaksi(J);
    if (aksi === "ulang") {
      J.hasil = null;
      J.perkiraan = null;
      J.galat = "";
      gambarJendela();
      void hitungPerkiraan(J);
    }
  }

  // ─── Menjalankan ───────────────────────────────────────────────────────────
  async function bacaAliran(jawab, padaPeristiwa) {
    let sisa = "";
    const olah = (potong) => {
      sisa += potong;
      let i;
      while ((i = sisa.search(/\r?\n\r?\n/)) >= 0) {
        const cocok = /\r?\n\r?\n/.exec(sisa);
        const blok = sisa.slice(0, i);
        sisa = sisa.slice(i + cocok[0].length);
        const p = uraiBlokSse(blok);
        if (p) padaPeristiwa(p);
      }
    };
    if (jawab.body && typeof jawab.body.getReader === "function") {
      const pembaca = jawab.body.getReader();
      let dekoder = null; // hanya bila aliran berupa byte (fetch asli); relai/uji mengirim teks
      for (;;) {
        const { value, done } = await pembaca.read();
        if (done) break;
        if (typeof value === "string") olah(value);
        else {
          if (!dekoder) dekoder = new akar.TextDecoder();
          olah(dekoder.decode(value, { stream: true }));
        }
      }
    } else olah(await jawab.text());
    olah("\n\n");
  }

  async function jalankan(J) {
    if (J.jalan || !J.perkiraan || !J.perkiraan.ok || J.perkiraan.bolehJalan === false) return;
    J.jalan = true;
    J.galat = "";
    J.batal = typeof akar.AbortController === "function" ? new akar.AbortController() : null;
    let hasil = "";
    let selesai = null;
    let gagal = "";
    let idPercakapan = "";
    const area = () => cari("#bd-ai-hasil");
    gambarKendali(J);
    if (area()) area().innerHTML = `<p class="bd-catat" role="status" id="bd-ai-jalan">Menyusun usulan… <button type="button" class="bd-btn kecil" data-ai="tutup">Hentikan</button></p>`;
    try {
      const nomor = teks(derry() && derry().perkaraTerpilih && derry().perkaraTerpilih() && derry().perkaraTerpilih().perkara && derry().perkaraTerpilih().perkara.nomorPerkara);
      const c = await kirimJson(`${API}/percakapan`, "POST", { judul: `Blangko Derry - ${J.f.judul}`, perkara: nomor, ...(proyekAktif() ? { proyekId: proyekAktif() } : {}) });
      idPercakapan = teks(c && c.id);
      const jawab = await akar.fetch(`${API}/percakapan/${encodeURIComponent(idPercakapan)}/pesan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(badanSekarang(J)),
        signal: J.batal ? J.batal.signal : undefined,
      });
      if (!jawab.ok || !jawab.body) {
        let isi = null;
        try {
          isi = await jawab.json();
        } catch {
          isi = null;
        }
        throw new Error((isi && isi.error && isi.error.message) || "Permintaan belum berhasil.");
      }
      await bacaAliran(jawab, (p) => {
        if (p.jenis === "teks") {
          hasil += teks(p.delta);
          const kini = cari("#bd-ai-jalan");
          if (kini) kini.firstChild.textContent = `Menyusun usulan… (${hasil.length} karakter) `;
        } else if (p.jenis === "selesai") selesai = p;
        else if (p.jenis === "gagal") gagal = teks(p.pesan);
      });
    } catch (e) {
      if (!(e && e.name === "AbortError")) gagal = teks(e && e.message) || "Permintaan belum berhasil.";
    }
    // Percakapan sekali pakai disembunyikan dari riwayat (pembukuan biaya tetap ada di server).
    if (idPercakapan) void kirimJson(`${API}/percakapan/${encodeURIComponent(idPercakapan)}`, "DELETE").catch(() => undefined);
    if (K.jendela !== J) return;
    J.jalan = false;
    J.batal = null;
    if (selesai && K.ringkas && Number.isFinite(Number(selesai.saldoRp))) {
      K.ringkas = selesai.dompet === "satker" ? { ...K.ringkas, satker: { ...(K.ringkas.satker || {}), saldoRp: Number(selesai.saldoRp) } } : { ...K.ringkas, saldoRp: Number(selesai.saldoRp) };
      K.ringkasSaat = Date.now();
      void akar.AletaBdAi.sinkron({ ringkas: K.ringkas }); // pojok saldo (milik pemuat) langsung memakai saldo terbaru
    }
    void muatRingkas(true).then(() => {
      gambarSaklar();
      gambarBilah();
      gambarSaldo();
    });
    if (gagal || !bersihkan(hasil)) {
      J.galat = gagal || "Tidak ada usulan yang dihasilkan. Coba lagi.";
      J.hasil = null;
      J.perkiraan = null;
      gambarJendela();
      void hitungPerkiraan(J);
      return;
    }
    const diperiksa = await periksaHasilRak(J, bersihkan(hasil));
    if (K.jendela !== J) return;
    J.hasil = {
      mentah: hasil,
      // Sudah diperiksa rak di server: penandanya yang berlaku (pasal terverifikasi tidak ditandai walau tidak ada di bahan).
      teks: diperiksa && diperiksa.teks ? bersihkan(diperiksa.teks) : tandaiRujukan(bersihkan(hasil), semuaBahan(J)),
      catatanPeriksa: diperiksa ? diperiksa.catatan : [],
      biayaRp: selesai ? Number(selesai.biayaRp) || 0 : 0,
      saldoRp: selesai ? Number(selesai.saldoRp) : NaN,
      dompet: selesai && selesai.dompet === "satker" ? "satker" : "",
    };
    gambarJendela();
  }

  const semuaBahan = (J) => Object.values({ ...(J.bahan || {}), masukan: J.masukan, acuan: J.acuan }).filter((v) => typeof v === "string").join("\n");

  // ─── Hasil ─────────────────────────────────────────────────────────────────
  function gambarHasil(J) {
    const el = K.akar && cari("#bd-ai-hasil");
    if (!el || K.jendela !== J) return;
    if (!J.hasil) {
      if (!J.jalan) el.innerHTML = "";
      return;
    }
    const f = J.f;
    const h = J.hasil;
    const biaya = `<p class="bd-catat">Biaya sebenarnya: ${h.biayaRp > 0 ? rupiah(h.biayaRp) : "tidak ditagih"}${Number.isFinite(h.saldoRp) ? ` · ${h.dompet === "satker" ? "saldo satker" : "saldo"} ${rupiah(h.saldoRp)}` : ""}.</p>`;
    const tanda = `<div class="bd-ai-tanda" role="note"><b>USULAN</b> - belum dipakai. Periksa dulu; Anda yang memutuskan.</div>`;
    const ulang = `<button type="button" class="bd-btn kecil" data-ai="ulang">Ulangi</button>`;
    let badan = "";
    let aksi = "";
    if (f.keluaran === "isian") {
      const diizinkan = new Set((J.peta && J.peta.kosong ? J.peta.kosong : []).map((x) => x.kode));
      const daftar = uraiIsian(h.mentah, diizinkan);
      const nama = new Map((J.peta && J.peta.kosong ? J.peta.kosong : []).map((x) => [x.kode, x.nama]));
      if (!daftar || !daftar.length) {
        badan = `<p class="bd-catat">Tidak ada isian yang dapat diusulkan dari data yang ada.</p>`;
      } else {
        h.daftarIsian = daftar;
        badan = `<ul class="bd-ai-daftar">${daftar
          .map(
            (x, i) =>
              `<li><label><input type="checkbox" data-ai-isian="${i}" checked> <b>${esc(nama.get(x.kode) || x.kode)}</b></label><textarea rows="2" data-ai-nilai="${i}">${esc(x.nilai)}</textarea>${x.alasan ? `<small class="bd-catat">${esc(x.alasan)}</small>` : ""}<small class="bd-ai-hasilisi" data-ai-status="${i}"></small></li>`
          )
          .join("")}</ul>`;
        aksi = `<button type="button" class="bd-btn" data-ai="pakai-isian">Pakai yang dicentang</button>`;
      }
    } else if (f.keluaran === "saksi") {
      const daftar = uraiSaksi(h.mentah);
      const saksi = (J.peta && J.peta.saksi ? J.peta.saksi : []).filter((s) => s.siap);
      if (!daftar || !daftar.length) badan = `<p class="bd-catat">Tidak ada baris yang dapat diusulkan.</p>`;
      else {
        h.daftarSaksi = daftar;
        badan =
          `<ul class="bd-ai-daftar">${daftar
            .map((x, i) => `<li><label><input type="checkbox" data-ai-baris="${i}" checked> Baris ${i + 1}</label><textarea rows="2" data-ai-tanya="${i}" aria-label="Pertanyaan ${i + 1}">${esc(x.tanya)}</textarea><textarea rows="2" data-ai-jawab="${i}" aria-label="Jawaban ${i + 1}">${esc(x.jawab)}</textarea></li>`)
            .join("")}</ul>` +
          (saksi.length
            ? `<label class="bd-ai-lbl" for="bd-ai-saksi">Tambahkan ke</label><select id="bd-ai-saksi">${saksi.map((s) => `<option value="${esc(s.kunci)}">${esc(s.sebutan)}</option>`).join("")}</select>`
            : `<p class="bd-catat">Tanya jawab saksi belum terbaca atau hanya dibaca pada blangko ini; usulan dapat disalin saja.</p>`);
        aksi = saksi.length ? `<button type="button" class="bd-btn" data-ai="pakai-saksi">Tambahkan yang dicentang</button>` : "";
      }
    } else if (f.keluaran === "temuan") {
      const daftar = uraiTemuan(h.mentah);
      if (daftar && daftar.length) {
        badan = `<ol class="bd-ai-temuan">${daftar.map((x) => `<li><b>${esc(x.judul)}</b>${x.uraian ? `<p>${esc(x.uraian)}</p>` : ""}${x.saran ? `<p class="bd-catat">Saran: ${esc(x.saran)}</p>` : ""}</li>`).join("")}</ol>`;
        h.salin = daftar.map((x, i) => `${i + 1}. ${x.judul}${x.uraian ? `\n   ${x.uraian}` : ""}${x.saran ? `\n   Saran: ${x.saran}` : ""}`).join("\n");
      } else if (daftar) {
        badan = `<p class="bd-catat">Tidak ada temuan.</p>`;
      } else {
        badan = `<textarea id="bd-ai-teks" rows="10" readonly>${esc(h.teks)}</textarea>`;
        h.salin = h.teks;
      }
      aksi = h.salin ? `<button type="button" class="bd-btn" data-ai="salin">Salin</button>` : "";
    } else {
      badan = `<label class="bd-ai-lbl" for="bd-ai-teks">Usulan (boleh disunting sebelum dipakai)</label><textarea id="bd-ai-teks" rows="12">${esc(h.teks)}</textarea>`;
      aksi = `<button type="button" class="bd-btn" data-ai="salin">Salin</button>`;
      if (f.pakai === "teksisian") {
        const api = isianApi();
        const pilihan = api && api.aiIsianTeks ? api.aiIsianTeks() : [];
        if (pilihan.length) {
          const awal = J.sumberIsian || (pilihan.find((x) => x.kosong) || pilihan[0]).kode;
          badan +=
            `<label class="bd-ai-lbl" for="bd-ai-sasaran">Pakai di isian</label><select id="bd-ai-sasaran">${pilihan.map((x) => `<option value="${esc(x.kode)}"${x.kode === awal ? " selected" : ""}>${esc(x.nama)}${x.kosong ? "" : " (sudah berisi)"}</option>`).join("")}</select>` +
            `<label class="bd-ai-ganti"><input type="checkbox" id="bd-ai-timpa"${J.sumberIsian ? " checked" : ""}> Ganti isi yang sudah ada (isi lama diganti usulan ini)</label>`;
          aksi = `<button type="button" class="bd-btn" data-ai="pakai-teks">Pakai di isian</button>` + aksi;
        }
      }
    }
    const periksa = Array.isArray(h.catatanPeriksa) && h.catatanPeriksa.length ? `<ul class="bd-catat bd-ai-periksa">${h.catatanPeriksa.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
    el.innerHTML = `${tanda}${badan}${periksa}${biaya}<p class="bd-ai-status" id="bd-ai-status" role="status"></p><div class="bd-ai-aksi">${aksi}${ulang}<button type="button" class="bd-btn kecil" data-ai="tutup">Tutup</button></div>`;
  }

  const status = (pesan) => {
    const el = K.akar && cari("#bd-ai-status");
    if (el) el.textContent = pesan;
  };
  const teksSekarang = (J) => {
    const ta = cari("#bd-ai-teks");
    return bersihkan(ta ? ta.value : J.hasil && J.hasil.teks);
  };

  async function salinHasil(J) {
    const isi = J.f.keluaran === "temuan" ? teks(J.hasil && J.hasil.salin) : teksSekarang(J);
    try {
      await akar.navigator.clipboard.writeText(isi);
      status("Tersalin.");
    } catch {
      const ta = cari("#bd-ai-teks");
      if (ta) {
        ta.removeAttribute("readonly");
        ta.select();
      }
      status("Gagal menyalin otomatis: pilih teks lalu tekan Ctrl+C.");
    }
  }

  async function pakaiTeks(J) {
    const api = isianApi();
    const sel = cari("#bd-ai-sasaran");
    const kode = sel ? sel.value : "";
    const timpa = Boolean(cari("#bd-ai-timpa") && cari("#bd-ai-timpa").checked);
    const isi = teksSekarang(J);
    if (!api || !kode || !isi) return status("Pilih isian tujuan dulu.");
    const r = await api.aiTerapkanIsian(kode, isi, { timpa });
    status(r.ok ? "Usulan sudah ditaruh di isian dan tersimpan seperti ketikan Anda. Periksa kembali di kotak isian." : r.pesan || "Gagal memakai usulan.");
  }

  async function pakaiIsian(J) {
    const api = isianApi();
    const daftar = (J.hasil && J.hasil.daftarIsian) || [];
    let ok = 0;
    for (let i = 0; i < daftar.length; i += 1) {
      const cek = cari(`[data-ai-isian="${i}"]`);
      const ta = cari(`[data-ai-nilai="${i}"]`);
      const ket = cari(`[data-ai-status="${i}"]`);
      if (!cek || !cek.checked || !ta) continue;
      const r = await api.aiTerapkanIsian(daftar[i].kode, bersihkan(ta.value));
      if (ket) ket.textContent = r.ok ? "dipakai" : r.pesan || "tidak dipakai";
      if (r.ok) {
        ok += 1;
        cek.checked = false;
        cek.disabled = true;
      }
    }
    status(ok ? `${ok} isian diisi dan tersimpan seperti ketikan Anda. Periksa kembali di kotak isian.` : "Tidak ada isian yang dipakai.");
  }

  function pakaiSaksi(J) {
    const api = isianApi();
    const daftar = (J.hasil && J.hasil.daftarSaksi) || [];
    const sel = cari("#bd-ai-saksi");
    const baris = [];
    for (let i = 0; i < daftar.length; i += 1) {
      const cek = cari(`[data-ai-baris="${i}"]`);
      if (!cek || !cek.checked) continue;
      baris.push({ tanya: bersihkan(cari(`[data-ai-tanya="${i}"]`).value), jawab: bersihkan(cari(`[data-ai-jawab="${i}"]`).value) });
    }
    if (!sel || !baris.length) return status("Centang baris dan pilih saksi dulu.");
    const r = api.aiTambahSaksi(sel.value, baris);
    status(r.ok ? `${r.jumlah} baris ditambahkan sebagai kalimat contoh. Belum disimpan: sesuaikan dengan keterangan saksi, lalu tekan Simpan ke ABT.` : r.pesan || "Gagal menambahkan.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Panduan bergambar (tur): menyorot elemen nyata, satu atau dua kalimat per langkah. Tampil sekali saat saklar pertama kali
  // dinyalakan akun ini; dibuka lagi lewat tanda (?) di baris ALETA Ai. Tidak menulis apa pun dan tidak memanggil layanan AI.
  // ──────────────────────────────────────────────────────────────────────────
  /** sasaran: pemilih elemen nyata (cadangan di `cadangan`); gambar: ilustrasi kecil bila tidak ada elemen yang bisa disorot. */
  const LANGKAH_TUR = [
    { sasaran: `#${ID_SAKLAR}`, judul: "Saklar ALETA Ai", teks: "Nyalakan saklar ini kalau Anda mau dibantu. Matikan kapan saja; kalau mati, panel bekerja seperti biasa." },
    { sasaran: `#${ID_SALDO}`, judul: "Saldo Anda", teks: "Di sini sisa saldo Anda. Klik sekali untuk melihat saldo kantor, klik lagi untuk kembali ke saldo Anda." },
    { sasaran: `#${ID_BILAH}`, judul: "Pilihan bantuan", teks: "Baris ini berisi bantuan untuk saksi, berita acara, isian, putusan, dan pemeriksaan naskah. Pilih perkara dulu supaya tombolnya aktif." },
    { sasaran: '[data-ai-grup="Menu proyek"]', cadangan: "[data-ai-grup]", judul: "Menu proyek", teks: "Berisi perintah siap pakai yang sudah dipilihkan sesuai perkara yang sedang dibuka. Yang lain ada di Semua menu." },
    { sasaran: null, gambar: "biaya", judul: "Biaya tampil dulu", teks: "Sebelum jalan, selalu tampil perkiraan biayanya. Hanya setelah Anda menekan Jalankan, bantuan dikerjakan." },
    { sasaran: null, gambar: "kartu", judul: "Hasilnya berupa usulan", teks: "Hasil muncul di kartu bertanda USULAN. Belum masuk ke berkas mana pun, jadi aman untuk dibaca dan disunting dulu." },
    { sasaran: null, gambar: "terima", judul: "Terima atau tolak", teks: "Kalau cocok tekan Pakai. Kalau tidak, tekan Ulangi atau Tutup. Tidak ada yang tertulis tanpa keputusan Anda." },
  ];

  function gambarContohTur(jenis) {
    if (jenis === "biaya") return `<div class="bd-ai-contoh"><span>Perkiraan biaya: sekitar Rp...</span><span class="bd-btn kecil" aria-hidden="true">Jalankan</span></div>`;
    if (jenis === "kartu") return `<div class="bd-ai-contoh kolom"><div class="bd-ai-tanda"><b>USULAN</b> - belum dipakai. Periksa dulu.</div><div class="bd-ai-contoh-isi">Bahwa pada sidang tanggal ... Penggugat hadir ...</div></div>`;
    if (jenis === "terima") return `<div class="bd-ai-contoh"><span class="bd-btn kecil" aria-hidden="true">Pakai</span><span class="bd-btn kecil" aria-hidden="true">Ulangi</span><span class="bd-btn kecil" aria-hidden="true">Tutup</span></div>`;
    return "";
  }

  function tutupTur() {
    K.tur = null;
    const el = K.akar && cari(`#${ID_TUR}`);
    if (el) el.remove();
  }

  function mulaiTur() {
    if (!K.akar) return;
    tutupTur();
    K.tur = { langkah: 0 };
    const el = akar.document.createElement("div");
    el.id = ID_TUR;
    el.className = "bd-ai-tur";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Panduan ALETA Ai");
    el.addEventListener("click", (e) => {
      const t = e.target && e.target.closest ? e.target.closest("[data-tur]") : null;
      if (!t) return;
      const a = t.getAttribute("data-tur");
      if (a === "lewati" || a === "selesai") return tutupTur();
      K.tur.langkah = Math.max(0, Math.min(LANGKAH_TUR.length - 1, K.tur.langkah + (a === "maju" ? 1 : -1)));
      gambarTur();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupTur();
    });
    K.akar.appendChild(el);
    gambarTur();
  }

  function gambarTur() {
    const el = K.akar && cari(`#${ID_TUR}`);
    if (!el || !K.tur) return;
    const n = K.tur.langkah;
    const l = LANGKAH_TUR[n];
    let sasaran = null;
    if (l.sasaran) {
      sasaran = cari(l.sasaran) || (l.cadangan ? cari(l.cadangan) : null);
      if (sasaran && sasaran.hidden) sasaran = null;
    }
    const terakhir = n === LANGKAH_TUR.length - 1;
    el.className = `bd-ai-tur${sasaran ? " bersorot" : ""}`;
    el.innerHTML =
      `<div class="bd-ai-sorot" id="bd-ai-sorot" hidden></div>` +
      `<div class="bd-ai-kartu-tur" id="bd-ai-kartu-tur"><p class="bd-ai-tur-no">Langkah ${n + 1} dari ${LANGKAH_TUR.length}</p><b>${esc(l.judul)}</b><p>${esc(l.teks)}</p>${l.gambar ? gambarContohTur(l.gambar) : ""}` +
      `<div class="bd-ai-aksi"><button type="button" class="bd-btn kecil" data-tur="lewati">Lewati</button>` +
      (n > 0 ? `<button type="button" class="bd-btn kecil" data-tur="mundur">Sebelumnya</button>` : "") +
      (terakhir ? `<button type="button" class="bd-btn" data-tur="selesai">Selesai</button>` : `<button type="button" class="bd-btn" data-tur="maju">Berikutnya</button>`) +
      `</div></div>`;
    const kartu = cari("#bd-ai-kartu-tur", el);
    const sorot = cari("#bd-ai-sorot", el);
    const z = (derry() && typeof derry().skala === "function" && derry().skala()) || 1;
    if (sasaran) {
      try {
        sasaran.scrollIntoView({ block: "nearest" });
      } catch {
        /* tanpa gulir */
      }
      const r = sasaran.getBoundingClientRect();
      const lebar = (akar.innerWidth || 1024) / z;
      const tinggi = (akar.innerHeight || 768) / z;
      sorot.hidden = false;
      sorot.style.left = `${r.left / z - 4}px`;
      sorot.style.top = `${r.top / z - 4}px`;
      sorot.style.width = `${r.width / z + 8}px`;
      sorot.style.height = `${r.height / z + 8}px`;
      const bawah = r.bottom / z + 14;
      kartu.style.left = `${Math.max(8, Math.min(r.left / z, lebar - 340))}px`;
      kartu.style.top = `${bawah + 190 > tinggi ? Math.max(8, r.top / z - 190) : bawah}px`;
      kartu.classList.remove("tengah");
    } else {
      sorot.hidden = true;
      kartu.classList.add("tengah");
    }
    const maju = cari('[data-tur="maju"], [data-tur="selesai"]', el);
    if (maju && maju.focus) maju.focus();
  }

  akar.AletaBdAiInti = {
    aktifkan,
    nyalakan,
    matikan,
    /** Titik sambung proyek: pilihan proyek kelolaan (hanya yang boleh dipakai akun ini) ikut terkirim sebagai proyekId. */
    /** Pojok saldo (milik pemuat) berganti dompet: bilah menyesuaikan kunci fitur. */
    modeBerubah() {
      K.menu = "";
      gambarBilah();
    },
    aturProyek(id) {
      K.proyekId = teks(id).trim();
      gambarBilah();
      return tulisSimpan({ [KUNCI_PROYEK]: K.proyekId });
    },
    proyekAktif,
    keadaan: () => ({ idAkun: K.idAkun, tersimpan: K.tersimpan, nyala: nyala(), mode: modeDompet(), dompet: dompetAktif(), proyekId: K.proyekId, ringkas: K.ringkas }),
    bukaFitur,
    tutup: tutupJendela,
    mulaiTur,
    tutupTur,
    turTerbuka: () => (K.tur ? K.tur.langkah : -1),
    FITUR,
    murni: { teksDariMedanKtp, samaranDariMedanKtp, proyekAktifDari: (id, daftar) => (id && (daftar || []).some((p) => p && p.id === id) ? id : ""), saringMenu, fiturDariPemicu, LANGKAH_TUR, bersihkan, uraiIsian, uraiSaksi, uraiTemuan, tandaiRujukan, samaranDariKtp, susunBadan, kekuranganBahan, uraiBlokSse, cariFitur },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = akar.AletaBdAiInti;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("blangko-derry-ai-inti.js"); // K11-SELESAI
