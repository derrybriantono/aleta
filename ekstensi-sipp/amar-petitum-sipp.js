"use strict";

/**
 * ============================================================================
 * AMAR DARI PETITUM DI BORANG PUTUSAN AKHIR SIPP (G2B 2.5, 30 Okt 2026)
 * ============================================================================
 *
 * Borang Putusan Akhir SIPP (#frm_putusan): begitu STATUS PUTUSAN dipilih (atau sudah terpilih saat borang dibuka) dan kolom Amar masih
 * KOSONG, amar berbutir disusun portal dari petitum perkara menurut status itu (lib/amar-dari-petitum.ts lewat
 * /api/aleta-ecourt/amar-usulan) dan langsung diisikan ke CKEditor Amar - tanpa tombol. Petugas membaca lalu menekan Simpan SIPP sendiri.
 *
 *   - Amar yang diketik manusia TIDAK PERNAH ditimpa: hanya kolom kosong, atau isi yang masih persis isian modul ini sendiri (status /
 *     verstek diganti sebelum ada suntingan) yang diisi ulang.
 *   - Tidak menyentuh status, verstek, tanggal, sumber hukum, atau tombol Simpan (sama dengan konten-panel-perkara: "TIDAK MENYENTUH
 *     STATUS PUTUSAN"). Templat amar SIPP (#template_amar) yang dipilih petugas menang karena ia mengisi kolom itu.
 *   - Bagian yang tidak pasti (biaya belum diketahui, kabul sebagian, tanggal/tempat akad itsbat) bertitik-titik dan disebut di keterangan
 *     kecil di bawah kolom (ikon (i) memuat pertanyaannya).
 *   - Tidak ada kata nama aplikasi yang ikut ke kolom Amar; keterangan di layar hanya untuk petugas.
 * Isi dan baca CKEditor lewat jembatan halaman (kirimKeJembatan, jembatan.js) karena CKEditor hidup di dunia halaman.
 */
(function amarPetitumSipp() {
  if (typeof globalThis === "undefined" || globalThis.aletaAmarPetitum) return;

  const API = "/aleta/api/aleta-ecourt/amar-usulan";
  const BORANG = "#frm_putusan";
  const PENUNJUK_AMAR = "#amar_text textarea";
  const ID_KET = "aleta-amar-petitum-ket";

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  /** Isi kolom tanpa tag/spasi - dipakai membandingkan "masih isian modul ini" dan "kosong". */
  const intiTeks = (html) =>
    String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const S = { isiTerakhir: "", kunciTerakhir: "", jalan: false };

  function nomorHalaman() {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      const n = l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function" ? l1.murni.nomorHalamanDetil(document) : "";
      if (n) return n;
    } catch {
      /* cadangan di bawah */
    }
    try {
      return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
    } catch {
      return "";
    }
  }

  function jembatan(pesan) {
    const f = typeof kirimKeJembatan === "function" ? kirimKeJembatan : globalThis.kirimKeJembatan;
    return typeof f === "function" ? f(pesan) : Promise.resolve({ ok: false, alasan: "jembatan_tidak_ada" });
  }

  function keadaanBorang() {
    const b = document.querySelector(BORANG);
    if (!b) return null;
    const st = b.querySelector('select[name="status_putusan"]');
    const vs = b.querySelector('select[name="verstek"]');
    const opsi = st && st.selectedIndex >= 0 ? st.options[st.selectedIndex] : null;
    const status = opsi && st.value ? sebaris(opsi.textContent) : "";
    const verstek = Boolean(vs && /^(?:y|ya|1)$/i.test(String(vs.value || "")));
    return { borang: b, status, verstek };
  }

  function tulisKeterangan(teks, pertanyaan) {
    const td = document.querySelector("#amar_text");
    if (!td) return;
    let k = document.getElementById(ID_KET);
    if (!teks) {
      if (k) k.remove();
      return;
    }
    if (!k) {
      k = document.createElement("div");
      k.id = ID_KET;
      k.className = "aleta-sisip aleta-amar-ket";
      k.setAttribute("role", "status");
      td.appendChild(k);
    }
    k.textContent = teks;
    if (Array.isArray(pertanyaan) && pertanyaan.length) {
      const i = document.createElement("span");
      i.className = "aleta-ikon-info";
      i.textContent = " (i)";
      i.title = pertanyaan.map((p) => `${p.no}. ${p.teks} Usulan: ${p.usulan}`).join("\n");
      k.appendChild(i);
    }
  }

  /** Mengisi kolom Amar bila kosong / masih isian modul ini. Murni-ish: semua efek lewat jembatan + fetch (diuji di jsdom). */
  async function perbarui() {
    if (S.jalan) return;
    const k = keadaanBorang();
    if (!k || !k.status) return;
    const nomor = nomorHalaman();
    if (!nomor) return;
    const kunci = `${nomor}|${k.status}|${k.verstek ? 1 : 0}`;
    if (kunci === S.kunciTerakhir) return;
    S.jalan = true;
    try {
      const baca = await jembatan({ jenis: "nilai", penunjuk: PENUNJUK_AMAR, jenisMedan: "kaya" });
      if (!baca || baca.ok === false || baca.siap === false) return; // CKEditor belum siap: dicoba lagi pada perubahan DOM berikutnya
      const sekarang = intiTeks(baca.nilai);
      // Diketik manusia (bukan kosong dan bukan isian modul ini) -> tidak disentuh.
      if (sekarang && sekarang !== intiTeks(S.isiTerakhir)) {
        S.kunciTerakhir = kunci;
        tulisKeterangan("");
        return;
      }
      const q = new URLSearchParams({ nomor, status: k.status, verstek: k.verstek ? "1" : "0" });
      const r = await fetch(`${API}?${q.toString()}`, { credentials: "include", cache: "no-store" });
      const luar = await r.json().catch(() => null);
      const d = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
      S.kunciTerakhir = kunci;
      if (!d || !d.ada || !d.html) {
        tulisKeterangan(d && d.alasan ? `Amar belum dapat disusun dari petitum: ${d.alasan}` : "");
        return;
      }
      const isi = await jembatan({ jenis: "isi", penunjuk: PENUNJUK_AMAR, jenisMedan: "kaya", nilai: d.html });
      if (!isi || isi.ok === false) {
        S.kunciTerakhir = ""; // CKEditor belum siap: dicoba lagi pada perubahan berikutnya
        return;
      }
      S.isiTerakhir = d.html;
      const cat = Array.isArray(d.catatan) ? d.catatan : [];
      tulisKeterangan(`Amar diisi dari petitum menurut status "${k.status}"${k.verstek ? " (verstek)" : ""}. Periksa sebelum Simpan.${cat.length ? ` ${cat.join(" ")}` : ""}`, d.pertanyaan);
    } catch {
      /* kemudahan saja: petugas tetap dapat mengetik amar */
    } finally {
      S.jalan = false;
    }
  }

  function pasang() {
    document.addEventListener(
      "change",
      (e) => {
        const t = e && e.target;
        if (t && t.closest && t.closest(BORANG) && /^(?:status_putusan|verstek)$/.test(String(t.name || ""))) void perbarui();
      },
      true
    );
    // Borang dibuka (popup SIPP) dengan status yang sudah terpilih.
    const amati = new MutationObserver(() => {
      if (document.querySelector(BORANG) && document.querySelector(PENUNJUK_AMAR)) void perbarui();
      else {
        S.kunciTerakhir = "";
        S.isiTerakhir = "";
      }
    });
    if (document.body) amati.observe(document.body, { childList: true, subtree: true });
  }

  globalThis.aletaAmarPetitum = { perbarui, murni: { intiTeks }, _keadaan: S };
  if (typeof document !== "undefined" && document.addEventListener) pasang();
})();
