"use strict";

/**
 * ============================================================================
 * KIRIM KETERANGAN SAKSI KE BAS SIPP (rantai C, C6 = U10, 25 Okt 2026) - MENULIS KE SIPP
 * ============================================================================
 *
 * Keterangan saksi disusun di Susun saksi dan tersimpan di ABT. BAS sidangnya (yang memuat keterangan itu) lalu dicetak ABT dan
 * dikirim sebagai e-Doc BAS ke SIPP. Tombol "Kirim keterangan saksi ke BAS SIPP" menyatukan langkah itu dengan penjagaan berlapis:
 *
 *   1. SAKLAR Fitur Satker "saksi-ke-bas-sipp" (bawaan MATI; gagal bertanya = mati): mati = tidak ada tombol, tidak ada tulisan.
 *   2. PRATINJAU dulu, tanpa menulis apa pun: sidang dicari di daftar BAS yang menjadi hak petugas; e-Doc yang SUDAH ada di SIPP
 *      menghentikan (tidak pernah diganti dari sini); BAS dicetak dari ABT lewat mesin Unggah massal; setiap jawaban saksi di ABT
 *      harus ditemukan di naskah; naskah tidak boleh memuat tanda aplikasi; sisa isian kosong dilaporkan.
 *   3. PERSETUJUAN petugas (kotak centang) - tidak pernah otomatis.
 *   4. BACA ULANG sebelum menulis: keterangan saksi di ABT dibaca lagi dan dibandingkan dengan yang dipratinjau (berubah = pratinjau
 *      ulang), lalu mesin Unggah massal membaca e-Doc di SIPP sekali lagi tepat sebelum mengunggah (dobel = tidak ditulis).
 *   5. PENJAGA TANDA: rute unggah (portal + bot) menolak naskah/metadata bertanda aplikasi; di sini naskah yang bertanda ditahan
 *      sejak pratinjau.
 *   6. TERCATAT: tiap pratinjau dan kirim dicatat (sidik + hitungan; bukan isi BAS) di jejak ALETA.
 *
 * Murni di bagian atas (diuji langsung); jaringan dan ABT datang dari `kait` yang disediakan abt.js.
 */
(function () {
  const SAKLAR = "saksi-ke-bas-sipp";
  const API = "/aleta/api/aleta-ecourt/saksi-ke-bas";
  const BATAS_KATA_KUNCI = 6;

  // ── murni ──────────────────────────────────────────────────────────────

  const teks = (x) => String(x == null ? "" : x);

  /** Huruf kecil, tanpa tanda baca, spasi tunggal. */
  function normalisasi(t) {
    return teks(t)
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/[^a-z0-9À-ɏ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const adaTandaAplikasi = (t) => /aleta/i.test(teks(t));

  /** Baris BAS untuk perkara + urutan sidang ini dari daftar Unggah massal; null bila tidak ada. */
  function cariBaris(daftar, nomorPerkara, urutan) {
    const nomor = normalisasi(nomorPerkara);
    const u = Number(urutan) || 0;
    const cocok = (Array.isArray(daftar) ? daftar : []).filter((b) => b && b.jenis === "bas" && normalisasi(b.nomorPerkara) === nomor);
    if (!cocok.length) return null;
    if (u) return cocok.find((b) => Number(b.urutan) === u) || null;
    return cocok.length === 1 ? cocok[0] : null;
  }

  /**
   * Setiap jawaban saksi (dari ABT) harus ada di naskah BAS: kata-kata awal jawaban (setelah dinormalisasi) ditemukan di naskah.
   * @param {string} naskah  teks naskah BAS (dari RTF)
   * @param {Array<{label: string, baris: Array<{tanya?: string, jawab: string}>}>} saksi
   */
  function periksaSaksiDiNaskah(naskah, saksi) {
    const n = ` ${normalisasi(naskah)} `;
    const hasil = { jumlahSaksi: 0, total: 0, ada: 0, hilang: [], kosong: [] };
    for (const s of Array.isArray(saksi) ? saksi : []) {
      const jawab = (s.baris || []).filter((b) => b && normalisasi(b.jawab));
      if (!jawab.length) {
        hasil.kosong.push(s.label);
        continue;
      }
      hasil.jumlahSaksi += 1;
      jawab.forEach((b, i) => {
        hasil.total += 1;
        const kunci = normalisasi(b.jawab).split(" ").slice(0, BATAS_KATA_KUNCI).join(" ");
        if (n.includes(` ${kunci}`)) hasil.ada += 1;
        else hasil.hilang.push({ saksi: s.label, no: i + 1, awal: kunci });
      });
    }
    return hasil;
  }

  /** Ringkasan kalimat untuk pratinjau. Murni. */
  function kalimatPeriksa(p) {
    return `Keterangan saksi di ABT: ${p.jumlahSaksi} saksi, ${p.total} jawaban; di naskah BAS ditemukan ${p.ada}, tidak ditemukan ${p.hilang.length}.`;
  }

  async function sidikTeks(t) {
    try {
      const c = globalThis.crypto && globalThis.crypto.subtle;
      if (c && typeof TextEncoder !== "undefined") {
        const buf = await c.digest("SHA-256", new TextEncoder().encode(teks(t)));
        return Array.from(new Uint8Array(buf))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch {
      /* jatuh ke sidik sederhana */
    }
    let h = 5381;
    for (const ch of teks(t)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
    return h.toString(16).padStart(8, "0");
  }

  /** Sidik jawaban saksi (untuk memastikan ABT tidak berubah antara pratinjau dan kirim). */
  const sidikSaksi = (saksi) => sidikTeks(JSON.stringify((saksi || []).map((s) => [s.label, (s.baris || []).map((b) => [b.tanya || "", b.jawab || ""])])));

  // ── jaringan lewat kait ────────────────────────────────────────────────

  async function catat(kait, entri) {
    try {
      if (kait && typeof kait.catatJejak === "function") await kait.catatJejak(entri);
    } catch {
      /* catatan tertinggal; tidak menggagalkan pekerjaan */
    }
  }

  /** Keterangan saksi tersimpan di ABT untuk sidang ini: [{label, baris:[{tanya, jawab}]}]. */
  async function bacaKeteranganSaksi(kait, urutan) {
    const hasil = [];
    for (const [pihak, maks, nama] of [["P", 5, "Saksi Penggugat/Pemohon"], ["T", 4, "Saksi Tergugat/Termohon"]]) {
      for (let ke = 1; ke <= maks; ke += 1) {
        const baris = await kait.bacaSaksi(pihak, ke, urutan);
        if (!Array.isArray(baris) || !baris.length) continue;
        hasil.push({
          label: `${nama} ${ke}`,
          baris: baris.map((b) => ({ tanya: teks(b.pertanyaan || b.tanya), jawab: teks(b.jawaban || b.jawab) })),
        });
      }
    }
    return hasil;
  }

  /**
   * Pratinjau: TIDAK menulis apa pun ke SIPP. Pulang { siap, halangan[], catatan[], baris, s, saksi, periksa, sidikSaksi, ukuran, sidik }.
   */
  async function pratinjau(kait, lapor) {
    const kabar = typeof lapor === "function" ? lapor : () => {};
    const p = { siap: false, halangan: [], catatan: [], baris: null, s: null, saksi: [], periksa: null, sidikSaksi: "", ukuran: 0, sidik: "", dobel: false };
    const nomor = kait.nomorPerkara();
    const urutan = Number(kait.urutanSidang()) || 0;
    try {
      kabar("membaca daftar BAS yang dapat Anda unggah…");
      const baris = cariBaris(await kait.daftarBas(), nomor, urutan);
      if (!baris) {
        p.halangan.push(`Sidang ke-${urutan || "?"} perkara ini tidak ada dalam daftar BAS yang menjadi hak Anda (di luar jendela hari, belum berlangsung, atau bukan perkara Anda).`);
        return p;
      }
      p.baris = baris;
      if (baris.adaBas) {
        p.dobel = true;
        p.halangan.push(`e-Doc BAS sidang ke-${baris.urutan || urutan} sudah ada di SIPP${baris.jalurBas ? ` (${baris.jalurBas})` : ""} dan tidak diganti dari sini. Bila berkas itu keliru, pakai Unggah massal lalu Ganti.`);
        return p;
      }
      kabar("membaca keterangan saksi di ABT…");
      p.saksi = await bacaKeteranganSaksi(kait, urutan || baris.urutan);
      if (!p.saksi.length) {
        p.halangan.push("Belum ada keterangan saksi yang tersimpan di ABT untuk sidang ini. Simpan dulu keterangan saksi ke ABT.");
        return p;
      }
      p.sidikSaksi = await sidikSaksi(p.saksi);
      const s = await kait.siapkan(baris, kabar);
      p.s = s;
      for (const c of s.catatan || []) p.catatan.push(c);
      if (s.keadaan === "dobel") p.dobel = true;
      if (s.keadaan !== "siap") {
        p.halangan.push(s.halangan || "BAS belum siap dikirim.");
        return p;
      }
      p.ukuran = Number(s.ukuran) || (s.rtf && s.rtf.byteLength) || 0;
      const naskah = kait.teksRtf(s.rtf);
      p.sidik = await sidikTeks(naskah);
      if (adaTandaAplikasi(naskah) || adaTandaAplikasi(s.nama)) p.halangan.push("Naskah BAS memuat tanda aplikasi. Bersihkan di ABT, lalu pratinjau lagi. Tidak ada yang dikirim.");
      p.periksa = periksaSaksiDiNaskah(naskah, p.saksi);
      if (p.periksa.hilang.length) {
        p.halangan.push(
          `${p.periksa.hilang.length} jawaban saksi tidak ditemukan di naskah BAS (mungkin blangko BAS yang dipilih tidak memuat keterangan saksi, atau ABT belum menyegarkannya). Periksa di ABT; tidak ada yang dikirim.`
        );
      }
      p.siap = p.halangan.length === 0;
      return p;
    } catch (e) {
      p.halangan.push(`Pratinjau gagal: ${String((e && e.message) || e)}`);
      return p;
    }
  }

  /** Entri jejak dari hasil pratinjau/kirim. */
  function entriJejak(p, tahap, hasil, catatan) {
    const b = p.baris || {};
    return {
      perkaraId: b.perkaraId,
      nomorPerkara: b.nomorPerkara,
      sidangId: b.sidangId,
      urutanSidang: b.urutan,
      tahap,
      hasil,
      jumlahSaksi: p.periksa ? p.periksa.jumlahSaksi : p.saksi.length,
      jumlahJawaban: p.periksa ? p.periksa.total : 0,
      jumlahHilang: p.periksa ? p.periksa.hilang.length : 0,
      ukuran: p.ukuran,
      sidik: p.sidik,
      catatan: String(catatan || "").slice(0, 500),
    };
  }

  /**
   * Kirim: HANYA dipanggil atas persetujuan petugas. Membaca ulang keterangan saksi di ABT (berubah = tidak dikirim), lalu mesin unggah
   * membaca e-Doc di SIPP tepat sebelum menulis. Pulang { hasil: berhasil|gagal|dobel|dilewati|dibatalkan, catatan }.
   */
  async function kirim(kait, p, lapor) {
    const kabar = typeof lapor === "function" ? lapor : () => {};
    if (!p || !p.siap || !p.s) return { hasil: "dilewati", catatan: "Pratinjau belum siap." };
    let h;
    try {
      kabar("membaca ulang keterangan saksi di ABT…");
      const baru = await bacaKeteranganSaksi(kait, Number(p.baris.urutan) || Number(kait.urutanSidang()) || 0);
      if ((await sidikSaksi(baru)) !== p.sidikSaksi) {
        h = { hasil: "dibatalkan", catatan: "Keterangan saksi di ABT berubah sejak pratinjau. Tidak ada yang dikirim; buat pratinjau lagi." };
      } else {
        h = await kait.unggah(p.s, kabar);
      }
    } catch (e) {
      h = { hasil: "gagal", catatan: String((e && e.message) || e) };
    }
    const hasilCatat = ["berhasil", "gagal", "dobel", "dilewati", "dibatalkan"].includes(h.hasil) ? h.hasil : "gagal";
    await catat(kait, entriJejak(p, "kirim", hasilCatat, h.catatan));
    return h;
  }

  // ── tampilan ───────────────────────────────────────────────────────────

  /**
   * Memasang tombol (di `aksi`) dan panel pratinjau (di `form`). Keduanya tersembunyi sampai saklar menyala.
   * @param {HTMLElement} aksi
   * @param {HTMLElement} form
   * @param {object} kait
   * @param {Function} buat  (tag, kelas, teks) => elemen
   */
  function pasangTombol(aksi, form, kait, buat) {
    const tombol = buat("button", "aleta-permintaan-tombol", "Kirim keterangan saksi ke BAS SIPP…");
    tombol.type = "button";
    tombol.hidden = true;
    tombol.setAttribute("data-kirim-bas", "1");
    tombol.title = "Mencetak BAS sidang ini dari ABT, memperlihatkan pratinjau, lalu mengirimnya sebagai e-Doc BAS ke SIPP hanya setelah Anda menyetujui.";
    const panel = buat("div", "aleta-sdg-hasil");
    panel.hidden = true;
    panel.setAttribute("data-panel-kirim-bas", "1");
    aksi.appendChild(tombol);
    form.appendChild(panel);

    let sibuk = false;
    const gambar = (p, kabar) => {
      panel.textContent = "";
      panel.appendChild(buat("div", "aleta-abt-label", "Kirim keterangan saksi ke BAS SIPP"));
      if (kabar) panel.appendChild(buat("div", "aleta-abt-kabar", kabar));
      if (!p) return;
      const b = p.baris;
      if (b) panel.appendChild(buat("div", "aleta-abt-kabar", `Sidang ke-${b.urutan || "?"}${b.tanggal ? `, ${b.tanggal}` : ""}: ${b.nomorPerkara}.`));
      if (p.periksa) {
        panel.appendChild(buat("div", "aleta-abt-kabar", kalimatPeriksa(p.periksa)));
        if (p.ukuran) panel.appendChild(buat("div", "aleta-abt-kabar", `Naskah BAS sekitar ${Math.max(1, Math.round(p.ukuran / 1024))} KB.`));
        const rinci = document.createElement("details");
        const ringkas = document.createElement("summary");
        ringkas.textContent = "Cuplikan keterangan saksi yang akan ikut terkirim";
        rinci.appendChild(ringkas);
        for (const s of p.saksi) {
          for (const x of s.baris.slice(0, 2)) rinci.appendChild(buat("div", "aleta-abt-kabar", `${s.label}: ${teks(x.jawab).slice(0, 160)}`));
        }
        panel.appendChild(rinci);
      }
      for (const c of p.catatan) panel.appendChild(buat("div", "aleta-abt-kabar", c));
      for (const h of p.halangan) panel.appendChild(buat("div", "aleta-abt-kabar aleta-abt-gagal", h));
      if (p.siap) {
        const c = buat("label", "aleta-sdg-centang");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-setuju-kirim-bas", "1");
        c.appendChild(cb);
        c.appendChild(buat("span", "", "Saya sudah membaca pratinjau ini dan setuju BAS ini dikirim ke e-Doc SIPP"));
        panel.appendChild(c);
        const kirimTombol = buat("button", "aleta-permintaan-tombol", "Kirim ke e-Doc SIPP");
        kirimTombol.type = "button";
        kirimTombol.disabled = true;
        kirimTombol.setAttribute("data-aksi-kirim-bas", "1");
        cb.addEventListener("change", () => {
          kirimTombol.disabled = !cb.checked;
        });
        kirimTombol.addEventListener("click", async () => {
          if (!cb.checked || sibuk) return;
          sibuk = true;
          kirimTombol.disabled = true;
          const h = await kirim(kait, p, (t) => gambar(p, t));
          sibuk = false;
          panel.textContent = "";
          panel.appendChild(buat("div", "aleta-abt-label", "Kirim keterangan saksi ke BAS SIPP"));
          panel.appendChild(buat("div", h.hasil === "berhasil" ? "aleta-abt-kabar" : "aleta-abt-kabar aleta-abt-gagal", `${h.hasil === "berhasil" ? "Terkirim" : "Tidak terkirim"}: ${h.catatan || h.hasil}`));
        });
        panel.appendChild(kirimTombol);
      }
    };

    tombol.addEventListener("click", async () => {
      if (sibuk) return;
      sibuk = true;
      panel.hidden = false;
      gambar(null, "Memeriksa…");
      const p = await pratinjau(kait, (t) => gambar(null, t));
      sibuk = false;
      gambar(p, "");
      await catat(kait, entriJejak(p, "pratinjau", p.siap ? "siap" : p.dobel ? "dobel" : "halangan", p.halangan.join(" ")));
    });

    // Saklar ditanyakan sekali; gagal bertanya = mati (tombol tetap tersembunyi).
    try {
      const S = globalThis.AletaSaklarFitur;
      if (S && typeof S.aktif === "function") {
        void S.aktif(SAKLAR).then(
          (ya) => {
            if (ya === true) tombol.hidden = false;
          },
          () => undefined
        );
      }
    } catch {
      /* mati */
    }
    return { tombol, panel };
  }

  const api = { SAKLAR, API, normalisasi, adaTandaAplikasi, cariBaris, periksaSaksiDiNaskah, kalimatPeriksa, pratinjau, kirim, entriJejak, bacaKeteranganSaksi, pasangTombol, sidikTeks };
  globalThis.AletaSaksiKeBas = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
