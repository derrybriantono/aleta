"use strict";

/**
 * ============================================================================
 * PEMERIKSA EJAAN NAMA PIHAK DI FORMULIR PIHAK SIPP (U18 / ide sipp-20, 25 Okt 2026)
 * ============================================================================
 *
 * Saat petugas mengetik nama di formulir "Referensi Data Pihak" SIPP (kolom #pihak_fullname), nama itu dicocokkan
 * dengan kamus alias di server. Bila tercatat sebagai ejaan lain dari nama baku, di bawah kolom muncul SATU baris
 * usulan: 'Tercatat sebagai ejaan lain dari "X"' dengan tombol "Salin ejaan baku". Hanya USULAN:
 *   - tidak ada yang diisikan atau disimpan otomatis (kolom, tombol Simpan, dan SIPP tidak disentuh; yang ada hanya
 *     menyalin teks ke papan klip atas klik petugas);
 *   - kamus tidak dikirim ke peramban - server hanya menjawab usulan atas nama yang diketik;
 *   - tidak ada satu kata "Aleta" yang ditulis ke SIPP (usulan hidup di elemen sementara di luar formulir yang dikirim).
 *
 * Mati bawaan: hanya bekerja bila Super Admin menyalakan kinerja.ejaanNamaPihak (singgahan tampilanServer). Mati = tidak
 * ada pendengar, tidak ada permintaan, formulir persis seperti dulu. Jaringan galat = diam.
 *
 * Global: ALETA_EJAAN_NAMA { aktif, tungguSiap, periksa, pasang, murni }.
 */
(function ejaanNamaModul(akar) {
  if (!akar || akar.ALETA_EJAAN_NAMA) return;

  const API = "/aleta/api/aleta-ecourt/alias-nama/periksa";
  const KUNCI_SERVER = "tampilanServer";
  const KOLOM = "#pihak_fullname";
  const ID_USULAN = "aleta-ejaan-usulan";
  const JEDA_MS = 700;
  const PANJANG_MIN = 5;

  let nyala = false;
  const siap = (async () => {
    try {
      const st = akar.chrome && akar.chrome.storage && akar.chrome.storage.local;
      if (!st) return;
      const s = await st.get([KUNCI_SERVER]);
      nyala = bacaSaklar(s && s[KUNCI_SERVER]);
      if (akar.chrome.storage.onChanged && typeof akar.chrome.storage.onChanged.addListener === "function") {
        akar.chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah === "local" && ubah && ubah[KUNCI_SERVER]) nyala = bacaSaklar(ubah[KUNCI_SERVER].newValue);
        });
      }
    } catch {
      /* tanpa penyimpanan ekstensi: tetap mati */
    }
  })();

  function bacaSaklar(t) {
    return Boolean(t && t.kinerja && t.kinerja.ejaanNamaPihak === true);
  }

  /** Meminta usulan server untuk satu nama. Pulang larik usulan (mungkin kosong); galat/mati = []. */
  async function periksa(nama, asal) {
    await siap;
    if (!nyala) return [];
    const teks = String(nama || "").replace(/\s+/g, " ").trim();
    if (teks.length < PANJANG_MIN) return [];
    try {
      const f = typeof akar.alatAmbil === "function" ? akar.alatAmbil : null;
      const opsi = {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: [{ asal: asal || "Formulir pihak SIPP", nama: teks }] }),
      };
      const r = f ? await f(API, opsi, "Pemeriksa ejaan nama") : await akar.fetch(API, opsi);
      if (!r || !r.ok) return [];
      const luar = await r.json();
      const d = luar && luar.data ? luar.data : luar;
      return d && d.tersedia === true && Array.isArray(d.usulan) ? d.usulan.filter((u) => u && u.jenis === "alias" && u.usulanBaku) : [];
    } catch {
      return [];
    }
  }

  function buatUsulan(dok, kolom, usulan) {
    let kotak = dok.getElementById(ID_USULAN);
    if (!usulan.length) {
      if (kotak) kotak.remove();
      return;
    }
    if (!kotak) {
      kotak = dok.createElement("div");
      kotak.id = ID_USULAN;
      kotak.setAttribute("role", "status");
      kotak.style.cssText =
        "margin:4px 0;padding:4px 8px;font-size:12px;line-height:1.4;border-radius:4px;" +
        "background:var(--s-latar-info, #eef6ff);color:var(--s-teks, #1a3a5a);border:1px solid var(--s-garis, #b7d4f0);";
      kolom.insertAdjacentElement("afterend", kotak);
    }
    kotak.textContent = "";
    const baku = usulan[0].usulanBaku;
    const teks = dok.createElement("span");
    teks.textContent = `Tercatat di kamus sebagai ejaan lain dari "${baku}". `;
    const tombol = dok.createElement("button");
    tombol.type = "button";
    tombol.textContent = "Salin ejaan baku";
    tombol.style.cssText = "font-size:12px;padding:1px 8px;cursor:pointer;";
    tombol.addEventListener("click", async () => {
      try {
        await akar.navigator.clipboard.writeText(baku);
        tombol.textContent = "Tersalin";
      } catch {
        tombol.textContent = "Tidak dapat menyalin";
      }
    });
    kotak.appendChild(teks);
    kotak.appendChild(tombol);
  }

  /** Memasang pemeriksa pada kolom nama di dokumen ini (sekali per kolom). Pulang true bila terpasang. */
  function pasang(dok) {
    const d = dok || akar.document;
    if (!d || !nyala) return false;
    const kolom = d.querySelector(KOLOM);
    if (!kolom || kolom.getAttribute("data-aleta-ejaan") === "1") return false;
    kolom.setAttribute("data-aleta-ejaan", "1");
    let pewaktu = null;
    const jalan = () => {
      clearTimeout(pewaktu);
      pewaktu = setTimeout(async () => {
        const usulan = await periksa(kolom.value, "Formulir pihak SIPP");
        if (kolom.isConnected) buatUsulan(d, kolom, usulan);
      }, JEDA_MS);
    };
    kolom.addEventListener("input", jalan);
    kolom.addEventListener("change", jalan);
    if (String(kolom.value || "").trim()) jalan();
    return true;
  }

  akar.ALETA_EJAAN_NAMA = {
    versi: "u18-25okt",
    aktif: () => nyala,
    tungguSiap: () => siap,
    periksa,
    pasang,
    murni: { bacaSaklar, KOLOM, ID_USULAN },
  };

  // Formulir pihak SIPP lahir dinamis (jendela modal): cukup diamati lewat pengamat bersama bila saklar menyala.
  try {
    void siap.then(() => {
      if (!nyala || !akar.document || !akar.document.body) return;
      const Pengamat = akar.ALETA_PENGAMAT ? akar.ALETA_PENGAMAT.Pengamat : akar.MutationObserver;
      new Pengamat(() => pasang(akar.document)).observe(akar.document.body, { childList: true, subtree: true });
      pasang(akar.document);
    });
  } catch {
    /* tambahan: tidak boleh mengganggu SIPP */
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
