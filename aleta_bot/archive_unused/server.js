const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 8080 });

server.on("connection", (ws) => {
  console.log("Client connected");

  ws.send("Hello client Derry");

  // Menangani pesan dari klien
  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);

    // Kirim balik pesan kepada klien berdasarkan isi pesan
    if (message === "hai") {
      ws.send("Derry Ganteng hai");
    } else if (message === "bye") {
      ws.send("Derry Ganteng dada");
    } else {
      ws.send("Derry Ganteng saja");
    }
  });

  // Menangani penutupan koneksi klien
  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
