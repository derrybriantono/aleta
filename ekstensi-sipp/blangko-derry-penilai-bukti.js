"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - PENILAIAN PEMBUKTIAN (A2, 1 Nov 2026)
 * ============================================================================
 *
 * Tabel ringkas "Penilaian pembuktian" di panel Blangko Derry (blangko putusan & BAS kesimpulan): satu baris per dalil dengan lencana
 * status (terbukti / belum terbukti / bertentangan / tidak perlu dibuktikan) + dasar (saksi mana, bukti mana). Bahan musyawarah
 * majelis, bukan putusan. Penilaiannya ATURAN di portal (lib/penilai-bukti.ts, POST aleta-ecourt/penilaian-bukti) - satu sumber
 * dengan agen A1; statusnya ikut tersimpan di matriks dalil.
 *
 * Perhitungan ulang otomatis TANPA tombol: setiap kali panel melapor perubahan (keterangan saksi/bukti tersimpan atau dimuat),
 * sidik bahan dibandingkan; berbeda = satu permintaan 1,5 detik sesudah perubahan terakhir (debounce). Sidik sama = tanpa
 * permintaan.
 *
 * KINERJA (arahan 1 Nov): dilipat bawaan; tanpa pemantauan berkala; sidik bahan dihitung dari teks yang sudah ada di memori
 * (FNV, tanpa pustaka); DOM hanya digambar bila bagiannya terbuka; paling banyak 40 baris sebelum "tampilkan semua"; hasil
 * disinggahkan per perkara.
 *
 * ALETA Ai (lapis 2, opsional): bila saklar ALETA Ai menyala dan fitur "C6" (penilaian lanjutan) tersedia, tombol kecil membuka
 * fitur itu dengan tabel ini sebagai bahan (teksUntukAi). Saat saklar mati tidak ada apa pun yang dimuat atau digambar.
 *
 * Fungsi murni (htmlTabel, ringkasPenilaian, sidikBahan, teksUntukAi) diuji tanpa DOM. Tidak ada yang ditulis ke ABT/SIPP/e-Court.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/penilaian-bukti";
  const TUNDA_MS = 1500;
  const SINGGAH_MS = 5 * 60 * 1000;
  const BATAS_BARIS = 40;
  const KODE_AI = "C6";

  const teks = (x) => String(x == null ? "" : x);
  const esc = (x) => teks(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const STATUS = {
    terbukti: { label: "terbukti", warna: "hijau" },
    "belum-terbukti": { label: "belum terbukti", warna: "kuning" },
    bertentangan: { label: "bertentangan", warna: "merah" },
    "tidak-perlu-dibuktikan": { label: "tidak perlu dibuktikan", warna: "abu" },
  };
  const URUT = ["terbukti", "belum-terbukti", "bertentangan", "tidak-perlu-dibuktikan"];

  /** Sidik bahan (FNV-1a 32 bit) - sama = tanpa permintaan baru. */
  function sidikBahan(b) {
    const t = JSON.stringify(b || null);
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  const statusBaris = (r) => (r && r.ditetapkan && STATUS[r.ditetapkan.status] ? r.ditetapkan.status : r && r.status);

  /** "12 dalil · 6 terbukti · 4 belum terbukti · 1 bertentangan · 1 tidak perlu dibuktikan". */
  function ringkasPenilaian(data) {
    if (!data || !data.ada || !data.hasil) return data && data.basi ? "sedang disusun dari berkas perkara" : "belum ada dalil yang dapat dinilai";
    const b = data.hasil.baris || [];
    const hit = {};
    for (const r of b) hit[statusBaris(r)] = (hit[statusBaris(r)] || 0) + 1;
    return [`${b.length} dalil`, ...URUT.filter((k) => hit[k]).map((k) => `${hit[k]} ${STATUS[k].label}`)].join(" · ");
  }

  function dasarHtml(r) {
    const s = (r.saksi || []).map((x) => {
      const ket = x.sikap === "sebaliknya" ? " (sebaliknya)" : x.langsung ? "" : " (dari cerita)";
      const judul = `${x.tanya ? `${x.tanya} - ` : ""}${x.kutipan}`;
      return `<span class="bd-pb-dasar${x.sikap === "sebaliknya" ? " lawan" : ""}" title="${esc(judul)}">${esc(x.label + ket)}</span>`;
    });
    const b = (r.bukti || []).map((x) => `<span class="bd-pb-dasar bukti" title="${esc(x.kelas)}${x.otentik ? " - akta otentik" : ""}">${esc(x.kode || x.kelas)}</span>`);
    const tt = (r.tidakTahu || []).length ? `<span class="bd-catat"> ${esc(r.tidakTahu.join(", "))} tidak tahu</span>` : "";
    return s.concat(b).join(" ") + tt || `<span class="bd-catat">-</span>`;
  }

  function barisHtml(r) {
    const st = statusBaris(r);
    const s = STATUS[st] || { label: teks(st), warna: "abu" };
    const keterangan = [r.alasan, ...(r.catatan || [])].filter(Boolean).join("\n");
    const tetap = r.ditetapkan ? ` <span class="bd-catat" title="Ditetapkan majelis; hitungan aturan: ${esc((STATUS[r.status] || {}).label || r.status)}">ditetapkan</span>` : "";
    const lemah = r.kekuatan === "lemah" && st !== "terbukti" ? ` <span class="bd-catat">lemah</span>` : "";
    return (
      `<tr><td class="bd-pd-no">${esc(r.nomor || "")}</td>` +
      `<td><span title="${esc(r.ringkas)}">${esc(r.ringkas)}</span></td>` +
      `<td><span class="bd-tanda ${s.warna}" title="${esc(keterangan)}">${esc(s.label)}</span>${lemah}${tetap}</td>` +
      `<td>${dasarHtml(r)}</td></tr>`
    );
  }

  /**
   * Isi bagian (tanpa pembungkus details).
   * @param {{ada:boolean, hasil:{baris:Array, kesimpulan?:{catatan:string[]}}, sumberBahan?:string, basi?:boolean, catatan?:string[]}|null} data
   * @param {{P:string,T:string}} sb
   */
  function htmlTabel(data, sb, semua, aiTersedia) {
    if (!data) return `<p class="bd-catat" role="status">Menilai pembuktian…</p>`;
    if (!data.ada || !data.hasil) return `<p class="bd-catat">${esc((data.catatan && data.catatan[0]) || "Belum ada dalil yang dapat dinilai.")}</p>`;
    const baris = data.hasil.baris || [];
    const tampil = semua ? baris : baris.slice(0, BATAS_BARIS);
    const sumber = data.sumberBahan === "panel" ? "keterangan saksi & bukti di panel ini" : data.sumberBahan === "abt" ? "keterangan saksi & bukti yang tersimpan" : "keterangan saksi & bukti di panel dan yang tersimpan";
    const kes = (data.hasil.kesimpulan && data.hasil.kesimpulan.catatan) || [];
    return (
      `<p class="bd-catat">Bahan musyawarah dari ${esc(sumber)} - bukan putusan. Arahkan penunjuk ke status untuk dasar lengkapnya (dua saksi bersesuaian / satu saksi + bukti lain / akta otentik / diakui lawan).${data.basi ? " Berkas baru sedang dibaca; bagian ini diperbarui sendiri." : ""}</p>` +
      (kes.length ? `<ul class="bd-pb-kesimpulan">${kes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "") +
      `<table class="bd-pd-tabel bd-pb-tabel"><thead><tr><th scope="col">No.</th><th scope="col">Dalil ${esc((sb && sb.P) || "")}</th><th scope="col">Status</th><th scope="col">Dasar</th></tr></thead>` +
      `<tbody>${tampil.map(barisHtml).join("")}</tbody></table>` +
      (baris.length > tampil.length ? `<button type="button" class="bd-btn kecil" data-pb="semua">Tampilkan ${baris.length - tampil.length} dalil lainnya</button>` : "") +
      (aiTersedia ? ` <button type="button" class="bd-btn kecil" data-pb="ai" title="Penilaian lanjutan atas tabel ini - hasilnya usulan untuk diperiksa">Penilaian lanjutan ALETA Ai</button>` : "")
    );
  }

  /** Tabel sebagai teks polos untuk bahan ALETA Ai (fitur C6) - tanpa nama saksi, hanya label & kutipan pendek. */
  function teksUntukAi(data) {
    if (!data || !data.hasil) return "";
    return (data.hasil.baris || [])
      .map((r) => {
        const s = (r.saksi || []).map((x) => `${x.label}${x.sikap === "sebaliknya" ? " (sebaliknya)" : x.langsung ? "" : " (dari cerita)"}: "${x.kutipan}"`).join("; ");
        const b = (r.bukti || []).map((x) => x.label).join(", ");
        return `[${r.id}] Dalil ${r.nomor || "-"}: ${r.ringkas}\n  Status aturan: ${(STATUS[statusBaris(r)] || {}).label || r.status} - ${r.alasan}\n  Saksi: ${s || "-"}\n  Bukti: ${b || "-"}`;
      })
      .join("\n");
  }

  // ── Keadaan per perkara ────────────────────────────────────────────────────
  const keadaan = new Map(); // kunci -> { data, sampai, sidik, waktu, jalan }
  const terbuka = new Set();
  const kunciPerkara = (nomor, sb) => `${teks(nomor)}|${teks(sb && sb.P)}|${teks(sb && sb.T)}`;
  const k0 = (kunci) => {
    let k = keadaan.get(kunci);
    if (!k) {
      k = { data: null, sampai: 0, sidik: "", waktu: 0, jalan: null, galat: "" };
      keadaan.set(kunci, k);
      if (keadaan.size > 30) keadaan.delete(keadaan.keys().next().value);
    }
    return k;
  };
  const tersinggah = (nomor, sb) => {
    const k = keadaan.get(kunciPerkara(nomor, sb));
    return k && k.data && k.sampai > Date.now() ? k.data : null;
  };

  function aiTersedia() {
    try {
      const A = globalThis.AletaBdAi;
      if (!A || typeof A.keadaan !== "function" || !A.keadaan().nyala) return false;
      return (A.FITUR || []).some((f) => f && f.kode === KODE_AI);
    } catch {
      return false;
    }
  }

  function gambar(o) {
    const el = typeof document !== "undefined" ? document.getElementById("bd-penilaian") : null;
    if (!el || !el.isConnected || el.dataset.pbKunci !== kunciPerkara(o.nomor, o.sebutan)) return;
    const k = keadaan.get(kunciPerkara(o.nomor, o.sebutan));
    const data = k ? k.data : null;
    const ringkas = el.querySelector("summary .bd-catat");
    if (ringkas && data) ringkas.textContent = ` · ${ringkasPenilaian(data)}`;
    const isi = el.querySelector(".bd-pb-isi");
    if (isi && el.open) isi.innerHTML = k && k.galat && !data ? `<p class="bd-catat" role="alert">Penilaian pembuktian belum terbaca: ${esc(k.galat)}.</p>` : htmlTabel(data, o.sebutan, el.dataset.pbSemua === "1", aiTersedia());
  }

  /** Kirim (POST) bahan panel; tanpa bahan = GET (bahan tersimpan di ABT). Satu permintaan berjalan per perkara. */
  function minta(o, bahan) {
    const kunci = kunciPerkara(o.nomor, o.sebutan);
    const k = k0(kunci);
    const dasar = { nomor: teks(o.nomor), lawan: teks(o.sebutan && o.sebutan.P) || "Penggugat", pelaku: teks(o.sebutan && o.sebutan.T) || "Tergugat" };
    const jalan = bahan
      ? o.ambil(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...dasar, ...bahan }) })
      : o.ambil(`${API}?${new URLSearchParams(dasar).toString()}`, {});
    k.jalan = Promise.resolve(jalan)
      .then((data) => {
        k.data = data;
        k.galat = "";
        k.sampai = Date.now() + SINGGAH_MS;
        gambar(o);
        return data;
      })
      .catch((e) => {
        k.galat = teks((e && e.message) || "server tidak menjawab");
        gambar(o);
        return null;
      })
      .finally(() => {
        k.jalan = null;
      });
    return k.jalan;
  }

  /**
   * Dipanggil panel setiap melapor perubahan (laporKeKerangka). Bahan berubah -> satu permintaan 1,5 detik kemudian. Tanpa bahan
   * (saksi & bukti belum dimuat di panel) tidak ada apa pun yang dikirim kecuali bagian ini dibuka (GET, bahan tersimpan).
   * @param {{nomor:string, sebutan:{P:string,T:string}, ambil:(url:string, opsi:object)=>Promise<any>, bahan:()=>object|null}} o
   */
  function segarkan(o) {
    if (!o || !o.nomor) return;
    let bahan = null;
    try {
      bahan = o.bahan ? o.bahan() : null;
    } catch {
      bahan = null;
    }
    const kunci = kunciPerkara(o.nomor, o.sebutan);
    const ada = keadaan.get(kunci);
    if (!bahan && !terbuka.has(kunci) && !(ada && ada.data)) return;
    const sidik = bahan ? sidikBahan(bahan) : "abt";
    const k = k0(kunci);
    if (k.sidik === sidik && k.data && k.sampai > Date.now()) return;
    k.sidik = sidik;
    clearTimeout(k.waktu);
    k.waktu = setTimeout(() => void minta(o, bahan), TUNDA_MS);
  }

  /** Pembungkus details (dilipat bawaan; dibuka lagi bila petugas sebelumnya membukanya untuk perkara yang sama). */
  function htmlBungkus(nomor, sb) {
    const kunci = kunciPerkara(nomor, sb);
    const buka = terbuka.has(kunci);
    const data = tersinggah(nomor, sb);
    return (
      `<details class="bd-tambahan bd-penilaian" id="bd-penilaian" data-pb-kunci="${esc(kunci)}"${buka ? " open" : ""}><summary>Penilaian pembuktian<span class="bd-catat"> · ${esc(data ? ringkasPenilaian(data) : "dalil x bukti x saksi, bahan musyawarah")}</span></summary>` +
      `<div class="bd-pb-isi">${buka ? htmlTabel(data, sb, false, aiTersedia()) : ""}</div></details>`
    );
  }

  /** Menghidupkan bagian yang sudah digambar (htmlBungkus). Membaca server saat dibuka bila belum ada hasil. */
  function pasang(el, o) {
    if (!el || el.dataset.pbPasang === "1") return;
    el.dataset.pbPasang = "1";
    const kunci = kunciPerkara(o.nomor, o.sebutan);
    el.addEventListener("toggle", () => {
      if (!el.open) return void terbuka.delete(kunci);
      terbuka.add(kunci);
      gambar(o);
      const k = keadaan.get(kunci);
      if (!(k && k.data && k.sampai > Date.now()) && !(k && k.jalan)) {
        let bahan = null;
        try {
          bahan = o.bahan ? o.bahan() : null;
        } catch {
          bahan = null;
        }
        k0(kunci).sidik = bahan ? sidikBahan(bahan) : "abt";
        void minta(o, bahan);
      }
    });
    el.addEventListener("click", (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest("[data-pb]") : null;
      if (!t) return;
      if (t.getAttribute("data-pb") === "semua") {
        el.dataset.pbSemua = "1";
        gambar(o);
      } else if (t.getAttribute("data-pb") === "ai" && aiTersedia()) {
        try {
          void globalThis.AletaBdAi.bukaFitur(KODE_AI);
        } catch {
          /* inti ALETA Ai belum dimuat */
        }
      }
    });
    if (el.open) gambar(o);
  }

  const api = { htmlTabel, htmlBungkus, ringkasPenilaian, sidikBahan, teksUntukAi, segarkan, pasang, tersinggah, aiTersedia, API, BATAS_BARIS, TUNDA_MS, KODE_AI, STATUS };
  globalThis.AletaBdPenilaiBukti = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
