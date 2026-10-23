/*
 * Pekerja latar ALETA (23 Okt 2026) - syarat ALETA dapat dipasang sebagai aplikasi.
 *
 * SENGAJA tidak menyimpan halaman, berkas, atau data portal: semuanya milik akun
 * yang sedang masuk dan tidak boleh tertinggal di HP. Semua permintaan diteruskan
 * ke server apa adanya. Satu-satunya tambahan: bila membuka halaman gagal karena
 * server tidak terjangkau (di luar jaringan kantor), tampil penjelasan singkat,
 * bukan layar galat peramban.
 */
const HALAMAN_TERPUTUS = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ALETA - tidak tersambung</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; background: #e6eef5; color: #0b141e; }
  @media (prefers-color-scheme: dark) { body { background: #0b141e; color: #e6eef5; } }
  main { max-width: 22rem; padding: 1.5rem; text-align: center; line-height: 1.5; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  button { margin-top: 1rem; padding: .6rem 1.2rem; border: 0; border-radius: .6rem; background: #155375; color: #fbf8f1; font-size: 1rem; }
</style></head>
<body><main>
  <h1>ALETA tidak tersambung ke server</h1>
  <p>Pastikan HP tersambung ke jaringan kantor, lalu coba lagi.</p>
  <button type="button" onclick="location.reload()">Coba lagi</button>
</main></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(HALAMAN_TERPUTUS, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        })
    )
  );
});
