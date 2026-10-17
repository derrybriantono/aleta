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
 *
 * TAHAP 2 (17 Okt 2026, "pemeriksa dulu, lalu draf utuh"): sesudah pemeriksaan
 * selesai, tombol "Susun draf utuh" meminta portal (rute yang sama, tindakan
 * "draf") menyusun draf putusan utuh mengikuti blangko terpilih. Pratinjaunya
 * tampil di kartu ini; berkasnya (RTF, dibuka di Word/ABT) hanya DIUNDUH ke
 * komputer pengguna - tidak ada yang dikirim ke ABT/SIPP. Bagian yang belum
 * pasti bertanda "[perlu dilengkapi: ...]" berwarna merah. Tombol hanya aktif
 * bila pemeriksaan sudah selesai DAN isian blangko belum berubah sesudahnya.
 */
(function putusanAdvanceModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanAdvance) return;

  const API = "/aleta/api/aleta-ecourt/putusan/advance";
  const ID_KARTU = "bd-advance";
  const NAMA_LANGKAH = { duduk: "Duduk perkara", bukti: "Bukti surat", saksi: "Keterangan saksi", kesimpulan: "Kesimpulan", pertimbangan: "Pertimbangan hukum", amar: "Amar", biaya: "Biaya perkara", koreksi: "Koreksi majelis" };

  // menyala: null = belum diketahui; false = akun ini dimatikan admin (Pengaturan SIPP & ABT > Putusan Advance, 17 Okt).
  const S = { pk: null, rapor: null, memuat: false, galat: "", salinan: [], menyala: null, sebabMati: "", draf: null, drafMemuat: false, drafGalat: "", sidik: "" };
  const PESAN_MATI = "Putusan Advance belum diaktifkan untuk akun Anda - hubungi admin.";

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

  /** Sidik isian saat pemeriksaan: berubah sesudahnya = rapor sudah basi, periksa ulang dulu. */
  function sidikKeadaan(k) {
    try {
      const b = bahanDariKeadaan(k, null);
      return JSON.stringify([(k && k.isi) || {}, (k && k.perlu) || [], b.saksi === undefined ? null : b.saksi]);
    } catch {
      return "";
    }
  }

  /** Isian blangko yang masih "perlu diisi" - dikirim supaya draf menandai bagiannya. */
  function isianKosongDariKeadaan(k) {
    const per = new Set((k && Array.isArray(k.perlu) ? k.perlu : []).map(String));
    const isian = (k && k.susunan && Array.isArray(k.susunan.isian) ? k.susunan.isian : []);
    return isian
      .filter((b) => b && per.has(String(b.kode)))
      .slice(0, 80)
      .map((b) => ({ kode: String(b.kode || ""), nama: String(b.nama || ""), jenis: String(b.jenis || ""), khusus: String(b.khusus || "") }));
  }

  /** Isian teks yang sudah terisi - bahan cadangan bila duduk perkara naskah tidak terbaca. */
  function bahanIsianDariKeadaan(k) {
    const nilai = (k && k.isi) || {};
    const isian = (k && k.susunan && Array.isArray(k.susunan.isian) ? k.susunan.isian : []);
    return isian
      .filter((b) => b && b.jenis === "teks" && typeof nilai[b.kode] === "string" && nilai[b.kode].trim())
      .slice(0, 60)
      .map((b) => ({ kode: String(b.kode || ""), nama: String(b.nama || ""), teks: String(nilai[b.kode]).slice(0, 6000), jenis: "teks", khusus: String(b.khusus || "") }));
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
      h += `<div style="margin:6px 0"><b>${a.huruf ? `Huruf ${esc(a.huruf.toLowerCase())}` : "Unsur perkara"}</b> - ${esc(a.judul)}<br><span style="font-size:.75rem;color:var(--muted)">${esc(a.dasar.join("; "))}${a.didalilkan ? " · didalilkan" : ""}${a.dipertimbangkan ? " · dikutip di pertimbangan" : ""}</span>`;
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

  /** Pratinjau draf utuh: tiap bagian, penanda merah, alinea contoh bergaris. */
  function isiPratinjauDraf(d) {
    const merah = "color:#c00000";
    let h = `<div style="max-height:340px;overflow:auto;border:1px solid var(--line,#ddd);border-radius:6px;padding:8px;font-size:.8rem" data-pa-pratinjau>`;
    for (const bg of d.bagian || []) {
      h += `<div data-bagian="${esc(bg.kunci)}" style="margin:0 0 8px"><div style="font-weight:600;font-size:.75rem;color:var(--muted)">${esc(bg.judul)}${bg.jumlahTanda ? ` · ${bg.jumlahTanda} perlu dilengkapi` : ""}</div>`;
      for (const p of bg.paragraf || []) {
        if (p.tanda) h += `<p data-pa-tanda style="margin:2px 0;${merah};font-weight:600">${esc(p.teks)}</p>`;
        else if (p.contoh) h += `<p data-pa-contoh style="margin:2px 0 2px 10px;${merah};border-left:3px solid #c00000;padding-left:6px">${esc(p.teks)}</p>`;
        else h += `<p style="margin:2px 0${p.gaya === "judul" || p.gaya === "tengah" ? ";text-align:center" : ""}">${esc(p.teks)}</p>`;
      }
      h += `</div>`;
    }
    return `${h}</div>`;
  }

  /** Blok "Susun draf utuh": aktif hanya sesudah pemeriksa selesai dan isian belum berubah. */
  function isiDraf() {
    const api = isian();
    const k = api && typeof api.keadaan === "function" ? api.keadaan() : null;
    const basi = Boolean(S.rapor && S.sidik && k && sidikKeadaan(k) !== S.sidik);
    const boleh = Boolean(S.rapor) && !S.memuat && !S.drafMemuat && !basi;
    let h = `<div data-pa-blokdraf style="margin:8px 0;padding:8px;border:1px solid var(--line,#ddd);border-radius:6px">`;
    h += `<b>Draf putusan utuh</b> <span style="font-size:.75rem;color:var(--muted)">disusun sesudah pemeriksaan, mengikuti blangko yang terpilih</span><br>`;
    h += `<button type="button" data-pa-draf class="bd-btn" ${boleh ? "" : "disabled"}>${S.drafMemuat ? "Menyusun… (bisa 1 menit)" : S.draf ? "Susun ulang draf utuh" : "Susun draf utuh"}</button>`;
    if (!S.rapor) h += ` <span style="font-size:.75rem;color:var(--muted)">Aktif sesudah pemeriksaan selesai.</span>`;
    if (basi) h += ` <span style="font-size:.75rem;color:var(--warn)" role="status">Isian blangko berubah sesudah pemeriksaan - periksa ulang dulu.</span>`;
    if (S.drafGalat) h += `<p style="color:var(--warn)" role="alert">${esc(S.drafGalat)}</p>`;
    const d = S.draf;
    if (d) {
      h += `<p style="font-size:.8rem;margin:6px 0">${esc(d.ringkas || "")}</p>`;
      if (d.sisa && d.sisa.jumlah) {
        h += `<p style="font-size:.78rem;color:var(--warn)" role="status">Saat diunggah ke ABT, peringatan akan muncul: ${esc(String(d.sisa.jumlah))} sisa blangko terdeteksi${(d.sisa.rincian || []).length ? ` (${d.sisa.rincian.map((x) => `${esc(x.label)} ${esc(String(x.jumlah))}`).join("; ")})` : ""}.</p>`;
      }
      if (Array.isArray(d.catatan) && d.catatan.length) h += `<ul style="margin:0 0 6px;padding-left:18px;font-size:.76rem;color:var(--muted)">${d.catatan.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`;
      h += `<p><button type="button" data-pa-unduh class="bd-btn">Unduh draf (Word)</button> <span style="font-size:.72rem;color:var(--muted)">Hanya diunduh ke komputer ini; bagian merah harus dilengkapi atau dihapus dulu.</span></p>`;
      h += isiPratinjauDraf(d);
      if (Array.isArray(d.serupa) && d.serupa.length) {
        h += `<p style="font-size:.76rem;color:var(--muted)">Putusan serupa yang menjadi pembanding: ${d.serupa.map((x) => esc(x.nomor)).join("; ")}.</p>`;
      }
    }
    return `${h}</div>`;
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
    if (S.menyala === false) return `${isi}<p style="color:var(--warn)" role="alert">${esc(S.sebabMati || PESAN_MATI)}</p>`;
    if (!put) return `${isi}<p class="bd-catat">Buka blangko <b>putusan</b> perkara ini di Blangko Derry dulu, lalu jalankan lagi.</p>`;
    isi += `<div style="font-size:.8rem;color:var(--muted)">${esc((k.pk && k.pk.nomorPerkara) || "")}</div>`;
    isi += `<p><button type="button" data-pa-periksa class="bd-btn" ${S.memuat ? "disabled" : ""}>${S.memuat ? "Memeriksa… (ABT menyusun naskah, bisa 1-5 menit)" : S.rapor ? "Periksa ulang" : "Periksa draf sekarang"}</button></p>`;
    if (S.galat) isi += `<p style="color:var(--warn)" role="alert">${esc(S.galat)}</p>`;
    const r = S.rapor;
    if (!r) return isi + isiDraf();
    isi += `<p><b>${esc(r.ringkas)}</b></p>`;
    isi += isiDraf();
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

  /** Tahap 2: portal menyusun draf utuh dari naskah blangko + hasil pemeriksa (dihitung ulang di sana). */
  async function susunDraf() {
    if (!S.rapor || S.drafMemuat) return;
    const api = isian();
    if (!api || typeof api.naskahRtf !== "function") {
      S.drafGalat = "Blangko Derry belum siap (perbarui ekstensi).";
      return render();
    }
    const k = api.keadaan();
    if (S.sidik && sidikKeadaan(k) !== S.sidik) {
      S.drafGalat = "Isian blangko berubah sesudah pemeriksaan. Periksa draf lagi dulu.";
      return render();
    }
    const a = kerangka();
    const t = a && typeof a.perkaraTerpilih === "function" ? a.perkaraTerpilih() : null;
    const bahan = bahanDariKeadaan(k, t && t.perkara);
    S.drafMemuat = true;
    S.drafGalat = "";
    render();
    try {
      const rtf = await api.naskahRtf(false);
      const d = await ambil(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...bahan, rtfBase64: keBase64(rtf), tindakan: "draf", isianKosong: isianKosongDariKeadaan(k), bahan: bahanIsianDariKeadaan(k) }),
        batasMs: 90000,
      });
      S.draf = d && d.draf ? d.draf : null;
      if (!S.draf) S.drafGalat = "Portal tidak mengembalikan draf.";
    } catch (e) {
      S.drafGalat = e && e.status === 403 ? "Draf utuh hanya untuk hakim, konseptor perkara ini, dan Admin." : `Draf gagal disusun: ${String((e && e.message) || e)}`;
    } finally {
      S.drafMemuat = false;
      render();
    }
  }

  /** Mengunduh RTF draf ke komputer; tidak mengirim apa pun ke ABT/SIPP. */
  function unduhDraf() {
    const d = S.draf;
    if (!d || !d.rtfBase64) return;
    const bin = atob(d.rtfBase64);
    const bita = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bita[i] = bin.charCodeAt(i);
    let alamat = "";
    let blobUrl = false;
    try {
      alamat = URL.createObjectURL(new Blob([bita], { type: "application/rtf" }));
      blobUrl = true;
    } catch {
      alamat = `data:application/rtf;base64,${d.rtfBase64}`;
    }
    const a = document.createElement("a");
    a.href = alamat;
    a.download = String(d.namaBerkas || "Draf putusan.rtf");
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blobUrl) setTimeout(() => { try { URL.revokeObjectURL(alamat); } catch { /* sudah dilepas */ } }, 4000);
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
    S.draf = null;
    S.drafGalat = "";
    render();
    try {
      const rtf = await api.naskahRtf(false);
      const sidik = sidikKeadaan(api.keadaan());
      const d = await ambil(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...bahan, rtfBase64: keBase64(rtf) }),
        batasMs: 90000,
      });
      S.rapor = d && d.rapor ? d.rapor : null;
      S.sidik = S.rapor ? sidik : "";
      if (!S.rapor) S.galat = "Portal tidak mengembalikan rapor.";
    } catch (e) {
      if (e && e.status === 403 && /belum diaktifkan/.test(String(e.message))) {
        S.menyala = false;
        S.sebabMati = String(e.message);
      }
      S.galat = e && e.status === 403 ? (S.menyala === false ? S.sebabMati : "Putusan Advance hanya untuk hakim, konseptor perkara ini (ditunjuk di ALETA atau tercatat di SIPP), dan Admin.") : `Pemeriksaan gagal: ${String((e && e.message) || e)}`;
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
    if (el.closest("[data-pa-draf]")) return void susunDraf();
    if (el.closest("[data-pa-unduh]")) return void unduhDraf();
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
      S.draf = null;
      S.drafGalat = "";
      S.sidik = "";
    }
    S.pk = d ? { perkaraId: d.perkaraId, nomorPerkara: d.nomorPerkara } : null;
    render();
  }

  /** Saklar per akun dari portal (GET); gagal dibaca = tetap tampil, rute yang menolak. */
  async function bacaMenyala() {
    try {
      const d = await ambil(API, { method: "GET" });
      S.menyala = d && d.menyala === false ? false : true;
      S.sebabMati = (d && d.sebab) || "";
    } catch (e) {
      if (e && e.status === 403 && /belum diaktifkan/.test(String(e.message))) {
        S.menyala = false;
        S.sebabMati = String(e.message);
      }
    }
    render();
  }

  function mulai() {
    const a = kerangka();
    if (!a || typeof a.daftarkanAlat !== "function") return false;
    a.daftarkanAlat("advance", bukaKartu);
    document.addEventListener("aleta-bd-perkara", saatPerkara);
    void bacaMenyala();
    return true;
  }

  globalThis.aletaPutusanAdvance = { mulai, bukaKartu, periksa, susunDraf, unduhDraf, murni: { bahanDariKeadaan, keBase64, sidikKeadaan, isianKosongDariKeadaan, bahanIsianDariKeadaan }, keadaan: () => ({ pk: S.pk, rapor: S.rapor, galat: S.galat, memuat: S.memuat, draf: S.draf, drafMemuat: S.drafMemuat, drafGalat: S.drafGalat }), menyala: () => S.menyala };
  if (!mulai()) {
    let coba = 0;
    const ulang = setInterval(() => {
      coba += 1;
      if (mulai() || coba > 40) clearInterval(ulang);
    }, 250);
  }
})();
