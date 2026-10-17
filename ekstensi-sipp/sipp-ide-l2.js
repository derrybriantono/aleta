"use strict";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1: SEPULUH PENANDA (Tahap L2, 16 Okt 2026)
 * ============================================================================
 *
 * Penanda kecil di halaman SIPP:
 *   - daftar perkara & Jadwal Sidang: di bawah nomor perkara tiap baris;
 *   - halaman perkara (perkara_detil*): satu baris "Penanda ALETA" di bawah
 *     tombol-tombol SIPP (table#submenus);
 *   - daftar perkara, khusus Ketua/Admin: kotak "Lewat 5 bulan" di atas tabel.
 * Tiap penanda adalah tombol: diklik -> penjelasan, sumber data, dasar hukum.
 *
 * Aturan dan teksnya di bot (aleta_bot/services/sippIdeL2Service.js), saringan
 * peran di portal (/api/aleta-ecourt/sipp-ide-l2). Di sini hanya menggambar.
 *
 * TIDAK MENGUBAH SIPP: hanya menambah elemen berkelas `aleta-sisip aleta-l2`
 * (diabaikan pengamat konten.js, disembunyikan saat cetak & mode senyap) dan
 * tombol `type="button"`. Gagal = diam; tidak ada kotak galat di halaman SIPP.
 *
 * Saklar (popup-ide-l2.js): aktif (induk ALETA), ideL2 (induk penanda), dan
 * satu kunci per penanda. Tidak ada kunci = menyala.
 *
 * Seluruh isi dibungkus fungsi: skrip konten berbagi lingkup global dengan
 * konten.js dkk., dan satu nama const yang sama mematikan berkas yang dimuat
 * belakangan.
 */
(function () {
  if (typeof window === "undefined" || window.__aletaIdeL2) return;
  window.__aletaIdeL2 = true;

  const API = "/aleta/api/aleta-ecourt/sipp-ide-l2";
  const KUNCI = {
    sita: "ideL2Sita",
    eksekusi: "ideL2Eksekusi",
    "izin-cerai": "ideL2IzinCerai",
    "penetapan-awal": "ideL2Penetapan",
    "belum-ditunda": "ideL2BelumDitunda",
    "potensi-verstek": "ideL2Verstek",
    "umur-perkara": "ideL2Umur",
    "tanpa-sidang-berikut": "ideL2TanpaSidang",
    "sisa-ikrar": "ideL2Ikrar",
    "akta-cerai": "ideL2AktaCerai",
    "lewat-5-bulan": "ideL2LimaBulan",
    "ecourt-verifikasi": "ideL2EcourtVerifikasi",
  };
  const POLA = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;
  const LABEL_NOMOR = /^nomor\s+perkara\s*:?$/i;
  const ATR = "data-aleta-l2";
  /** Elemen milik ALETA (konten.js, panel, sisipan) - baris di dalamnya bukan baris SIPP. */
  // Bukan [class*="aleta-"]: konten.js memberi baris SIPP sendiri kelas aleta-baris-disorot.
  const BUKAN_SIPP = '[id^="aleta-"], .aleta-panel, .aleta-sisip, .aleta-tanda, [data-aleta-tanda], [data-aleta-l2]';

  /** Di dalam elemen ALETA? Diperiksa dari INDUKNYA - simpul SIPP sendiri boleh berkelas ALETA. */
  function diDalamAleta(el) {
    const induk = el && el.parentElement;
    return Boolean(induk && induk.closest(BUKAN_SIPP));
  }
  /**
   * Teks SIPP sebuah sel TANPA sisipan ALETA di dalamnya (tombol ABT/ALETA L1,
   * lencana konten.js, penanda ini sendiri). Sel nomor perkara non-e-Court SIPP
   * tidak berspasi sesudah nomornya: "123/Pdt.G/2026/PA.Dgl" + "ABTALETA" tidak
   * lagi cocok dengan pola nomor (batas kata hilang) - penandanya dulu tidak
   * pernah tergambar di baris itu (audit 17 Okt). Simpul ALETA diganti spasi.
   */
  function teksSipp(el) {
    if (!el) return "";
    let t = "";
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) t += n.nodeValue;
      else if (n.nodeType === 1) t += n.matches && n.matches(BUKAN_SIPP) ? " " : teksSipp(n);
    }
    return t;
  }
  const TINGKAT_URUT = { merah: 0, oranye: 1, kuning: 2, biru: 3, abu: 4, hijau: 5 };
  const NAMA_TINGKAT = { merah: "perlu tindakan", oranye: "perhatian", kuning: "perhatian", biru: "keterangan", abu: "keterangan", hijau: "baik" };

  const keadaan = {
    saklar: { aktif: true, ideL2: true, kode: {} },
    siap: false,
    sidik: "",
    jawaban: null,
    lima: null,
    sedang: false,
    jeda: 0,
  };

  const gudang = (() => {
    try {
      return chrome && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
    } catch {
      return null;
    }
  })();

  // ── saklar ────────────────────────────────────────────────────────────────

  async function bacaSaklar() {
    const kunci = ["aktif", "ideL2", ...Object.values(KUNCI)];
    let s = {};
    try {
      s = gudang ? (await gudang.get(kunci)) || {} : {};
    } catch {
      s = {};
    }
    const kode = {};
    for (const [k, nama] of Object.entries(KUNCI)) kode[k] = s[nama] !== false;
    keadaan.saklar = { aktif: s.aktif !== false, ideL2: s.ideL2 !== false, kode };
    keadaan.siap = true;
  }

  /** Tampilan Lama tidak berubah sama sekali (sama dengan L1/M1/M2) - penanda Ide ALETA hanya di Baru & UI Baru. */
  function modeLama() {
    try {
      // eslint-disable-next-line no-undef
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  function nyala() {
    return keadaan.saklar.aktif && keadaan.saklar.ideL2 && !modeLama();
  }

  function bolehKode(kode) {
    return nyala() && keadaan.saklar.kode[kode] !== false;
  }

  // ── halaman ───────────────────────────────────────────────────────────────

  function jenisHalaman() {
    const jalur = String(location.pathname || "");
    if (/perkara_detil|detil[_-]?perkara|detail[_-]?perkara/i.test(jalur)) return "detil";
    if (/\/(?:perkara_list|perkara_[a-z]+_list(?:_[a-z]+)?|sidang_list|jadwal_sidang_list|main)(?:\/|$)/i.test(jalur)) return "daftar";
    return "";
  }

  function nomorHalamanDetil() {
    for (const sel of Array.from(document.querySelectorAll("td, th"))) {
      if (diDalamAleta(sel)) continue;
      if (!LABEL_NOMOR.test(String(sel.textContent || "").replace(/\s+/g, " ").trim())) continue;
      let isi = sel.nextElementSibling;
      if (isi && /^:?$/.test(String(isi.textContent || "").trim())) isi = isi.nextElementSibling || isi;
      const cocok = isi ? POLA.exec(teksSipp(isi)) : null;
      if (cocok) return cocok[1];
    }
    // Sebagian halaman perkara memuat nomornya hanya di judul jendela.
    const judul = POLA.exec(String(document.title || ""));
    return judul ? judul[1] : "";
  }

  /** Baris tabel SIPP yang memuat nomor perkara, satu per nomor. */
  function barisDaftar() {
    const hasil = [];
    const terlihat = new Set();
    for (const baris of Array.from(document.querySelectorAll("tr"))) {
      if (diDalamAleta(baris)) continue;
      let nomor = "";
      let sel = null;
      for (const c of Array.from(baris.cells || [])) {
        const cocok = POLA.exec(teksSipp(c));
        if (cocok) {
          nomor = cocok[1];
          sel = c;
          break;
        }
      }
      if (!nomor || terlihat.has(nomor.toLowerCase())) continue;
      terlihat.add(nomor.toLowerCase());
      hasil.push({ nomor, baris, sel });
      if (hasil.length >= 100) break;
    }
    return hasil;
  }

  // ── gaya ──────────────────────────────────────────────────────────────────

  function pasangGaya() {
    if (document.getElementById("aleta-l2-gaya")) return;
    const g = document.createElement("style");
    g.id = "aleta-l2-gaya";
    g.textContent = `
.aleta-sisip.aleta-l2{margin:3px 0 0;padding:0;border:0;background:none;font-size:11px;line-height:1.5}
.aleta-l2-wadah{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.aleta-sisip.aleta-l2-detil{margin:6px 0;padding:5px 8px;border:1px solid #d6dde6;border-left:3px solid #2563eb;border-radius:6px;background:#f8fafc}
.aleta-l2-judul{font-weight:700;font-size:11px;color:#334155;margin-right:4px}
button.aleta-l2-pil{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:3px;padding:0 7px;border-radius:999px;border:1px solid;font:600 10.5px/17px -apple-system,"Segoe UI",sans-serif;white-space:nowrap}
button.aleta-l2-pil:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
button.aleta-l2-pil[data-tingkat=merah]{background:#fee2e2;color:#991b1b;border-color:#fca5a5}
button.aleta-l2-pil[data-tingkat=oranye]{background:#ffedd5;color:#9a3412;border-color:#fdba74}
button.aleta-l2-pil[data-tingkat=kuning]{background:#fef9c3;color:#854d0e;border-color:#fde047}
button.aleta-l2-pil[data-tingkat=biru]{background:#dbeafe;color:#1e40af;border-color:#93c5fd}
button.aleta-l2-pil[data-tingkat=abu]{background:#f1f5f9;color:#475569;border-color:#cbd5e1}
button.aleta-l2-pil[data-tingkat=hijau]{background:#dcfce7;color:#166534;border-color:#86efac}
.aleta-sisip.aleta-l2-jelas{position:fixed;z-index:2147483000;max-width:360px;margin:0;padding:10px 12px;border:1px solid #cbd5e1;border-left:4px solid #2563eb;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 8px 24px rgba(15,23,42,.18);font:12.5px/1.55 -apple-system,"Segoe UI",sans-serif;text-align:left}
.aleta-l2-jelas h4{margin:0 22px 4px 0;font-size:13px}
.aleta-l2-jelas p{margin:4px 0}
.aleta-l2-jelas .aleta-l2-kecil{color:#475569;font-size:11.5px}
.aleta-l2-jelas .aleta-l2-cek{color:#9a3412;font-size:11.5px;font-weight:600}
.aleta-l2-jelas button.aleta-l2-tutup{all:unset;cursor:pointer;position:absolute;top:6px;right:8px;font-size:15px;color:#64748b}
.aleta-sisip.aleta-l2-lima{margin:6px 0;padding:6px 10px;border:1px solid #fca5a5;border-left:4px solid #dc2626;border-radius:6px;background:#fff7f7;font-size:12px}
.aleta-sisip.aleta-l2-lima[data-nol]{border-color:#86efac;border-left-color:#16a34a;background:#f6fef8}
.aleta-l2-lima summary{cursor:pointer;font-weight:700}
.aleta-l2-lima ol{margin:4px 0 0 18px;padding:0;columns:3;font-size:11.5px}
`;
    (document.head || document.documentElement).appendChild(g);
  }

  // ── penjelasan (klik penanda) ─────────────────────────────────────────────

  function tutupJelas() {
    for (const el of Array.from(document.querySelectorAll(".aleta-l2-jelas"))) el.remove();
  }

  function bukaJelas(p, tombol) {
    tutupJelas();
    const kotak = document.createElement("div");
    kotak.className = "aleta-sisip aleta-l2-jelas";
    kotak.setAttribute(ATR, "jelas");
    kotak.setAttribute("role", "dialog");
    kotak.setAttribute("aria-label", `Penjelasan: ${p.label}`);
    const tutup = document.createElement("button");
    tutup.type = "button";
    tutup.className = "aleta-l2-tutup";
    tutup.textContent = "×";
    tutup.setAttribute("aria-label", "Tutup penjelasan");
    tutup.addEventListener("click", tutupJelas);
    const judul = document.createElement("h4");
    judul.textContent = `${p.label} — ${NAMA_TINGKAT[p.tingkat] || "keterangan"}`;
    const isi = document.createElement("p");
    isi.textContent = p.jelas;
    const sumber = document.createElement("p");
    sumber.className = "aleta-l2-kecil";
    sumber.textContent = `Sumber data: ${p.sumber}`;
    const dasar = document.createElement("p");
    dasar.className = "aleta-l2-kecil";
    dasar.textContent = `Dasar: ${p.dasar}`;
    kotak.append(tutup, judul, isi, sumber, dasar);
    if (p.perluDicek) {
      const cek = document.createElement("p");
      cek.className = "aleta-l2-cek";
      cek.textContent = "Dasar/ambang penanda ini masih perlu dicek pengguna.";
      kotak.appendChild(cek);
    }
    const kaki = document.createElement("p");
    kaki.className = "aleta-l2-kecil";
    kaki.textContent = "Penanda ALETA - hanya keterangan, data SIPP tidak diubah.";
    kotak.appendChild(kaki);
    document.body.appendChild(kotak);
    const r = tombol.getBoundingClientRect();
    const lebar = Math.min(360, (window.innerWidth || 800) - 16);
    kotak.style.left = `${Math.max(8, Math.min(r.left, (window.innerWidth || 800) - lebar - 8))}px`;
    const bawah = r.bottom + 6;
    kotak.style.top = `${bawah + 220 > (window.innerHeight || 600) ? Math.max(8, r.top - 226) : bawah}px`;
    tutup.focus();
  }

  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(".aleta-l2-jelas") || t.closest("button.aleta-l2-pil")) return;
      tutupJelas();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") tutupJelas();
  });

  function pil(p) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "aleta-l2-pil";
    b.setAttribute("data-tingkat", p.tingkat);
    b.setAttribute("data-kode", p.kode);
    b.textContent = p.label;
    b.title = `ALETA: ${p.jelas} (klik untuk dasar hukumnya)`;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (b.getAttribute("aria-expanded") === "true" && document.querySelector(".aleta-l2-jelas")) {
        tutupJelas();
        b.setAttribute("aria-expanded", "false");
        return;
      }
      bukaJelas(p, b);
      b.setAttribute("aria-expanded", "true");
    });
    return b;
  }

  function urutkan(daftar) {
    return [...daftar].sort((a, b) => (TINGKAT_URUT[a.tingkat] ?? 9) - (TINGKAT_URUT[b.tingkat] ?? 9));
  }

  // ── menggambar ────────────────────────────────────────────────────────────

  function bersihkan() {
    tutupJelas();
    for (const el of Array.from(document.querySelectorAll(`[${ATR}]`))) el.remove();
  }

  function penandaUntuk(nomor, detil) {
    const j = keadaan.jawaban;
    if (!j || !j.perkara) return [];
    const kunci = Object.keys(j.perkara).find((k) => k.toLowerCase() === String(nomor).toLowerCase());
    const isi = kunci ? j.perkara[kunci] : null;
    const daftar = isi && Array.isArray(isi.penanda) ? isi.penanda : [];
    return urutkan(daftar.filter((p) => bolehKode(p.kode) && (detil || !p.hanyaDetil)));
  }

  function gambarDaftar(baris) {
    for (const { nomor, sel } of baris) {
      if (!sel || !sel.isConnected) continue;
      const lama = sel.querySelector(`:scope > [${ATR}="baris"]`);
      if (lama) lama.remove();
      const daftar = penandaUntuk(nomor, false);
      if (!daftar.length) continue;
      const wadah = document.createElement("div");
      wadah.className = "aleta-sisip aleta-l2 aleta-l2-wadah";
      wadah.setAttribute(ATR, "baris");
      for (const p of daftar) wadah.appendChild(pil(p));
      sel.appendChild(wadah);
    }
  }

  function gambarDetil(nomor) {
    const lama = document.querySelector(`[${ATR}="detil"]`);
    if (lama) lama.remove();
    const daftar = penandaUntuk(nomor, true);
    if (!daftar.length) return;
    const wadah = document.createElement("div");
    wadah.className = "aleta-sisip aleta-l2 aleta-l2-detil aleta-l2-wadah";
    wadah.setAttribute(ATR, "detil");
    wadah.setAttribute("role", "group");
    wadah.setAttribute("aria-label", "Penanda ALETA untuk perkara ini");
    const judul = document.createElement("span");
    judul.className = "aleta-l2-judul";
    judul.textContent = "Penanda ALETA:";
    wadah.appendChild(judul);
    for (const p of daftar) wadah.appendChild(pil(p));
    const acuan = document.querySelector("table#submenus");
    if (acuan && acuan.parentNode) acuan.parentNode.insertBefore(wadah, acuan.nextSibling);
    else {
      const tab = document.querySelector('[id^="tabs"]');
      if (tab && tab.parentNode) tab.parentNode.insertBefore(wadah, tab);
      else return;
    }
  }

  function gambarLimaBulan() {
    const lama = document.querySelector(`[${ATR}="lima"]`);
    if (lama) lama.remove();
    const l = keadaan.lima;
    if (!l || !l.tersedia || !bolehKode("lewat-5-bulan")) return;
    if (!/perkara_list|\/main(?:\/|$)/i.test(String(location.pathname || ""))) return;
    const tabel = document.querySelector("table#tablePerkaraAll");
    if (!tabel || !tabel.parentNode) return;
    const kotak = document.createElement("details");
    kotak.className = "aleta-sisip aleta-l2 aleta-l2-lima";
    kotak.setAttribute(ATR, "lima");
    if (!l.jumlah) kotak.setAttribute("data-nol", "");
    const ring = document.createElement("summary");
    ring.textContent = l.jumlah
      ? `ALETA: ${l.jumlah} perkara belum putus sudah lewat 5 bulan - Ketua Majelis wajib melapor (SEMA 2/2014)`
      : "ALETA: tidak ada perkara belum putus yang lewat 5 bulan (SEMA 2/2014)";
    kotak.appendChild(ring);
    if (l.jumlah) {
      const daftar = document.createElement("ol");
      for (const x of l.daftar.slice(0, 60)) {
        const li = document.createElement("li");
        li.textContent = `${x.nomor} - ${x.hari} hari (lewat ${x.lewat})`;
        daftar.appendChild(li);
      }
      kotak.appendChild(daftar);
    }
    const dasar = document.createElement("p");
    dasar.className = "aleta-l2-kecil";
    dasar.style.margin = "4px 0 0";
    dasar.textContent = `Dasar: ${String(l.dasar || "SEMA 2/2014").replace(/\.\s*$/, "")}. Hari dihitung di luar mediasi. Data SIPP tidak diubah.`;
    kotak.appendChild(dasar);
    tabel.parentNode.insertBefore(kotak, tabel);
  }

  // ── meminta ───────────────────────────────────────────────────────────────

  async function minta(nomor) {
    try {
      const r = await fetch(API, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorPerkara: nomor }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      const isi = j && j.data !== undefined ? j.data : j;
      return isi && isi.tersedia ? isi : null;
    } catch {
      return null;
    }
  }

  async function mintaLimaBulan() {
    try {
      const r = await fetch(`${API}?info=lima-bulan`, { credentials: "include", cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.data !== undefined ? j.data : j;
    } catch {
      return null;
    }
  }

  let segarPada = 0;
  async function segarkan(paksa) {
    if (keadaan.sedang) return;
    keadaan.sedang = true;
    try {
      if (!keadaan.siap) await bacaSaklar();
      if (!nyala()) {
        bersihkan();
        keadaan.sidik = "";
        return;
      }
      const jenis = jenisHalaman();
      if (!jenis) return;
      let nomor = [];
      let baris = [];
      if (jenis === "detil") {
        const n = nomorHalamanDetil();
        if (n) nomor = [n];
      } else {
        baris = barisDaftar();
        nomor = baris.map((x) => x.nomor);
      }
      if (!nomor.length) return;
      const sidik = `${jenis}|${nomor.join("|")}`;
      // Jawaban dipakai ulang 5 menit (penanda "belum ditunda" bergantung jam).
      const basi = Date.now() - segarPada > 5 * 60 * 1000;
      if (paksa || sidik !== keadaan.sidik || basi || !keadaan.jawaban) {
        const j = await minta(nomor);
        if (!nyala()) return;
        keadaan.jawaban = j;
        keadaan.sidik = sidik;
        segarPada = Date.now();
        if (jenis === "daftar" && j && Array.isArray(j.boleh) && j.boleh.includes("lewat-5-bulan") && !keadaan.lima) {
          keadaan.lima = await mintaLimaBulan();
        }
      }
      if (!keadaan.jawaban) return;
      if (jenis === "detil") gambarDetil(nomor[0]);
      else {
        gambarDaftar(baris);
        gambarLimaBulan();
      }
    } catch {
      /* diam: SIPP tetap seperti semula */
    } finally {
      keadaan.sedang = false;
    }
  }

  function jadwalkan(paksa) {
    clearTimeout(keadaan.jeda);
    keadaan.jeda = setTimeout(() => void segarkan(paksa), 450);
  }

  /** Perubahan yang SELURUHNYA milik ALETA tidak memicu penyegaran (mencegah putaran). */
  function milikAleta(simpul) {
    if (!simpul || simpul.nodeType !== 1 || !simpul.closest) return false;
    return Boolean(simpul.closest(BUKAN_SIPP)) && !/^(TR|TD|TBODY|TABLE)$/.test(simpul.tagName);
  }

  if (typeof MutationObserver === "function" && document.body) {
    new MutationObserver((daftar) => {
      for (const u of daftar) {
        const berubah = [...Array.from(u.addedNodes || []), ...Array.from(u.removedNodes || [])];
        if (!berubah.length) continue;
        if (berubah.every((s) => s.nodeType !== 1 || milikAleta(s) || milikAleta(u.target))) continue;
        jadwalkan(false);
        return;
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local") return;
      const kunci = ["aktif", "ideL2", ...Object.values(KUNCI)];
      if (!kunci.some((k) => k in ubah)) return;
      void bacaSaklar().then(() => {
        bersihkan();
        keadaan.lima = null;
        jadwalkan(true);
      });
    });
  } catch {
    /* di luar ekstensi */
  }

  // Lama <-> Baru/UI Baru diikuti seketika (audit 17 Okt: dulu penanda tampil
  // dan meminta portal di Tampilan Lama).
  document.addEventListener("aleta-uji-berubah", () => {
    bersihkan();
    keadaan.lima = null;
    keadaan.sidik = "";
    jadwalkan(true);
  });

  pasangGaya();
  void bacaSaklar().then(() => jadwalkan(false));
  setInterval(() => {
    if (document.visibilityState === "visible") jadwalkan(false);
  }, 5 * 60 * 1000 + 1000);

  // Untuk uji (JSDOM): keadaan & penyegar tanpa jeda.
  window.__aletaIdeL2Uji = { keadaan, segarkan, bacaSaklar, barisDaftar, nomorHalamanDetil, jenisHalaman };
})();
