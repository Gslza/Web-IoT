/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define standard types directly in server to avoid import resolution issues during CJS esbuild compilation
interface RelayState {
  relay1: boolean;
  relay2: boolean;
  relay3: boolean;
  relay4: boolean;
}

interface SensorState {
  temperature: number;
  humidity: number;
  last_update: string;
}

interface ESP32State {
  status: "online" | "offline";
  wifi_signal: string;
  ip_address: string;
  last_seen?: string;
}

interface CommandState {
  source: "web" | "telegram" | "voice" | "system" | "automation";
  last_command: string;
  updated_at: string;
}

interface SmartHomeSchema {
  relay: RelayState;
  sensor: SensorState;
  esp32: ESP32State;
  command: CommandState;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  source: "web" | "telegram" | "voice" | "automation" | "esp32" | "system";
  message: string;
  type: "info" | "success" | "warning" | "danger";
}

interface SensorHistory {
  timestamp: string;
  temperature: number;
  humidity: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory data store
  let smartHomeState: SmartHomeSchema = {
    relay: {
      relay1: false,
      relay2: false,
      relay3: false,
      relay4: false,
    },
    sensor: {
      temperature: 28.5,
      humidity: 65.0,
      last_update: new Date().toISOString(),
    },
    esp32: {
      status: "online",
      wifi_signal: "-68 dBm",
      ip_address: "192.168.1.108",
      last_seen: new Date().toISOString(),
    },
    command: {
      source: "system",
      last_command: "Sistem IoT Berhasil Diinisialisasi",
      updated_at: new Date().toISOString(),
    },
  };

  let activityLogs: ActivityLog[] = [
    {
      id: "log_1",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      source: "esp32",
      message: "ESP32 DevKit V1 berhasil terhubung ke WiFi SSID: 'MyHome_WiFi'",
      type: "success",
    },
    {
      id: "log_2",
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      source: "telegram",
      message: "Telegram Bot diinisialisasi sukses menggunakan @SmartHomeIoTQuizBot",
      type: "info",
    },
    {
      id: "log_3",
      timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      source: "telegram",
      message: "Pengguna @gusliyanza mengirimkan perintah /start",
      type: "info",
    },
    {
      id: "log_4",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      source: "telegram",
      message: "Mengaktifkan Lampu 1 melalui perintah Telegram /lampu1_on",
      type: "success",
    },
    {
      id: "log_5",
      timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      source: "esp32",
      message: "ESP32 mengonfirmasi Lampu 1 menyala (Relay 1 LOW)",
      type: "success",
    },
    {
      id: "log_6",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      source: "voice",
      message: "Perintah suara terdeteksi: 'Nyalakan Lampu 2'",
      type: "info",
    },
    {
      id: "log_7",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      source: "web",
      message: "Mengaktifkan Lampu 2 melalui Web Dashboard",
      type: "success",
    },
    {
      id: "log_8",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      source: "automation",
      message: "Otomatisasi: Suhu mencapai 28.5°C, menyalakan Lampu 4 (Kipas Angin Angkat)",
      type: "warning",
    },
  ];

  // Helper list for sensor chart
  let sensorHistory: SensorHistory[] = [];
  const baseTime = Date.now();
  for (let i = 10; i >= 0; i--) {
    const formattedTime = new Date(baseTime - i * 5 * 60 * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    sensorHistory.push({
      timestamp: formattedTime,
      temperature: +(26.5 + Math.random() * 3).toFixed(1),
      humidity: +(60 + Math.random() * 8).toFixed(1),
    });
  }

  // Helper to add activity log
  const pushLog = (source: ActivityLog["source"], message: string, type: ActivityLog["type"] = "info") => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      source,
      message,
      type,
    };
    activityLogs.unshift(newLog);
    if (activityLogs.length > 50) {
      activityLogs = activityLogs.slice(0, 50);
    }
  };

  // Check ESP32 status dynamically based on last updated
  const checkESP32Status = () => {
    const lastSeenTime = new Date(smartHomeState.esp32.last_seen || 0).getTime();
    const isOnline = Date.now() - lastSeenTime < 35000; // considered offline if no message in 35s
    smartHomeState.esp32.status = isOnline ? "online" : "offline";
  };

  // Background Simulator to make life easy & awesome in the preview, changing temperatures slightly!
  let simulatorInterval: NodeJS.Timeout | null = null;
  const startSimulator = () => {
    if (simulatorInterval) return;
    simulatorInterval = setInterval(() => {
      // Small adjustment of temperature & humidity
      const tempDelta = (Math.random() - 0.5) * 0.4;
      const humiDelta = (Math.random() - 0.5) * 0.8;

      let newTemp = +(smartHomeState.sensor.temperature + tempDelta).toFixed(1);
      if (newTemp < 24) newTemp = 24.2;
      if (newTemp > 35) newTemp = 34.6;

      let newHumi = +(smartHomeState.sensor.humidity + humiDelta).toFixed(1);
      if (newHumi < 40) newHumi = 42.0;
      if (newHumi > 95) newHumi = 91.5;

      smartHomeState.sensor.temperature = newTemp;
      smartHomeState.sensor.humidity = newHumi;
      smartHomeState.sensor.last_update = new Date().toISOString();
      smartHomeState.esp32.last_seen = new Date().toISOString();
      smartHomeState.esp32.status = "online";

      // Append to sensor graph history
      const formattedTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      sensorHistory.push({
        timestamp: formattedTime,
        temperature: newTemp,
        humidity: newHumi,
      });
      if (sensorHistory.length > 15) {
        sensorHistory.shift();
      }

      // Check automations
      if (newTemp > 31.0 && !smartHomeState.relay.relay4) {
        smartHomeState.relay.relay4 = true;
        pushLog("automation", `Pengaman Suhu: Temperatur ${newTemp}°C (>31°C). Otomatis menyalakan Lampu 4 (Relay 4 / Kipas Pendingin).`, "warning");
      }

    }, 8000);
  };

  // Start the background simulator by default so preview works instantly with simulated live data!
  startSimulator();

  // 1. GET FULL STATUS
  app.get("/api/status", (req, res) => {
    checkESP32Status();
    res.json({
      smart_home: smartHomeState,
      logs: activityLogs,
      history: sensorHistory,
    });
  });

  // 2. POST CONTROL RELAY (FROM WEB)
  app.post("/api/relay", (req, res) => {
    const { relayId, value, source = "web" } = req.body; // e.g. "relay1", true, "web"
    const validRelays = ["relay1", "relay2", "relay3", "relay4"];

    if (!validRelays.includes(relayId) || typeof value !== "boolean") {
      return res.status(400).json({ error: "Invalid parameters. relayId must be relay1-4, value must be boolean." });
    }

    // Update state
    smartHomeState.relay[relayId as keyof RelayState] = value;
    smartHomeState.command = {
      source: source,
      last_command: `Set ${relayId} to ${value ? "ON" : "OFF"}`,
      updated_at: new Date().toISOString(),
    };

    const friendlyName = relayId === "relay1" ? "Lampu 1" : relayId === "relay2" ? "Lampu 2" : relayId === "relay3" ? "Lampu 3" : "Lampu 4";
    pushLog(
      source,
      `Mengubah status ${friendlyName} menjadi ${value ? "AKTIF (ON)" : "NONAKTIF (OFF)"} melalui ${source === "web" ? "Web Dashboard" : source === "telegram" ? "Telegram Bot" : "Perintah Suara"}`,
      value ? "success" : "info"
    );

    res.json({ status: "success", smart_home: smartHomeState });
  });

  // 3. POST VARIATION COMMAND (FROM WEB/TELEGRAM)
  app.post("/api/variation", (req, res) => {
    const { type, source = "web" } = req.body; // type: "variation1" or "variation2"

    if (type !== "variation1" && type !== "variation2") {
      return res.status(400).json({ error: "Invalid variation type. Use variation1 or variation2." });
    }

    smartHomeState.command = {
      source: source,
      last_command: `Run ${type === "variation1" ? "Variasi Lampu 1" : "Variasi Lampu 2"}`,
      updated_at: new Date().toISOString(),
    };

    if (type === "variation1") {
      // Variation 1 logic: Relay 1, 2, 3, 4 sequentially run, then off
      smartHomeState.relay = {
        relay1: true,
        relay2: true,
        relay3: true,
        relay4: true,
      };
      pushLog(source, `Memulai pola 'Variasi 1' (Menyalakan semua relay bergantian) via ${source}`, "success");
    } else {
      // Variation 2 logic: Alternate blink
      smartHomeState.relay = {
        relay1: true,
        relay2: false,
        relay3: true,
        relay4: false,
      };
      pushLog(source, `Memulai pola 'Variasi 2' (Selingan Lampu 1 & 3 ON, Lampu 2 & 4 OFF) via ${source}`, "success");
    }

    res.json({ status: "success", smart_home: smartHomeState });
  });

  // 4. POST ALL RELAY OFF (FROM WEB/TELEGRAM)
  app.post("/api/all-off", (req, res) => {
    const { source = "web" } = req.body;

    smartHomeState.relay = {
      relay1: false,
      relay2: false,
      relay3: false,
      relay4: false,
    };

    smartHomeState.command = {
      source: source,
      last_command: "Mematikan semua relay",
      updated_at: new Date().toISOString(),
    };

    pushLog(source, `Mematikan seluruh lampu / relay (All OFF) via ${source}`, "warning");

    res.json({ status: "success", smart_home: smartHomeState });
  });

  // 5. POST TRIGGER TELEGRAM COMMAND SIMULATION IN UI
  app.post("/api/telegram-simulate", (req, res) => {
    const { text, user = "@gusliyanza" } = req.body; // text matches the bot command (e.g. "/lampu1_on", "Nyalakan lampu 1")
    if (!text) return res.status(400).json({ error: "Text command is required" });

    pushLog("telegram", `Pengguna ${user} mengirimkan pesan ke Bot: "${text}"`, "info");

    const commandClean = text.trim().toLowerCase();

    // Command Parser
    if (commandClean === "/start") {
      pushLog("telegram", `Bot merespon: Menampilkan Menu Utama dan daftar perintah smart home.`, "info");
    } else if (commandClean === "/lampu1_on" || commandClean === "nyalakan lampu 1") {
      smartHomeState.relay.relay1 = true;
      pushLog("telegram", `Bot merespon: 'Lampu 1 AKTIF'. Notifikasi dikirim.`, "success");
    } else if (commandClean === "/lampu1_off" || commandClean === "matikan lampu 1") {
      smartHomeState.relay.relay1 = false;
      pushLog("telegram", `Bot merespon: 'Lampu 1 MATI'. Notifikasi dikirim.`, "info");
    } else if (commandClean === "/lampu2_on" || commandClean === "nyalakan lampu 2") {
      smartHomeState.relay.relay2 = true;
      pushLog("telegram", `Bot merespon: 'Lampu 2 AKTIF'. Notifikasi dikirim.`, "success");
    } else if (commandClean === "/lampu2_off" || commandClean === "matikan lampu 2") {
      smartHomeState.relay.relay2 = false;
      pushLog("telegram", `Bot merespon: 'Lampu 2 MATI'. Notifikasi dikirim.`, "info");
    } else if (commandClean === "/lampu3_on" || commandClean === "nyalakan lampu 3") {
      smartHomeState.relay.relay3 = true;
      pushLog("telegram", `Bot merespon: 'Lampu 3 AKTIF'. Notifikasi dikirim.`, "success");
    } else if (commandClean === "/lampu3_off" || commandClean === "matikan lampu 3") {
      smartHomeState.relay.relay3 = false;
      pushLog("telegram", `Bot merespon: 'Lampu 3 MATI'. Notifikasi dikirim.`, "info");
    } else if (commandClean === "/lampu4_on" || commandClean === "nyalakan lampu 4") {
      smartHomeState.relay.relay4 = true;
      pushLog("telegram", `Bot merespon: 'Lampu 4 AKTIF'. Notifikasi dikirim.`, "success");
    } else if (commandClean === "/lampu4_off" || commandClean === "matikan lampu 4") {
      smartHomeState.relay.relay4 = false;
      pushLog("telegram", `Bot merespon: 'Lampu 4 MATI'. Notifikasi dikirim.`, "info");
    } else if (commandClean === "/sensor" || commandClean === "berapa temperatur" || commandClean === "berapa kelembapan") {
      const respMsg = `Suhu: ${smartHomeState.sensor.temperature}°C, Kelembaban: ${smartHomeState.sensor.humidity}%`;
      pushLog("telegram", `Bot merespon: '${respMsg}'`, "info");
    } else if (commandClean === "/status") {
      const respMsg = `L1:${smartHomeState.relay.relay1 ? "ON" : "OFF"} | L2:${smartHomeState.relay.relay2 ? "ON" : "OFF"} | L3:${smartHomeState.relay.relay3 ? "ON" : "OFF"} | L4:${smartHomeState.relay.relay4 ? "ON" : "OFF"}`;
      pushLog("telegram", `Bot merespon: 'Status Relay: ${respMsg}'`, "info");
    } else if (commandClean === "/all_on" || commandClean === "nyalakan semua lampu") {
      smartHomeState.relay = { relay1: true, relay2: true, relay3: true, relay4: true };
      pushLog("telegram", `Bot merespon: 'Semua Relay AKTIF'. Notifikasi dikirim.`, "success");
    } else if (commandClean === "/all_off" || commandClean === "matikan lampu" || commandClean === "matikan semua lampu") {
      smartHomeState.relay = { relay1: false, relay2: false, relay3: false, relay4: false };
      pushLog("telegram", `Bot merespon: 'Semua Relay MATI'. Notifikasi dikirim.`, "warning");
    } else if (commandClean === "/variasi1" || commandClean === "nyalakan variasi 1") {
      smartHomeState.relay = { relay1: true, relay2: true, relay3: true, relay4: true };
      pushLog("telegram", `Bot merespon: 'Menjalankan Variasi Lampu 1'.`, "success");
    } else if (commandClean === "/variasi2" || commandClean === "nyalakan variasi 2") {
      smartHomeState.relay = { relay1: true, relay2: false, relay3: true, relay4: false };
      pushLog("telegram", `Bot merespon: 'Menjalankan Variasi Lampu 2'.`, "success");
    } else {
      // General voice typing matcher
      if (commandClean.includes("nyalakan") && commandClean.includes("lampu")) {
        // try to see which lamp
        if (commandClean.includes("1")) {
          smartHomeState.relay.relay1 = true;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 1 AKTIF'.`, "success");
        } else if (commandClean.includes("2")) {
          smartHomeState.relay.relay2 = true;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 2 AKTIF'.`, "success");
        } else if (commandClean.includes("3")) {
          smartHomeState.relay.relay3 = true;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 3 AKTIF'.`, "success");
        } else if (commandClean.includes("4")) {
          smartHomeState.relay.relay4 = true;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 4 AKTIF'.`, "success");
        } else {
          // turn all on
          smartHomeState.relay = { relay1: true, relay2: true, relay3: true, relay4: true };
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Semua Lampu AKTIF'.`, "success");
        }
      } else if (commandClean.includes("matikan") && commandClean.includes("lampu")) {
        if (commandClean.includes("1")) {
          smartHomeState.relay.relay1 = false;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 1 OFF'.`, "info");
        } else if (commandClean.includes("2")) {
          smartHomeState.relay.relay2 = false;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 2 OFF'.`, "info");
        } else if (commandClean.includes("3")) {
          smartHomeState.relay.relay3 = false;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 3 OFF'.`, "info");
        } else if (commandClean.includes("4")) {
          smartHomeState.relay.relay4 = false;
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Lampu 4 OFF'.`, "info");
        } else {
          smartHomeState.relay = { relay1: false, relay2: false, relay3: false, relay4: false };
          pushLog("telegram", `Menerjemahkan pesan suara keyboard: 'Semua Lampu OFF'.`, "warning");
        }
      } else {
        pushLog("telegram", `Bot merespon: Perintah tidak dikenal. Ketik /status atau /start untuk panduan.`, "warning");
      }
    }

    res.json({ status: "success", smart_home: smartHomeState });
  });

  // 6. ACTUAL REST API FOR REAL ESP32 TO CONNECT TO!
  // It handles POST requests from the ESP32 to push current readings and obtain the target relay states.
  // ESP32 sends: { "temperature": X, "humidity": Y, "relay": { "relay1": B, ... }, "ip_address": "X", "wifi_signal": "Y" }
  // Server returns: { "relay": { "relay1": B, ... }, "command": "...", "status": "ok" }
  app.post("/api/esp32/update", (req, res) => {
    const wasOffline = smartHomeState.esp32.status === "offline";
    const { temperature, humidity, wifi_signal, ip_address, relay } = req.body;

    if (temperature !== undefined) smartHomeState.sensor.temperature = +Number(temperature).toFixed(1);
    if (humidity !== undefined) smartHomeState.sensor.humidity = +Number(humidity).toFixed(1);
    if (wifi_signal !== undefined) smartHomeState.esp32.wifi_signal = String(wifi_signal);
    if (ip_address !== undefined) smartHomeState.esp32.ip_address = String(ip_address);
    smartHomeState.sensor.last_update = new Date().toISOString();
    smartHomeState.esp32.last_seen = new Date().toISOString();
    smartHomeState.esp32.status = "online";

    // If ESP32 reported its relay state, we update the state.
    // However, if the server has a newer target value that was set by Web/Telegram,
    // the ESP32 should apply the server's target state instead.
    // To keep it simple and synchronized, we return the server's target relay states!
    const formattedTime = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Save historical data
    if (temperature !== undefined && humidity !== undefined) {
      sensorHistory.push({
        timestamp: formattedTime,
        temperature: +Number(temperature).toFixed(1),
        humidity: +Number(humidity).toFixed(1),
      });
      if (sensorHistory.length > 15) {
        sensorHistory.shift();
      }
    }

    // Acknowledge connect in the logs if it was offline
    if (wasOffline) {
      pushLog("esp32", `ESP32 tersambung kembali. IP: ${ip_address || "unknown"}, Sinyal: ${wifi_signal || "unknown"}`, "success");
    }

    // Return current relay states of the cloud, which ESP32 must synchronize with
    res.json({
      status: "ok",
      relay: smartHomeState.relay,
      last_command: smartHomeState.command,
    });
  });

  // GET API - ESP32 simple GET poll fallback (for very memory-constrained ESP32 queries)
  // ESP32: GET /api/esp32/poll?temp=28.4&humi=61.2&ip=192.168.1.15&wifi=-65
  app.get("/api/esp32/poll", (req, res) => {
    const { temp, humi, ip, wifi } = req.query;

    if (temp !== undefined) smartHomeState.sensor.temperature = +Number(temp).toFixed(1);
    if (humi !== undefined) smartHomeState.sensor.humidity = +Number(humi).toFixed(1);
    if (ip !== undefined) smartHomeState.esp32.ip_address = String(ip);
    if (wifi !== undefined) smartHomeState.esp32.wifi_signal = String(wifi) + " dBm";
    smartHomeState.sensor.last_update = new Date().toISOString();
    smartHomeState.esp32.last_seen = new Date().toISOString();
    smartHomeState.esp32.status = "online";

    // Return a simple CSV or JSON string so ESP32 can parse it instantly:
    // "relay1,relay2,relay3,relay4" (e.g. "0,1,0,0" where 0=OFF, 1=ON)
    const r1 = smartHomeState.relay.relay1 ? "1" : "0";
    const r2 = smartHomeState.relay.relay2 ? "1" : "0";
    const r3 = smartHomeState.relay.relay3 ? "1" : "0";
    const r4 = smartHomeState.relay.relay4 ? "1" : "0";

    res.send(`${r1},${r2},${r3},${r4}`);
  });

  // REST API Clear Logs
  app.post("/api/logs/clear", (req, res) => {
    activityLogs = [
      {
        id: "cleared",
        timestamp: new Date().toISOString(),
        source: "system",
        message: "Log riwayat dibersihkan oleh pengguna.",
        type: "info",
      }
    ];
    res.json({ status: "success", logs: activityLogs });
  });

  // Serve static assets from build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Home Express Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
});
