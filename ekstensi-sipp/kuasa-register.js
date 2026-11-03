"use strict";

/**
 * ============================================================================
 * NOMOR & TANGGAL REGISTER KUASA DI BORANG KUASA HUKUM SIPP (3 Nov 2026)
 * ============================================================================
 *
 * Borang SIPP "Tambah/Ubah Data Kuasa Hukum" (form#frm_user, action addPengacara/validateInput) hanya punya
 * Nomor/Tanggal SURAT kuasa. Dua baris ditambahkan tepat di bawah "Tanggal Surat Kuasa", bergaya persis baris SIPP
 * di sekitarnya (baris SIPP disalin, jadi tema terang/gelap mengikuti):
 *
 *     Nomor Register Kuasa      [ ........... ]
 *     Tanggal Register Kuasa    [ tgl/bln/tahun ]
 *
 * SIPP tidak punya kolom untuk register kuasa dan skemanya tidak diubah: nilainya disimpan di basis data ALETA
 * (tabel aleta_register_kuasa, rute /aleta-ecourt/register-kuasa) dan dipakai blangko ABT lewat usulan #8539# / #0132#.
 *
 * ATURAN (keputusan Derry 3 Nov; murni di src/lib/register-kuasa.ts, disalin di bawah dan diuji sama):
 *   - satu NAMA kuasa (tanpa gelar/spasi) dalam satu perkara = satu nomor & tanggal register; pihak lain yang memberi kuasa
 *     kepada kuasa yang sama ikut nilainya OTOMATIS (diisikan saat borang dibuka / nama kuasa dipilih);
 *   - register BARU hanya bila kuasa itu ditambahkan pada tanggal lain: Tanggal Surat Kuasa berbeda dari register yang ada
 *     -> isian register kosong untuk diisi.
 *
 * SIMPAN. Ikut tombol Simpan SIPP, otomatis: saat borang dikirim, nilai dicatat; SESUDAH SIPP menjawab berhasil (st 1,
 * didengar jembatan.js) barulah dikirim ke ALETA. SIPP ditolak/dibatalkan = tidak ada yang disimpan. Bila SIPP berhasil
 * tetapi ALETA gagal, SIPP tetap tersimpan dan petugas diberi tahu (buka data kuasa itu lalu Simpan lagi).
 *
 * Isian baru TANPA name - tidak ikut terkirim ke SIPP; tidak ada yang ditulis ke SIPP/ABT oleh berkas ini.
 */
const KR_BORANG = 'form#frm_user[action*="addPengacara/validateInput"]';
const KR_API = "/aleta/api/aleta-ecourt/register-kuasa";
const KR_JEDA_PANTAU_MS = 700;
const KR_BATAS_BUKTI_MS = 65000;

/* --- Aturan murni (salinan src/lib/register-kuasa.ts) --- */
const KR_GELAR =
  /\b(?:s\.?\s?h\.?\s?i|s\.?\s?h|m\.?\s?h\.?\s?i|m\.?\s?h|m\.?\s?kn|s\.?\s?ag|s\.?\s?e|m\.?\s?e|s\.?\s?pd|s\.?\s?sos|m\.?\s?si|s\.?\s?kom|c\.?\s?l\.?\s?a|c\.?\s?p\.?\s?l|adv|advokat|dr|drs|ir|hj|h|prof)\b\.?/g;

function krKunciNama(nama) {
  return String(nama == null ? "" : nama)
    .toLowerCase()
    .replace(KR_GELAR, " ")
    .replace(/[^a-z]/g, "");
}

function krTanggalIso(nilai) {
  const t = String(nilai == null ? "" : nilai).trim();
  let y, m, d;
  let c = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (c) {
    d = Number(c[1]);
    m = Number(c[2]);
    y = Number(c[3]);
  } else {
    c = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(t);
    if (!c) return "";
    y = Number(c[1]);
    m = Number(c[2]);
    d = Number(c[3]);
  }
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return "";
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function krTanggalTampil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? "" : iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** daftar urut paling lama -> paling baru. Hasil: {jenis:"pakai",register,sebab} | {jenis:"baru",lain} | {jenis:"kosong"}. */
function krPilihRegister(daftar, tanggalSuratKuasa) {
  const ada = (Array.isArray(daftar) ? daftar : []).filter((r) => r && (r.nomorRegister || r.tanggalRegister));
  if (!ada.length) return { jenis: "kosong" };
  const tgl = krTanggalIso(tanggalSuratKuasa);
  if (!tgl) return { jenis: "pakai", register: ada[ada.length - 1], sebab: "belum-ada-tanggal" };
  const sama = ada.filter((r) => r.tanggalSuratKuasa === tgl);
  if (sama.length) return { jenis: "pakai", register: sama[sama.length - 1], sebab: "sama-tanggal" };
  const tanpaTanggal = ada.filter((r) => !r.tanggalSuratKuasa);
  if (tanpaTanggal.length === ada.length) return { jenis: "pakai", register: ada[ada.length - 1], sebab: "belum-ada-tanggal" };
  return { jenis: "baru", lain: ada };
}

const krKeadaan = { borang: null, nomorEl: null, tanggalEl: null, catatEl: null, kunci: "", daftar: new Map(), diisiOtomatis: null, disentuh: false, pantau: null, jam: null, pengamat: null, tertunda: null, nomorBukti: 0 };

function krBolehTampil() {
  try {
    return typeof saksiscanModeUi === "function" ? saksiscanModeUi() : true;
  } catch {
    return false;
  }
}

function krBorangTerbuka() {
  const f = document.querySelector(KR_BORANG);
  return f && (typeof saksiscanTampak !== "function" || saksiscanTampak(f)) ? f : null;
}

function krEl(tag, kelas, teks) {
  return typeof saksiscanEl === "function" ? saksiscanEl(tag, kelas, teks) : Object.assign(document.createElement(tag), { className: kelas || "", textContent: teks == null ? "" : String(teks) });
}

function krNomorPerkara() {
  try {
    return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
  } catch {
    return "";
  }
}

function krNilai(f, penunjuk) {
  const e = f.querySelector(penunjuk);
  return e ? String(e.value || "").trim() : "";
}

/** Nama para pihak yang dicentang (borang tambah) - hanya catatan siapa yang memberi kuasa. */
function krNamaPihak(f) {
  const nama = [];
  for (const c of Array.from(f.querySelectorAll('input[type="checkbox"][name="para_pihak[]"]'))) {
    if (!c.checked) continue;
    let teks = "";
    for (let n = c.nextSibling; n && !(n.nodeType === 1 && n.tagName === "BR") && !(n.nodeType === 1 && n.tagName === "INPUT"); n = n.nextSibling) teks += n.nodeType === 3 ? n.nodeValue : "";
    teks = teks.replace(/\s+/g, " ").trim();
    if (teks) nama.push(teks);
  }
  return nama.join("; ").slice(0, 400);
}

/** Baris SIPP "dasar" disalin supaya gaya (kelas, lebar kolom, tema) PERSIS sama; isinya diganti. */
function krBuatBaris(dasarTr, label, jenis) {
  const tr = dasarTr.cloneNode(true);
  // Bukan kelas aleta-sisip (gayanya menambah latar/jarak): baris harus tampak PERSIS seperti baris SIPP. Penanda data-aleta-tanda
  // membuat pengamat konten.js dan penghitung kolom melewatinya.
  tr.classList.add("aleta-reg-baris");
  tr.setAttribute("data-aleta-tanda", "register");
  tr.setAttribute("data-aleta-register", jenis);
  const sel = tr.querySelectorAll("td");
  if (sel[0]) {
    sel[0].textContent = label;
  }
  const input = tr.querySelector("input");
  if (input) {
    input.removeAttribute("id");
    input.removeAttribute("name");
    input.removeAttribute("required");
    input.classList.remove("hasDatepicker");
    input.value = "";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("data-aleta-register-isi", jenis);
    if (jenis === "nomor") input.setAttribute("maxlength", "100");
    else {
      input.setAttribute("placeholder", "tgl/bln/tahun");
      input.setAttribute("maxlength", "10");
    }
  }
  return tr;
}

function krPasangBaris(f) {
  if (krKeadaan.borang === f && krKeadaan.nomorEl && krKeadaan.nomorEl.isConnected && krKeadaan.tanggalEl && krKeadaan.tanggalEl.isConnected) return true;
  const tglKuasa = f.querySelector("#tgl_kuasa");
  const nmrKuasa = f.querySelector("#nmr_kuasa");
  const trTgl = tglKuasa && tglKuasa.closest("tr");
  const trNmr = nmrKuasa && nmrKuasa.closest("tr");
  if (!trTgl || !trNmr || !trTgl.parentNode) return false;
  for (const lama of Array.from(f.querySelectorAll("[data-aleta-register]"))) lama.remove();
  const trNomor = krBuatBaris(trNmr, "Nomor Register Kuasa", "nomor");
  const trTanggal = krBuatBaris(trTgl, "Tanggal Register Kuasa", "tanggal");
  trTgl.parentNode.insertBefore(trNomor, trTgl.nextSibling);
  trNomor.parentNode.insertBefore(trTanggal, trNomor.nextSibling);
  const nomorEl = trNomor.querySelector("input");
  const tanggalEl = trTanggal.querySelector("input");
  const sentuh = () => {
    krKeadaan.disentuh = true;
  };
  nomorEl.addEventListener("input", sentuh);
  tanggalEl.addEventListener("input", (e) => {
    sentuh();
    krMaskTanggal(tanggalEl, e);
  });
  krKeadaan.borang = f;
  krKeadaan.nomorEl = nomorEl;
  krKeadaan.tanggalEl = tanggalEl;
  krKeadaan.catatEl = null;
  krKeadaan.kunci = "";
  krKeadaan.diisiOtomatis = null;
  krKeadaan.disentuh = false;
  krKeadaan.tertunda = null;
  return true;
}

/** Garis miring otomatis seperti isian tanggal SIPP: 2 digit -> "/", 4 digit -> "/". */
function krMaskTanggal(el, e) {
  if (e && e.inputType && /^delete/.test(e.inputType)) return;
  let v = String(el.value || "").replace(/[^\d/]/g, "");
  if (/^\d{2}$/.test(v) || /^\d{2}\/\d{2}$/.test(v)) v += "/";
  if (v !== el.value) el.value = v;
}

async function krAmbil(nomor, nama) {
  const alamat = `${KR_API}?${new URLSearchParams({ nomor, nama }).toString()}`;
  try {
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, { credentials: "include", cache: "no-store" }, "Membaca register kuasa") : await fetch(alamat, { credentials: "include", cache: "no-store" });
    if (!r.ok) return null;
    const luar = await r.json().catch(() => null);
    const isi = luar && luar.data ? luar.data : luar;
    return isi && Array.isArray(isi.daftar) ? isi.daftar : null;
  } catch {
    return null;
  }
}

function krGambarCatatan(f, teks, pakai) {
  let c = krKeadaan.catatEl;
  if (!teks) {
    if (c && c.isConnected) c.remove();
    krKeadaan.catatEl = null;
    return;
  }
  if (!c || !c.isConnected) {
    const tr = krKeadaan.tanggalEl && krKeadaan.tanggalEl.closest("tr");
    if (!tr || !tr.parentNode) return;
    c = document.createElement("tr");
    c.className = "aleta-reg-baris aleta-kr-catatan";
    c.setAttribute("data-aleta-tanda", "register");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.style.cssText = "font-size:12px;opacity:.85;padding:2px 6px;";
    c.appendChild(td);
    tr.parentNode.insertBefore(c, tr.nextSibling);
    krKeadaan.catatEl = c;
  }
  const td = c.firstChild;
  td.textContent = teks;
  if (pakai) {
    const t = document.createElement("button");
    t.type = "button";
    t.textContent = "Pakai register yang ada";
    t.style.cssText = "margin-left:6px;font-size:12px;cursor:pointer;";
    t.addEventListener("click", () => {
      krIsi(pakai);
      krKeadaan.disentuh = false;
      krGambarCatatan(f, "Register kuasa yang sama dipakai.", null);
    });
    td.appendChild(t);
  }
}

function krIsi(register) {
  const n = register.nomorRegister || "";
  const t = krTanggalTampil(register.tanggalRegister);
  krKeadaan.nomorEl.value = n;
  krKeadaan.tanggalEl.value = t;
  krKeadaan.diisiOtomatis = { nomor: n, tanggal: t };
}

/** Isian masih persis seperti yang diisikan otomatis (atau kosong) = belum disunting petugas. */
function krBelumDisunting() {
  if (krKeadaan.disentuh) return false;
  const a = krKeadaan.diisiOtomatis;
  const n = krKeadaan.nomorEl.value.trim();
  const t = krKeadaan.tanggalEl.value.trim();
  return a ? n === a.nomor && t === a.tanggal : !n && !t;
}

function krTerapkan(f, daftar) {
  const pil = krPilihRegister(daftar, krNilai(f, "#tgl_kuasa"));
  if (pil.jenis === "pakai") {
    if (krBelumDisunting()) {
      krIsi(pil.register);
      krGambarCatatan(f, "Register kuasa yang sama di perkara ini diisikan otomatis.", null);
    }
  } else if (pil.jenis === "baru") {
    if (krBelumDisunting()) {
      krKeadaan.nomorEl.value = "";
      krKeadaan.tanggalEl.value = "";
      krKeadaan.diisiOtomatis = null;
    }
    const ref = pil.lain[pil.lain.length - 1];
    krGambarCatatan(
      f,
      `Kuasa ini sudah punya register (No. ${ref.nomorRegister || "-"}, tgl ${krTanggalTampil(ref.tanggalRegister) || "-"}) untuk surat kuasa tanggal ${krTanggalTampil(ref.tanggalSuratKuasa) || "lain"}. Tanggal surat kuasa ini berbeda, jadi isi register baru.`,
      ref
    );
  } else {
    krGambarCatatan(f, "", null);
  }
}

async function krPeriksa() {
  const f = krBolehTampil() ? krBorangTerbuka() : null;
  if (!f) {
    krKeadaan.borang = null;
    return false;
  }
  if (!krPasangBaris(f)) return true;
  const nomor = krNomorPerkara();
  const nama = krNilai(f, "#fullname");
  const kunciNama = krKunciNama(nama);
  if (!nomor || !kunciNama) {
    krGambarCatatan(f, "", null);
    return true;
  }
  const kunciDaftar = `${nomor}|${kunciNama}`;
  const kunci = `${kunciDaftar}|${krNilai(f, "#tgl_kuasa")}`;
  if (kunci === krKeadaan.kunci) return true;
  krKeadaan.kunci = kunci;
  let daftar = krKeadaan.daftar.get(kunciDaftar);
  if (!daftar) {
    const janji = krAmbil(nomor, nama);
    krKeadaan.tertunda = janji;
    daftar = await janji;
    if (krKeadaan.tertunda !== janji || krKeadaan.kunci !== kunci) return true;
    if (!daftar) {
      krKeadaan.kunci = ""; // gagal baca: dicoba lagi pada denyut berikutnya
      return true;
    }
    krKeadaan.daftar.set(kunciDaftar, daftar);
    if (krKeadaan.daftar.size > 40) krKeadaan.daftar.delete(krKeadaan.daftar.keys().next().value);
  }
  krTerapkan(f, daftar);
  return true;
}

/* --- Simpan ikut tombol Simpan SIPP --- */

function krToast(teks, galat) {
  try {
    const t = krEl("div", "aleta-kr-toast", teks);
    t.setAttribute("data-aleta-tanda", "register");
    t.style.cssText = `position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483000;max-width:min(520px,calc(100vw - 32px));padding:8px 14px;border-radius:6px;font:13px/1.4 "Segoe UI",system-ui,sans-serif;color:#fff;background:${galat ? "#a32a1f" : "#1f7a4d"};box-shadow:0 4px 14px rgba(0,0,0,.35);`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), galat ? 9000 : 3500);
  } catch {
    /* pemberitahuan hanya kenyamanan */
  }
}

async function krKirim(muatan) {
  try {
    const r = await fetch(KR_API, { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(muatan) });
    // Belum masuk portal / peran tanpa hak panel: bukan galat yang perlu dikabarkan tiap Simpan (fitur ini tidak berlaku bagi akun itu).
    if (r.status === 401 || r.status === 403 || r.status === 404) return "diabaikan";
    return r.ok;
  } catch {
    return false;
  }
}

/** Menunggu jawaban SIPP atas pengiriman borang (jembatan.js, jenis "dengar-simpan") - {st} atau null (lewat batas). */
function krTungguBukti(id) {
  return new Promise((selesai) => {
    let jam = null;
    const dengar = (peristiwa) => {
      if (peristiwa.source !== window) return;
      const isi = peristiwa.data;
      if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.jenis !== "bukti-simpan" || isi.id !== id) return;
      window.removeEventListener("message", dengar);
      clearTimeout(jam);
      selesai(isi);
    };
    jam = setTimeout(() => {
      window.removeEventListener("message", dengar);
      selesai(null);
    }, KR_BATAS_BUKTI_MS);
    window.addEventListener("message", dengar);
  });
}

/** SIPP menjawab berhasil: st 1; bila jembatan hanya mendengar pesan popup (tanpa st), berhasil = ada kata "berhasil" dan bukan peringatan. */
function krBerhasil(bukti) {
  if (!bukti) return false;
  if (bukti.st === 1) return true;
  if (bukti.st === 0) return false;
  const p = String(bukti.pesan || "");
  return /berhasil/i.test(p) && !/peringatan|tidak berhasil|gagal/i.test(p);
}

function krSaatKirim(e) {
  const f = e && e.target;
  if (!f || f !== krKeadaan.borang || !f.matches || !f.matches(KR_BORANG)) return;
  const nomorRegister = krKeadaan.nomorEl ? krKeadaan.nomorEl.value.trim() : "";
  const tanggalRegister = krKeadaan.tanggalEl ? krKeadaan.tanggalEl.value.trim() : "";
  const muatan = {
    nomorPerkara: krNomorPerkara(),
    namaKuasa: krNilai(f, "#fullname"),
    pihakKe: Number(krNilai(f, "#pihak_ke")) || 1,
    pihakNama: krNamaPihak(f),
    tanggalSuratKuasa: krNilai(f, "#tgl_kuasa"),
    nomorRegister,
    tanggalRegister,
  };
  if (!muatan.nomorPerkara || !krKunciNama(muatan.namaKuasa)) return;
  if (!nomorRegister && !tanggalRegister) return;
  if (tanggalRegister && !krTanggalIso(tanggalRegister)) {
    krToast("Tanggal register kuasa tidak sah (tulis tgl/bln/tahun), jadi register tidak ikut disimpan.", true);
    return;
  }
  krKeadaan.nomorBukti += 1;
  const id = `aleta-kuasa-register-${Date.now()}-${krKeadaan.nomorBukti}`;
  krKeadaan.terakhirId = id;
  // Telinga jembatan dipasang SEBELUM jawaban SIPP tiba (permintaan ini diproses sebelum respons jaringan).
  if (typeof saksiscanJembatan === "function") void saksiscanJembatan({ jenis: "dengar-simpan", borang: KR_BORANG, bukti: id });
  void krTungguBukti(id).then(async (bukti) => {
    // Hanya pengiriman TERAKHIR yang dipakai (pengiriman lama yang dibatalkan petugas tidak boleh menimpa).
    if (krKeadaan.terakhirId !== id || !krBerhasil(bukti)) return;
    const ok = await krKirim(muatan);
    if (ok === "diabaikan") return;
    if (ok) {
      krKeadaan.daftar.delete(`${muatan.nomorPerkara}|${krKunciNama(muatan.namaKuasa)}`);
      krToast("Nomor dan tanggal register kuasa tersimpan.", false);
    } else {
      krToast("Data kuasa sudah tersimpan di SIPP, tetapi nomor dan tanggal register belum tersimpan. Buka lagi data kuasa itu lalu tekan Simpan.", true);
    }
  });
}

/* --- Pemantau (hidup selama borang terbuka) --- */

function krPantau(ada) {
  if (ada && !krKeadaan.pantau) {
    krKeadaan.pantau = (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.interval : (fn, ms) => setInterval(fn, ms))(() => {
      void krPeriksa()
        .then((masih) => {
          if (!masih) krPantau(false);
        })
        .catch(() => krPantau(false));
    }, KR_JEDA_PANTAU_MS);
  } else if (!ada && krKeadaan.pantau) {
    (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.hapus : (i) => clearInterval(i))(krKeadaan.pantau);
    krKeadaan.pantau = null;
  }
}

function krJadwalkan() {
  if (krKeadaan.jam) return;
  krKeadaan.jam = setTimeout(() => {
    krKeadaan.jam = null;
    void krPeriksa()
      .then((ada) => krPantau(ada))
      .catch(() => krPantau(false));
  }, 300);
}

function krMulai() {
  if (typeof document === "undefined" || !document.body || globalThis.__aletaKrTerpasang) return false;
  globalThis.__aletaKrTerpasang = true;
  document.addEventListener("submit", krSaatKirim, true);
  try {
    krKeadaan.pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
      const milikKita = (m) => {
        if (m.target && m.target.closest && m.target.closest(".aleta-reg-baris, .aleta-kr-toast")) return true;
        const baru = Array.from(m.addedNodes || []);
        return baru.length > 0 && baru.every((n) => n.nodeType === 1 && n.classList && (n.classList.contains("aleta-reg-baris") || n.classList.contains("aleta-kr-toast")));
      };
      const luar = daftar.some((m) => !milikKita(m));
      if (luar) krJadwalkan();
    });
    krKeadaan.pengamat.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  } catch {
    /* tanpa pengamat: tidak ada baris register - borang SIPP tetap seperti biasa */
  }
  krJadwalkan();
  return true;
}
/* KR mulai */
krMulai();

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("kuasa-register.js"); // K11-SELESAI
