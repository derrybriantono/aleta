"use strict";

/**
 * ============================================================================
 * PUTUSAN ADVANCE DI BLANGKO ABT BY DERRY BRIANTONO (F4.4, 17 Okt 2026)
 * ============================================================================
 *
 * Skrip konten ABT, berkas TERSENDIRI (dimuat sesudah konseptor-langkah.js).
 * Alat "Putusan Advance (periksa draf)" di menu Alat saya (hakim):
 *
 *   1. naskah draf putusan diambil dari Blangko Derry (aletaBlangkoDerryIsian
 *      .naskahRtf - RTF yang sama dengan pratinjau/cetak, disusun ABT);
 *   2. dikirim bersama huruf alasan (#8503#) dan jawaban saksi tanya jawab ke
 *      portal POST /aleta/api/aleta-ecourt/putusan/advance;
 *   3. rapor ditampilkan di kartu melayang: unsur alasan, dasar hukum,
 *      konsistensi pertimbangan-amar, putusan serupa hakim yang sama (BHT),
 *      contoh alinea per unsur (nama disamarkan) + tombol Salin.
 *
 * HANYA MEMBACA. Tidak ada yang ditulis ke ABT, SIPP, atau basis data ALETA;
 * tombol Salin hanya menyalin ke papan klip - hakim sendiri yang menempel dan
 * menyimpan lewat Blangko Derry/ABT seperti biasa (tindakan hukum = kelas C).
 */
(function putusanAdvanceModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanAdvance) return;

  const API = "/aleta/api/aleta-ecourt/putusan/advance";
  const ID_KARTU = "bd-advance";
  const NAMA_LANGKAH = { duduk: "Duduk perkara", bukti: "Bukti surat", saksi: "Keterangan saksi", kesimpulan: "Kesimpulan", pertimbangan: "Pertimbangan hukum", amar: "Amar", biaya: "Biaya perkara", koreksi: "Koreksi majelis" };

  const S = { pk: null, rapor: null, memuat: false, galat: "", salinan: [] };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const kerangka = () => globalThis.aletaBlangkoDerry || null;
  const isian = () => globalThis.aletaBlangkoDerryIsian || null;
  const akar = () => document.getElementById("aleta-bd-akar");

  function keBase64(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /** Bahan yang dikirim: RTF draf, huruf alasan, jawaban saksi. Murni atas keadaan Blangko Derry. */
  function bahanDariKeadaan(k, perkara) {
    const tj = (k && k.tj) || {};
    const rows = Object.values(tj).flatMap((t) => (t && Array.isArray(t.rows) ? t.rows : []));
    const saksi = rows.map((r) => String((r && r.jawab) || "").trim()).filter(Boolean);
    return {
      nomorPerkara: String((k && k.pk && k.pk.nomorPerkara) || (perkara && perkara.nomorPerkara) || ""),
      jenisPerkara: String((perkara && perkara.jenisPerkara) || ""),
      huruf: String((k && k.isi && k.isi["8503"]) || ""),
      // Tanya jawab belum dibuka = tidak terkirim (bukan "saksi tidak menerangkan apa pun").
      saksi: Object.keys(tj).length ? saksi : undefined,
    };
  }

  async function ambil(alamat, opsi) {
    const o = { credentials: "include", cache: "no-store", ...(opsi || {}) };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, o, "Putusan Advance") : await fetch(alamat, o);
    const luar = await r.json().catch(() => null);
    const data = luar && luar.data !== undefined ? luar.data : luar;
    if (!r.ok || !luar || luar.ok === false || (data && data.ok === false)) {
      const sebab = (data && (data.sebab || data.alasan)) || (luar && luar.error && luar.error.message) || `Portal menjawab ${r.status}.`;
      const e = new Error(String(sebab));
      e.status = r.status;
      throw e;
    }
    return data;
  }

  // ── Kartu ──────────────────────────────────────────────────────────────────
  function kartu() {
    const a = akar();
    if (!a) return null;
    let k = document.getElementById(ID_KARTU);
    if (!k) {
      a.insertAdjacentHTML(
        "beforeend",
        `<div class="bd-float lebar" id="${ID_KARTU}" hidden role="dialog" aria-label="Putusan Advance" style="right:16px;top:72px;max-height:calc(100vh - 96px);overflow:auto;max-width:min(760px,calc(100vw - 32px))"></div>`
      );
      k = document.getElementById(ID_KARTU);
      k.addEventListener("click", saatKlik);
    }
    return k;
  }

  function warnaTingkat(t) {
    return t === "perhatian" ? "var(--warn)" : "var(--muted)";
  }

  function isiTemuan(r) {
    if (!r.temuan.length) return `<p style="color:var(--ok)">Tidak ada temuan. Tetap baca ulang seluruh naskah sebelum dibacakan.</p>`;
    return (
      `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">` +
      r.temuan
        .map(
          (t) =>
            `<li data-kode="${esc(t.kode)}" data-tingkat="${esc(t.tingkat)}"><b style="color:${warnaTingkat(t.tingkat)}">${t.tingkat === "perhatian" ? "⚠ " : "• "}${esc(t.judul)}</b>` +
            ` <span style="font-size:.72rem;color:var(--muted)">[${esc(NAMA_LANGKAH[t.langkah] || t.langkah)}]</span>` +
            `<br><span style="font-size:.8rem">${esc(t.rinci)}</span>` +
            (t.bukti && t.bukti.length ? `<br><span style="font-size:.75rem;color:var(--muted)">${t.bukti.map(esc).join("<br>")}</span>` : "") +
            `</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function isiAlasan(r) {
    if (!r.alasan.length) return "";
    S.salinan = [];
    let h = `<h4 style="margin:10px 0 4px">Alasan & unsur</h4>`;
    for (const a of r.alasan) {
      h += `<div style="margin:6px 0"><b>Huruf ${esc(a.huruf.toLowerCase())}</b> - ${esc(a.judul)}<br><span style="font-size:.75rem;color:var(--muted)">${esc(a.dasar.join("; "))}${a.didalilkan ? " · didalilkan" : ""}${a.dipertimbangkan ? " · dikutip di pertimbangan" : ""}</span>`;
      h += `<table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-top:4px"><thead><tr><th style="text-align:left">Unsur</th><th>Pertimbangan</th><th>Saksi</th><th>Putusan serupa</th></tr></thead><tbody>`;
      for (const u of a.unsur) {
        h +=
          `<tr data-unsur="${esc(u.kode)}" style="border-top:1px solid var(--line, #ddd)"><td>${esc(u.nama)}${u.dasar ? `<br><span style="font-size:.72rem;color:var(--muted)">${esc(u.dasar)}</span>` : ""}</td>` +
          `<td style="text-align:center;color:${u.dipertimbangkan ? "var(--ok)" : "var(--warn)"}">${u.dipertimbangkan ? "✓" : "belum"}</td>` +
          `<td style="text-align:center">${u.saksi === null ? "-" : u.saksi ? "✓" : "belum"}</td>` +
          `<td style="text-align:center">${u.lazim ? `${u.lazim.ada}/${u.lazim.dari}` : "-"}</td></tr>`;
        for (const c of u.contoh) {
          const i = S.salinan.push(c.teks) - 1;
          h +=
            `<tr><td colspan="4"><details><summary style="cursor:pointer;font-size:.78rem">Contoh alinea - ${esc(c.label)}</summary>` +
            `<p style="font-size:.8rem;white-space:pre-wrap;margin:4px 0">${esc(c.teks)}</p>` +
            `<button type="button" data-pa-salin="${i}" class="bd-btn">Salin alinea</button> <span style="font-size:.72rem;color:var(--muted)">Baca dan sesuaikan dengan fakta perkara ini sebelum dipakai.</span></details></td></tr>`;
        }
      }
      h += `</tbody></table></div>`;
    }
    return h;
  }

  function isiSerupa(r) {
    if (!r.serupa.length) return "";
    return (
      `<h4 style="margin:10px 0 4px">Putusan serupa (BHT, hakim yang sama)</h4><ul style="margin:0;padding-left:18px;font-size:.8rem">` +
      r.serupa
        .map((s) => `<li><b>${esc(s.nomor)}</b>${s.tanggalBht ? ` · BHT ${esc(s.tanggalBht)}` : ""} · sama: ${esc(s.sama.join(", ") || "-")}${s.beda.length ? ` · beda: ${esc(s.beda.join(", "))}` : ""}</li>`)
        .join("") +
      `</ul>`
    );
  }

  function isiKartu() {
    const kepala =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">` +
      `<b style="color:var(--accent)">Putusan Advance - periksa draf</b>` +
      `<button type="button" data-pa-tutup aria-label="Tutup" style="all:unset;cursor:pointer;padding:0 6px;color:var(--muted)">✕</button></div>`;
    const ket = `<p class="bd-catat">Hanya membaca draf putusan blangko ini. Tidak ada yang disimpan ke ABT atau SIPP; keputusan tetap pada majelis.</p>`;
    const k = isian() && typeof isian().keadaan === "function" ? isian().keadaan() : null;
    const put = k && k.blangko && k.blangko.jenis === "put";
    let isi = `${kepala}${ket}`;
    if (!put) return `${isi}<p class="bd-catat">Buka blangko <b>putusan</b> perkara ini di Blangko Derry dulu, lalu jalankan lagi.</p>`;
    isi += `<div style="font-size:.8rem;color:var(--muted)">${esc((k.pk && k.pk.nomorPerkara) || "")}</div>`;
    isi += `<p><button type="button" data-pa-periksa class="bd-btn" ${S.memuat ? "disabled" : ""}>${S.memuat ? "Memeriksa… (ABT menyusun naskah, bisa 1-5 menit)" : S.rapor ? "Periksa ulang" : "Periksa draf sekarang"}</button></p>`;
    if (S.galat) isi += `<p style="color:var(--warn)" role="alert">${esc(S.galat)}</p>`;
    const r = S.rapor;
    if (!r) return isi;
    isi += `<p><b>${esc(r.ringkas)}</b></p>`;
    const langkah = Object.entries(r.perLangkah || {});
    if (langkah.length) {
      isi += `<p style="font-size:.78rem">Per langkah checklist konseptor: ${langkah.map(([l, n]) => `${esc(NAMA_LANGKAH[l] || l)} ${n.perhatian ? `<b style="color:var(--warn)">${n.perhatian} perhatian</b>` : ""}${n.perhatian && n.catatan ? ", " : ""}${n.catatan ? `${n.catatan} catatan` : ""}`).join(" · ")}</p>`;
    }
    isi += isiTemuan(r) + isiAlasan(r) + isiSerupa(r);
    if (r.kutipan.length) {
      isi += `<h4 style="margin:10px 0 4px">Dasar hukum yang dikutip draf</h4><p style="font-size:.78rem">${r.kutipan.slice(0, 14).map((x) => esc(x.sebutan)).join("; ")}</p>`;
    }
    if (r.tidakDiperiksa.length) {
      isi += `<h4 style="margin:10px 0 4px">Tidak diperiksa</h4><ul style="margin:0;padding-left:18px;font-size:.78rem;color:var(--muted)">${r.tidakDiperiksa.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    }
    return isi;
  }

  function render() {
    const k = document.getElementById(ID_KARTU);
    if (k && !k.hidden) k.innerHTML = isiKartu();
  }

  async function salin(teks, tombol) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(teks);
      else {
        // SIPP/ABT satker lewat http bukan konteks aman: salin lewat textarea sementara.
        const t = document.createElement("textarea");
        t.value = teks;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }
      if (tombol) tombol.textContent = "Tersalin";
    } catch {
      if (tombol) tombol.textContent = "Gagal menyalin - pilih teksnya lalu Ctrl+C";
    }
  }

  async function periksa() {
    const api = isian();
    if (!api || typeof api.naskahRtf !== "function") {
      S.galat = "Blangko Derry belum siap (perbarui ekstensi).";
      return render();
    }
    const a = kerangka();
    const t = a && typeof a.perkaraTerpilih === "function" ? a.perkaraTerpilih() : null;
    const bahan = bahanDariKeadaan(api.keadaan(), t && t.perkara);
    if (!bahan.nomorPerkara) {
      S.galat = "Pilih perkara dulu.";
      return render();
    }
    S.memuat = true;
    S.galat = "";
    render();
    try {
      const rtf = await api.naskahRtf(false);
      const d = await ambil(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...bahan, rtfBase64: keBase64(rtf) }),
        batasMs: 90000,
      });
      S.rapor = d && d.rapor ? d.rapor : null;
      if (!S.rapor) S.galat = "Portal tidak mengembalikan rapor.";
    } catch (e) {
      S.galat = e && e.status === 403 ? "Putusan Advance hanya untuk akun yang berhak memakai Blangko ABT." : `Pemeriksaan gagal: ${String((e && e.message) || e)}`;
    } finally {
      S.memuat = false;
      render();
    }
  }

  function saatKlik(e) {
    const el = e.target && e.target.closest ? e.target : null;
    if (!el) return;
    if (el.closest("[data-pa-tutup]")) {
      document.getElementById(ID_KARTU).hidden = true;
      return;
    }
    if (el.closest("[data-pa-periksa]")) return void periksa();
    const s = el.closest("[data-pa-salin]");
    if (s) void salin(S.salinan[Number(s.getAttribute("data-pa-salin"))] || "", s);
  }

  function bukaKartu() {
    const k = kartu();
    if (!k) return;
    k.hidden = false;
    k.innerHTML = isiKartu();
  }

  function saatPerkara(e) {
    const d = e && e.detail;
    const baru = d ? String(d.perkaraId || "") : "";
    if (baru !== String((S.pk && S.pk.perkaraId) || "")) {
      S.rapor = null;
      S.galat = "";
    }
    S.pk = d ? { perkaraId: d.perkaraId, nomorPerkara: d.nomorPerkara } : null;
    render();
  }

  function mulai() {
    const a = kerangka();
    if (!a || typeof a.daftarkanAlat !== "function") return false;
    a.daftarkanAlat("advance", bukaKartu);
    document.addEventListener("aleta-bd-perkara", saatPerkara);
    return true;
  }

  globalThis.aletaPutusanAdvance = { mulai, bukaKartu, periksa, murni: { bahanDariKeadaan, keBase64 }, keadaan: () => ({ pk: S.pk, rapor: S.rapor, galat: S.galat, memuat: S.memuat }) };
  if (!mulai()) {
    let coba = 0;
    const ulang = setInterval(() => {
      coba += 1;
      if (mulai() || coba > 40) clearInterval(ulang);
    }, 250);
  }
})();
