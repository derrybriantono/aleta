"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - CETAK MASSAL (20 OKT 2026)
 * ============================================================================
 *
 * Satu tombol "Cetak massal" di ujung kanan langkah 1 (Perkara) membuka jendela besar. Isinya menurut PERAN akun (hak menu yang
 * sudah ada, jenisBoleh() di blangko-derry-isian.js):
 *   Hakim                     -> PUTUSAN perkara yang diputus / beragenda putusan pada tanggal terpilih
 *   Panitera Pengganti        -> BAS sidang pada tanggal terpilih (milik PP itu; "semua perkara" bagi yang berhak)
 *   Juru sita                 -> RELAAS panggilan dan pemberitahuan putusan (daftar dan blangko dari fungsi bersama jurusita.js:
 *                                relaas-massal/cetak + pemetaan blangko; bukan rumus baru)
 *   PTSP / petugas meja       -> PENETAPAN PMH, PPP, PJS, PHS perkara baru yang blangkonya belum dicetak
 *   Super Admin               -> semuanya (memilih jenis)
 *
 * Alur: tanggal (bawaan hari ini) + jenis -> daftar perkara bercentang (tidak ada yang tercentang sendiri; "Pilih semua yang siap") dengan
 * blangko pilihan MESIN SARAN Blangko Derry (dapat diganti per baris) -> "Isi otomatis semua" (mesin isi otomatis yang ada, tidak
 * menimpa isian yang sudah ada) -> "Cetak": tiap perkara diproses oleh pengemudi satu-perkara di blangko-derry-isian.js
 * (aletaBlangkoDerryIsian.massal) - jalur ambilRtf yang SAMA dengan langkah 5 Cetak - hasilnya satu ZIP (RTF) atau satu PDF
 * gabungan (+ tanda tangan sah bila dicentang). Gagal satu tidak menghentikan yang lain; ada ringkasan akhir.
 *
 * Tidak ada yang ditulis ke SIPP. Isian ke ABT hanya lewat jalur simpan isian yang sudah ada (di pengemudi). Batas wajar: paling
 * banyak 40 dokumen sekali jalan dengan jeda antar dokumen supaya ABT tidak terbebani.
 */
(function blangkoDerryMassalModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaBlangkoDerryMassal) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const API_PERKARA = "/aleta/api/aleta-ecourt/perkara-saya";
  const API_GABUNG = "/aleta/api/aleta-ecourt/pdf-gabung";
  const K_CETAK_BLANGKO = "blangkoDerryCetakBlangko";
  const BATAS_DOKUMEN = 40;
  const JEDA_MS = 1200;
  const BATAS_GABUNG_BASE64 = 20 * 1024 * 1024;
  const JANGKAUAN_PTSP_HARI = 28;
  const URUT_JENIS = ["put", "bas", "rel", "ptsp"];
  const JUDUL_JENIS = { put: "Putusan", bas: "Berita acara sidang (BAS)", rel: "Relaas panggilan dan pemberitahuan putusan", ptsp: "Penetapan awal (PMH, PPP, PJS, PHS)" };
  const NAMA_BERKAS_JENIS = { put: "Putusan", bas: "BAS", rel: "Relaas", ptsp: "Penetapan" };
  const NAMA_PERAN_TAMPIL = { put: "Hakim", bas: "Panitera Pengganti", rel: "Juru sita", ptsp: "PTSP" };
  const PERAN_JENIS = { put: "hakim", bas: "pp", rel: "js" };
  const JENIS_PERAN = { hakim: "put", pp: "bas", js: "rel", ptsp: "ptsp" };
  // 28 Okt 2026: PTSP memilih penetapan mana yang dicetak. Empat penetapan awal tercentang sejak awal (perilaku lama); PMH+PHS gabungan
  // (@ 0) dan penunjukan mediator (@ 4) tersedia sebagai pilihan tambahan. PHS ikrar talak (@ 3, @ 3a, @ 3b) tidak ikut: tanggal acuannya
  // sidang ikrar, bukan sidang pertama.
  const POLA_PTSP = [
    { label: "PMH", pola: /^@\s*1\b.*PMH/i, utama: true, judul: "Penetapan majelis hakim (PMH)" },
    { label: "PPP", pola: /^@\s*0a\b.*PPP/i, utama: true, judul: "Penunjukan panitera pengganti (PPP)" },
    { label: "PJS", pola: /^@\s*0b\b.*PJS/i, utama: true, judul: "Penunjukan juru sita (PJS)" },
    { label: "PHS", pola: /^@\s*2\s*-.*PHS/i, utama: true, judul: "Penetapan hari sidang (PHS)" },
    { label: "PMH + PHS", pola: /^@\s*0\s*-\s*PMH/i, utama: false, judul: "PMH dan PHS satu blangko" },
    { label: "Mediator", pola: /^@\s*4\b.*Mediator/i, utama: false, judul: "Penunjukan mediator" },
  ];
  const PENETAPAN_BAWAAN = POLA_PTSP.filter((x) => x.utama).map((x) => x.label);
  const LABEL_STATUS = { tanpa: "Pilih blangko", menunggu: "Siap diperiksa", jalan: "Memproses…", siap: "Siap", cek: "Perlu dicek", gagal: "Gagal", selesai: "Sudah dicetak" };

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu murni (diuji)
  // ──────────────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tanpaRtf = (s) => String(s || "").replace(/\.rtf$/i, "").trim();
  const nomorAngka = (n) => parseInt(n, 10) || 0;
  const nomorPendek = (n) => String(n || "").replace(/\/PA\.[A-Za-z]+$/, "");
  const tanggalLokal = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const tambahHari = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const tglIndo = (iso) => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : String(iso || "");
  };

  /** CRC-32 (IEEE) untuk berkas ZIP. */
  let tabelCrc = null;
  function crc32(bita) {
    if (!tabelCrc) {
      tabelCrc = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        tabelCrc[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bita.length; i += 1) c = tabelCrc[(c ^ bita[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /** ZIP tanpa kompresi (STORE): entri [{ nama, bita: Uint8Array }] -> Uint8Array. Nama berkas UTF-8. */
  function buatZip(entri) {
    const enc = new TextEncoder();
    const bagian = [];
    const pusat = [];
    let posisi = 0;
    const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
    const dosTanggal = (() => {
      const d = new Date();
      const waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const tgl = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      return { waktu: waktu & 0xffff, tgl: tgl & 0xffff };
    })();
    for (const e of entri) {
      const nama = enc.encode(e.nama);
      const isi = e.bita instanceof Uint8Array ? e.bita : new Uint8Array(e.bita);
      const crc = crc32(isi);
      const kepala = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTanggal.waktu), ...u16(dosTanggal.tgl), ...u32(crc), ...u32(isi.length), ...u32(isi.length), ...u16(nama.length), ...u16(0)]);
      bagian.push(kepala, nama, isi);
      pusat.push({ nama, crc, ukuran: isi.length, posisi });
      posisi += kepala.length + nama.length + isi.length;
    }
    const awalPusat = posisi;
    for (const p of pusat) {
      const k = Uint8Array.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTanggal.waktu), ...u16(dosTanggal.tgl), ...u32(p.crc), ...u32(p.ukuran), ...u32(p.ukuran), ...u16(p.nama.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(p.posisi)]);
      bagian.push(k, p.nama);
      posisi += k.length + p.nama.length;
    }
    const akhir = Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(pusat.length), ...u16(pusat.length), ...u32(posisi - awalPusat), ...u32(awalPusat), ...u16(0)]);
    bagian.push(akhir);
    const hasil = new Uint8Array(posisi + akhir.length);
    let o = 0;
    for (const b of bagian) {
      hasil.set(b, o);
      o += b.length;
    }
    return hasil;
  }
  /** Nama berkas unik di dalam satu ZIP: "x.rtf", "x (2).rtf", ... */
  function namaUnik(nama, dipakai) {
    const bersih = String(nama || "naskah").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_");
    if (!dipakai.has(bersih.toLowerCase())) {
      dipakai.add(bersih.toLowerCase());
      return bersih;
    }
    const titik = bersih.lastIndexOf(".");
    const batang = titik > 0 ? bersih.slice(0, titik) : bersih;
    const akhiran = titik > 0 ? bersih.slice(titik) : "";
    for (let i = 2; i < 1000; i += 1) {
      const calon = `${batang} (${i})${akhiran}`;
      if (!dipakai.has(calon.toLowerCase())) {
        dipakai.add(calon.toLowerCase());
        return calon;
      }
    }
    return bersih;
  }
  /** "A binti B" + "C" -> "A binti B vs C (dkk)" dipendekkan. */
  function pihakRingkas(p) {
    const pihak = (p && p.pihak) || {};
    const satu = (daftar) => {
      const l = Array.isArray(daftar) ? daftar.filter(Boolean) : [];
      if (!l.length) return "-";
      const nama = String(l[0]).length > 26 ? `${String(l[0]).slice(0, 25)}…` : String(l[0]);
      return l.length > 1 ? `${nama} dkk` : nama;
    };
    return `${satu(pihak.penggugat)} lawan ${satu(pihak.tergugat)}`;
  }
  const sidangBertanggal = (p, tanggal) => (Array.isArray(p.sidang) ? p.sidang : []).filter((s) => s && s.tanggal === tanggal);
  const beragendaPutus = (s) => /putus|pembacaan|pengucapan/i.test(`${(s && s.agenda) || ""} ${(s && s.ket) || ""}`);
  /**
   * Daftar dasar (tanpa blangko) untuk putusan, BAS, dan penetapan dari jawaban perkara-saya. Murni.
   *   put: perkara yang diputus pada tanggal itu atau yang sidangnya hari itu beragenda putusan (semuaSidang: seluruh sidang hari itu)
   *   bas: setiap sidang pada tanggal itu, perkara yang peran PP-nya milik akun (atau semua bila server mengirim semua)
   *   ptsp: perkara dengan sidang pertama pada/sesudah tanggal itu (paling jauh 28 hari) - satu baris per penetapan (PMH, PPP, PJS, PHS)
   */
  function barisDariPerkara(jenis, daftar, tanggal, opsi) {
    const o = opsi || {};
    const peran = PERAN_JENIS[jenis] || "";
    const hasil = [];
    const buat = (p, s, tambahan) => ({
      id: `${jenis}|${p.perkaraId || p.nomorPerkara}|${(s && (s.sidangId || s.tanggal)) || ""}${tambahan && tambahan.label ? `|${tambahan.label}` : ""}`,
      jenis,
      nomor: String(p.nomorPerkara || ""),
      perkaraId: String(p.perkaraId || ""),
      pihak: pihakRingkas(p),
      jenisPerkara: String(p.jenisPerkara || ""),
      tanggal: (s && s.tanggal) || "",
      agenda: s ? [s.agenda, s.ket].filter(Boolean).join(" · ") : "",
      label: (tambahan && tambahan.label) || "",
      pola: (tambahan && tambahan.pola) || null,
      sudahAda: false,
      catatan: "",
      status: "tanpa",
      item: { nomor: String(p.nomorPerkara || ""), perkaraId: String(p.perkaraId || ""), jenisPerkara: String(p.jenisPerkara || ""), perkara: p, sidang: s || null, kelompok: "", berkas: "" },
    });
    for (const p of Array.isArray(daftar) ? daftar : []) {
      if (!p || !p.nomorPerkara) continue;
      if (peran && !o.abaikanPeran && Array.isArray(p.sebagai) && p.sebagai.length && !p.sebagai.includes(peran)) continue;
      if (jenis === "put") {
        const hari = sidangBertanggal(p, tanggal);
        const putusHariIni = p.tanggalPutusan === tanggal;
        const pilih = o.semuaSidang ? hari : hari.filter(beragendaPutus);
        const sidang = pilih[0] || (putusHariIni ? hari[hari.length - 1] || (p.sidang || []).filter((s) => s.tanggal && s.tanggal <= tanggal).pop() || null : null);
        if (!sidang && !putusHariIni) continue;
        const b = buat(p, sidang);
        b.sudahAda = p.adaBerkasPutusan === true;
        if (b.sudahAda) b.catatan = "putusan sudah ada di SIPP";
        hasil.push(b);
      } else if (jenis === "bas") {
        for (const s of sidangBertanggal(p, tanggal)) {
          const b = buat(p, s);
          b.sudahAda = s.adaBas === true;
          if (b.sudahAda) b.catatan = "BAS sidang ini sudah ada di SIPP";
          hasil.push(b);
        }
      } else if (jenis === "ptsp") {
        const urut = (Array.isArray(p.sidang) ? p.sidang : []).slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || (a.urutan || 0) - (b.urutan || 0));
        const pertama = urut.find((s) => (Number(s.urutan) || 1) <= 1) || null;
        const batasAtas = o.sampai && o.sampai >= tanggal ? o.sampai : tambahHari(tanggal, JANGKAUAN_PTSP_HARI);
        if (!pertama || !pertama.tanggal || pertama.tanggal < tanggal || pertama.tanggal > batasAtas) continue;
        const dipakai = POLA_PTSP.filter((x) => (Array.isArray(o.penetapan) ? o.penetapan.includes(x.label) : x.utama));
        for (const x of dipakai) hasil.push(buat(p, pertama, x));
      }
    }
    const urutanLabel = (l) => POLA_PTSP.findIndex((x) => x.label === l);
    return hasil.sort((a, b) => nomorAngka(a.nomor) - nomorAngka(b.nomor) || a.nomor.localeCompare(b.nomor) || String(a.tanggal).localeCompare(String(b.tanggal)) || urutanLabel(a.label) - urutanLabel(b.label));
  }
  /** Keadaan isian pengemudi -> status baris dan catatannya. Murni. */
  function nilaiKeadaan(k) {
    const x = k || {};
    const sebab = [];
    const kosong = Array.isArray(x.kosongPenting) ? x.kosongPenting : [];
    if (kosong.length) sebab.push(`${kosong.length} isian belum terisi (${kosong.slice(0, 3).join(", ")}${kosong.length > 3 ? ", …" : ""})`);
    if (x.ragu) sebab.push(`${x.ragu} isian masih ragu`);
    if (x.gagalSimpan) sebab.push(`${x.gagalSimpan} isian gagal tersimpan`);
    if (x.penandaSisa) sebab.push(`${x.penandaSisa} bagian naskah belum terisi`);
    return { status: sebab.length ? "cek" : "siap", catatan: sebab.join("; ") };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan jendela
  // ──────────────────────────────────────────────────────────────────────────
  const M = {
    terbuka: false,
    jenis: "",
    tanggal: "",
    sampai: "", // PTSP: ujung rentang sidang pertama; kosong = tanggal + 28 hari
    penetapan: PENETAPAN_BAWAAN.slice(), // PTSP: penetapan yang dicetak
    semua: false, // saringan "semua perkara" (BAS) / "semua juru sita" (relaas)
    semuaSidang: false, // putusan: seluruh sidang hari itu, bukan hanya yang beragenda putusan
    format: "rtf", // "rtf" | "pdf"
    ttd: true,
    memuat: false,
    galat: "",
    baris: [],
    pilih: new Set(),
    menu: [],
    pernah: new Map(), // "nomor|berkas" -> jam
    jalan: "", // "" | "isi" | "cetak"
    henti: false,
    kemajuan: null, // { selesai, total, sekarang }
    ringkasan: null,
    hasilServer: [], // K14: pekerjaan berkas yang selesai di server
    pulih: null, // K15: antrean terputus yang ditawarkan lagi dari server { selesai, total, jumlah, waktu }
    picker: null, // { id, cari }
    urut: 0,
    potret: null,
  };
  const api = () => globalThis.aletaBlangkoDerry || null;
  const driver = () => (globalThis.aletaBlangkoDerryIsian && globalThis.aletaBlangkoDerryIsian.massal) || null;
  const toast = (t) => {
    const a = api();
    if (a && typeof a.toast === "function") a.toast(t);
  };
  const adm = () => Boolean(api() && api().adm());
  const el = (id) => document.getElementById(id);

  // ──────────────────────────────────────────────────────────────────────────
  // Jenis yang boleh, daftar, blangko
  // ──────────────────────────────────────────────────────────────────────────
  function jenisBoleh() {
    const d = driver();
    if (!d) return [];
    const ada = d.jenisBoleh();
    return URUT_JENIS.filter((j) => ada.includes(j));
  }
  /** Jenis bawaan menurut peran akun; Super Admin/Admin mulai dari putusan. */
  function jenisBawaan(ada) {
    const a = api();
    const peran = a && typeof a.peranAkun === "function" ? a.peranAkun() : [];
    if (!adm()) for (const p of ["hakim", "pp", "js", "ptsp"]) if (peran.includes(p) && ada.includes(JENIS_PERAN[p])) return JENIS_PERAN[p];
    return ada[0] || "";
  }
  /** Ujung rentang sidang pertama PTSP: pilihan petugas, atau tanggal mulai + 28 hari. */
  const sampaiPtsp = () => (M.sampai && M.sampai >= M.tanggal ? M.sampai : tambahHari(M.tanggal, JANGKAUAN_PTSP_HARI));
  function alamatPerkara() {
    const q = new URLSearchParams();
    q.set("mode", "rentang");
    q.set("dari", M.tanggal);
    q.set("sampai", M.jenis === "ptsp" ? sampaiPtsp() : M.tanggal);
    if (adm()) {
      const kd = api() && typeof api().keadaan === "function" ? api().keadaan() : null;
      if (kd && kd.sebagai && kd.sebagai.nama && kd.sebagai.peran) {
        q.set("sebagai", kd.sebagai.nama);
        q.set("peranSebagai", kd.sebagai.peran);
        // Admin yang melihat sebagai akun PTSP: perkara satker seperti yang dilihat PTSP (baca saja).
        if (kd.sebagai.peran === "ptsp" && M.jenis === "ptsp") q.set("massal", "ptsp");
      }
    } else if (M.jenis === "ptsp") q.set("massal", "ptsp");
    else if (M.jenis === "bas" && M.semua) q.set("massal", "bas");
    return `${API_PERKARA}?${q.toString()}`;
  }
  const cariBerkas = (berkas, kelompok) => {
    const b = tanpaRtf(berkas);
    const urutan = kelompok ? [...M.menu.filter((k) => k.nama === kelompok), ...M.menu.filter((k) => k.nama !== kelompok)] : M.menu;
    for (const k of urutan) if (k.berkas.some((x) => tanpaRtf(x) === b)) return { kelompok: k.nama, berkas: k.berkas.find((x) => tanpaRtf(x) === b) };
    return null;
  };
  function pasangBlangko(b, kelompok, berkas) {
    b.item.kelompok = kelompok;
    b.item.berkas = berkas;
    b.berkas = berkas;
    b.kelompok = kelompok;
    b.status = "menunggu";
    b.catatan = b.catatan && b.sudahAda ? b.catatan : "";
    b.keadaan = null;
    const jam = M.pernah.get(`${b.nomor}|${tanpaRtf(berkas)}`);
    b.pernah = jam || "";
    if (jam) b.status = "selesai";
  }
  /** Blangko pilihan mesin saran Derry (putusan, BAS) atau menurut pola penetapan (PTSP); sisanya jadi alternatif. */
  function tetapkanBlangko(b) {
    const d = driver();
    b.alternatif = [];
    if (b.jenis === "ptsp") {
      for (const k of M.menu.filter((x) => x.jenis === "ptsp")) {
        const ketemu = k.berkas.find((x) => b.pola && b.pola.test(tanpaRtf(x)));
        if (ketemu) return pasangBlangko(b, k.nama, ketemu);
      }
      b.status = "tanpa";
      b.catatan = `blangko ${b.label} tidak ditemukan di menu`;
      return;
    }
    let saran = [];
    try {
      saran = d.saran(b.item, b.jenis);
    } catch {
      saran = [];
    }
    const ada = saran.map((r) => ({ r, c: cariBerkas(r.berkas, r.kelompok) })).filter((x) => x.c);
    if (!ada.length) {
      b.status = "tanpa";
      b.catatan = b.catatan || "belum ada saran blangko untuk sidang ini - pilih sendiri";
      return;
    }
    b.alternatif = ada.slice(1).map((x) => ({ kelompok: x.c.kelompok, berkas: x.c.berkas, alasan: x.r.alasan }));
    b.alasanSaran = ada[0].r.alasan || "";
    pasangBlangko(b, ada[0].c.kelompok, ada[0].c.berkas);
  }

  /** Sisi (pihak) yang MEMANG dipanggil/diberitahu tiap dokumen satu baris relaas - semua yang tersedia, bukan hanya yang tercentang bawaan. */
  function tersedia(baris) {
    const pilih = { p1: false, p2: false, b1: false, b2: false, pi: false };
    const kp = jurusitaKeadaanDok(baris.panggilan, baris.kelompok);
    if (kp && kp.boleh) for (const s of kp.sisi) pilih[`p${s}`] = true;
    for (const s of [1, 2]) {
      const k = jurusitaKeadaanDok(jurusitaDokPbtSisi(baris.pbt, s), baris.kelompok);
      if (k && k.boleh && k.sisi.includes(s)) pilih[`b${s}`] = true;
    }
    if (baris.pengumuman) pilih.pi = true;
    return pilih;
  }
  // Relaas: daftar dan blangko dari fungsi bersama jurusita.js (relaas-massal/cetak + pemetaan blangko).
  async function barisRelaas() {
    if (typeof jurusitaAmbilDaftarRelaas !== "function" || typeof jurusitaBarisMassal !== "function" || typeof jurusitaDokumenBarisMassal !== "function") {
      throw new Error("Mesin relaas belum termuat. Muat ulang halaman ABT.");
    }
    const [jawab, peta, siapa] = await Promise.all([jurusitaAmbilDaftarRelaas(M.tanggal), typeof jurusitaMuatPeta === "function" ? jurusitaMuatPeta() : null, typeof jurusitaMuatSiapa === "function" ? jurusitaMuatSiapa() : null]);
    if (!jawab.data || !Array.isArray(jawab.data.dokumen)) throw new Error(jawab.sebab || "Daftar relaas tidak terbaca.");
    const namaSaya = String((siapa && siapa.nama) || (typeof jurusitaSiapa !== "undefined" && jurusitaSiapa && jurusitaSiapa.nama) || "");
    const hanyaSaya = !adm() && !M.semua && namaSaya && typeof jurusitaNamaCocok === "function";
    const lolos = (b) => !hanyaSaya || jurusitaNamaCocok(namaSaya, b.jurusita);
    const kelompokDua = [
      ...jurusitaBarisMassal(jawab.data.dokumen, "hari-ini").filter(lolos),
      ...(typeof jurusitaDokumenKemarin === "function" ? jurusitaBarisMassal(jurusitaDokumenKemarin(jawab.data), "kemarin").filter(lolos) : []),
    ];
    const hasil = [];
    for (const baris of kelompokDua) {
      const bawaan = typeof jurusitaPilihanBawaan === "function" ? jurusitaPilihanBawaan(baris) : tersedia(baris);
      const kunciBawaan = new Set(jurusitaDokumenBarisMassal(baris, bawaan, peta).dokumen.map((x) => x.kunci));
      const { dokumen } = jurusitaDokumenBarisMassal(baris, tersedia(baris), peta);
      for (const dk of dokumen) {
        const pbt = dk.golongan === "pemberitahuan-putusan";
        const sumber = pbt ? (baris.pbt && baris.pbt[0]) || {} : baris.panggilan || {};
        const tujuan = String(sumber.tanggalSidangTujuan || "");
        const d = Number(dk.d) || 0;
        const perkara = { nomorPerkara: dk.nomorPerkara, perkaraId: dk.perkaraId, jenisPerkara: String(sumber.jenisPerkara || ""), majelisNama: "", paniteraNama: "", jurusitaNama: baris.jurusita || "", sebagai: ["js"], pihak: { penggugat: [], tergugat: [] }, sidang: [] };
        hasil.push({
          id: `rel|${dk.kunci}`,
          jenis: "rel",
          nomor: dk.nomorPerkara,
          perkaraId: dk.perkaraId,
          pihak: dk.label,
          jenisPerkara: perkara.jenisPerkara,
          tanggal: tujuan,
          agenda: baris.kelompok === "kemarin" ? "dari hari kerja sebelumnya" : "",
          label: dk.label,
          pola: null,
          sudahAda: sumber.sudahAdaRelaas === true,
          catatan: sumber.sudahAdaRelaas === true ? "relaas sudah tercatat di SIPP" : "",
          siapDefault: kunciBawaan.has(dk.kunci),
          tolak: !pbt && d <= 0 ? "nomor sidang yang dipanggil belum terbaca" : "",
          status: "tanpa",
          blangkoRute: dk.berkas,
          item: {
            nomor: dk.nomorPerkara,
            perkaraId: dk.perkaraId,
            jenisPerkara: perkara.jenisPerkara,
            perkara,
            sidang: tujuan || d ? { sidangId: String(sumber.sidangId == null ? "" : sumber.sidangId), tanggal: tujuan, urutan: d, agenda: "", ket: "" } : null,
            urutanPaksa: d,
            kelompok: "",
            berkas: "",
          },
        });
      }
    }
    return hasil.sort((a, b) => nomorAngka(a.nomor) - nomorAngka(b.nomor) || a.id.localeCompare(b.id));
  }
  function tetapkanBlangkoRelaas(b) {
    const c = cariBerkas(b.blangkoRute);
    b.alternatif = [];
    if (b.tolak) {
      b.status = "tanpa";
      b.catatan = b.tolak;
      return;
    }
    if (!c) {
      b.status = "tanpa";
      b.catatan = b.catatan || "blangko relaas tidak ditemukan di menu ABT akun ini";
      return;
    }
    pasangBlangko(b, c.kelompok, c.berkas);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Memuat daftar
  // ──────────────────────────────────────────────────────────────────────────
  async function bacaPernah() {
    M.pernah = new Map();
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
      const semua = (await chrome.storage.local.get(null)) || {};
      for (const [k, v] of Object.entries(semua)) if (k.startsWith(`${K_CETAK_BLANGKO}:`)) M.pernah.set(k.slice(K_CETAK_BLANGKO.length + 1), String(v));
    } catch {
      /* penyimpanan tidak tersedia: tanda "sudah dicetak" tidak tampil */
    }
  }
  // ───────────────────────────────────────────────────────
  // K15 - antrean di server (hanya bila Super Admin menyalakan saklar antreanDiServer; mati = tidak ada yang dikirim/dibaca)
  // ───────────────────────────────────────────────────────
  const kunciAntrean = () => `${M.jenis}|${M.tanggal}`;
  function statusKeServer(b) {
    return b.status === "selesai" || b.status === "cek" ? "selesai" : b.status === "gagal" ? "gagal" : "menunggu";
  }
  /** Keadaan pengerjaan saja: nomor perkara, nama blangko, status. Tidak ada isi dokumen. */
  function muatanAntrean(dipilih) {
    return { jenis: M.jenis, tanggal: M.tanggal, format: M.format, ttd: M.ttd === true, butir: dipilih.map((b) => ({ nomor: b.nomor, berkas: tanpaRtf(b.berkas), status: statusKeServer(b) })) };
  }
  function cerminAntrean(dipilih, selesaiN, segera) {
    const A = globalThis.ALETA_ANTREAN_SERVER;
    if (!A) return;
    void A.catat(
      "cetak-massal",
      kunciAntrean(),
      { ringkas: `Cetak massal ${JUDUL_JENIS[M.jenis] || M.jenis} ${M.tanggal}: ${selesaiN} dari ${dipilih.length}`, selesai: selesaiN, total: dipilih.length, muatan: muatanAntrean(dipilih) },
      { segera: segera === true }
    );
  }
  function akhiriCermin() {
    const A = globalThis.ALETA_ANTREAN_SERVER;
    if (A) void A.akhiri("cetak-massal", kunciAntrean(), "selesai");
  }
  /**
   * Antrean cetak massal yang terputus (Chrome ditutup di tengah jalan, atau PC lain) untuk jenis + tanggal yang sama:
   * perkara yang BELUM selesai dicentang kembali dan diberi catatan. Tidak menjalankan apa pun; petugas menekan Cetak sendiri.
   */
  async function tawarkanAntreanTerputus() {
    const A = globalThis.ALETA_ANTREAN_SERVER;
    if (!A) return;
    let daftar = [];
    try {
      await A.tungguSiap();
      if (!A.aktif()) return;
      daftar = await A.tertinggal("cetak-massal");
    } catch {
      return;
    }
    const cocok = daftar.find((x) => x && x.muatan && x.muatan.jenis === M.jenis && x.muatan.tanggal === M.tanggal && Array.isArray(x.muatan.butir));
    if (!cocok) return;
    const belum = new Set(cocok.muatan.butir.filter((b) => b.status !== "selesai").map((b) => b.nomor));
    if (!belum.size) return;
    const hasil = new Set();
    for (const b of M.baris) {
      if (hasil.size >= BATAS_DOKUMEN) break;
      if (belum.has(b.nomor) && b.berkas) hasil.add(b.id);
    }
    if (!hasil.size) return;
    M.pilih = hasil;
    if (cocok.muatan.format === "rtf" || cocok.muatan.format === "pdf") M.format = cocok.muatan.format;
    M.pulih = { selesai: cocok.selesai, total: cocok.total, jumlah: hasil.size, waktu: String(cocok.diubahPada || "") };
  }
  function pulihHtml() {
    const p = M.pulih;
    if (!p || M.ringkasan) return "";
    return `<div class="bd-ms-ringkasan" role="status"><b>Cetak massal sebelumnya belum selesai</b><p>${esc(String(p.selesai))} dari ${esc(String(p.total))} perkara sudah selesai. ${esc(String(p.jumlah))} yang belum sudah dicentang kembali; tekan Cetak bila ingin melanjutkan.</p></div>`;
  }

  /** K14: pekerjaan berkas milik akun ini yang sudah selesai di server (mungkin ditinggal menutup Chrome). */
  async function muatHasilServer() {
    M.hasilServer = [];
    const B = serverBerkas();
    if (!B) return;
    try {
      const daftar = await B.daftar();
      M.hasilServer = daftar.filter((x) => x && x.status === "selesai" && x.hasil);
    } catch {
      M.hasilServer = [];
    }
  }
  function hasilServerHtml() {
    if (!M.hasilServer || !M.hasilServer.length) return "";
    return (
      `<div class="bd-ms-ringkasan" role="status"><b>Hasil yang sudah disusun di server</b>` +
      M.hasilServer
        .map(
          (x) =>
            `<p>${esc(x.hasil.nama)} <span class="bd-catat">(${esc(String(Math.round(x.hasil.ukuran / 1024)))} KB)</span> ` +
            `<button type="button" class="bd-btn kecil" data-ms="srv-unduh" data-srv="${esc(x.id)}">Unduh</button> ` +
            `<button type="button" class="bd-btn kecil" data-ms="srv-hapus" data-srv="${esc(x.id)}">Hapus</button></p>`
        )
        .join("") +
      `</div>`
    );
  }
  async function muat() {
    const d = driver();
    if (!d || !M.jenis) return;
    const nomor = ++M.urut;
    M.memuat = true;
    M.galat = "";
    M.baris = [];
    M.pilih = new Set();
    M.ringkasan = null;
    M.pulih = null;
    gambar();
    try {
      await bacaPernah();
      let baris;
      if (M.jenis === "rel") baris = await barisRelaas();
      else {
        const data = await d.ambilPortal(alamatPerkara(), {}, "Membaca daftar perkara");
        baris = barisDariPerkara(M.jenis, data && data.perkara, M.tanggal, { semuaSidang: M.semuaSidang, abaikanPeran: M.jenis === "ptsp", sampai: M.jenis === "ptsp" ? sampaiPtsp() : "", penetapan: M.penetapan });
      }
      if (nomor !== M.urut) return;
      M.menu = await d.menu(M.jenis);
      if (M.jenis !== "rel" && M.jenis !== "ptsp") await d.muatSaranTanggal(M.tanggal);
      if (nomor !== M.urut) return;
      for (const b of baris) {
        if (M.jenis === "rel") tetapkanBlangkoRelaas(b);
        else tetapkanBlangko(b);
      }
      M.baris = baris;
      await tawarkanAntreanTerputus();
      await muatHasilServer();
    } catch (e) {
      if (nomor !== M.urut) return;
      M.galat = String((e && e.message) || e);
    }
    M.memuat = false;
    gambar();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar
  // ──────────────────────────────────────────────────────────────────────────
  function ikon(status) {
    return status === "selesai" || status === "siap" ? "✓" : status === "cek" ? "!" : status === "gagal" ? "×" : status === "jalan" ? "…" : "";
  }
  function barisHtml(b) {
    const dipilih = M.pilih.has(b.id);
    const kunci = M.jalan !== "";
    const tanpa = !b.berkas;
    const label = LABEL_STATUS[b.status] || b.status;
    const rincian = [b.status === "selesai" && b.pernah ? `dicetak ${b.pernah}` : "", b.catatan].filter(Boolean).join(" · ");
    return (
      `<div class="bd-ms-baris st-${b.status}${dipilih ? " dipilih" : ""}" data-msbaris="${esc(b.id)}" role="listitem">` +
      `<label class="bd-ms-cek"><input type="checkbox" data-mscek="${esc(b.id)}" ${dipilih ? "checked" : ""} ${tanpa || kunci ? "disabled" : ""} aria-label="Pilih ${esc(b.nomor)}"></label>` +
      `<div class="bd-ms-pk"><b class="bd-ms-no">${esc(nomorPendek(b.nomor))}</b><span class="bd-ms-pihak">${esc(b.pihak)}</span>` +
      `<small>${esc([b.label && b.jenis === "ptsp" ? b.label : "", b.tanggal ? tglIndo(b.tanggal) : "", b.agenda].filter(Boolean).join(" · "))}</small></div>` +
      `<div class="bd-ms-bl">${tanpa ? `<span class="bd-ms-kosong">Belum ada blangko</span>` : `<span class="bd-ms-nama" title="${esc(b.berkas)}">${esc(driver().namaTampil(b.berkas, b.jenis))}</span>`}` +
      `<button type="button" class="bd-btn kecil" data-msganti="${esc(b.id)}" ${kunci ? "disabled" : ""}>${tanpa ? "Pilih blangko" : "Ganti"}</button></div>` +
      `<div class="bd-ms-st"><span class="bd-ms-chip st-${b.status}">${ikon(b.status) ? `<i aria-hidden="true">${ikon(b.status)}</i> ` : ""}${esc(label)}</span>${rincian ? `<small>${esc(rincian)}</small>` : ""}</div>` +
      `</div>`
    );
  }
  function pickerHtml() {
    const p = M.picker;
    if (!p) return "";
    const b = M.baris.find((x) => x.id === p.id);
    if (!b) return "";
    const cari = String(p.cari || "").toLowerCase();
    const cocok = (n) => !cari || tanpaRtf(n).toLowerCase().includes(cari);
    const alt = (b.alternatif || []).filter((a) => cocok(a.berkas));
    let isi = alt.length
      ? `<h5>Disarankan</h5>` + alt.map((a) => `<button type="button" class="bd-ms-pil" data-mspil="${esc(a.kelompok)}|${esc(a.berkas)}"><span>${esc(driver().namaTampil(a.berkas, b.jenis))}</span><small>${esc(a.alasan || "")}</small></button>`).join("")
      : "";
    for (const k of M.menu) {
      const l = k.berkas.filter(cocok);
      if (!l.length) continue;
      isi += `<h5>${esc(k.judul)}</h5>` + l.map((n) => `<button type="button" class="bd-ms-pil${n === b.berkas ? " aktif" : ""}" data-mspil="${esc(k.nama)}|${esc(n)}"><span>${esc(driver().namaTampil(n, b.jenis))}</span></button>`).join("");
    }
    return (
      `<div class="bd-ms-picker" role="dialog" aria-label="Pilih blangko"><div class="bd-ms-pkepala"><b>Pilih blangko untuk ${esc(nomorPendek(b.nomor))}</b>` +
      `<input type="search" id="bd-ms-cariblangko" placeholder="Cari nama blangko" value="${esc(p.cari || "")}" aria-label="Cari blangko"><button type="button" class="bd-btn kecil" data-ms="tutuppicker">Tutup</button></div>` +
      `<div class="bd-ms-pisi">${isi || `<p class="bd-catat">Tidak ada blangko yang cocok.</p>`}</div></div>`
    );
  }
  function ringkasanHtml() {
    const r = M.ringkasan;
    if (!r) return "";
    const gagal = r.gagal.map((g) => `<li><b>${esc(nomorPendek(g.nomor))}</b> ${esc(g.sebab)}</li>`).join("");
    return (
      `<div class="bd-ms-ringkasan" role="status"><b>${esc(r.judul)}</b><p>${esc(r.teks)}</p>` +
      (r.cek.length ? `<p class="bd-ms-awas">Perlu dicek lagi: ${esc(r.cek.map((c) => nomorPendek(c.nomor)).join(", "))}.</p>` : "") +
      (gagal ? `<ul>${gagal}</ul><p>Perkara yang gagal tercentang kembali; tekan Cetak untuk mencoba sekali lagi.</p>` : "") +
      `</div>`
    );
  }
  function gambar() {
    const akar = el("bd-massal-modal");
    if (!akar || !M.terbuka) return;
    const d = driver();
    const ada = jenisBoleh();
    const sibuk = M.jalan !== "";
    const pilihJumlah = M.pilih.size;
    const siapAda = M.baris.filter(bolehDipilihSiap).length;
    const kontrolJenis =
      ada.length > 1
        ? `<label class="bd-lbl" for="bd-ms-jenis">Jenis</label><select id="bd-ms-jenis" ${sibuk ? "disabled" : ""}>${ada.map((j) => `<option value="${j}" ${j === M.jenis ? "selected" : ""}>${esc(JUDUL_JENIS[j])}</option>`).join("")}</select>`
        : `<span class="bd-ms-jenis1">${esc(JUDUL_JENIS[M.jenis] || "")}</span>`;
    const saringan =
      M.jenis === "bas"
        ? `<label class="bd-cek"><input type="checkbox" id="bd-ms-semua" ${M.semua ? "checked" : ""} ${sibuk || adm() ? "disabled" : ""}> Semua perkara, bukan hanya milik saya</label>`
        : M.jenis === "rel"
          ? `<label class="bd-cek"><input type="checkbox" id="bd-ms-semua" ${M.semua ? "checked" : ""} ${sibuk || adm() ? "disabled" : ""}> Semua juru sita</label>`
          : M.jenis === "put"
            ? `<label class="bd-cek"><input type="checkbox" id="bd-ms-semuasidang" ${M.semuaSidang ? "checked" : ""} ${sibuk ? "disabled" : ""}> Tampilkan semua sidang hari itu</label>`
            : "";
    const ketTanggal = M.jenis === "ptsp" ? "Sidang pertama dari" : M.jenis === "rel" ? "Relaas yang lahir pada" : "Tanggal sidang";
    const rentangPtsp =
      M.jenis === "ptsp"
        ? `<label class="bd-lbl" for="bd-ms-sampai">sampai</label><input type="date" id="bd-ms-sampai" value="${esc(sampaiPtsp())}" min="${esc(M.tanggal)}" ${sibuk ? "disabled" : ""}>`
        : "";
    const pilihanPtsp =
      M.jenis === "ptsp"
        ? `<div class="bd-ms-aksi bd-ms-ptsp" role="group" aria-label="Penetapan yang dicetak"><span class="bd-lbl">Penetapan yang dicetak</span>` +
          POLA_PTSP.map(
            (x) =>
              `<label class="bd-cek" title="${esc(x.judul)}"><input type="checkbox" data-msptsp="${esc(x.label)}" ${M.penetapan.includes(x.label) ? "checked" : ""} ${sibuk ? "disabled" : ""}> ${esc(x.label)}</label>`
          ).join("") +
          `</div>`
        : "";
    const kemajuan = M.kemajuan
      ? `<div class="bd-ms-kemajuan" role="progressbar" aria-valuemin="0" aria-valuemax="${M.kemajuan.total}" aria-valuenow="${M.kemajuan.selesai}"><div style="width:${M.kemajuan.total ? Math.round((M.kemajuan.selesai / M.kemajuan.total) * 100) : 0}%"></div></div>` +
        `<span class="bd-catat">${M.kemajuan.selesai} dari ${M.kemajuan.total}${M.kemajuan.sekarang ? ` · ${esc(M.kemajuan.sekarang)}` : ""}</span>`
      : "";
    const badan = M.memuat
      ? `<p class="bd-catat" role="status">Membaca daftar…</p>`
      : M.galat
        ? `<div class="bd-peringatan" role="alert">${esc(M.galat)} <button type="button" class="bd-btn kecil" data-ms="muat">Coba lagi</button></div>`
        : M.baris.length
          ? `<div class="bd-ms-daftar" role="list">${M.baris.map(barisHtml).join("")}</div>`
          : `<p class="bd-catat">Tidak ada ${M.jenis === "put" ? "perkara yang diputus atau beragenda putusan" : M.jenis === "bas" ? "sidang" : M.jenis === "rel" ? "relaas" : "perkara baru"} pada tanggal ini.</p>`;
    const sebelumGulir = akar.querySelector(".bd-ms-daftar") ? akar.querySelector(".bd-ms-daftar").scrollTop : 0;
    akar.innerHTML =
      `<div class="bd-ms-kotak" role="dialog" aria-modal="true" aria-label="Cetak massal">` +
      `<div class="bd-ms-kepala"><div><b>Cetak massal</b> <small>${esc(adm() ? "Super Admin / Admin" : NAMA_PERAN_TAMPIL[M.jenis] || "")}</small></div>` +
      `<button type="button" class="bd-btn kecil" data-ms="tutup" ${sibuk ? "disabled" : ""}>Tutup</button></div>` +
      `<div class="bd-ms-kontrol"><label class="bd-lbl" for="bd-ms-tgl">${ketTanggal}</label><input type="date" id="bd-ms-tgl" value="${esc(M.tanggal)}" ${sibuk ? "disabled" : ""}>${rentangPtsp}` +
      `<button type="button" class="bd-btn kecil" data-ms="hariini" ${sibuk ? "disabled" : ""}>Hari ini</button>${kontrolJenis}${saringan}</div>` +
      pilihanPtsp +
      `<div class="bd-ms-aksi"><button type="button" class="bd-btn kecil" data-ms="pilihsiap" ${sibuk || !siapAda ? "disabled" : ""}>Pilih semua yang siap</button>` +
      `<button type="button" class="bd-btn kecil" data-ms="kosongkan" ${sibuk || !pilihJumlah ? "disabled" : ""}>Kosongkan pilihan</button>` +
      `<span class="bd-catat" id="bd-ms-hitung">${pilihJumlah} dipilih dari ${M.baris.length}${pilihJumlah > BATAS_DOKUMEN ? ` · paling banyak ${BATAS_DOKUMEN} sekali jalan` : ""}</span>` +
      `<button type="button" class="bd-btn kecil" data-ms="isi" ${sibuk || !pilihJumlah ? "disabled" : ""}>Isi otomatis semua</button></div>` +
      badan +
      hasilServerHtml() +
      pulihHtml() +
      ringkasanHtml() +
      `<div class="bd-ms-kaki"><div class="bd-ms-format" role="radiogroup" aria-label="Bentuk hasil">` +
      `<label class="bd-cek"><input type="radio" name="bd-ms-format" value="rtf" ${M.format === "rtf" ? "checked" : ""} ${sibuk ? "disabled" : ""}> RTF (satu ZIP)</label>` +
      `<label class="bd-cek"><input type="radio" name="bd-ms-format" value="pdf" ${M.format === "pdf" ? "checked" : ""} ${sibuk ? "disabled" : ""}> PDF gabungan</label>` +
      `<label class="bd-cek"><input type="checkbox" id="bd-ms-ttd" ${M.ttd ? "checked" : ""} ${sibuk || M.format !== "pdf" ? "disabled" : ""}> Bubuhkan tanda tangan sah</label></div>` +
      `<div class="bd-ms-tombol">${kemajuan}${sibuk ? `<button type="button" class="bd-btn" data-ms="henti" ${M.henti ? "disabled" : ""}>${M.henti ? "Menghentikan…" : "Hentikan"}</button>` : ""}` +
      `<button type="button" class="bd-btn utama besar" data-ms="cetak" ${sibuk || !pilihJumlah ? "disabled" : ""}>${M.jalan === "cetak" ? "Sedang mencetak…" : `Cetak${pilihJumlah ? ` ${pilihJumlah}` : ""}`}</button></div></div>` +
      pickerHtml() +
      `</div>`;
    const daftar = akar.querySelector(".bd-ms-daftar");
    if (daftar) daftar.scrollTop = sebelumGulir;
  }
  function segarkanBaris() {
    // Pembaruan ringan saat memproses: gambar ulang menyeluruh dengan gulir dipertahankan.
    gambar();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aksi
  // ──────────────────────────────────────────────────────────────────────────
  const bolehDipilihSiap = (b) => Boolean(b.berkas) && (b.status === "menunggu" || b.status === "siap") && !b.sudahAda && b.siapDefault !== false;
  function pilihSiap() {
    const hasil = new Set();
    for (const b of M.baris) {
      if (hasil.size >= BATAS_DOKUMEN) break;
      if (bolehDipilihSiap(b)) hasil.add(b.id);
    }
    M.pilih = hasil;
    if (M.baris.filter(bolehDipilihSiap).length > BATAS_DOKUMEN) toast(`Hanya ${BATAS_DOKUMEN} yang pertama dipilih; paling banyak ${BATAS_DOKUMEN} sekali jalan.`);
    gambar();
  }
  let jedaMs = JEDA_MS;
  const jeda = () => new Promise((r) => setTimeout(r, jedaMs));
  const dipilihBerurut = () => M.baris.filter((b) => M.pilih.has(b.id) && b.berkas);
  function awal(untukApa) {
    const d = driver();
    const dipilih = dipilihBerurut();
    if (!d) return null;
    if (!dipilih.length) {
      toast("Centang perkara dulu.");
      return null;
    }
    if (dipilih.length > BATAS_DOKUMEN) {
      toast(`Paling banyak ${BATAS_DOKUMEN} sekali jalan. Kurangi pilihan Anda.`);
      return null;
    }
    M.jalan = untukApa;
    M.henti = false;
    M.ringkasan = null;
    M.kemajuan = { selesai: 0, total: dipilih.length, sekarang: "" };
    return dipilih;
  }
  async function isiSemua() {
    const dipilih = awal("isi");
    if (!dipilih) return;
    const d = driver();
    gambar();
    let siap = 0;
    let cek = 0;
    let gagal = 0;
    try {
      await d.siramSimpan();
      if (!M.potret) M.potret = d.potret();
      for (const b of dipilih) {
        if (M.henti) break;
        b.status = "jalan";
        M.kemajuan.sekarang = nomorPendek(b.nomor);
        segarkanBaris();
        try {
          const k = await d.siapkan(b.item, { isiOto: true });
          b.keadaan = k;
          const n = nilaiKeadaan(k);
          b.status = n.status;
          b.catatan = n.catatan;
          if (n.status === "siap") siap += 1;
          else cek += 1;
        } catch (e) {
          b.status = "gagal";
          b.catatan = String((e && e.message) || e);
          gagal += 1;
        }
        M.kemajuan.selesai += 1;
        segarkanBaris();
        await jeda();
      }
    } finally {
      await selesaiJalan();
    }
    M.ringkasan = { judul: M.henti ? "Dihentikan" : "Isi otomatis selesai", teks: `${siap} siap, ${cek} perlu dicek, ${gagal} gagal. Isian yang sudah ada tidak ditimpa.`, cek: dipilih.filter((b) => b.status === "cek"), gagal: dipilih.filter((b) => b.status === "gagal").map((b) => ({ nomor: b.nomor, sebab: b.catatan })) };
    gambar();
  }
  async function selesaiJalan() {
    const d = driver();
    M.jalan = "";
    M.kemajuan = null;
    if (M.potret && d) {
      const p = M.potret;
      M.potret = null;
      await d.pulihkan(p);
    }
  }
  const base64 = (bita) => {
    let s = "";
    for (let i = 0; i < bita.length; i += 0x8000) s += String.fromCharCode.apply(null, bita.subarray(i, i + 0x8000));
    return btoa(s);
  };
  /** PDF-PDF digabung lewat portal (bagian-bagian ≤ 20 MB base64). Pulang [{ bita, halaman }]; melempar bila portal tidak dapat menggabung. */
  async function gabungkan(daftar) {
    const d = driver();
    const bagian = [];
    let kini = [];
    let ukuran = 0;
    for (const b of daftar) {
      const teks = base64(b);
      if (kini.length && ukuran + teks.length > BATAS_GABUNG_BASE64) {
        bagian.push(kini);
        kini = [];
        ukuran = 0;
      }
      kini.push(teks);
      ukuran += teks.length;
    }
    if (kini.length) bagian.push(kini);
    const hasil = [];
    for (const teks of bagian) {
      const j = await d.ambilPortal(API_GABUNG, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfBase64: teks }), batasMs: 120000 }, "Menggabung PDF");
      if (!j || !j.available) throw new Error((j && j.message) || "Penggabung PDF tidak tersedia.");
      hasil.push({ bita: Uint8Array.from(atob(j.pdfBase64), (c) => c.charCodeAt(0)), halaman: j.halaman || 0 });
    }
    return hasil;
  }
  /** Jalur LAMA: ZIP / PDF gabungan disusun di peramban. Pulang kalimat hasil. */
  async function rakitLokal(hasil, pdf, d, nama) {
    let teksHasil = "";
    try {
      if (pdf) {
        const potongan = await gabungkan(hasil.map((x) => x.h.pdf));
        if (potongan.length === 1) {
          const u = await d.unduh(new Blob([potongan[0].bita], { type: "application/pdf" }), `${nama}.pdf`);
          teksHasil = u.ok ? `${hasil.length} perkara digabung menjadi satu PDF (${potongan[0].halaman} halaman): "${nama}.pdf".` : `PDF gabungan gagal diunduh: ${u.pesan}`;
        } else {
          const pakai = new Set();
          const zip = buatZip(potongan.map((p, i) => ({ nama: namaUnik(`${nama} bagian ${i + 1}.pdf`, pakai), bita: p.bita })));
          const u = await d.unduh(new Blob([zip], { type: "application/zip" }), `${nama}.zip`);
          teksHasil = u.ok ? `${hasil.length} perkara terlalu besar untuk satu PDF; hasil dibagi ${potongan.length} PDF di dalam "${nama}.zip".` : `ZIP gagal diunduh: ${u.pesan}`;
        }
      } else {
        const pakai = new Set();
        const zip = buatZip(hasil.map((x) => ({ nama: namaUnik(x.h.namaRtf, pakai), bita: x.h.rtf })));
        const u = await d.unduh(new Blob([zip], { type: "application/zip" }), `${nama}.zip`);
        teksHasil = u.ok ? `${hasil.length} naskah RTF dalam satu ZIP: "${nama}.zip".` : `ZIP gagal diunduh: ${u.pesan}`;
      }
    } catch (e) {
      // Penggabung PDF tidak tersedia (server belum diperbarui) atau gagal: PDF tiap perkara tetap diberikan dalam satu ZIP.
      try {
        const pakai = new Set();
        const zip = buatZip(hasil.map((x) => ({ nama: namaUnik(x.h.namaPdf || x.h.namaRtf, pakai), bita: x.h.pdf || x.h.rtf })));
        const u = await d.unduh(new Blob([zip], { type: "application/zip" }), `${nama}.zip`);
        teksHasil = u.ok ? `PDF tidak dapat digabung (${String((e && e.message) || e)}); PDF tiap perkara diberikan dalam satu ZIP "${nama}.zip".` : `ZIP gagal diunduh: ${u.pesan}`;
      } catch (e2) {
        teksHasil = `Hasil tidak dapat disimpan: ${String((e2 && e2.message) || e2)}`;
      }
    }
    return teksHasil;
  }

  // ───────────────────────────────────────────────────────
  // K14 - berkas dikerjakan server (hanya bila Super Admin menyalakan saklar berkasDiServer; mati = jalur lama di atas)
  // ───────────────────────────────────────────────────────
  const serverBerkas = () => globalThis.ALETA_BERKAS_SERVER || null;
  /**
   * Menyuruh server menyusun hasil dari naskah yang sudah terkirim, menunggu, lalu mengunduh hasil jadi.
   * Pulang { ok, teks }. ok:false = server gagal; pemanggil memakai jalur lama dari naskah yang masih dipegang peramban.
   */
  async function rakitServer(B, kerja, hasil, d, nama) {
    try {
      const mulai = await B.mulai(kerja.id);
      if (!mulai) return { ok: false, teks: "" };
      M.ringkasan = { judul: "Server menyusun hasil", teks: "Naskah sudah di server. Anda boleh menutup halaman ini; hasil menunggu di server dan muncul lagi di jendela Cetak massal.", cek: [], gagal: [] };
      gambar();
      const akhir = await B.tunggu(kerja.id, {
        padaKabar: (s) => {
          M.ringkasan = { judul: "Server menyusun hasil", teks: `${s.selesaiButir} dari ${s.jumlahButir} naskah diperiksa. Anda boleh menutup halaman ini; hasil menunggu di server.`, cek: [], gagal: [] };
          gambar();
        },
      });
      if (!akhir || akhir.status !== "selesai" || !akhir.hasil) return { ok: false, teks: "" };
      const blob = await B.unduh(kerja.id);
      if (!blob) return { ok: false, teks: "" };
      const u = await d.unduh(blob, akhir.hasil.nama);
      // Naskah yang masih berisi sisa blangko / perbaikan (diperiksa server) ditandai "Perlu dicek".
      const perluDicek = new Set((akhir.perluDicek || []).map((x) => x.nama));
      for (const x of hasil) {
        if (perluDicek.has(x.h.namaRtf)) {
          x.baris.status = "cek";
          x.baris.catatan = "Naskah masih berisi sisa blangko atau catatan perbaikan (diperiksa server).";
        }
      }
      void B.hapus(kerja.id);
      return { ok: true, teks: u.ok ? `${akhir.ringkasan} Disusun di server: "${akhir.hasil.nama}".` : `Hasil dari server gagal diunduh: ${u.pesan}` };
    } catch {
      return { ok: false, teks: "" };
    }
  }
  /** PDF yang belum ada (server ditinggalkan di tengah jalan) dibuat di peramban lewat jalur lama. */
  async function lengkapiPdfLokal(hasil, d) {
    for (const x of hasil) {
      if (x.h.pdf) continue;
      x.h = await d.cetakSatu(x.baris.item, { pdf: true, ttd: M.ttd, isiOto: false });
    }
  }

  async function cetakSemua() {
    const dipilih = awal("cetak");
    if (!dipilih) return;
    const d = driver();
    const pdf = M.format === "pdf";
    gambar();
    const hasil = [];
    const gagal = [];
    // K14: bila server sanggup, naskah dikirim ke sana dan hasil jadi diterima kembali. Tanda tangan sah dibubuhkan
    // di peramban (gambar tanda tangan tidak dikirim), jadi PDF bertanda tangan tetap memakai jalur lama.
    const B = serverBerkas();
    let kerjaServer = null;
    if (B && (!pdf || !M.ttd)) {
      try {
        kerjaServer = await B.buat({ format: pdf ? "pdf" : "rtf", nama: `Cetak massal - ${NAMA_BERKAS_JENIS[M.jenis]} - ${M.tanggal}` });
      } catch {
        kerjaServer = null;
      }
    }
    try {
      await d.siramSimpan();
      if (!M.potret) M.potret = d.potret();
      for (const b of dipilih) {
        if (M.henti) break;
        b.status = "jalan";
        M.kemajuan.sekarang = nomorPendek(b.nomor);
        segarkanBaris();
        try {
          const h = await d.cetakSatu(b.item, { pdf: pdf && !kerjaServer, ttd: pdf && M.ttd && !kerjaServer, isiOto: false });
          const n = nilaiKeadaan(h.keadaan);
          // Cetak selesai walau ada yang perlu dicek: naskah tetap ikut, perkaranya ditandai supaya diperiksa.
          b.status = n.status === "cek" ? "cek" : "selesai";
          b.catatan = n.catatan;
          b.keadaan = h.keadaan;
          b.pernah = new Date().toTimeString().slice(0, 5).replace(":", ".");
          M.pernah.set(`${b.nomor}|${tanpaRtf(b.berkas)}`, b.pernah);
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) void Promise.resolve(chrome.storage.local.set({ [`${K_CETAK_BLANGKO}:${b.nomor}|${tanpaRtf(b.berkas)}`]: b.pernah })).catch(() => undefined);
          hasil.push({ baris: b, h });
          if (kerjaServer) {
            const diterima = await B.kirimButir(kerjaServer.id, { nama: h.namaRtf, bita: h.rtf }).catch(() => false);
            if (!diterima) {
              // Server menolak / putus: tinggalkan, sisanya memakai jalur lama (PDF yang belum ada dibuat ulang di peramban).
              void B.hapus(kerjaServer.id);
              kerjaServer = null;
            }
          }
        } catch (e) {
          b.status = "gagal";
          b.catatan = String((e && e.message) || e);
          gagal.push({ nomor: b.nomor, sebab: b.catatan });
        }
        M.kemajuan.selesai += 1;
        cerminAntrean(dipilih, M.kemajuan.selesai, false);
        segarkanBaris();
        if (!M.henti) await jeda();
      }
    } finally {
      await selesaiJalan();
    }
    let teksHasil = "";
    if (hasil.length) {
      const nama = `Cetak massal - ${NAMA_BERKAS_JENIS[M.jenis]} - ${M.tanggal}`;
      let selesaiServer = false;
      if (kerjaServer && !M.henti) {
        const r = await rakitServer(B, kerjaServer, hasil, d, nama);
        if (r.ok) {
          teksHasil = r.teks;
          selesaiServer = true;
        }
      }
      if (!selesaiServer) {
        if (kerjaServer) void B.hapus(kerjaServer.id);
        if (pdf) {
          try {
            await lengkapiPdfLokal(hasil, d);
          } catch {
            /* PDF yang tidak dapat dibuat jatuh ke ZIP RTF di rakitLokal */
          }
        }
        teksHasil = await rakitLokal(hasil, pdf, d, nama);
      }
    }
    // K15: selesai bersih = salinan di server ditutup; dihentikan/ada yang gagal = keadaan terakhir disalin supaya dapat dilanjutkan.
    M.pulih = null;
    if (!M.henti && gagal.length === 0) akhiriCermin();
    else cerminAntrean(dipilih, dipilih.filter((b) => b.status === "selesai" || b.status === "cek").length, true);
    const cek = dipilih.filter((b) => b.status === "cek");
    // Yang gagal tercentang kembali supaya dapat diulang; yang berhasil dilepas.
    M.pilih = new Set(dipilih.filter((b) => b.status === "gagal").map((b) => b.id));
    M.ringkasan = {
      judul: M.henti ? "Dihentikan" : gagal.length ? "Selesai, ada yang gagal" : "Selesai",
      teks: `${hasil.length} dari ${dipilih.length} berhasil dicetak.${gagal.length ? ` ${gagal.length} gagal.` : ""}${M.henti ? " Dihentikan oleh Anda." : ""} ${teksHasil}`.trim(),
      cek,
      gagal,
    };
    gambar();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Membuka dan menutup
  // ──────────────────────────────────────────────────────────────────────────
  function sambungkan() {
    const akar = el("bd-massal-modal");
    if (!akar || akar.dataset.terpasang) return;
    akar.dataset.terpasang = "1";
    akar.addEventListener("click", (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const pil = t.closest("[data-mspil]");
      if (pil) {
        const [kelompok, ...sisa] = pil.getAttribute("data-mspil").split("|");
        const b = M.baris.find((x) => M.picker && x.id === M.picker.id);
        if (b) {
          pasangBlangko(b, kelompok, sisa.join("|"));
          b.keadaan = null;
        }
        M.picker = null;
        return gambar();
      }
      const ganti = t.closest("[data-msganti]");
      if (ganti) {
        M.picker = { id: ganti.getAttribute("data-msganti"), cari: "" };
        gambar();
        const c = el("bd-ms-cariblangko");
        if (c) c.focus();
        return;
      }
      const aksi = t.closest("[data-ms]");
      const kode = aksi ? aksi.getAttribute("data-ms") : "";
      if (kode === "tutup") return tutup();
      if (kode === "tutuppicker") {
        M.picker = null;
        return gambar();
      }
      if (kode === "hariini") {
        M.tanggal = tanggalLokal();
        M.sampai = "";
        return void muat();
      }
      if (kode === "muat") return void muat();
      if (kode === "pilihsiap") return pilihSiap();
      if (kode === "kosongkan") {
        M.pilih = new Set();
        return gambar();
      }
      if (kode === "isi") return void isiSemua();
      if (kode === "cetak") return void cetakSemua();
      if (kode === "srv-unduh" || kode === "srv-hapus") {
        const idSrv = aksi.getAttribute("data-srv");
        const B = serverBerkas();
        if (!B || !idSrv) return;
        if (kode === "srv-hapus") {
          void B.hapus(idSrv).then(() => muatHasilServer().then(gambar));
          return;
        }
        void (async () => {
          const item = (M.hasilServer || []).find((x) => x.id === idSrv);
          const blob = await B.unduh(idSrv);
          const d2 = driver();
          if (blob && item && d2) await d2.unduh(blob, item.hasil.nama);
          else toast("Hasil tidak dapat diunduh; mungkin sudah kedaluwarsa.");
          await muatHasilServer();
          gambar();
        })();
        return;
      }
      if (kode === "henti") {
        M.henti = true;
        return gambar();
      }
    });
    akar.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.id === "bd-ms-tgl") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) {
          M.tanggal = t.value;
          void muat();
        }
        return;
      }
      if (t.id === "bd-ms-sampai") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) {
          M.sampai = t.value;
          void muat();
        }
        return;
      }
      if (t.hasAttribute && t.hasAttribute("data-msptsp")) {
        const label = t.getAttribute("data-msptsp");
        const sisa = M.penetapan.filter((x) => x !== label);
        // Paling sedikit satu penetapan harus tercentang; kotak terakhir tidak bisa dimatikan.
        if (!t.checked && !sisa.length) {
          toast("Pilih paling sedikit satu penetapan.");
          return gambar();
        }
        M.penetapan = POLA_PTSP.map((x) => x.label).filter((x) => (x === label ? t.checked : sisa.includes(x)));
        return void muat();
      }
      if (t.id === "bd-ms-jenis") {
        M.jenis = t.value;
        M.semua = false;
        M.semuaSidang = false;
        return void muat();
      }
      if (t.id === "bd-ms-semua") {
        M.semua = t.checked;
        return void muat();
      }
      if (t.id === "bd-ms-semuasidang") {
        M.semuaSidang = t.checked;
        return void muat();
      }
      if (t.id === "bd-ms-ttd") {
        M.ttd = t.checked;
        return;
      }
      if (t.name === "bd-ms-format") {
        M.format = t.value === "pdf" ? "pdf" : "rtf";
        return gambar();
      }
      if (t.hasAttribute && t.hasAttribute("data-mscek")) {
        const id = t.getAttribute("data-mscek");
        if (t.checked) M.pilih.add(id);
        else M.pilih.delete(id);
        const h = el("bd-ms-hitung");
        if (h) h.textContent = `${M.pilih.size} dipilih dari ${M.baris.length}${M.pilih.size > BATAS_DOKUMEN ? ` · paling banyak ${BATAS_DOKUMEN} sekali jalan` : ""}`;
        return gambar();
      }
    });
    akar.addEventListener("input", (e) => {
      const t = e.target;
      if (t && t.id === "bd-ms-cariblangko" && M.picker) {
        M.picker.cari = t.value;
        const posisi = t.selectionStart;
        gambar();
        const c = el("bd-ms-cariblangko");
        if (c) {
          c.focus();
          try {
            c.setSelectionRange(posisi, posisi);
          } catch {
            /* tipe input tanpa seleksi */
          }
        }
      }
    });
    akar.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && M.jalan === "") {
        if (M.picker) {
          M.picker = null;
          gambar();
        } else tutup();
        e.stopPropagation();
      }
    });
  }
  function tutup() {
    if (M.jalan !== "") return;
    M.terbuka = false;
    const akar = el("bd-massal-modal");
    if (akar) {
      akar.hidden = true;
      akar.innerHTML = "";
    }
  }
  async function buka() {
    const a = api();
    const d = driver();
    if (!a || !d) return toast("Cetak massal belum siap. Muat ulang halaman ABT.");
    const dasar = typeof a.akar === "function" ? a.akar() : document.getElementById("aleta-bd-akar");
    if (!dasar) return;
    if (typeof a.muatHak === "function") await Promise.resolve(a.muatHak()).catch(() => undefined);
    // Menu Derry dibaca dulu: folder PTSP baru terhitung berhak sesudah menu akun terbaca.
    await d.menu("").catch(() => undefined);
    const ada = jenisBoleh();
    if (!ada.length) return toast("Peran akun Anda tidak punya blangko untuk dicetak massal.");
    let akar = el("bd-massal-modal");
    if (!akar) {
      akar = document.createElement("div");
      akar.id = "bd-massal-modal";
      akar.className = "bd-modal bd-ms";
      dasar.appendChild(akar);
    }
    akar.hidden = false;
    sambungkan();
    M.terbuka = true;
    if (!M.jenis || !ada.includes(M.jenis)) M.jenis = jenisBawaan(ada);
    M.tanggal = M.tanggal || tanggalLokal();
    // 28 Okt 2026: daftar perkara PTSP sedang "tanggal tertentu" / "rentang tanggal" -> Cetak massal PTSP memulai dari rentang yang sama.
    const kd = typeof a.keadaan === "function" ? a.keadaan() : null;
    if (M.jenis === "ptsp" && kd && kd.ptspDaftar && kd.rentang && kd.rentang.dari) {
      M.tanggal = kd.rentang.dari;
      M.sampai = kd.rentang.sampai || kd.rentang.dari;
    }
    M.picker = null;
    M.ringkasan = null;
    gambar();
    void muat();
  }

  const apiMassal = {
    versi: "20okt",
    buka,
    tutup,
    /** Jeda antar dokumen (milidetik; 0-10000). Bawaan 1200: ABT tidak dikeroyok. */
    atur(o) {
      if (o && Number.isFinite(Number(o.jedaMs))) jedaMs = Math.min(10000, Math.max(0, Number(o.jedaMs)));
    },
    keadaan: () => ({ terbuka: M.terbuka, jenis: M.jenis, tanggal: M.tanggal, sampai: M.jenis === "ptsp" ? sampaiPtsp() : "", penetapan: M.penetapan.slice(), format: M.format, ttd: M.ttd, pilih: Array.from(M.pilih), jalan: M.jalan, baris: M.baris.map((b) => ({ id: b.id, nomor: b.nomor, status: b.status, berkas: b.berkas, kelompok: b.kelompok, catatan: b.catatan, label: b.label })) }),
    murni: { buatZip, crc32, namaUnik, barisDariPerkara, nilaiKeadaan, pihakRingkas, beragendaPutus, batas: { dokumen: BATAS_DOKUMEN, jedaMs: JEDA_MS } },
  };
  globalThis.aletaBlangkoDerryMassal = apiMassal;

  function mulai() {
    const a = api();
    if (!a || typeof a.pasangMassal !== "function") return false;
    a.pasangMassal(buka);
    return true;
  }
  if (!mulai()) {
    // blangko-derry.js belum terpasang (urutan muat lain): coba lagi sebentar.
    let coba = 0;
    const ulang = setInterval(() => {
      coba += 1;
      if (mulai() || coba > 40) clearInterval(ulang);
    }, 250);
  }
})();
