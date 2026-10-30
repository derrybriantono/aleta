"use strict";

/**
 * ============================================================================
 * TEMUAN PERKARA DI PANEL CETAK BLANGKO DERRY (G4, 30 Okt 2026)
 * ============================================================================
 *
 * Mengisi wadah catatan temuan (#bd-temuanhadir) yang sudah ada - tanpa layar baru:
 *
 *   4.4 KEHADIRAN   BAS sidang ini (nama blangko: "P & T Hadir", "P Hadir & T
 *                   Tidak Hadir", "P & T Tidak Hadir") berbeda dengan pilihan
 *                   kehadiran SIPP, atau putusan verstek padahal SIPP mencatat
 *                   Tergugat hadir (aturan identik paket relaas-penetapan-30okt).
 *                   Usulannya disebut, dan PANITERA PENGGANTI perkara itu
 *                   mendapat SATU tombol "Betulkan di SIPP". Penulisan ke SIPP
 *                   hanya atas klik itu, atas akun SIPP PP perkara (rute portal
 *                   kehadiran-sidang menegakkannya lagi). Peran lain hanya membaca
 *                   usulannya.
 *   4.3 PUTUSAN     sesudah putus: amar dan tanggal putusan SIPP dicocokkan
 *                   dengan dokumen putusan yang diunggah (rute cocok-putusan) -
 *                   beda = peringatan pasif. Hanya membaca.
 *
 * Tidak menulis apa pun ke halaman SIPP/ABT; tidak satu kata merek ke SIPP.
 * Gagal membaca = diam (catatan temuan lama tetap tampil seperti dulu).
 */
(function temuanPerkaraModul() {
  if (typeof globalThis === "undefined" || globalThis.AletaTemuanPerkara) return;

  const API_HADIR = "/aleta/api/aleta-ecourt/kehadiran-sidang";
  const API_PUTUSAN = "/aleta/api/aleta-ecourt/cocok-putusan";
  const UMUR_MS = 60 * 1000;
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const singgah = new Map(); // kunci -> { saat, janji }
  const selesaiPer = new Map(); // perkaraId -> Map(jadwalId -> kalimat) - sudah dibetulkan di SIPP pada sesi ini
  const selesaiDi = (perkaraId) => {
    const id = teks(perkaraId);
    if (!selesaiPer.has(id)) selesaiPer.set(id, new Map());
    return selesaiPer.get(id);
  };
  let urutGambar = 0;

  const teks = (x) => String(x == null ? "" : x).trim();
  const esc = (x) =>
    teks(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function tglIndo(iso) {
    const m = teks(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m && BULAN[+m[2] - 1] ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : teks(iso);
  }

  /** Kehadiran menurut nama blangko BAS Derry - SAMA dengan kehadiranBas di bot (kehadiranSidangTulisService). */
  function kehadiranBas(namaBlangko) {
    const x = teks(namaBlangko).replace(/\s+/g, " ");
    if (!/\bBAS\b/i.test(x) || /ikrar/i.test(x)) return null;
    if (/\bP\s*(?:&|dan)\s*T\s+Tidak\s+Hadir\b/i.test(x)) return 4;
    if (/\bP\s+Hadir\s*(?:&|dan)\s*T\s+Tidak\s+Hadir\b/i.test(x)) return 2;
    if (/\bP\s+Tidak\s+Hadir\s*(?:&|dan)\s*T\s+Hadir\b/i.test(x)) return 3;
    if (/\bP\s*(?:&|dan)\s*T\s+Hadir\b/i.test(x)) return 1;
    return null;
  }

  function sebutan(jenisPerkara) {
    return /talak/i.test(teks(jenisPerkara)) ? { p: "Pemohon", t: "Termohon" } : { p: "Penggugat", t: "Tergugat" };
  }

  function namaKehadiran(kode, s) {
    return (
      {
        1: "Semua Pihak",
        2: `${s.p} saja`,
        3: `${s.t} saja`,
        4: "Para Pihak Tidak Hadir",
      }[Number(kode)] || (Number(kode) ? "pilihan lain" : "belum diisi")
    );
  }

  /** BAS yang dicetak menyebut kehadiran yang berbeda dengan sidang terpilih di SIPP? -> { kode, jadwalId } | null */
  function bedaBas(k) {
    if (!k || teks(k.jenis) !== "bas" || !k.sidang) return null;
    const kode = kehadiranBas(k.berkas);
    const jadwalId = teks(k.sidang.sidangId);
    if (!kode || !/^\d+$/.test(jadwalId)) return null;
    const sipp = Number(k.sidang.hadir) || 0;
    if (sipp === kode || (sipp && ![1, 2, 3, 4].includes(sipp))) return null;
    return { kode, jadwalId, sipp };
  }

  async function ambilJson(alamat, opsi) {
    try {
      const r = await fetch(alamat, Object.assign({ credentials: "include", cache: "no-store" }, opsi || {}));
      const j = await r.json().catch(() => null);
      const d = j && j.data && typeof j.data === "object" ? j.data : j;
      if (!r.ok) return { ok: false, alasan: teks((j && j.error && (j.error.message || j.error)) || (d && d.alasan)) || "Permintaan ditolak." };
      return d || null;
    } catch {
      return null;
    }
  }

  function bacaSinggah(kunci, kerja) {
    const ada = singgah.get(kunci);
    if (ada && Date.now() - ada.saat < UMUR_MS) return ada.janji;
    const janji = kerja();
    singgah.set(kunci, { saat: Date.now(), janji });
    return janji;
  }

  function kotak(wadah, kelas) {
    let el = wadah.querySelector(`.${kelas}`);
    if (!el) {
      el = document.createElement("div");
      el.className = `bd-peringatan ${kelas}`;
      el.setAttribute("role", "status");
      wadah.appendChild(el);
    }
    return el;
  }

  // ── 4.4 kehadiran ─────────────────────────────────────────────────────────
  async function gambarKehadiran(wadah, k, nomor) {
    const beda = bedaBas(k);
    const selesai = selesaiDi(k.perkaraId);
    if (!k.temuanVerstek && !beda) {
      if (selesai.size) kotak(wadah, "bd-temuanusul").innerHTML = `<span class="bd-catat">Sudah dibetulkan di SIPP: ${esc([...selesai.values()].join("; "))}. Muat ulang halaman untuk melihat kehadiran terbaru.</span>`;
      return;
    }
    const p = new URLSearchParams({ perkaraId: teks(k.perkaraId) });
    if (beda) {
      p.set("basJadwalId", beda.jadwalId);
      p.set("basNama", teks(k.berkas).slice(0, 300));
    }
    const d = await bacaSinggah(`hadir|${p.toString()}`, () => ambilJson(`${API_HADIR}?${p.toString()}`));
    if (nomor !== urutGambar || !wadah.isConnected) return;
    const s = sebutan(k.jenisPerkara);
    const usul = d && Array.isArray(d.usul) ? d.usul.filter((u) => !selesai.has(String(u.jadwalId))) : [];
    const sudah = [...selesai.values()];
    if (!usul.length && !beda && !sudah.length) return;
    const el = kotak(wadah, "bd-temuanusul");
    const bagian = [];
    if (beda && !k.temuanVerstek) {
      bagian.push(
        `<b>Catatan temuan:</b> BAS sidang ini mencatat ${esc(namaKehadiran(beda.kode, s))}, sedangkan SIPP mencatat ${esc(namaKehadiran(beda.sipp, s))}.`
      );
    }
    if (d && Array.isArray(d.bertentangan) && d.bertentangan.length) {
      bagian.push("BAS dan amar verstek menyebut kehadiran yang berbeda untuk sidang yang sama - tidak diusulkan, periksa sendiri.");
    }
    if (usul.length) {
      const kalimat = usul.map((u) => `sidang ${u.urutan > 0 ? `ke-${u.urutan} ` : ""}(${tglIndo(u.tanggal)}): ${namaKehadiran(u.dari, s)} menjadi ${namaKehadiran(u.ke, s)}`);
      bagian.push(`Usul pembetulan kehadiran di SIPP: ${esc(kalimat.join("; "))}.`);
      if (d.bolehAnda === true) {
        bagian.push(
          `<button type="button" class="bd-btn kecil" data-temuan="betulkan" title="Menulis pilihan kehadiran di SIPP atas akun Anda sebagai panitera pengganti perkara ini">Betulkan di SIPP</button>`
        );
      } else {
        bagian.push(`<span class="bd-catat">Dibetulkan panitera pengganti perkara ini${d.pp && d.pp.namaLengkap ? ` (${esc(d.pp.namaLengkap)})` : ""} dari panel ini.</span>`);
      }
    }
    if (sudah.length) bagian.push(`<span class="bd-catat">Sudah dibetulkan di SIPP: ${esc(sudah.join("; "))}.</span>`);
    el.innerHTML = bagian.join(" ");
    const tombol = el.querySelector('[data-temuan="betulkan"]');
    if (tombol) tombol.addEventListener("click", () => void betulkan(wadah, k, usul, tombol));
  }

  async function betulkan(wadah, k, usul, tombol) {
    const selesai = selesaiDi(k.perkaraId);
    tombol.disabled = true;
    tombol.textContent = "Menulis ke SIPP…";
    const gagal = [];
    for (const u of usul) {
      const d = await ambilJson(API_HADIR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId: teks(k.perkaraId), jadwalId: String(u.jadwalId), dihadiriOleh: u.ke, sebelum: u.dari, sebab: u.sebab }),
      });
      if (d && d.ok === true) selesai.set(String(u.jadwalId), `sidang ${u.urutan > 0 ? `ke-${u.urutan} ` : ""}(${tglIndo(u.tanggal)})`);
      else gagal.push(teks((d && (d.alasan || d.pesan)) || "ALETA belum dapat dihubungi"));
    }
    singgah.clear();
    if (gagal.length) {
      tombol.disabled = false;
      tombol.textContent = "Betulkan di SIPP";
      const el = kotak(wadah, "bd-temuanusul");
      const g = document.createElement("div");
      g.className = "bd-catat";
      g.textContent = `Belum tertulis: ${gagal[0]}`;
      el.appendChild(g);
      return;
    }
    urutGambar += 1;
    await gambarKehadiran(wadah, Object.assign({}, k, { temuanVerstek: false, jenis: "" }), urutGambar);
  }

  // ── 4.3 putusan SIPP vs dokumen ───────────────────────────────────────────
  async function gambarPutusan(wadah, k, nomor) {
    const ps = k.putusanSipp && typeof k.putusanSipp === "object" ? k.putusanSipp : null;
    if (!ps || !/^\d{4}-\d{2}-\d{2}$/.test(teks(ps.tanggalPutusan))) return;
    const id = teks(k.perkaraId);
    if (!/^\d+$/.test(id)) return;
    const d = await bacaSinggah(`putusan|${id}`, () => ambilJson(`${API_PUTUSAN}?perkaraId=${encodeURIComponent(id)}`));
    if (nomor !== urutGambar || !wadah.isConnected || !d || d.keadaan !== "beda") return;
    const el = kotak(wadah, "bd-temuanputusan");
    const beda = Array.isArray(d.beda) ? d.beda : [];
    el.innerHTML =
      `<b>Catatan temuan:</b> putusan di SIPP berbeda dengan dokumen putusan yang diunggah - ${esc(beda.map((b) => b.ringkas).join("; ") || "periksa amar dan tanggal")}.` +
      ` <span class="bd-catat" title="${esc(beda.map((b) => `${b.label}: SIPP ${b.sipp || "-"} / dokumen ${b.dokumen || "-"}`).join("\n"))}">ⓘ</span>`;
  }

  /** Dipanggil blangko-derry-isian.js tiap catatan temuan digambar ulang. Tidak pernah melempar. */
  function gambar(wadah, konteks) {
    try {
      if (!wadah || !konteks || !teks(konteks.perkaraId)) return;
      urutGambar += 1;
      const nomor = urutGambar;
      void gambarKehadiran(wadah, konteks, nomor).catch(() => undefined);
      void gambarPutusan(wadah, konteks, nomor).catch(() => undefined);
    } catch {
      /* diam */
    }
  }

  globalThis.AletaTemuanPerkara = { gambar, kehadiranBas, bedaBas, namaKehadiran, _lupakan: () => (singgah.clear(), selesaiPer.clear()) };
})();
