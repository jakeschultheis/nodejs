import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("static"));

const OPN_URL = process.env.OPN_URL;
const OPN_KEY = process.env.OPN_KEY;
const OPN_SECRET = process.env.OPN_SECRET;
const OPN_INSECURE = process.env.OPN_INSECURE === "1";

// TLS agent to optionally ignore cert validation
import https from "https";
const agent = new https.Agent({
  rejectUnauthorized: !OPN_INSECURE
});

// Helper for POSTing to OPNsense
async function opnPost(path) {
  const url = `${OPN_URL}${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(OPN_KEY + ":" + OPN_SECRET).toString("base64"),
      "Content-Type": "application/json"
    },
    body: "{}",
    agent
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return body;
}

// ---------- API ROUTES ----------

// STATUS
app.post("/api/status", async (req, res) => {
  try {
    const raw = await opnPost("/api/core/firmware/status");
    const json = JSON.parse(raw);

    // Normalize flexible fields
    const normalize = (v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "ok";
      }
      return false;
    };

    const output = `
Status: ${json.status}
Version: ${json.version}
Upgrade Available: ${normalize(json.upgrade_available)}
Needs Reboot: ${normalize(json.upgrade_needs_reboot)}
    `.trim();

    res.type("text").send(output);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// UPDATE
app.post("/api/update", async (req, res) => {
  try {
    const out = await opnPost("/api/core/firmware/update");
    res.type("text").send(out);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// UPGRADE
app.post("/api/upgrade", async (req, res) => {
  try {
    const out = await opnPost("/api/core/firmware/upgrade");
    res.type("text").send(out);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Start server
app.listen(8080, () => {
  console.log("Server running at http://localhost:8080");
});
