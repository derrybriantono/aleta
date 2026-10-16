"use strict";

/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA DI BLANGKO ABT BY DERRY BRIANTONO (F1.6)
 * ============================================================================
 *
 * Skrip konten ABT, berkas TERSENDIRI (dimuat sesudah blangko-derry-isian.js)
 * supaya tidak bertabrakan dengan tampilan Blangko Derry. Dua tugas:
 *
 *   1. LAPOR. blangko-derry-isian.js mengumumkan peristiwa "aleta-bd-isian"
 *      tiap kali kelengkapan isian dihitung. Untuk blangko PUTUSAN, daftar
 *      isian beserta terisi/kosongnya dikirim ke portal
 *      (POST /aleta/api/aleta-ecourt/konseptor-langkah { lapor }) - ditunda
 *      beberapa detik dan hanya bila berubah. Isian yang masih kosong membuat
 *      langkah draf putusannya belum selesai di Jadwal Sidang.
 *   2. ALAT "Checklist konseptor putusan" di menu Alat saya: kartu melayang
 *      berisi langkah penyusunan draf perkara terpilih, centang per langkah,
 *      siapa & kapan. Sama dengan yang dilihat majelis di Jadwal Sidang.
 *
 * Yang ditulis hanya basis data ALETA lewat rute portal; ABT dan SIPP tidak
 * disentuh. Aturan statusnya di portal (src/lib/konseptor-langkah.ts).
 */
(function konseptorLangkahModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaKonseptorLangkah) return;

  const API = "/aleta/api/aleta-ecourt/konseptor-langkah";
  const JEDA_LAPOR_MS = 4000;
  const ID_KARTU = "bd-konseptor";
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const S = {
    pk: null,
    jamLapor: null,
    tandaTerkirim: new Map(),
    menunggu: null,
    rinci: null,
    memuat: false,
    galat: "",
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const kerangka = () => globalThis.aletaBlangkoDerry || null;
  const akar = () => document.getElementById("aleta-bd-akar");

  /** "17 Okt 08.12" WITA - salinan waktuSingkat di src/lib/konseptor-langkah.ts. */
  function waktuSingkat(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return "";
    const w = new Date(d.getTime() + 8 * 3600 * 1000);
    return `${w.getUTCDate()} ${BLN[w.getUTCMonth()]} ${String(w.getUTCHours()).padStart(2, "0")}.${String(w.getUTCMinutes()).padStart(2, "0")}`;
  }

  async function ambil(alamat, opsi) {
    const o = { credentials: "include", cache: "no-store", ...(opsi || {}) };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, o, "Checklist konseptor") : await fetch(alamat, o);
    const luar = await r.json().catch(() => null);
    const data = luar && luar.data !== undefined ? luar.data : luar;
    if (!r.ok || !luar || luar.ok === false || (data && data.ok === false)) {
      const sebab = (data && data.alasan) || (luar && luar.error && luar.error.message) || `Portal menjawab ${r.status}.`;
      const e = new Error(String(sebab));
      e.status = r.status;
      throw e;
    }
    return data;
  }

  // ── 1. Lapor isian blangko putusan ────────────────────────────────────────
  function tandaLapor(d) {
    return `${d.berkas}|${d.isian.map((b) => `${b.kode}:${b.terisi ? 1 : 0}`).join(",")}`;
  }
  function saatIsian(e) {
    const d = e && e.detail;
    if (!d || d.jenis !== "put" || !/^\d+$/.test(String(d.perkaraId || "")) || !Array.isArray(d.isian) || !d.isian.length) return;
    S.menunggu = d;
    clearTimeout(S.jamLapor);
    S.jamLapor = setTimeout(() => void kirimLapor(), JEDA_LAPOR_MS);
  }
  async function kirimLapor() {
    const d = S.menunggu;
    S.menunggu = null;
    if (!d) return;
    const tanda = tandaLapor(d);
    if (S.tandaTerkirim.get(d.perkaraId) === tanda) return;
    try {
      const h = await ambil(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perkaraId: d.perkaraId, nomorPerkara: d.nomorPerkara, lapor: { berkas: d.berkas, isian: d.isian } }),
      });
      S.tandaTerkirim.set(d.perkaraId, tanda);
      if (h && h.kemajuan && S.pk && String(S.pk.perkaraId) === d.perkaraId) {
        S.rinci = h.kemajuan;
        render();
      }
    } catch {
      // Peran tanpa hak menyusun draf (403) atau portal mati: diam - Blangko
      // Derry tetap bekerja; checklist hanya tidak diperbarui dari blangko.
    }
  }

  // ── 2. Kartu checklist ─────────────────────────────────────────────────────
  function kartu() {
    const a = akar();
    if (!a) return null;
    let k = document.getElementById(ID_KARTU);
    if (!k) {
      a.insertAdjacentHTML(
        "beforeend",
        `<div class="bd-float lebar" id="${ID_KARTU}" hidden role="dialog" aria-label="Checklist konseptor putusan" style="right:16px;top:72px;max-height:calc(100vh - 96px)"></div>`
      );
      k = document.getElementById(ID_KARTU);
      k.addEventListener("change", saatCentang);
      k.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest("[data-kl-tutup]")) k.hidden = true;
      });
    }
    return k;
  }

  function isiKartu() {
    const pk = S.pk;
    const kepala =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">` +
      `<b style="color:var(--accent)">Checklist konseptor putusan</b>` +
      `<button type="button" data-kl-tutup aria-label="Tutup" style="all:unset;cursor:pointer;padding:0 6px;color:var(--muted)">✕</button></div>`;
    if (!pk) return `${kepala}<p class="bd-catat">Pilih perkara dulu.</p>`;
    let isi = `${kepala}<div style="font-size:.8rem;color:var(--muted)">${esc(pk.nomorPerkara || "")}</div>`;
    if (S.memuat && !S.rinci) return `${isi}<p class="bd-catat">Memuat checklist…</p>`;
    const r = S.rinci;
    if (r) {
      isi += `<p style="font-size:.8rem;color:var(--muted)">${
        r.blangko
          ? `Blangko: ${esc(r.blangko.berkas || "putusan")} - ${r.blangko.terisi} dari ${r.blangko.jumlah} isian terisi${r.blangko.pada ? ` (${esc(waktuSingkat(r.blangko.pada))})` : ""}.`
          : "Blangko putusan perkara ini belum dibuka di sini - pilih blangko putusan supaya isian kosong ikut diperiksa."
      }</p>`;
      isi += `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px">`;
      for (const l of r.langkah) {
        const warna = l.status === "selesai" ? "var(--ok)" : l.status === "kosong" ? "var(--warn)" : "var(--fg)";
        let ket = "";
        if (l.status === "selesai") ket = `${l.sumber === "blangko" ? "terisi di blangko" : "selesai"}${l.oleh ? ` oleh ${esc(l.oleh)}` : ""}${l.pada ? `, ${esc(waktuSingkat(l.pada))}` : ""}`;
        else if (l.status === "kosong" && l.blangko)
          ket = `${l.blangko.jumlah - l.blangko.terisi} isian masih kosong${l.blangko.kosong.length ? `: ${esc(l.blangko.kosong.join(", "))}` : ""}`;
        isi +=
          `<li data-langkah="${esc(l.kode)}" data-status="${esc(l.status)}" style="display:flex;gap:6px;align-items:flex-start">` +
          `<input type="checkbox" data-kl-langkah="${esc(l.kode)}" ${l.dicentang ? "checked" : ""} aria-label="Tandai selesai: ${esc(l.judul)}" style="margin-top:3px">` +
          `<span><b style="color:${warna}" title="${esc(l.keterangan)}">${l.status === "selesai" ? "✓ " : ""}${esc(l.judul)}</b>` +
          (ket ? `<br><span style="font-size:.78rem;color:var(--muted)">${ket}</span>` : "") +
          `</span></li>`;
      }
      isi += `</ul>`;
      isi += r.siap
        ? `<p style="color:var(--ok);font-weight:600">Draf siap dibacakan.</p>`
        : `<p style="font-size:.8rem;color:var(--muted)">${r.selesai} dari ${r.jumlah} langkah selesai. Majelis melihat kemajuan yang sama di Jadwal Sidang ALETA.</p>`;
    }
    if (S.galat) isi += `<p style="color:var(--warn)">${esc(S.galat)}</p>`;
    return isi;
  }

  function render() {
    const k = document.getElementById(ID_KARTU);
    if (k && !k.hidden) k.innerHTML = isiKartu();
  }

  async function muat() {
    if (!S.pk || !/^\d+$/.test(String(S.pk.perkaraId || ""))) {
      S.rinci = null;
      render();
      return;
    }
    const pid = String(S.pk.perkaraId);
    S.memuat = true;
    S.galat = "";
    render();
    try {
      const h = await ambil(`${API}?perkaraId=${encodeURIComponent(pid)}`);
      if (S.pk && String(S.pk.perkaraId) === pid) S.rinci = (h && h.peta && h.peta[pid]) || null;
    } catch (e) {
      S.galat = `Checklist tidak terbaca: ${String((e && e.message) || e)}`;
    } finally {
      S.memuat = false;
      render();
    }
  }

  async function saatCentang(e) {
    const el = e.target;
    const langkah = el && el.getAttribute && el.getAttribute("data-kl-langkah");
    if (!langkah || !S.pk) return;
    el.disabled = true;
    S.galat = "";
    try {
      const h = await ambil(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perkaraId: String(S.pk.perkaraId), nomorPerkara: S.pk.nomorPerkara, langkah, selesai: Boolean(el.checked) }),
      });
      if (h && h.kemajuan) S.rinci = h.kemajuan;
    } catch (err) {
      S.galat = err && err.status === 403 ? "Centang hanya oleh majelis dan panitera pengganti." : `Centang tidak tersimpan: ${String((err && err.message) || err)}`;
      el.checked = !el.checked;
    } finally {
      el.disabled = false;
      render();
    }
  }

  function bukaKartu() {
    const k = kartu();
    if (!k) return;
    const a = kerangka();
    if (!S.pk && a && typeof a.perkaraTerpilih === "function") {
      const t = a.perkaraTerpilih();
      if (t && t.perkara) S.pk = { perkaraId: t.perkara.perkaraId, nomorPerkara: t.perkara.nomorPerkara };
    }
    k.hidden = false;
    k.innerHTML = isiKartu();
    void muat();
  }

  function saatPerkara(e) {
    const d = e && e.detail;
    const lama = S.pk && String(S.pk.perkaraId);
    S.pk = d ? { perkaraId: d.perkaraId, nomorPerkara: d.nomorPerkara } : null;
    if (String((S.pk && S.pk.perkaraId) || "") !== String(lama || "")) {
      S.rinci = null;
      const k = document.getElementById(ID_KARTU);
      if (k && !k.hidden) void muat();
    }
  }

  function mulai() {
    const a = kerangka();
    if (!a || typeof a.daftarkanAlat !== "function") return false;
    a.daftarkanAlat("konseptor", bukaKartu);
    document.addEventListener("aleta-bd-perkara", saatPerkara);
    document.addEventListener("aleta-bd-isian", saatIsian);
    return true;
  }

  globalThis.aletaKonseptorLangkah = { mulai, bukaKartu, murni: { tandaLapor, waktuSingkat }, keadaan: () => ({ pk: S.pk, rinci: S.rinci, galat: S.galat }) };
  if (!mulai()) {
    let coba = 0;
    const ulang = setInterval(() => {
      coba += 1;
      if (mulai() || coba > 40) clearInterval(ulang);
    }, 250);
  }
})();
