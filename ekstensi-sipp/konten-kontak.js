"use strict";

/**
 * ============================================================================
 * KONTAK & PEKERJAAN PIHAK DI BLANGKO PIHAK/KUASA SIPP (K11)
 * ============================================================================
 *
 * Blok KONTAK-EC (k5*) dan PEKERJAAN-PIHAK (pk*) konten.js yang lama: lajur kontak e-Court dan usulan
 * pekerjaan di blangko form#frm_ref_pihak / form#frm_ref_pengacara. Keduanya memulai dirinya sendiri
 * (k5Mulai(); pkMulai(); di ujung berkas) dan baru berguna bila blangko itu ada di halaman, jadi dimuat
 * modul-malas.js hanya ketika blangkonya muncul (bersama saksiscan.js dan pihak-lengkap.js).
 * Potongan UTUH kode lama; tidak ada pernyataan yang diubah.
 */


/* === KONTAK-EC 11 Okt === */
/**
 * ============================================================================
 * KONTAK-EC (11 Okt 2026, agen 5): EMAIL & NOMOR HP/WA DARI e-COURT KE BLANGKO SIPP
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan deteksi email dan nomor whatsapp dari e-court
 * untuk dimasukkan datanya ke sipp dan abt".
 *
 * Saat blangko "Data Pihak" (form#frm_ref_pihak) atau "Data Pengacara"
 * (form#frm_ref_pengacara) SIPP terbuka, lajur di ATAS blangko menampilkan
 * email dan nomor HP/WA orang itu menurut e-Court (akun e-Court + surat
 * gugatan/kuasa/jawab-menjawab yang diarsipkan ALETA), lengkap dengan
 * sumbernya, keyakinannya, dan bedanya dengan isian blangko sekarang.
 *
 *   - Medan blangko KOSONG  -> tombol "Isi" (satu klik petugas).
 *   - Medan SAMA            -> "sudah sama", tanpa tombol.
 *   - Medan BERISI LAIN     -> tidak pernah diganti diam-diam: petugas harus
 *                              mencentang "ganti isian blangko" lebih dulu.
 *
 * ALETA hanya MENGISI medan lewat jembatan.js; Simpan tetap ditekan petugas.
 * Tidak ada atribut/kelas/teks ALETA di medan SIPP - lajurnya berdiri di luar
 * blangko. Nomor sudah dinormalkan bot ke 08xxxxxxxxxx (borang SIPP: numeric).
 * Gerbang sama dengan bantu data saksi: tampilan UI Baru (saksiscanModeUi).
 *
 * GET /aleta/api/aleta-ecourt/kontak-pihak?nomor=&nama=&teks=1
 */
const K5_API_KONTAK = "/aleta/api/aleta-ecourt/kontak-pihak";
const K5_JEDA_PANTAU_MS = 900;
const K5_BORANG = Object.freeze([
  { penunjuk: "form#frm_ref_pihak", nama: "#pihak_fullname", email: "#pihak_email", hp: "#pihak_no_tlp", jenis: "pihak" },
  { penunjuk: "form#frm_ref_pengacara", nama: "#pengacara_fullname", email: "#pengacara_email", hp: "#pengacara_no_tlp", jenis: "kuasa" },
]);
const K5_LABEL_KEYAKINAN = { pasti: "pasti", cukup: "cukup - periksa", ragu: "ragu - periksa dulu" };

/** Nama tanpa "bin/binti ..." dan gelar, huruf kecil - pembanding yang sama dengan bot (bakuNama). */
function k5BakuNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/\b(?:bin|binti)\b.*$/, "")
    .replace(/,?\s*\b(?:s\.?\s?h|m\.?\s?h|s\.?\s?h\.?\s?i|s\.?\s?ag|m\.?\s?kn|s\.?\s?e|s\.?\s?pd|h|hj|dr|ir|drs)\b\.?/g, " ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Orang di jawaban bot yang namanya sama dengan nama di blangko; golongan blangko didahulukan. */
function k5CariOrang(orang, nama, jenis) {
  const n = k5BakuNama(nama);
  if (!n) return null;
  const sama = (Array.isArray(orang) ? orang : []).filter((o) => o && k5BakuNama(o.nama) === n);
  return sama.find((o) => o.jenis === jenis) || sama[0] || null;
}

/** Nomor di medan blangko -> bentuk 08... untuk dibandingkan (SIPP kadang "+62 812-..."). */
function k5BakuNomor(teks) {
  let d = String(teks || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  return d;
}

/** "kosong" | "sama" | "beda" - isian blangko SEKARANG dibanding usulan. */
function k5Keadaan(kolom, nilaiBlangko, usulan) {
  const kini = String(nilaiBlangko || "").trim();
  if (!kini || kini === "-") return "kosong";
  if (kolom === "email") return kini.toLowerCase() === String(usulan || "").toLowerCase() ? "sama" : "beda";
  return k5BakuNomor(kini).includes(k5BakuNomor(usulan)) ? "sama" : "beda";
}

/** Baris yang digambar untuk satu orang (murni - diuji tanpa DOM). */
function k5BarisUsulan(o, blangko) {
  const baris = [];
  if (!o || !o.usulan) return baris;
  for (const kolom of ["email", "hp"]) {
    const u = o.usulan[kolom];
    if (!u || !u.nilai) continue;
    const keadaan = k5Keadaan(kolom, blangko && blangko[kolom], u.nilai);
    baris.push({
      kolom,
      label: kolom === "email" ? "Email" : u.jenisNomor === "telepon" ? "Telepon (bukan WhatsApp)" : "No. HP/WA",
      nilai: u.nilai,
      keadaan,
      keyakinan: u.keyakinan || "ragu",
      sumber: (Array.isArray(u.sumber) ? u.sumber : []).map((s) => s && s.label).filter(Boolean),
      kutipan: (Array.isArray(u.sumber) && u.sumber[0] && u.sumber[0].kutipan) || "",
      lain: Array.isArray(u.nilaiLain) ? u.nilaiLain : [],
      terlaluPanjang: Boolean(u.terlaluPanjang),
      // Medan berisi lain diganti hanya sesudah petugas mencentang konfirmasi.
      perluKonfirmasi: keadaan === "beda",
    });
  }
  return baris;
}

const k5Keadaan_ = { lajur: null, borangEl: null, kunci: "", kunciCalon: "", sejak: 0, hasil: null, janji: null, pantau: null, jam: null, pengamat: null };

function k5BolehTampil() {
  try {
    return typeof saksiscanModeUi === "function" && saksiscanModeUi();
  } catch {
    return false;
  }
}

function k5BorangTerbuka() {
  for (const b of K5_BORANG) {
    const f = document.querySelector(b.penunjuk);
    if (f && typeof saksiscanTampak === "function" && saksiscanTampak(f)) return { b, f };
  }
  return null;
}

async function k5Ambil(nomor, nama) {
  const q = new URLSearchParams({ teks: "1" });
  if (nomor) q.set("nomor", nomor);
  if (nama) q.set("nama", nama);
  const alamat = `${K5_API_KONTAK}?${q.toString()}`;
  try {
    const o = { credentials: "include", cache: "no-store" };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, o, "Membaca kontak e-Court") : await fetch(alamat, o);
    if (r.status === 404) return { ok: false, pesan: "Server ALETA belum mengenal kontak e-Court (perlu pembaruan)." };
    if (r.status === 423) return { ok: false, pesan: "Ditahan mode coba - tidak ada yang dikirim ke ALETA." };
    if (r.status === 401 || r.status === 403) return { ok: false, pesan: "Belum masuk portal ALETA, atau peran ini tidak diberi akses panel." };
    const luar = await r.json().catch(() => null);
    const isi = luar && luar.data ? luar.data : luar;
    if (!r.ok || !isi) return { ok: false, pesan: `Server ALETA menjawab ${r.status}.` };
    return { ok: true, isi };
  } catch {
    return { ok: false, pesan: "Server ALETA tidak dapat dihubungi." };
  }
}

function k5El(tag, kelas, teks) {
  return typeof saksiscanEl === "function" ? saksiscanEl(tag, kelas, teks) : Object.assign(document.createElement(tag), { className: kelas || "", textContent: teks == null ? "" : String(teks) });
}

async function k5Isi(b, kolom, nilai) {
  const j = await saksiscanJembatan({ jenis: "isi", penunjuk: `${b.penunjuk} ${b[kolom]}`, jenisMedan: "teks", nilai });
  return Boolean(j && j.ok === true);
}

/** Lajur di atas blangko: satu baris per kolom (email, HP), dengan tombol isi / konfirmasi ganti. */
function k5Gambar(lajur, b, f, hasil, pesan) {
  lajur.textContent = "";
  lajur.appendChild(k5El("div", "aleta-c2-sbantu-judul", "Kontak dari e-Court - periksa sebelum Simpan"));
  if (pesan) {
    lajur.appendChild(k5El("div", "aleta-c2-sbantu-lembut", pesan));
    return;
  }
  const nama = String((f.querySelector(b.nama) || {}).value || "").trim();
  const o = hasil ? k5CariOrang(hasil.orang, nama, b.jenis) : null;
  if (!o) {
    lajur.appendChild(
      k5El(
        "div",
        "aleta-c2-sbantu-lembut",
        hasil && hasil.ada
          ? `Nama di blangko tidak sama dengan ${b.jenis === "kuasa" ? "kuasa" : "pihak"} perkara ${hasil.nomorPerkara || "ini"} - tidak ada usulan kontak.`
          : (hasil && hasil.catatan && hasil.catatan[0]) || "Tidak ada data kontak e-Court untuk nama ini."
      )
    );
    return;
  }
  const blangko = { email: String((f.querySelector(b.email) || {}).value || ""), hp: String((f.querySelector(b.hp) || {}).value || "") };
  const baris = k5BarisUsulan(o, blangko);
  if (!baris.length) {
    lajur.appendChild(k5El("div", "aleta-c2-sbantu-lembut", "e-Court tidak memuat email atau nomor HP orang ini."));
    return;
  }
  for (const x of baris) {
    const wadah = k5El("div", "aleta-c2-sbantu-baris");
    wadah.appendChild(k5El("span", "aleta-c2-sbantu-hasil", `${x.label}: ${x.nilai}`));
    wadah.appendChild(k5El("span", "aleta-c2-sbantu-lembut", `(${K5_LABEL_KEYAKINAN[x.keyakinan] || x.keyakinan}; ${x.sumber.join("; ") || "e-Court"})`));
    if (x.keadaan === "sama") {
      wadah.appendChild(k5El("span", "aleta-c2-sbantu-lembut", "- sudah sama di blangko"));
    } else if (x.terlaluPanjang) {
      wadah.appendChild(k5El("span", "aleta-c2-sbantu-peringatan", "- lebih dari 50 huruf, tidak muat di kolom SIPP"));
    } else {
      const tombol = k5El("button", "aleta-tombol", x.keadaan === "kosong" ? "Isi" : "Ganti isian blangko");
      tombol.type = "button";
      let konfirmasi = null;
      if (x.perluKonfirmasi) {
        const label = k5El("label", "aleta-c2-sbantu-saklar");
        konfirmasi = document.createElement("input");
        konfirmasi.type = "checkbox";
        label.appendChild(konfirmasi);
        label.appendChild(k5El("span", "", ` Ya, ganti "${blangko[x.kolom]}" dengan nilai e-Court`));
        wadah.appendChild(label);
        tombol.disabled = true;
        konfirmasi.addEventListener("change", () => {
          tombol.disabled = !konfirmasi.checked;
        });
      }
      tombol.addEventListener("click", async () => {
        if (konfirmasi && !konfirmasi.checked) return;
        tombol.disabled = true;
        const berhasil = await k5Isi(b, x.kolom, x.nilai);
        tombol.textContent = berhasil ? "Terisi - tekan Simpan SIPP" : "Gagal mengisi - ketik manual";
      });
      wadah.appendChild(tombol);
    }
    if (x.kutipan) wadah.title = x.kutipan;
    if (x.lain.length) wadah.appendChild(k5El("span", "aleta-c2-sbantu-lembut", ` Nilai lain di e-Court: ${x.lain.join(", ")}`));
    lajur.appendChild(wadah);
  }
  lajur.appendChild(k5El("div", "aleta-c2-sbantu-lembut", "Isian blangko yang sudah berisi tidak diganti tanpa centang. Simpan tetap Anda yang menekan."));
}

/**
 * Lajur di atas blangko - lajur bantu data saksi (aleta-c2-sbantu) juga ingin
 * berdiri TEPAT di atas blangko yang sama. Posisi dianggap benar bila di antara
 * lajur ini dan blangko hanya ada lajur ALETA lain; tanpa itu keduanya saling
 * memindahkan diri tanpa henti.
 */
function k5PosisiBenar(lajur, f) {
  if (!lajur || !f || !lajur.isConnected || lajur.parentElement !== f.parentElement) return false;
  for (let s = lajur.nextElementSibling; s; s = s.nextElementSibling) {
    if (s === f) return true;
    if (!s.classList || !s.classList.contains("aleta-c2-sbantu")) return false;
  }
  return false;
}

async function k5Periksa() {
  const terbuka = k5BolehTampil() ? k5BorangTerbuka() : null;
  if (!terbuka) {
    if (k5Keadaan_.lajur && k5Keadaan_.lajur.isConnected) k5Keadaan_.lajur.remove();
    k5Keadaan_.borangEl = null;
    return false;
  }
  const { b, f } = terbuka;
  if (!k5Keadaan_.lajur) k5Keadaan_.lajur = k5El("div", "aleta-c2-sbantu aleta-c2-sbantu-ref aleta-k5-kontak");
  const lajur = k5Keadaan_.lajur;
  if (!k5PosisiBenar(lajur, f) && f.parentElement) f.parentElement.insertBefore(lajur, f);
  const nama = String((f.querySelector(b.nama) || {}).value || "").replace(/\s+/g, " ").trim();
  let nomor = "";
  try {
    nomor = typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
  } catch {
    nomor = "";
  }
  const kunci = `${nomor}|${k5BakuNama(nama)}`;
  if (!k5BakuNama(nama)) {
    k5Gambar(lajur, b, f, null, "Ketik/pilih nama dulu - kontak e-Court dicari menurut nama.");
    return true;
  }
  // Nama yang masih diketik tidak dicari tiap huruf: tunggu tenang sesaat.
  if (kunci !== k5Keadaan_.kunciCalon) {
    k5Keadaan_.kunciCalon = kunci;
    k5Keadaan_.sejak = Date.now();
    return true;
  }
  if (kunci !== k5Keadaan_.kunci && Date.now() - k5Keadaan_.sejak < 700) return true;
  if (kunci !== k5Keadaan_.kunci) {
    k5Keadaan_.kunci = kunci;
    lajur.dataset.potret = "";
    k5Keadaan_.hasil = null;
    k5Gambar(lajur, b, f, null, "Mencari email dan nomor HP di e-Court…");
    const janji = k5Ambil(nomor, nama);
    k5Keadaan_.janji = janji;
    const j = await janji;
    if (k5Keadaan_.janji !== janji) return true;
    k5Keadaan_.hasil = j.ok ? j.isi : { ada: false, orang: [], catatan: [j.pesan] };
  }
  if (k5Keadaan_.hasil) {
    // Digambar ulang hanya bila isian medan berubah (SIPP mengisi lewat .val() tanpa peristiwa).
    const potret = `${kunci}|${(f.querySelector(b.email) || {}).value || ""}|${(f.querySelector(b.hp) || {}).value || ""}`;
    if (potret !== lajur.dataset.potret) {
      lajur.dataset.potret = potret;
      k5Gambar(lajur, b, f, k5Keadaan_.hasil, "");
    }
  }
  return true;
}

/**
 * Pemantau hanya hidup selama blangko terbuka: pengamat DOM (seperti bantu
 * data saksi) memeriksa sekali bila halaman berubah; selama blangko tampak,
 * isian medan dibaca ulang tiap 0,9 detik (SIPP mengisinya lewat .val() tanpa
 * peristiwa) dan pewaktunya berhenti begitu blangko tertutup.
 */
function k5Pantau(ada) {
  if (ada && !k5Keadaan_.pantau) {
    k5Keadaan_.pantau = (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.interval : (f, m) => setInterval(f, m))(() => {
      void k5Periksa()
        .then((masih) => {
          if (!masih) k5Pantau(false);
        })
        .catch(() => k5Pantau(false));
    }, K5_JEDA_PANTAU_MS);
  } else if (!ada && k5Keadaan_.pantau) {
    (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.hapus : (i) => clearInterval(i))(k5Keadaan_.pantau);
    k5Keadaan_.pantau = null;
  }
}

function k5Jadwalkan() {
  if (k5Keadaan_.jam) return;
  k5Keadaan_.jam = setTimeout(() => {
    k5Keadaan_.jam = null;
    void k5Periksa()
      .then((ada) => k5Pantau(ada))
      .catch(() => k5Pantau(false));
  }, 400);
}

function k5Mulai() {
  if (typeof document === "undefined" || !document.body || globalThis.__aletaK5Terpasang) return false;
  globalThis.__aletaK5Terpasang = true;
  try {
    k5Keadaan_.pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
      const luar = daftar.some((m) => !(m.target && m.target.closest && m.target.closest(".aleta-k5-kontak")));
      if (luar) k5Jadwalkan();
    });
    k5Keadaan_.pengamat.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  } catch {
    /* tanpa pengamat: tidak ada lajur kontak - SIPP tetap seperti biasa */
  }
  k5Jadwalkan();
  return true;
}
/* K5 mulai */
k5Mulai();
/* === AKHIR KONTAK-EC === */

/* === PEKERJAAN 11 Okt === */
/**
 * ============================================================================
 * PEKERJAAN (11 Okt 2026, agen 7): PILIHAN PEKERJAAN DI BLANGKO DATA PIHAK SIPP
 * ============================================================================
 *
 * Permintaan pengguna: "kadang petugas mengisi kerjaannya itu lainnya tetapi di
 * isi PNS/POLRI/TNI/BUMN/BUMD, buat deteksi otomatis bagi manual di isi
 * lainnya dan tautkan sesuai (PPPK gabung dengan PNS pertimbangan PNS)".
 * Revisi 11 Okt: PPPK berkalimat sendiri "Aparatur Sipil Negara (PPPK)" - SIPP tidak
 * punya pilihannya, jadi PPPK TIDAK ditawari "Pegawai Negeri Sipil" (biarkan Lain-Lain).
 *
 * Blangko pihak SIPP pengadilan agama (pihak_list.php, jenis_pengadilan 4):
 * pilihan #apakahtni (1 Tentara Nasional Indonesia, 3 Pegawai Negeri Sipil,
 * 4 Pegawai BUMN/BUMD, 5 POLRI, 2 Lain-Lain) + uraian #pihak_pekerjaan yang
 * hanya tersimpan bila Lain-Lain. Bila petugas memilih Lain-Lain lalu mengetik
 * "ASN Dinas Pendidikan" / "PPPK (Guru SDN ...)" / "Anggota Polri", lajur ini
 * menyebut kategori yang terbaca (kamus pekerjaan.json di bot - aturan yang
 * sama dengan kueri ABT 8510/8524/8533) dan MENAWARKAN pilihan yang sesuai.
 *
 *   - Tidak pernah mengganti diam-diam: tombol mati sampai petugas mencentang
 *     "Ya, ganti pilihan" (uraian Lain-Lain tidak ikut tersimpan SIPP).
 *   - ALETA hanya memilih #apakahtni lewat jembatan.js; Simpan ditekan petugas.
 *   - Pensiunan/mantan/honorer/kontrak/swasta: hanya keterangan "tidak dibaca
 *     sebagai PNS ...", tanpa tombol. Perangkat desa: tidak ada pilihannya di
 *     SIPP - keterangan saja (ABT tetap membacanya dari teks).
 *   - Tanpa tanda ALETA di medan SIPP; lajur berdiri di luar blangko. Gerbang
 *     sama dengan bantu data saksi / kontak e-Court: tampilan UI Baru.
 *
 * GET /aleta/api/aleta-ecourt/pekerjaan-pihak?teks=...
 */
const PK_API = "/aleta/api/aleta-ecourt/pekerjaan-pihak";
const PK_JEDA_PANTAU_MS = 900;
const PK_BORANG = "form#frm_ref_pihak";
/** Kategori bot -> nilai #apakahtni SIPP (pihak_list.php: switch($apakahtni)). */
const PK_NILAI_PILIHAN = Object.freeze({ TNI: "1", PNS: "3", BUMN: "4", BUMD: "4", POLRI: "5" });
const PK_TULISAN_PILIHAN = Object.freeze({ 1: "Tentara Nasional Indonesia", 3: "Pegawai Negeri Sipil", 4: "Pegawai BUMN/BUMD", 5: "POLRI", 2: "Lain-Lain" });

/**
 * Rencana lajur dari keadaan blangko + jawaban bot. Murni (diuji tanpa DOM).
 * @param {{pilihan: string|null, uraian: string}} blangko  pilihan = nilai #apakahtni (null bila tidak ada)
 * @param {object|null} hasil  satu butir jawaban bot {kunci, label, asal, teksBaku, kalimat, golongan, dasar}
 * @returns {{tampil: boolean, judul: string, keterangan: string, tombol: null|{nilai: string, tulisan: string}, perluKonfirmasi: boolean}}
 */
function pkRencana(blangko, hasil) {
  const kosong = { tampil: false, judul: "", keterangan: "", tombol: null, perluKonfirmasi: false };
  const uraian = String((blangko && blangko.uraian) || "").trim();
  const pilihan = blangko ? blangko.pilihan : null;
  // Pilihan baku sudah dipilih (bukan Lain-Lain): tidak ada yang ditawarkan.
  if (pilihan !== null && pilihan !== undefined && pilihan !== "" && pilihan !== "2") return kosong;
  if (!uraian || !hasil || !hasil.kunci) return kosong;
  const kunci = String(hasil.kunci);
  if (kunci === "LAIN" || kunci === "KOSONG") return kosong;
  const pilihanTulisan = pilihan === null || pilihan === undefined ? "teks bebas" : PK_TULISAN_PILIHAN[pilihan] || "Lain-Lain";
  const judul = `Pekerjaan terbaca: ${hasil.kalimat || kunci}${pilihan === null || pilihan === undefined ? "" : `, pilihan SIPP: ${pilihanTulisan}`}`;
  const nilai = PK_NILAI_PILIHAN[kunci];
  if (kunci === "BUKAN") {
    return { tampil: true, judul, keterangan: "Tetap Lain-Lain - kalimat izin atasan PNS/TNI/POLRI tidak dipakai ABT untuk pekerjaan ini.", tombol: null, perluKonfirmasi: false };
  }
  if (!nilai) {
    return {
      tampil: true,
      judul,
      keterangan: "SIPP tidak punya pilihan untuk pekerjaan ini - biarkan Lain-Lain; ABT (8510/8524/8533) tetap membacanya dari uraian.",
      tombol: null,
      perluKonfirmasi: false,
    };
  }
  if (pilihan === null || pilihan === undefined) {
    // Blangko tanpa #apakahtni (SIPP lain): keterangan saja.
    return { tampil: true, judul, keterangan: `ABT membacanya sebagai ${hasil.label || kunci}.`, tombol: null, perluKonfirmasi: false };
  }
  return {
    tampil: true,
    judul,
    keterangan: `ABT (8510/8524/8533) sudah membacanya sebagai ${hasil.label || kunci}. Mengganti pilihan merapikan data SIPP; uraian "${uraian}" tidak ikut tersimpan.`,
    tombol: { nilai, tulisan: PK_TULISAN_PILIHAN[nilai] },
    perluKonfirmasi: true,
  };
}

const pkKeadaan = { lajur: null, kunci: "", kunciCalon: "", sejak: 0, hasil: null, janji: null, pantau: null, jam: null, pengamat: null, singgah: new Map() };

function pkBolehTampil() {
  try {
    return typeof saksiscanModeUi === "function" && saksiscanModeUi();
  } catch {
    return false;
  }
}

function pkBorangTerbuka() {
  const f = document.querySelector(PK_BORANG);
  return f && typeof saksiscanTampak === "function" && saksiscanTampak(f) ? f : null;
}

function pkBacaBlangko(f) {
  const pilih = f.querySelector("#apakahtni");
  const uraian = f.querySelector("#pihak_pekerjaan");
  return { pilihan: pilih ? String(pilih.value || "") : null, uraian: uraian ? String(uraian.value || "") : "" };
}

async function pkAmbil(teks) {
  const t = String(teks || "").trim().slice(0, 300);
  if (pkKeadaan.singgah.has(t)) return pkKeadaan.singgah.get(t);
  const alamat = `${PK_API}?${new URLSearchParams({ teks: t }).toString()}`;
  let hasil;
  try {
    const o = { credentials: "include", cache: "no-store" };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, o, "Membaca kategori pekerjaan") : await fetch(alamat, o);
    if (r.status === 404) return { ok: false, pesan: "Server ALETA belum mengenal pembacaan pekerjaan (perlu pembaruan)." };
    if (r.status === 423) return { ok: false, pesan: "Ditahan mode coba - tidak ada yang dikirim ke ALETA." };
    if (r.status === 401 || r.status === 403) return { ok: false, pesan: "Belum masuk portal ALETA, atau peran ini tidak diberi akses panel." };
    const luar = await r.json().catch(() => null);
    const isi = luar && luar.data ? luar.data : luar;
    if (!r.ok || !isi || isi.tersedia === false) return { ok: false, pesan: (isi && isi.pesan) || `Server ALETA menjawab ${r.status}.` };
    hasil = { ok: true, isi: Array.isArray(isi.hasil) ? isi.hasil[0] || null : null };
  } catch {
    return { ok: false, pesan: "Server ALETA tidak dapat dihubungi." };
  }
  pkKeadaan.singgah.set(t, hasil);
  if (pkKeadaan.singgah.size > 200) pkKeadaan.singgah.delete(pkKeadaan.singgah.keys().next().value);
  return hasil;
}

function pkEl(tag, kelas, teks) {
  return typeof saksiscanEl === "function" ? saksiscanEl(tag, kelas, teks) : Object.assign(document.createElement(tag), { className: kelas || "", textContent: teks == null ? "" : String(teks) });
}

function pkGambar(lajur, rencana, pesan) {
  lajur.textContent = "";
  if (pesan) {
    lajur.appendChild(pkEl("div", "aleta-c2-sbantu-judul", "Pekerjaan terbaca"));
    lajur.appendChild(pkEl("div", "aleta-c2-sbantu-lembut", pesan));
    return;
  }
  lajur.appendChild(pkEl("div", "aleta-c2-sbantu-judul", rencana.judul));
  lajur.appendChild(pkEl("div", "aleta-c2-sbantu-lembut", rencana.keterangan));
  if (!rencana.tombol) return;
  const wadah = pkEl("div", "aleta-c2-sbantu-baris");
  const label = pkEl("label", "aleta-c2-sbantu-saklar");
  const centang = document.createElement("input");
  centang.type = "checkbox";
  label.appendChild(centang);
  label.appendChild(pkEl("span", "", ` Ya, ganti pilihan pekerjaan ke "${rencana.tombol.tulisan}"`));
  wadah.appendChild(label);
  const tombol = pkEl("button", "aleta-tombol", `Pilih "${rencana.tombol.tulisan}"`);
  tombol.type = "button";
  tombol.disabled = true;
  centang.addEventListener("change", () => {
    tombol.disabled = !centang.checked;
  });
  tombol.addEventListener("click", async () => {
    if (!centang.checked) return;
    tombol.disabled = true;
    const j = await saksiscanJembatan({ jenis: "isi", penunjuk: `${PK_BORANG} #apakahtni`, jenisMedan: "pilih", nilai: rencana.tombol.nilai });
    tombol.textContent = j && j.ok === true ? "Terpilih - tekan Simpan SIPP" : "Gagal memilih - pilih manual";
  });
  wadah.appendChild(tombol);
  lajur.appendChild(wadah);
}

/** Lajur berdiri tepat di atas blangko; lajur ALETA lain (kontak, bantu saksi) boleh di antaranya. */
function pkPosisiBenar(lajur, f) {
  if (!lajur || !f || !lajur.isConnected || lajur.parentElement !== f.parentElement) return false;
  for (let s = lajur.nextElementSibling; s; s = s.nextElementSibling) {
    if (s === f) return true;
    if (!s.classList || !s.classList.contains("aleta-c2-sbantu")) return false;
  }
  return false;
}

async function pkPeriksa() {
  const f = pkBolehTampil() ? pkBorangTerbuka() : null;
  if (!f) {
    if (pkKeadaan.lajur && pkKeadaan.lajur.isConnected) pkKeadaan.lajur.remove();
    return false;
  }
  const b = pkBacaBlangko(f);
  const uraian = b.uraian.replace(/\s+/g, " ").trim();
  const kunci = `${b.pilihan}|${uraian.toLowerCase()}`;
  const lain = b.pilihan === null || b.pilihan === "" || b.pilihan === "2";
  if (!lain || !uraian) {
    if (pkKeadaan.lajur && pkKeadaan.lajur.isConnected) pkKeadaan.lajur.remove();
    pkKeadaan.kunci = kunci;
    return true;
  }
  // Uraian yang masih diketik tidak dibaca tiap huruf: tunggu tenang sesaat.
  if (kunci !== pkKeadaan.kunciCalon) {
    pkKeadaan.kunciCalon = kunci;
    pkKeadaan.sejak = Date.now();
    return true;
  }
  if (kunci !== pkKeadaan.kunci && Date.now() - pkKeadaan.sejak < 700) return true;
  if (kunci !== pkKeadaan.kunci) {
    pkKeadaan.kunci = kunci;
    const janji = pkAmbil(uraian);
    pkKeadaan.janji = janji;
    const j = await janji;
    if (pkKeadaan.janji !== janji) return true;
    pkKeadaan.hasil = j;
    const rencana = j.ok ? pkRencana(b, j.isi) : null;
    if (j.ok && !rencana.tampil) {
      if (pkKeadaan.lajur && pkKeadaan.lajur.isConnected) pkKeadaan.lajur.remove();
      return true;
    }
    if (!pkKeadaan.lajur) pkKeadaan.lajur = pkEl("div", "aleta-c2-sbantu aleta-c2-sbantu-ref aleta-pk-pekerjaan");
    pkGambar(pkKeadaan.lajur, rencana, j.ok ? "" : j.pesan);
  }
  const lajur = pkKeadaan.lajur;
  if (lajur && lajur.childNodes.length && !pkPosisiBenar(lajur, f) && f.parentElement) f.parentElement.insertBefore(lajur, f);
  return true;
}

function pkPantau(ada) {
  if (ada && !pkKeadaan.pantau) {
    pkKeadaan.pantau = (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.interval : (f, m) => setInterval(f, m))(() => {
      void pkPeriksa()
        .then((masih) => {
          if (!masih) pkPantau(false);
        })
        .catch(() => pkPantau(false));
    }, PK_JEDA_PANTAU_MS);
  } else if (!ada && pkKeadaan.pantau) {
    (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.hapus : (i) => clearInterval(i))(pkKeadaan.pantau);
    pkKeadaan.pantau = null;
  }
}

function pkJadwalkan() {
  if (pkKeadaan.jam) return;
  pkKeadaan.jam = setTimeout(() => {
    pkKeadaan.jam = null;
    void pkPeriksa()
      .then((ada) => pkPantau(ada))
      .catch(() => pkPantau(false));
  }, 400);
}

function pkMulai() {
  if (typeof document === "undefined" || !document.body || globalThis.__aletaPkTerpasang) return false;
  globalThis.__aletaPkTerpasang = true;
  try {
    pkKeadaan.pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
      const luar = daftar.some((m) => !(m.target && m.target.closest && m.target.closest(".aleta-pk-pekerjaan")));
      if (luar) pkJadwalkan();
    });
    pkKeadaan.pengamat.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  } catch {
    /* tanpa pengamat: tidak ada lajur pekerjaan - SIPP tetap seperti biasa */
  }
  pkJadwalkan();
  return true;
}
/* PK mulai */
pkMulai();
/* === AKHIR PEKERJAAN === */

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("konten-kontak.js"); // K11-SELESAI
