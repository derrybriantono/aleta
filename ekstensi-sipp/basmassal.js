"use strict";

/*
 * ============================================================================
 * BAS MASSAL - BERITA ACARA SIDANG SATU TANGGAL, UNTUK PANITERA SIDANG / PP
 * (PERBAIKAN 30 SEP 2026 SORE, BUTIR U4 - KONTRAK K4)
 * ============================================================================
 *
 * Skrip konten bersama panel SIPP (konten.js, halaman daftar perkara) dan
 * panel ABT (abt.js, beranda). Dimuat SESUDAH panel-alat.js dan jurusita.js,
 * SEBELUM konten.js / abt.js. Ia tidak memasang apa pun sendiri; yang
 * memanggilnya panel pemilik halaman:
 *
 *   globalThis.aletaBasMassalPasang(wadah, { situs: "sipp"|"abt", peran? })
 *     -> Promise<boolean>  true bila bagian BAS massal tergambar di `wadah`
 *
 * `peran` (opsional) = peran yang sedang AKTIF menurut panel pemanggil (mode
 * ganti peran dihormati). Tanpa itu dipakai akun ALETA dari /ekstensi/siapa.
 *
 * ============================================================================
 * APA YANG DIKERJAKAN "BAS MASSAL"
 * ============================================================================
 *
 * Hakim punya Putusan massal, juru sita punya Relaas massal. Panitera sidang:
 *
 *   1. Pilih tanggal sidang -> daftar perkara yang bersidang (bawaan: yang
 *      panitera penggantinya pengguna ini; admin: semua), dengan status tiap
 *      perkara: BAS sidang itu sudah/belum diunggah ke SIPP, saksi yang
 *      diajukan, lembar BAS di ALETA, kehadiran yang tercatat.
 *   2. Blangko BAS diusulkan dari set yang cocok dengan jenis perkaranya pada
 *      jenjang "BAS <urutan sidang>" - hanya bila keadaan di nama blangko
 *      cocok dengan kehadiran di SIPP; selain itu dipilih petugas.
 *   3. Pratinjau (GET bas/periksa): berapa penanda terisi dari SIPP, lembar
 *      ALETA, dan keterangan saksi yang sudah terekam di ABT; apa yang masih
 *      kosong dan harus dilengkapi.
 *   4. Unduh (GET bas/naskah): blangko ASLI ABT dengan penanda terisi, RTF.
 *   5. "Kerjakan yang dicentang": pratinjau lalu unduh, BERUNTUN, satu per
 *      satu; yang pratinjaunya menemukan halangan dilewati kecuali petugas
 *      mencentang "unduh walau ada halangan". Dapat dihentikan.
 *   6. Buka di ABT: blangko yang sama dibuka di ABT lewat jalur ABT sendiri
 *      (POST abt/main/cari, persis tautan kartu blangko ABT - pemeriksaan hak
 *      akses ABT tetap berlaku), atau kelompok blangkonya (GET beranda?a=&c=).
 *      Di sanalah panel ABT per perkara menyusun keterangan saksi 1 & 2
 *      (mesin abt.js + /aleta-bot/abt/usulan, dengan pratinjau).
 *
 * ============================================================================
 * TIDAK ADA JALUR TULIS BARU
 * ============================================================================
 *
 * Seluruh permintaan jaringan di berkas ini GET: /ekstensi/siapa,
 * /bas-massal (baru, hanya membaca), /bas/periksa, /bas/naskah. Tidak ada
 * yang ditulis ke SIPP, ABT, maupun ALETA. "Buka di ABT" adalah navigasi yang
 * sama dengan tautan kartu blangko ABT (main/cari hanya membaca - ada di
 * ALETA_COBA_BOLEH) dan tetap diperiksa terhadap mode coba dan mode latihan
 * sebelum dikirim. Satu-satunya yang disimpan: token blangko BAS yang terbaca
 * dari halaman ABT, di chrome.storage.local "tokenBlangkoBas" - supaya tombol
 * "Buka di ABT" tersedia juga dari SIPP.
 *
 * Tampilan Lama: pulang false SEKETIKA - tanpa elemen, permintaan, maupun
 * simpanan apa pun.
 */

const BASMASSAL_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const BASMASSAL_API_DAFTAR = "/aleta/api/aleta-ecourt/bas-massal";
const BASMASSAL_API_PERIKSA = "/aleta/api/aleta-ecourt/bas/periksa";
const BASMASSAL_API_NASKAH = "/aleta/api/aleta-ecourt/bas/naskah";
const BASMASSAL_KUNCI_TOKEN = "tokenBlangkoBas";
const BASMASSAL_PENANDA = "aleta-basmassal";
const BASMASSAL_TOKEN_MAKS = 400;
const BASMASSAL_JEDA_BERUNTUN_MS = 400;
/** Golongan peran (alatGolonganPeran) yang boleh - sama dengan matriks K1 "bas-massal". */
const BASMASSAL_GOLONGAN_BOLEH = ["admin", "panitera"];

/* ─── 1. Gerbang tampilan dan peran ──────────────────────────────────────── */

function basmassalModeBaru() {
  try {
    return typeof alatUjiMode === "function" && alatUjiMode() !== "lama";
  } catch {
    return false;
  }
}

/** Satu peran boleh membuka BAS massal? Matriks K1 bila ada, golongan bila tidak. */
function basmassalPeranBoleh(situs, peran) {
  const p = String(peran || "").trim();
  if (!p) return false;
  try {
    if (typeof alatMenuPeran === "function") {
      const menu = alatMenuPeran(situs === "abt" ? "abt" : "sipp", "daftar", p);
      if (Array.isArray(menu)) return menu.includes("bas-massal");
    }
  } catch {
    /* jatuh ke golongan */
  }
  if (typeof alatGolonganPeran !== "function") return false;
  return BASMASSAL_GOLONGAN_BOLEH.includes(alatGolonganPeran(p));
}

async function basmassalMuatSiapa() {
  try {
    const r = await alatAmbil(BASMASSAL_API_SIAPA, { credentials: "include", cache: "no-store" }, "Membaca akun ALETA");
    if (!r.ok) return null;
    const luar = await r.json();
    const isi = luar && luar.data ? luar.data : luar;
    if (!isi || !isi.nama) return null;
    return {
      nama: String(isi.nama || ""),
      peran: String(isi.peran || ""),
      roleId: String(isi.roleId || ""),
      peranTambahan: Array.isArray(isi.peranTambahan) ? isi.peranTambahan.map(String) : [],
    };
  } catch {
    return null;
  }
}

/* ─── 2. Pembantu kecil ──────────────────────────────────────────────────── */

function basmassalEl(tag, kelas, teks) {
  if (typeof alatEl === "function") return alatEl(tag, kelas, teks);
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined && teks !== null) e.textContent = String(teks);
  return e;
}

function basmassalTombol(teks, kelas, judul) {
  const b = basmassalEl("button", `aleta-basmassal-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

function basmassalTanggalIso(d) {
  if (typeof alatTanggalIso === "function") return alatTanggalIso(d || new Date());
  const t = d || new Date();
  const dua = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}

function basmassalPesanStatus(status, yangDiminta) {
  if (typeof alatPesanGagal === "function") return alatPesanGagal(null, status, yangDiminta);
  return `${yangDiminta} gagal (${status}).`;
}

function basmassalKabar(wadah, teks, jenis) {
  wadah.textContent = teks || "";
  wadah.className = `aleta-basmassal-kabar${jenis ? ` aleta-basmassal-kabar-${jenis}` : ""}`;
  wadah.hidden = !teks;
}

/** Kunci nama untuk mencocokkan kelompok/berkas: huruf kecil, tanpa tanda baca, tanpa .rtf. */
function basmassalKunciNama(nama) {
  return String(nama || "")
    .replace(/\.rtf\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nama kelompok dari folder set: "derry_briantono/- BAS VERSTEK PERCERAIAN -" -> "bas verstek perceraian". */
function basmassalKunciFolder(folder) {
  const potong = String(folder || "").split("/");
  return basmassalKunciNama(potong[potong.length - 1]);
}

/** Alamat dasar ABT (".../aps_badilag/abt") di halaman ini. */
function basmassalAsalAbt() {
  const cocok = location.pathname.match(/^(.*?\/abt)\//);
  return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
}

/* ─── 3. Token blangko BAS dari halaman ABT ──────────────────────────────── */

async function basmassalBacaToken() {
  try {
    const s = await chrome.storage.local.get([BASMASSAL_KUNCI_TOKEN]);
    const isi = s && s[BASMASSAL_KUNCI_TOKEN];
    if (isi && typeof isi === "object") {
      return {
        kelompok: isi.kelompok && typeof isi.kelompok === "object" ? isi.kelompok : {},
        berkas: isi.berkas && typeof isi.berkas === "object" ? isi.berkas : {},
      };
    }
  } catch {
    /* tanpa simpanan: tidak ada tombol Buka di ABT dari SIPP */
  }
  return { kelompok: {}, berkas: {} };
}

/**
 * Membaca token kelompok (bilah kiri ABT) dan token berkas (kartu kelompok
 * yang sedang terbuka) yang namanya memuat "BAS". Hanya MEMBACA halaman ABT;
 * hasilnya disimpan lokal. Pulang jumlah token yang terbaca.
 */
async function basmassalPanenTokenAbt() {
  if (!document.querySelector("#navbar .accordion") && !document.querySelector(".pricing-top h3")) return 0;
  const asal = basmassalAsalAbt();
  const kini = Date.now();
  const kelompok = {};
  const berkas = {};
  for (const a of Array.from(document.querySelectorAll("#navbar a[href]"))) {
    let u;
    try {
      u = new URL(a.getAttribute("href"), location.origin);
    } catch {
      continue;
    }
    const tokenA = u.searchParams.get("a");
    const nama = String(a.textContent || "").replace(/\s+/g, " ").trim();
    const kunci = basmassalKunciNama(nama);
    if (!tokenA || !/(^| )bas( |$)/.test(kunci)) continue;
    kelompok[kunci] = { a: tokenA, nama, asal, diambil: kini };
  }
  for (const h3 of Array.from(document.querySelectorAll(".pricing-top h3"))) {
    // h3 = nama kelompok + "<br>" + jenis dan nomor perkara - hanya simpul pertamanya.
    const nama = String((h3.firstChild && h3.firstChild.textContent) || h3.textContent || "").replace(/\s+/g, " ").trim();
    const kunciKel = basmassalKunciNama(nama);
    if (!/(^| )bas( |$)/.test(kunciKel)) continue;
    const kartu = h3.closest(".pricing_inner_w3ls") || h3.parentElement;
    if (!kartu) continue;
    for (const t of Array.from(kartu.querySelectorAll(".pricing-bottom-bottom a[onclick], .pricing-bottom-bottom a[href*='abt/preview']"))) {
      const token = typeof alatTokenDariTautan === "function" ? alatTokenDariTautan(t) : null;
      if (!token || !token.a || !token.b) continue;
      const span = t.querySelector("span");
      const namaBerkas = String((span || t).textContent || "").replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
      if (!namaBerkas) continue;
      berkas[`${kunciKel}|${basmassalKunciNama(namaBerkas)}`] = { a: token.a, b: token.b, berkas: namaBerkas, kelompok: nama, asal, diambil: kini };
    }
  }
  const jumlah = Object.keys(kelompok).length + Object.keys(berkas).length;
  if (jumlah === 0) return 0;
  const lama = await basmassalBacaToken();
  const gabung = (x, y) => {
    const hasil = { ...x, ...y };
    const kunci = Object.keys(hasil).sort((p, q) => Number(hasil[q].diambil || 0) - Number(hasil[p].diambil || 0));
    const bersih = {};
    for (const k of kunci.slice(0, BASMASSAL_TOKEN_MAKS)) bersih[k] = hasil[k];
    return bersih;
  };
  try {
    await chrome.storage.local.set({
      [BASMASSAL_KUNCI_TOKEN]: { kelompok: gabung(lama.kelompok, kelompok), berkas: gabung(lama.berkas, berkas) },
    });
  } catch {
    /* tanpa simpanan: token hanya berlaku di halaman ini */
  }
  return jumlah;
}

/**
 * Token untuk satu blangko: berkas di kelompok yang namanya sama dengan
 * foldernya; bila tidak ada, berkas bernama sama yang SATU-SATUNYA (nama yang
 * sama di dua kelompok tidak ditebak). Kelompok saja bila berkasnya belum
 * pernah terbaca.
 */
function basmassalTokenUntuk(peta, folder, namaBerkas) {
  const kunciKel = basmassalKunciFolder(folder);
  const kunciBerkas = basmassalKunciNama(namaBerkas);
  let berkas = peta.berkas[`${kunciKel}|${kunciBerkas}`] || null;
  if (!berkas) {
    const sama = Object.entries(peta.berkas).filter(([k]) => k.split("|")[1] === kunciBerkas);
    if (sama.length === 1) berkas = sama[0][1];
  }
  const kelompok = peta.kelompok[kunciKel] || null;
  return { berkas, kelompok };
}

/** Mode coba atau mode latihan menahan POST ini? */
function basmassalDitahan(alamat) {
  try {
    if (typeof alatCobaMenahan === "function" && alatCobaMenahan(alamat, "POST")) return "mode coba";
    if (typeof alatLatihanMenahan === "function" && alatLatihanMenahan(alamat, "POST")) return "mode latihan";
  } catch {
    return "";
  }
  return "";
}

/** Membuka blangko di ABT lewat jalur ABT sendiri - POST main/cari {a, b, c}, tab baru. */
function basmassalBukaDiAbt(token, perkaraId) {
  const asal = String(token.asal || basmassalAsalAbt());
  const alamat = `${asal}/main/cari`;
  const tahan = basmassalDitahan(alamat);
  if (tahan) return { ok: false, sebab: `Ditahan ${tahan}: membuka blangko di ABT tidak dikirim.` };
  const borang = document.createElement("form");
  borang.method = "post";
  borang.action = alamat;
  borang.target = "_blank";
  borang.style.display = "none";
  for (const [nama, nilai] of [
    ["a", token.a],
    ["b", token.b],
    ["c", String(perkaraId || "")],
  ]) {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = nama;
    i.value = String(nilai || "");
    borang.appendChild(i);
  }
  document.body.appendChild(borang);
  try {
    borang.submit();
  } finally {
    borang.remove();
  }
  return { ok: true };
}

/* ─── 4. Rute ALETA (semuanya GET) ───────────────────────────────────────── */

async function basmassalMuatDaftar(tanggal, saringan) {
  const q = new URLSearchParams();
  if (tanggal) q.set("tanggal", tanggal);
  if (saringan) q.set("saringan", saringan);
  let r;
  try {
    r = await alatAmbil(`${BASMASSAL_API_DAFTAR}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca daftar sidang");
  } catch (e) {
    return { sebab: String((e && e.message) || e) };
  }
  const luar = await r.json().catch(() => null);
  if (!r.ok || !luar || luar.ok === false) {
    return {
      sebab: String((luar && (luar.alasan || (luar.error && luar.error.message))) || basmassalPesanStatus(r.status, "Membaca daftar sidang")),
    };
  }
  const data = luar.data ? luar.data : luar;
  if (!data || !Array.isArray(data.sidang)) return { sebab: "Daftar sidang tidak terbaca." };
  return { data };
}

function basmassalQueryBlangko(baris, pilihan) {
  const q = new URLSearchParams();
  q.set("perkaraId", baris.perkaraId);
  q.set("folder", pilihan.folder);
  q.set("berkas", pilihan.berkas);
  if (Number(pilihan.basKe) > 0) q.set("sidangKe", String(pilihan.basKe));
  return q.toString();
}

async function basmassalPeriksa(baris, pilihan) {
  let r;
  try {
    r = await alatAmbil(
      `${BASMASSAL_API_PERIKSA}?${basmassalQueryBlangko(baris, pilihan)}`,
      { credentials: "include", cache: "no-store" },
      "Pratinjau BAS"
    );
  } catch (e) {
    return { ok: false, sebab: String((e && e.message) || e) };
  }
  const luar = await r.json().catch(() => null);
  if (!r.ok || !luar) return { ok: false, sebab: basmassalPesanStatus(r.status, "Pratinjau BAS") };
  const d = luar.data ? luar.data : luar;
  if (!d || d.ok === false) return { ok: false, sebab: String((d && d.sebab) || "Blangko tidak terbaca.") };
  return {
    ok: true,
    jumlahPenanda: Number(d.jumlahPenanda) || 0,
    jumlahTerisi: Number(d.jumlahTerisi) || 0,
    jumlahTersisa: Number(d.jumlahTersisa) || 0,
    ringkasan: String(d.ringkasan || ""),
    temuan: Array.isArray(d.temuan) ? d.temuan : [],
  };
}

function basmassalNamaUnduhan(respons, baris, pilihan) {
  const cd = String((respons.headers && respons.headers.get && respons.headers.get("content-disposition")) || "");
  const cocok = cd.match(/filename="([^"]+)"/i);
  const nama = cocok ? cocok[1] : `${baris.nomorPerkara} - ${pilihan.berkas}`;
  return nama.replace(/[\\/:*?"<>|]+/g, "_");
}

/** Unduh blangko terisi (RTF). Membaca, lalu menyerahkan berkasnya ke peramban. */
async function basmassalUnduh(baris, pilihan) {
  let r;
  try {
    r = await alatAmbil(
      `${BASMASSAL_API_NASKAH}?${basmassalQueryBlangko(baris, pilihan)}`,
      { credentials: "include", cache: "no-store" },
      "Mengunduh BAS"
    );
  } catch (e) {
    return { ok: false, sebab: String((e && e.message) || e) };
  }
  if (!r.ok) {
    const luar = await r.json().catch(() => null);
    return { ok: false, sebab: String((luar && luar.sebab) || basmassalPesanStatus(r.status, "Mengunduh BAS")) };
  }
  const nama = basmassalNamaUnduhan(r, baris, pilihan);
  const tersisa = String(r.headers.get("x-aleta-tersisa") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  let blob;
  try {
    blob = await r.blob();
  } catch (e) {
    return { ok: false, sebab: `Berkas tidak terbaca: ${String((e && e.message) || e)}` };
  }
  if (typeof URL.createObjectURL !== "function") return { ok: false, sebab: "Peramban ini tidak dapat menyimpan unduhan dari panel." };
  const alamat = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = alamat;
  a.download = nama;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(alamat);
    } catch {
      /* sudah dilepas */
    }
  }, 60000);
  return { ok: true, nama, tersisa };
}

/* ─── 5. Tampilan ────────────────────────────────────────────────────────── */

function basmassalTanda(teks, keadaan, judul) {
  const s = basmassalEl("span", `aleta-basmassal-tanda${keadaan ? ` aleta-basmassal-tanda-${keadaan}` : ""}`, teks);
  if (judul) s.title = judul;
  return s;
}

/** Kalimat hasil pratinjau + rincian temuannya. */
function basmassalGambarPratinjau(kotak, hasil, pilihan) {
  kotak.textContent = "";
  if (!hasil.ok) {
    kotak.appendChild(basmassalEl("div", "aleta-basmassal-kabar aleta-basmassal-kabar-salah", hasil.sebab));
    return;
  }
  const halangan = hasil.temuan.filter((t) => t && t.tingkat === "halangan").length;
  kotak.appendChild(
    basmassalEl(
      "div",
      `aleta-basmassal-kabar ${halangan ? "aleta-basmassal-kabar-peringatan" : "aleta-basmassal-kabar-baik"}`,
      `${hasil.jumlahTerisi} dari ${hasil.jumlahPenanda} isian terisi` +
        (hasil.jumlahTersisa ? ` · ${hasil.jumlahTersisa} masih kosong` : "") +
        (hasil.ringkasan ? ` - ${hasil.ringkasan}` : "")
    )
  );
  if (hasil.temuan.length) {
    const rinci = basmassalEl("details", "aleta-basmassal-rinci");
    rinci.appendChild(basmassalEl("summary", "", `Yang perlu dilengkapi (${hasil.temuan.length})`));
    const ul = basmassalEl("ul", "aleta-basmassal-daftar-temuan");
    for (const t of hasil.temuan.slice(0, 30)) {
      const li = basmassalEl("li", t && t.tingkat === "halangan" ? "aleta-basmassal-salah" : "", `${String((t && t.hal) || "")}: ${String((t && t.tindakan) || (t && t.keterangan) || "")}`);
      ul.appendChild(li);
    }
    rinci.appendChild(ul);
    kotak.appendChild(rinci);
  }
  kotak.appendChild(basmassalEl("div", "aleta-basmassal-lembut aleta-teknis", `Blangko: ${pilihan.berkas} (${pilihan.folder})`));
}

/**
 * Satu baris perkara. Pulang pengendali { baris, pilihan(), centang, kerjakan(paksa) }.
 */
function basmassalGambarBaris(daftar, baris, konteks) {
  const akar = basmassalEl("div", "aleta-basmassal-baris");
  akar.setAttribute("data-nomor", baris.nomorPerkara);

  const kepala = basmassalEl("div", "aleta-basmassal-kepala");
  const label = basmassalEl("label", "aleta-basmassal-pilih-perkara");
  const centang = document.createElement("input");
  centang.type = "checkbox";
  centang.className = "aleta-basmassal-centang";
  centang.disabled = true;
  label.appendChild(centang);
  label.appendChild(basmassalEl("span", "aleta-basmassal-nomor", baris.nomorPerkara));
  kepala.appendChild(label);
  const sidang = [
    baris.urutanSidang > 0 ? `sidang ke-${baris.urutanSidang}` : "",
    baris.jamSidang,
    baris.agenda,
  ]
    .filter(Boolean)
    .join(" · ");
  if (sidang) kepala.appendChild(basmassalEl("span", "aleta-basmassal-lembut", sidang));
  akar.appendChild(kepala);

  const status = basmassalEl("div", "aleta-basmassal-status");
  if (baris.basSipp === true) status.appendChild(basmassalTanda("BAS sudah di SIPP", "baik", "BAS sidang ini sudah diunggah ke SIPP."));
  else if (baris.basSipp === false) status.appendChild(basmassalTanda("BAS belum di SIPP", "belum", "BAS sidang ini belum diunggah ke SIPP."));
  status.appendChild(basmassalTanda(baris.kehadiran, "", "Kehadiran menurut jadwal sidang SIPP."));
  const saksi = baris.saksi || { pihak1: 0, pihak2: 0, nama1: [], nama2: [] };
  if (saksi.pihak1 + saksi.pihak2 > 0) {
    status.appendChild(
      basmassalTanda(
        `saksi ${saksi.pihak1 + saksi.pihak2}`,
        "",
        [...(saksi.nama1 || []), ...(saksi.nama2 || [])].join(", ") || "Saksi yang diajukan di SIPP."
      )
    );
  }
  if (baris.lembar && baris.lembar.jumlah > 0) {
    status.appendChild(
      basmassalTanda(
        `lembar BAS ${baris.lembar.selesai}/${baris.lembar.jumlah} selesai`,
        baris.lembar.selesai === baris.lembar.jumlah ? "baik" : "",
        "Lembar BAS yang diketik di Alat Bantu Tulis BAS portal ALETA."
      )
    );
  }
  if (baris.sudahPutus) status.appendChild(basmassalTanda("sudah putus", "", ""));
  if (konteks.tampilkanPp && baris.paniteraNama) status.appendChild(basmassalTanda(`PP: ${baris.paniteraNama}`, "", ""));
  akar.appendChild(status);

  const b = baris.blangko || { usulan: null, pilihan: [], sebab: "" };
  const barisBlangko = basmassalEl("div", "aleta-basmassal-baris-blangko");
  const pilih = document.createElement("select");
  pilih.className = "aleta-basmassal-blangko";
  const kosong = document.createElement("option");
  kosong.value = "";
  kosong.textContent = b.pilihan.length ? "Pilih blangko BAS..." : "tidak ada blangko BAS";
  pilih.appendChild(kosong);
  b.pilihan.forEach((p, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `${p.label}${b.pilihan.some((x) => x.setId !== p.setId) ? ` (${p.setNama})` : ""}`;
    o.title = p.berkas;
    pilih.appendChild(o);
  });
  if (b.usulan) {
    const i = b.pilihan.findIndex((p) => p.berkas === b.usulan.berkas && p.folder === b.usulan.folder);
    if (i >= 0) pilih.value = String(i);
  }
  pilih.disabled = b.pilihan.length === 0;
  barisBlangko.appendChild(pilih);
  akar.appendChild(barisBlangko);
  if (b.sebab) akar.appendChild(basmassalEl("div", "aleta-basmassal-lembut", b.sebab));

  const aksi = basmassalEl("div", "aleta-basmassal-aksi");
  const tPratinjau = basmassalTombol("Pratinjau", "aleta-basmassal-tombol-kecil", "Periksa isian BAS sebelum diunduh - tidak ada yang ditulis");
  const tUnduh = basmassalTombol("Unduh", "aleta-basmassal-tombol-kecil", "Unduh blangko BAS terisi (RTF)");
  aksi.appendChild(tPratinjau);
  aksi.appendChild(tUnduh);
  const tAbt = basmassalTombol("Buka di ABT", "aleta-basmassal-tombol-kecil", "Buka blangko ini di ABT (tab baru) - susun keterangan saksi di panel ABT perkara itu");
  tAbt.hidden = true;
  aksi.appendChild(tAbt);
  const aKelompok = basmassalEl("a", "aleta-basmassal-tautan", "Kelompok di ABT");
  aKelompok.target = "_blank";
  aKelompok.rel = "noopener";
  aKelompok.hidden = true;
  aksi.appendChild(aKelompok);
  const aCetak = basmassalEl("a", "aleta-basmassal-tautan", "Cetak ABT");
  aCetak.target = "_blank";
  aCetak.rel = "noopener";
  aCetak.title = "Tombol CETAK ABT sendiri untuk blangko dan perkara ini";
  aCetak.hidden = true;
  aksi.appendChild(aCetak);
  akar.appendChild(aksi);

  const hasil = basmassalEl("div", "aleta-basmassal-hasil");
  akar.appendChild(hasil);
  daftar.appendChild(akar);

  const pilihan = () => {
    const i = pilih.value === "" ? -1 : Number(pilih.value);
    return i >= 0 && b.pilihan[i] ? b.pilihan[i] : null;
  };
  let tokenBerkas = null;
  const segarkan = () => {
    const p = pilihan();
    const bisa = Boolean(p) && /^\d+$/.test(String(baris.perkaraId || ""));
    centang.disabled = !bisa;
    if (!bisa) centang.checked = false;
    tPratinjau.disabled = !bisa;
    tUnduh.disabled = !bisa;
    const token = p ? basmassalTokenUntuk(konteks.token, p.folder, p.berkas) : { berkas: null, kelompok: null };
    tokenBerkas = bisa ? token.berkas : null;
    tAbt.hidden = !tokenBerkas;
    if (tokenBerkas) {
      const q = new URLSearchParams({ a: tokenBerkas.a, b: tokenBerkas.b, c: String(baris.perkaraId) });
      aCetak.href = `${String(tokenBerkas.asal || basmassalAsalAbt())}/preview?${q.toString()}`;
      aCetak.hidden = false;
      aKelompok.hidden = true;
    } else {
      aCetak.hidden = true;
      if (p && token.kelompok && baris.perkaraId) {
        const q = new URLSearchParams({ a: token.kelompok.a, c: String(baris.perkaraId) });
        aKelompok.href = `${String(token.kelompok.asal || basmassalAsalAbt())}/main/beranda?${q.toString()}`;
        aKelompok.title = `Buka kelompok "${token.kelompok.nama}" di ABT untuk perkara ini, lalu pilih blangkonya`;
        aKelompok.hidden = false;
      } else {
        aKelompok.hidden = true;
      }
    }
    konteks.segarkanAksi();
  };
  pilih.addEventListener("change", segarkan);
  centang.addEventListener("change", () => konteks.segarkanAksi());

  const pratinjau = async () => {
    const p = pilihan();
    if (!p) return null;
    hasil.textContent = "";
    hasil.appendChild(basmassalEl("div", "aleta-basmassal-lembut", "Memeriksa isian..."));
    const h = await basmassalPeriksa(baris, p);
    basmassalGambarPratinjau(hasil, h, p);
    return h;
  };
  const unduh = async () => {
    const p = pilihan();
    if (!p) return null;
    const u = await basmassalUnduh(baris, p);
    const kabar = basmassalEl("div", "aleta-basmassal-kabar");
    if (u.ok) {
      basmassalKabar(kabar, `Diunduh: ${u.nama}${u.tersisa.length ? ` - ${u.tersisa.length} isian masih kosong, lengkapi di Word` : ""}`, u.tersisa.length ? "peringatan" : "baik");
    } else {
      basmassalKabar(kabar, `Tidak diunduh: ${u.sebab}`, "salah");
    }
    hasil.appendChild(kabar);
    return u;
  };
  tPratinjau.addEventListener("click", async () => {
    tPratinjau.disabled = true;
    await pratinjau();
    tPratinjau.disabled = !pilihan();
  });
  tUnduh.addEventListener("click", async () => {
    tUnduh.disabled = true;
    await unduh();
    tUnduh.disabled = !pilihan();
  });
  tAbt.addEventListener("click", () => {
    if (!tokenBerkas) return;
    const j = basmassalBukaDiAbt(tokenBerkas, baris.perkaraId);
    if (!j.ok) {
      const kabar = basmassalEl("div", "aleta-basmassal-kabar");
      basmassalKabar(kabar, j.sebab, "peringatan");
      hasil.appendChild(kabar);
    }
  });

  /** Beruntun: pratinjau, lalu unduh bila tidak ada halangan (atau dipaksa). */
  const kerjakan = async (paksa) => {
    const h = await pratinjau();
    if (!h || !h.ok) return { keadaan: "gagal" };
    const halangan = h.temuan.filter((t) => t && t.tingkat === "halangan");
    if (halangan.length && !paksa) {
      const kabar = basmassalEl("div", "aleta-basmassal-kabar");
      basmassalKabar(kabar, `Dilewati - ada ${halangan.length} halangan. Lengkapi dulu, atau centang "unduh walau ada halangan".`, "peringatan");
      hasil.appendChild(kabar);
      return { keadaan: "dilewati" };
    }
    const u = await unduh();
    return { keadaan: u && u.ok ? "diunduh" : "gagal" };
  };

  segarkan();
  return { baris, centang, pilihan, kerjakan, segarkan };
}

function basmassalGambar(akar, konteks) {
  const judul = basmassalEl("div", "aleta-basmassal-judul");
  judul.appendChild(basmassalEl("span", "aleta-basmassal-judul-teks", "BAS massal"));
  const info = basmassalTombol("ⓘ", "aleta-basmassal-info", "Penjelasan");
  info.setAttribute("aria-expanded", "false");
  judul.appendChild(info);
  akar.appendChild(judul);
  const uraian = basmassalEl(
    "div",
    "aleta-basmassal-uraian",
    "Perkara yang bersidang pada tanggal yang dipilih, beserta status BAS-nya. Pilih blangko, Pratinjau untuk melihat " +
      "isian yang masih kosong, lalu Unduh - atau centang beberapa perkara dan tekan \"Kerjakan yang dicentang\". " +
      "Keterangan saksi 1 & 2 disusun di panel ABT perkara itu (Buka di ABT). Tombol Buka di ABT muncul setelah " +
      "kelompok blangko BAS pernah dibuka di ABT di peramban ini."
  );
  uraian.appendChild(
    basmassalEl(
      "div",
      "aleta-teknis",
      "Sumber: jadwal SIPP (edoc BAS, saksi, dihadiri_oleh) lewat ALETA Bot, katalog blangko APS Badilag, lembar " +
        "aleta_bas_lembar. Usulan blangko hanya bila keadaan di nama blangko cocok dengan kehadiran. Pratinjau = " +
        "GET bas/periksa, Unduh = GET bas/naskah (blangko asli ABT, RTF). Tidak ada yang ditulis ke SIPP, ABT, maupun ALETA."
    )
  );
  uraian.hidden = true;
  info.addEventListener("click", () => {
    uraian.hidden = !uraian.hidden;
    info.setAttribute("aria-expanded", uraian.hidden ? "false" : "true");
  });
  akar.appendChild(uraian);

  const atas = basmassalEl("div", "aleta-basmassal-baris-atas");
  const tanggal = document.createElement("input");
  tanggal.type = "date";
  tanggal.className = "aleta-basmassal-pilih aleta-basmassal-tanggal";
  tanggal.value = basmassalTanggalIso(new Date());
  atas.appendChild(tanggal);
  const saring = document.createElement("select");
  saring.className = "aleta-basmassal-pilih aleta-basmassal-saring";
  for (const [nilai, teks] of [
    ["", "Bawaan"],
    ["saya", "PP: saya"],
    ["semua", "Semua PP"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  saring.value = "";
  atas.appendChild(saring);
  const muat = basmassalTombol("Tampilkan", "aleta-basmassal-tombol-kecil");
  atas.appendChild(muat);
  akar.appendChild(atas);

  const kabar = basmassalEl("div", "aleta-basmassal-kabar");
  kabar.hidden = true;
  akar.appendChild(kabar);
  const daftar = basmassalEl("div", "aleta-basmassal-daftar");
  akar.appendChild(daftar);

  const bawah = basmassalEl("div", "aleta-basmassal-bawah");
  bawah.hidden = true;
  const semuaSiap = basmassalTombol("Centang semua yang berblangko", "aleta-basmassal-tombol-kecil");
  const labelPaksa = basmassalEl("label", "aleta-basmassal-paksa");
  const paksa = document.createElement("input");
  paksa.type = "checkbox";
  labelPaksa.appendChild(paksa);
  labelPaksa.appendChild(document.createTextNode(" unduh walau ada halangan"));
  const kerjakan = basmassalTombol("Kerjakan yang dicentang", "aleta-basmassal-tombol-utama", "Pratinjau lalu unduh, satu per satu");
  kerjakan.disabled = true;
  const henti = basmassalTombol("Hentikan", "aleta-basmassal-tombol-kecil");
  henti.hidden = true;
  for (const x of [semuaSiap, labelPaksa, kerjakan, henti]) bawah.appendChild(x);
  akar.appendChild(bawah);
  const kemajuan = basmassalEl("div", "aleta-basmassal-kabar");
  kemajuan.hidden = true;
  akar.appendChild(kemajuan);

  let pengendali = [];
  let berjalan = false;
  let berhenti = false;
  konteks.segarkanAksi = () => {
    const dicentang = pengendali.filter((p) => p.centang.checked && !p.centang.disabled).length;
    kerjakan.disabled = berjalan || dicentang === 0;
    kerjakan.textContent = dicentang > 1 ? `Kerjakan ${dicentang} yang dicentang` : "Kerjakan yang dicentang";
  };

  const tampilkan = async () => {
    if (berjalan) return;
    muat.disabled = true;
    daftar.textContent = "";
    pengendali = [];
    bawah.hidden = true;
    basmassalKabar(kemajuan, "", "");
    basmassalKabar(kabar, "Membaca sidang...", "");
    const [j, token] = await Promise.all([basmassalMuatDaftar(tanggal.value, saring.value), basmassalBacaToken()]);
    // Bagiannya sudah dibuang (panel ditutup / dipasang ulang) selama menunggu.
    if (!akar.isConnected) return;
    konteks.token = token;
    muat.disabled = false;
    if (!j.data) {
      basmassalKabar(kabar, j.sebab || "Daftar sidang tidak terbaca.", "salah");
      return;
    }
    const d = j.data;
    if (saring.value === "" && (d.saringan === "saya" || d.saringan === "semua")) saring.value = d.saringan;
    konteks.tampilkanPp = d.saringan === "semua";
    const sidang = d.sidang;
    if (sidang.length === 0) {
      const lain = d.saringan === "saya" && Number(d.jumlahSemua) > 0 ? ` (${d.jumlahSemua} perkara bersidang dengan PP lain - pilih "Semua PP")` : "";
      basmassalKabar(kabar, `Tidak ada sidang ${d.saringan === "saya" ? "Anda " : ""}pada ${d.tanggal}${lain}.`, "");
      return;
    }
    const belumSipp = sidang.filter((s) => s.basSipp === false).length;
    const berUsulan = sidang.filter((s) => s.blangko && s.blangko.usulan).length;
    basmassalKabar(
      kabar,
      `${sidang.length} perkara bersidang${belumSipp ? ` · ${belumSipp} BAS belum di SIPP` : ""} · ${berUsulan} blangko terusul`,
      ""
    );
    for (const s of sidang) pengendali.push(basmassalGambarBaris(daftar, s, konteks));
    bawah.hidden = false;
    konteks.segarkanAksi();
  };
  muat.addEventListener("click", () => void tampilkan());
  tanggal.addEventListener("change", () => void tampilkan());
  saring.addEventListener("change", () => void tampilkan());

  semuaSiap.addEventListener("click", () => {
    for (const p of pengendali) if (!p.centang.disabled) p.centang.checked = true;
    konteks.segarkanAksi();
  });
  henti.addEventListener("click", () => {
    berhenti = true;
    henti.disabled = true;
  });
  kerjakan.addEventListener("click", async () => {
    const dipilih = pengendali.filter((p) => p.centang.checked && !p.centang.disabled);
    if (dipilih.length === 0 || berjalan) return;
    berjalan = true;
    berhenti = false;
    henti.hidden = false;
    henti.disabled = false;
    muat.disabled = true;
    konteks.segarkanAksi();
    const hitung = { diunduh: 0, dilewati: 0, gagal: 0 };
    for (let i = 0; i < dipilih.length; i += 1) {
      if (berhenti) break;
      basmassalKabar(kemajuan, `Mengerjakan ${i + 1} dari ${dipilih.length}: ${dipilih[i].baris.nomorPerkara}`, "");
      let h;
      try {
        h = await dipilih[i].kerjakan(paksa.checked);
      } catch {
        h = { keadaan: "gagal" };
      }
      hitung[h.keadaan] = (hitung[h.keadaan] || 0) + 1;
      if (i < dipilih.length - 1 && !berhenti) await new Promise((r) => setTimeout(r, BASMASSAL_JEDA_BERUNTUN_MS));
    }
    const sisa = dipilih.length - hitung.diunduh - hitung.dilewati - hitung.gagal;
    basmassalKabar(
      kemajuan,
      `${berhenti ? "Dihentikan" : "Selesai"}: ${hitung.diunduh} diunduh` +
        (hitung.dilewati ? ` · ${hitung.dilewati} dilewati` : "") +
        (hitung.gagal ? ` · ${hitung.gagal} gagal` : "") +
        (sisa > 0 ? ` · ${sisa} belum dikerjakan` : ""),
      hitung.gagal ? "salah" : hitung.dilewati || sisa ? "peringatan" : "baik"
    );
    berjalan = false;
    henti.hidden = true;
    muat.disabled = false;
    konteks.segarkanAksi();
  });

  return tampilkan;
}

/* ─── 6. Pintu masuk ─────────────────────────────────────────────────────── */

async function aletaBasMassalPasang(wadah, opsi) {
  // Tampilan Lama: tidak ada yang digambar, dibaca, maupun disimpan.
  if (!basmassalModeBaru()) return false;
  if (!wadah || typeof wadah.appendChild !== "function") return false;
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const situs = o.situs === "abt" ? "abt" : "sipp";

  let boleh = false;
  if (typeof o.peran === "string" && o.peran.trim()) {
    boleh = basmassalPeranBoleh(situs, o.peran);
  } else {
    const siapa = await basmassalMuatSiapa();
    if (siapa) boleh = [siapa.peran, siapa.roleId, ...siapa.peranTambahan].some((p) => basmassalPeranBoleh(situs, p));
  }
  if (!boleh || !basmassalModeBaru()) return false;

  if (situs === "abt") await basmassalPanenTokenAbt();

  const lama = wadah.querySelector(`:scope > .${BASMASSAL_PENANDA}`);
  if (lama) lama.remove();
  const akar = basmassalEl("div", BASMASSAL_PENANDA);
  akar.setAttribute("data-situs", situs);
  const konteks = { token: { kelompok: {}, berkas: {} }, tampilkanPp: false, segarkanAksi: () => {} };
  const tampilkan = basmassalGambar(akar, konteks);
  wadah.appendChild(akar);
  // Membaca daftar hari ini sekali (GET). Tidak ada yang tercentang sendiri.
  void tampilkan();
  return true;
}

globalThis.aletaBasMassalPasang = aletaBasMassalPasang;
