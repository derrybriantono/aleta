"use strict";

/**
 * ============================================================================
 * ALETA Ai - GELEMBUNG CHAT DI SIPP, ABT, DAN PORTAL (tahap 2b, 23 Okt 2026)
 * ============================================================================
 *
 * Rencana ALETA Ai v2 bagian 10.1. Gelembung kecil di pojok KIRI bawah (panel
 * ALETA melayang di kanan; tombol Simpan SIPP/ABT ada di badan formulir) yang
 * dibuka menjadi panel pop-up: dapat digeser, diperkecil, diperbesar; layar
 * kecil (HP) = penuh layar, layar lebar (TV) = lebar terbatas.
 *
 * KEAMANAN
 *   - Ekstensi TIDAK memegang kunci API dan tidak memanggil layanan AI. Semua
 *     lewat rute portal ALETA yang SEASAL (/aleta/api/aleta-ai/...), memakai
 *     sesi masuk ALETA (cookie); jawaban dialirkan server (SSE).
 *   - Hak per peran ditegakkan server (matriks kemampuan & alat data); di sini
 *     gelembung hanya tampil bila server menjawab ALETA Ai aktif untuk akun ini.
 *   - Tidak menulis apa pun ke SIPP/ABT: jawaban hanya dapat DISALIN dengan
 *     tombol (konfirmasi petugas), tidak pernah diisikan otomatis. Jawaban
 *     ditampilkan sebagai TEKS (textContent), tidak pernah sebagai HTML.
 *   - Isi halaman SIPP tidak dikirim; hanya nomor perkara sebagai konteks,
 *     dan itu dapat dilepas ("Pertanyaan umum").
 *
 * e-COURT (23 Okt, keputusan pengguna): situsnya beda asal, jadi permintaan
 *   lewat port "aleta-ai-relai" ke pekerja latar (aleta-ai-relai.js) yang
 *   meneruskannya ke portal dengan sesi ALETA. Tidak ada data situs e-Court
 *   yang dikirim selain nomor perkara sebagai konteks.
 * SAKLAR: "aletaAiGelembung" (popup, bawaan menyala) dan saklar induk "aktif".
 * RIWAYAT: satu percakapan per perkara (atau "umum"), disimpan di server -
 *   tampil juga di layar ALETA Ai portal, dan sebaliknya.
 * Gaya di dalam Shadow DOM supaya tidak mengubah tampilan SIPP; warna dari
 * token --aleta-* (cadangan di dalam var()), tema dari tema-pusat.js.
 */
(function pasangGelembungAletaAi(akar) {
  if (!akar || !akar.document || akar.__aletaAiGelembung) return;
  akar.__aletaAiGelembung = true;

  const API = "/aleta/api/aleta-ai";
  const KUNCI_SAKLAR = "aletaAiGelembung";
  const KUNCI_PERCAKAPAN = "aletaAiGelembungPercakapan";
  const KUNCI_POSISI = "aletaAiGelembungPosisi";
  // Tanpa \b di depan: teks sel tabel SIPP dapat menempel ("Nomor Perkara684/Pdt.G/...").
  const POLA_NOMOR = /(?<![\d/])(\d{1,5}\/Pdt\.[A-Za-z]+(?:\.[A-Za-z]+)?\/\d{4}\/PA\.[A-Za-z]+)/;
  const doc = akar.document;

  const simpan = (() => {
    try {
      return akar.chrome && akar.chrome.storage && akar.chrome.storage.local ? akar.chrome.storage.local : null;
    } catch {
      return null;
    }
  })();
  const bacaSimpan = async (kunci) => {
    if (!simpan) return {};
    try {
      return (await simpan.get(kunci)) || {};
    } catch {
      return {};
    }
  };
  const tulisSimpan = async (isi) => {
    if (!simpan) return;
    try {
      await simpan.set(isi);
    } catch {
      /* PC ini menolak menulis: gelembung tetap jalan tanpa ingatan */
    }
  };

  // ─── Konteks perkara ──────────────────────────────────────────────────────

  function halamanPerkara() {
    const alamat = String(akar.location && akar.location.href);
    return /detil|detail|perkara_id=|perkara\/\d+|blangko/i.test(alamat);
  }

  /** Teks halaman per simpul, dipisah spasi (textContent menempelkan sel tabel dengan tombol di sebelahnya). */
  function teksHalaman() {
    if (!doc.body) return "";
    const bagian = [];
    let panjang = 0;
    const jalan = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
    for (let n = jalan.nextNode(); n && panjang < 20000; n = jalan.nextNode()) {
      const t = String(n.nodeValue || "").trim();
      if (!t) continue;
      bagian.push(t);
      panjang += t.length + 1;
    }
    return bagian.join(" ");
  }

  /** Nomor perkara halaman ini: pendeteksi SIPP yang sudah ada (konten.js) bila ada, lalu judul/isi halaman perkara. */
  function nomorKonteks() {
    try {
      if (typeof akar.cariNomorPerkara === "function") {
        const n = akar.cariNomorPerkara();
        if (n && POLA_NOMOR.test(String(n))) return String(n).match(POLA_NOMOR)[1];
      }
    } catch {
      /* jatuh ke cara sendiri */
    }
    if (!halamanPerkara()) return "";
    const dariJudul = String(doc.title || "").match(POLA_NOMOR);
    if (dariJudul) return dariJudul[1];
    const m = teksHalaman().match(POLA_NOMOR);
    return m ? m[1] : "";
  }

  // ─── Jaringan (seasal, sesi ALETA; e-Court lewat relai pekerja latar) ─────

  /** e-Court beda asal dengan portal: permintaan diteruskan pekerja latar (aleta-ai-relai.js). */
  const LEWAT_RELAI = /(^|\.)ecourt\.mahkamahagung\.go\.id$/i.test(String(akar.location && akar.location.hostname));

  /**
   * Permintaan lewat port "aleta-ai-relai" dengan bentuk jawaban mirip fetch:
   * {ok, status, json(), text(), body.getReader()} - pemanggil tidak perlu tahu jalurnya.
   */
  function mintaRelai(alamat, opsi = {}) {
    return new Promise((selesai) => {
      let port;
      try {
        port = akar.chrome.runtime.connect({ name: "aleta-ai-relai" });
      } catch {
        selesai({ ok: false, status: 502, json: async () => ({ ok: false, error: { message: "Pekerja latar ALETA tidak tersedia." } }), text: async () => "" });
        return;
      }
      const antre = [];
      let tunggu = null;
      let habis = false;
      let mulai = false;
      const dorong = (x) => {
        if (tunggu) {
          const t = tunggu;
          tunggu = null;
          t(x);
        } else antre.push(x);
      };
      const body = {
        getReader: () => ({
          read: () => (antre.length ? Promise.resolve(antre.shift()) : habis ? Promise.resolve({ done: true }) : new Promise((r) => (tunggu = r))),
        }),
      };
      const akhiri = () => {
        if (habis) return;
        habis = true;
        dorong({ done: true });
      };
      port.onMessage.addListener((m) => {
        if (m && typeof m.potong === "string") {
          if (!mulai) {
            mulai = true;
            selesai({ ok: true, status: 200, body, json: async () => ({}), text: async () => "" });
          }
          dorong({ value: m.potong, done: false });
          return;
        }
        if (m && m.selesai) {
          if (!mulai) {
            mulai = true;
            const status = Number(m.status) || 502;
            selesai({ ok: status < 400, status, json: async () => m.isi, text: async () => "" });
          }
          akhiri();
          try {
            port.disconnect();
          } catch {
            /* sudah putus */
          }
        }
      });
      port.onDisconnect.addListener(() => {
        if (!mulai) {
          mulai = true;
          selesai({ ok: false, status: 502, json: async () => ({ ok: false, error: { message: "Pekerja latar ALETA tidak menjawab." } }), text: async () => "" });
        }
        akhiri();
      });
      if (opsi.signal) {
        opsi.signal.addEventListener("abort", () => {
          try {
            port.disconnect();
          } catch {
            /* sudah putus */
          }
          akhiri();
        });
      }
      port.postMessage({ jalur: String(alamat).replace(/^\/aleta/, ""), metode: String(opsi.method || "GET"), badan: opsi.body ? JSON.parse(opsi.body) : undefined });
    });
  }

  const minta = (alamat, opsi = {}) => (LEWAT_RELAI ? mintaRelai(alamat, opsi) : akar.fetch(alamat, opsi));

  async function ambilJson(alamat, opsi = {}) {
    const r = await minta(alamat, { credentials: "include", cache: "no-store", ...opsi });
    let isi = null;
    try {
      isi = await r.json();
    } catch {
      isi = null;
    }
    if (!r.ok || !isi || isi.ok === false) {
      const pesan = (isi && isi.error && isi.error.message) || (r.status === 401 ? "Masuk ke portal ALETA dulu." : "Layanan belum dapat dihubungi.");
      const g = new Error(pesan);
      g.status = r.status;
      throw g;
    }
    return isi.data;
  }

  /** Membaca aliran SSE `data: {json}` dari rute pesan; tiap peristiwa ke `padaPeristiwa`. */
  async function bacaAliran(jawab, padaPeristiwa) {
    let sisa = "";
    const olah = (potong) => {
      sisa += potong;
      let i;
      while ((i = sisa.indexOf("\n\n")) >= 0) {
        const blok = sisa.slice(0, i);
        sisa = sisa.slice(i + 2);
        const data = blok
          .split("\n")
          .filter((b) => b.startsWith("data:"))
          .map((b) => b.slice(5).trim())
          .join("");
        if (!data) continue;
        try {
          padaPeristiwa(JSON.parse(data));
        } catch {
          /* blok rusak dilewati */
        }
      }
    };
    if (jawab.body && typeof jawab.body.getReader === "function") {
      const pembaca = jawab.body.getReader();
      let dekoder = null; // relai mengirim teks; Uint8Array hanya dari fetch seasal

      for (;;) {
        const { value, done } = await pembaca.read();
        if (done) break;
        if (typeof value === "string") olah(value);
        else {
          if (!dekoder) dekoder = new akar.TextDecoder();
          olah(dekoder.decode(value, { stream: true }));
        }
      }
    } else {
      olah(await jawab.text());
    }
    olah("\n\n");
  }

  // ─── Tampilan ─────────────────────────────────────────────────────────────

  const CSS = `
:host { all: initial; position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 13.5px;
  --aai-latar: var(--aleta-latar-naik, #f6f4ef); --aai-garis: var(--aleta-garis, #d5cec2); --aai-tulisan: var(--aleta-tulisan, #2b2721);
  --aai-lembut: var(--aleta-tulisan-lembut, #63594c); --aai-merek: var(--aleta-merek, #1c6f46); --aai-merek-tulisan: var(--aleta-latar-naik, #ffffff);
  --aai-latar-pengguna: var(--aleta-merek-latar, #e3efe8); --aai-bahaya: var(--aleta-lewat, #a33228); }
:host([data-tema="gelap"]) { --aai-latar: var(--aleta-latar, #16211c); --aai-garis: var(--aleta-garis, #2c3a34); --aai-tulisan: var(--aleta-tulisan, #e6ede8);
  --aai-lembut: var(--aleta-tulisan-lembut, #a3b4ab); --aai-merek: var(--aleta-merek, #7fd0a6); --aai-merek-tulisan: var(--aleta-latar, #16211c);
  --aai-latar-pengguna: var(--aleta-latar-naik, #1d2925); --aai-bahaya: var(--aleta-lewat, #eb968c); }
* { box-sizing: border-box; }
.gelembung { width: 52px; height: 52px; border-radius: 50%; border: 1px solid var(--aai-garis); background: var(--aai-merek); color: var(--aai-merek-tulisan);
  font-family: inherit; font-weight: 700; font-size: 13px; line-height: 1; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.gelembung:focus-visible, button:focus-visible, textarea:focus-visible { outline: 2px solid var(--aai-merek); outline-offset: 2px; }
.panel { position: fixed; left: 16px; bottom: 80px; width: min(420px, calc(100vw - 32px)); height: min(560px, calc(100vh - 110px)); display: flex; flex-direction: column;
  background: var(--aai-latar); color: var(--aai-tulisan); border: 1px solid var(--aai-garis); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.3); overflow: hidden; }
.panel[hidden] { display: none; }
:host([data-ukuran="besar"]) .panel { width: min(720px, calc(100vw - 32px)); height: min(80vh, calc(100vh - 110px)); }
:host([data-ukuran="kecil"]) .panel { height: auto; }
:host([data-ukuran="kecil"]) .isi, :host([data-ukuran="kecil"]) .tulis, :host([data-ukuran="kecil"]) .konteks { display: none; }
.kepala { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--aai-garis); cursor: move; user-select: none; touch-action: none; }
.kepala strong { flex: 1; font-size: 14px; }
.kepala button, .konteks button, .salin { background: transparent; color: var(--aai-tulisan); border: 1px solid var(--aai-garis); border-radius: 6px; padding: 3px 8px; font-size: 12px; cursor: pointer; }
.konteks { display: flex; gap: 6px; align-items: center; padding: 6px 10px; font-size: 12px; color: var(--aai-lembut); border-bottom: 1px solid var(--aai-garis); }
.konteks[hidden] { display: none; }
.konteks span { flex: 1; }
.isi { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.pesan { white-space: pre-wrap; word-wrap: break-word; line-height: 1.45; padding: 8px 10px; border-radius: 10px; max-width: 92%; }
.pesan.pengguna { align-self: flex-end; background: var(--aai-latar-pengguna); }
.pesan.ai { align-self: flex-start; border: 1px solid var(--aai-garis); }
.pesan .salin { display: block; margin-top: 6px; }
.status { font-size: 12px; color: var(--aai-lembut); padding: 0 10px 4px; min-height: 16px; }
.status.galat { color: var(--aai-bahaya); }
.tulis { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--aai-garis); }
textarea { flex: 1; resize: none; min-height: 40px; max-height: 140px; font: inherit; font-size: 13.5px; color: var(--aai-tulisan); background: transparent;
  border: 1px solid var(--aai-garis); border-radius: 8px; padding: 6px 8px; }
.kirim { background: var(--aai-merek); color: var(--aai-merek-tulisan); border: 0; border-radius: 8px; padding: 0 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
.kirim:disabled { opacity: .55; cursor: default; }
.kaki { font-size: 12px; padding: 4px 10px 8px; color: var(--aai-lembut); }
.kaki a { color: var(--aai-merek); }
@media (max-width: 600px) {
  .panel, :host([data-ukuran="besar"]) .panel { left: 0 !important; top: 0 !important; bottom: 0; right: 0; width: 100vw; height: 100vh; border-radius: 0; }
}
@media (min-width: 2200px) { :host { font-size: 15px; } }
`;

  let tuan = null;
  let bayang = null;
  let el = {};
  let percakapanPerKonteks = {};
  let konteksAktif = "";
  let konteksDilepas = false;
  let sedangKirim = false;
  let pengendali = null;

  function buatElemen(nama, atribut = {}, anak = []) {
    const e = doc.createElement(nama);
    for (const [k, v] of Object.entries(atribut)) {
      if (k === "teks") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const a of anak) e.appendChild(a);
    return e;
  }

  function terapkanTema() {
    if (!tuan) return;
    const html = doc.documentElement;
    const tanda = html && html.getAttribute("data-aleta-tema");
    let gelap = tanda === "gelap" || Boolean(html && html.classList && html.classList.contains("dark"));
    // e-Court tidak memuat tema-pusat.js: tanpa tanda, ikuti tema sistem.
    if (!tanda && LEWAT_RELAI) {
      try {
        gelap = Boolean(akar.matchMedia && akar.matchMedia("(prefers-color-scheme: dark)").matches);
      } catch {
        /* terang */
      }
    }
    tuan.setAttribute("data-tema", gelap ? "gelap" : "terang");
  }

  function setStatus(teks, galat = false) {
    if (!el.status) return;
    el.status.textContent = teks || "";
    el.status.classList.toggle("galat", Boolean(galat));
  }

  function tambahPesan(peran, teks) {
    const p = buatElemen("div", { class: `pesan ${peran}` });
    const isi = buatElemen("div", { class: "teks", teks });
    p.appendChild(isi);
    if (peran === "ai") {
      const salin = buatElemen("button", { type: "button", class: "salin", teks: "Salin" });
      salin.addEventListener("click", async () => {
        try {
          await akar.navigator.clipboard.writeText(isi.textContent || "");
          setStatus("Jawaban disalin. Tempel sendiri di tempat yang Anda pilih.");
        } catch {
          setStatus("Tidak dapat menyalin otomatis; pilih teksnya lalu salin.", true);
        }
      });
      p.appendChild(salin);
    }
    el.isi.appendChild(p);
    el.isi.scrollTop = el.isi.scrollHeight;
    return isi;
  }

  function tampilKonteks() {
    if (!el.konteks) return;
    const ada = Boolean(konteksAktif);
    el.konteks.hidden = !ada;
    if (!ada) return;
    el.konteksTeks.textContent = konteksDilepas ? "Pertanyaan umum (tanpa perkara)." : `Tanya tentang ${konteksAktif}?`;
    el.konteksTombol.textContent = konteksDilepas ? `Pakai ${konteksAktif}` : "Pertanyaan umum";
  }

  const kunciKonteks = () => (konteksAktif && !konteksDilepas ? konteksAktif : "umum");

  async function idPercakapan() {
    const kunci = kunciKonteks();
    if (percakapanPerKonteks[kunci]) return percakapanPerKonteks[kunci];
    const data = await ambilJson(`${API}/percakapan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perkara: kunci === "umum" ? "" : kunci }),
    });
    percakapanPerKonteks = { ...percakapanPerKonteks, [kunci]: String(data.id) };
    await tulisSimpan({ [KUNCI_PERCAKAPAN]: percakapanPerKonteks });
    return percakapanPerKonteks[kunci];
  }

  async function kirim() {
    const teks = String(el.masukan.value || "").trim();
    if (!teks || sedangKirim) return;
    sedangKirim = true;
    el.kirim.disabled = true;
    el.masukan.value = "";
    tambahPesan("pengguna", teks);
    const wadah = tambahPesan("ai", "");
    setStatus("Menyiapkan jawaban...");
    try {
      let id = await idPercakapan();
      pengendali = new akar.AbortController();
      let jawab = await minta(`${API}/percakapan/${encodeURIComponent(id)}/pesan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ teks }),
        signal: pengendali.signal,
      });
      if (jawab.status === 404) {
        // Percakapan disembunyikan dari portal: mulai yang baru untuk konteks ini.
        delete percakapanPerKonteks[kunciKonteks()];
        id = await idPercakapan();
        jawab = await minta(`${API}/percakapan/${encodeURIComponent(id)}/pesan`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ teks }),
          signal: pengendali.signal,
        });
      }
      if (!jawab.ok) {
        let pesan = "Jawaban belum berhasil dibuat.";
        try {
          const isi = await jawab.json();
          pesan = (isi && isi.error && isi.error.message) || pesan;
        } catch {
          /* tetap pesan umum */
        }
        throw new Error(pesan);
      }
      let selesai = false;
      await bacaAliran(jawab, (e) => {
        if (!e || typeof e !== "object") return;
        if (e.jenis === "teks") wadah.textContent += String(e.delta || "");
        else if (e.jenis === "alat") setStatus(`Membaca ${e.label || "data"} dari SIPP...`);
        else if (e.jenis === "perkiraan") setStatus(`Mode ${e.label || e.mode || ""}...`);
        else if (e.jenis === "selesai") {
          selesai = true;
          setStatus(`Selesai. Biaya Rp${Number(e.biayaRp || 0).toLocaleString("id-ID")}.`);
        } else if (e.jenis === "gagal") {
          selesai = true;
          if (!wadah.textContent) wadah.parentElement.remove();
          setStatus(String(e.pesan || "Jawaban belum berhasil dibuat."), true);
        }
        el.isi.scrollTop = el.isi.scrollHeight;
      });
      if (!selesai) setStatus("Jawaban terhenti sebelum selesai.", true);
    } catch (g) {
      if (!wadah.textContent && wadah.parentElement) wadah.parentElement.remove();
      setStatus(g && g.name === "AbortError" ? "Jawaban dihentikan." : String((g && g.message) || "Layanan belum dapat dihubungi."), true);
    } finally {
      sedangKirim = false;
      pengendali = null;
      el.kirim.disabled = false;
    }
  }

  function aturUkuran(u) {
    if (!tuan) return;
    if (u) tuan.setAttribute("data-ukuran", u);
    else tuan.removeAttribute("data-ukuran");
  }

  function pasangGeser() {
    let mulai = null;
    el.kepala.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      const r = el.panel.getBoundingClientRect();
      mulai = { x: e.clientX, y: e.clientY, kiri: r.left, atas: r.top };
      try {
        el.kepala.setPointerCapture(e.pointerId);
      } catch {
        /* tidak semua peramban */
      }
    });
    el.kepala.addEventListener("pointermove", (e) => {
      if (!mulai) return;
      const lebar = akar.innerWidth || 1024;
      const tinggi = akar.innerHeight || 768;
      const kiri = Math.max(0, Math.min(lebar - 120, mulai.kiri + e.clientX - mulai.x));
      const atas = Math.max(0, Math.min(tinggi - 60, mulai.atas + e.clientY - mulai.y));
      el.panel.style.left = `${kiri}px`;
      el.panel.style.top = `${atas}px`;
      el.panel.style.bottom = "auto";
    });
    const akhiri = () => {
      if (!mulai) return;
      mulai = null;
      void tulisSimpan({ [KUNCI_POSISI]: { left: el.panel.style.left, top: el.panel.style.top } });
    };
    el.kepala.addEventListener("pointerup", akhiri);
    el.kepala.addEventListener("pointercancel", akhiri);
  }

  function bangun(posisi, asalPortal) {
    tuan = buatElemen("div", { id: "aleta-ai-gelembung", "data-aleta-ui": "aleta-ai" });
    bayang = tuan.attachShadow({ mode: "open" });
    bayang.appendChild(buatElemen("style", { teks: CSS }));

    el.gelembung = buatElemen("button", { type: "button", class: "gelembung", "aria-label": "Tanya ALETA Ai", "aria-expanded": "false", title: "Tanya ALETA Ai", teks: "Ai" });
    el.kepala = buatElemen("div", { class: "kepala" }, [buatElemen("strong", { teks: "ALETA Ai" })]);
    el.perkecil = buatElemen("button", { type: "button", "aria-label": "Perkecil", title: "Perkecil", teks: "–" });
    el.perbesar = buatElemen("button", { type: "button", "aria-label": "Perbesar", title: "Perbesar", teks: "□" });
    el.tutup = buatElemen("button", { type: "button", "aria-label": "Tutup", title: "Tutup", teks: "×" });
    el.kepala.append(el.perkecil, el.perbesar, el.tutup);
    el.konteksTeks = buatElemen("span");
    el.konteksTombol = buatElemen("button", { type: "button" });
    el.konteks = buatElemen("div", { class: "konteks" }, [el.konteksTeks, el.konteksTombol]);
    el.isi = buatElemen("div", { class: "isi", role: "log", "aria-live": "polite" });
    el.status = buatElemen("div", { class: "status", role: "status" });
    el.masukan = buatElemen("textarea", { rows: "2", "aria-label": "Pertanyaan untuk ALETA Ai", placeholder: "Tulis pertanyaan... (Enter kirim, Shift+Enter baris baru)" });
    el.kirim = buatElemen("button", { type: "button", class: "kirim", teks: "Kirim" });
    el.tulis = buatElemen("div", { class: "tulis" }, [el.masukan, el.kirim]);
    // Di e-Court tautan memakai alamat portal tersimpan; tanpa itu tautannya tidak ditampilkan.
    const alamatPortal = LEWAT_RELAI ? (asalPortal ? `${String(asalPortal).replace(/\/+$/, "")}/aleta-ai` : "") : "/aleta/aleta-ai";
    const tautan = alamatPortal ? buatElemen("a", { href: alamatPortal, target: "_blank", rel: "noopener", teks: "Buka riwayat di portal" }) : null;
    el.kaki = buatElemen("div", { class: "kaki" }, tautan ? [doc.createTextNode("Draf AI - wajib diperiksa. "), tautan] : [doc.createTextNode("Draf AI - wajib diperiksa.")]);
    el.panel = buatElemen("div", { class: "panel", role: "dialog", "aria-label": "ALETA Ai" }, [el.kepala, el.konteks, el.isi, el.status, el.tulis, el.kaki]);
    el.panel.hidden = true;
    if (posisi && posisi.left && posisi.top) {
      el.panel.style.left = posisi.left;
      el.panel.style.top = posisi.top;
      el.panel.style.bottom = "auto";
    }
    bayang.append(el.gelembung, el.panel);

    el.gelembung.addEventListener("click", () => {
      const buka = el.panel.hidden;
      el.panel.hidden = !buka;
      el.gelembung.setAttribute("aria-expanded", String(buka));
      if (buka) {
        konteksAktif = nomorKonteks();
        tampilKonteks();
        el.masukan.focus();
      }
    });
    el.tutup.addEventListener("click", () => {
      el.panel.hidden = true;
      el.gelembung.setAttribute("aria-expanded", "false");
      if (pengendali) pengendali.abort();
    });
    el.perkecil.addEventListener("click", () => aturUkuran(tuan.getAttribute("data-ukuran") === "kecil" ? "" : "kecil"));
    el.perbesar.addEventListener("click", () => aturUkuran(tuan.getAttribute("data-ukuran") === "besar" ? "" : "besar"));
    el.konteksTombol.addEventListener("click", () => {
      konteksDilepas = !konteksDilepas;
      tampilKonteks();
    });
    el.kirim.addEventListener("click", () => void kirim());
    el.masukan.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void kirim();
      } else if (e.key === "Escape") {
        el.tutup.click();
      }
    });
    pasangGeser();
    doc.body.appendChild(tuan);
    terapkanTema();
    try {
      new akar.MutationObserver(terapkanTema).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-aleta-tema", "class"] });
    } catch {
      /* tanpa pengamat: tema saat dibuka saja */
    }
  }

  function lepas() {
    if (pengendali) pengendali.abort();
    if (tuan && tuan.parentNode) tuan.parentNode.removeChild(tuan);
    tuan = null;
    bayang = null;
    el = {};
  }

  async function nilai() {
    const s = await bacaSimpan(["aktif", KUNCI_SAKLAR, KUNCI_PERCAKAPAN, KUNCI_POSISI, "asalPortal"]);
    const hidup = s.aktif !== false && s[KUNCI_SAKLAR] !== false;
    if (!hidup) {
      lepas();
      return;
    }
    if (tuan) return;
    // Layar ALETA Ai portal sudah memuat percakapan yang sama: tidak perlu gelembung kedua.
    if (/^\/aleta\/aleta-ai(\/|$)/.test(String(akar.location && akar.location.pathname))) return;
    percakapanPerKonteks = s[KUNCI_PERCAKAPAN] && typeof s[KUNCI_PERCAKAPAN] === "object" ? { ...s[KUNCI_PERCAKAPAN] } : {};
    // Hanya tampil bila server menyatakan ALETA Ai aktif bagi akun yang masuk.
    let ringkas = null;
    try {
      ringkas = await ambilJson(`${API}/ringkas`);
    } catch {
      ringkas = null;
    }
    if (!ringkas || ringkas.aktif !== true || tuan) return;
    if (!doc.body) return;
    bangun(s[KUNCI_POSISI], s.asalPortal);
  }

  try {
    if (akar.chrome && akar.chrome.storage && akar.chrome.storage.onChanged) {
      akar.chrome.storage.onChanged.addListener((ubah, tempat) => {
        if (tempat === "local" && (ubah[KUNCI_SAKLAR] || ubah.aktif)) void nilai();
      });
    }
  } catch {
    /* tanpa pendengar: berlaku saat halaman dimuat ulang */
  }

  akar.aletaAiGelembung = { nilai, lepas, nomorKonteks, bacaAliran };
  void nilai();
})(typeof window !== "undefined" ? window : null);
