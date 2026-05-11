import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server implementation...");

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Bulk SMS Simulation
  app.post("/api/sms/send", async (req, res) => {
    const { recipients, message } = req.body;
    console.log(`SMS Sim: ${recipients.length} recipients`);
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER READY AT http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("BOOTSTRAP ERROR:", err);
  process.exit(1);
});
