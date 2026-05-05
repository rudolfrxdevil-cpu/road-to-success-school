import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, "db.json");

// Simple in-memory / file db
async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return { users: {} };
  }
}

async function writeDB(data: any) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // APIs
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort werden benötigt" });
    }
    const db = await readDB();
    if (db.users[username]) {
      return res.status(400).json({ error: "Benutzername bereits vergeben" });
    }
    
    // Create new user (clear text password for simplicity since no hashing lib installed)
    db.users[username] = {
      password,
      profile: {
        name: username,
        gradeLevel: "10b",
        points: 0,
        history: [],
        schedule: { 0: [], 1: [], 2: [], 3: [], 4: [] }
      }
    };
    await writeDB(db);
    
    res.json({ success: true, profile: db.users[username].profile });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users[username];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Falscher Benutzername oder Passwort" });
    }
    res.json({ success: true, profile: user.profile });
  });

  app.post("/api/profile", async (req, res) => {
    const { username, profile } = req.body;
    if (!username || !profile) {
      return res.status(400).json({ error: "Missing data" });
    }
    const db = await readDB();
    if (!db.users[username]) {
      return res.status(404).json({ error: "User not found" });
    }
    db.users[username].profile = profile;
    await writeDB(db);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
