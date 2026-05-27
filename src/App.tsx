/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  Cpu,
  Thermometer,
  Zap,
  FileText,
  Settings as SettingsIcon,
  Search,
  Bell,
  User,
  Wifi,
  WifiOff,
  Power,
  Mic,
  RefreshCw,
  Play,
  Square,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  DollarSign,
  Clock,
  Send,
  Download,
  Copy,
  Volume2,
  ChevronRight,
  Database,
  ArrowRight,
  Laptop
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { generateESP32Code } from "./esp32Code";
import { SmartHomeSchema, ActivityLog, SensorHistory } from "./types";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "devices" | "sensor" | "automation" | "report" | "settings">("dashboard");

  // Core IoT State
  const [iotState, setIotState] = useState<SmartHomeSchema>({
    relay: { relay1: false, relay2: false, relay3: false, relay4: false },
    sensor: { temperature: 28.5, humidity: 65, last_update: new Date().toISOString() },
    esp32: { status: "online", wifi_signal: "-68 dBm", ip_address: "192.168.1.108", last_seen: new Date().toISOString() },
    command: { source: "system", last_command: "Sistem IoT Terkoneksi", updated_at: new Date().toISOString() }
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [history, setHistory] = useState<SensorHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingError, setPollingError] = useState(false);

  // Connection config states
  const [wifiSsid, setWifiSsid] = useState("MyHome_WiFi");
  const [wifiPass, setWifiPass] = useState("123456789");
  const [botToken, setBotToken] = useState("1234567890:AAH_MySmartHomeBotTokenXYZ");
  const [chatId, setChatId] = useState("987654321");
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [useActiveLow, setUseActiveLow] = useState(true);

  // Hardware Pins Settings
  const [dhtPin, setDhtPin] = useState(4);
  const [dhtType, setDhtType] = useState("DHT11");
  const [r1Pin, setR1Pin] = useState(16);
  const [r2Pin, setR2Pin] = useState(17);
  const [r3Pin, setR3Pin] = useState(18);
  const [r4Pin, setR4Pin] = useState(19);

  // Interactivity & Simulator
  const [telegramCommand, setTelegramCommand] = useState("");
  const [simulatingLog, setSimulatingLog] = useState(false);
  const [voiceInput, setVoiceInput] = useState("");
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: "success" | "info" | "warning" } | null>(null);

  // Polling Trigger
  const [pollCounter, setPollCounter] = useState(0);

  // Detect and set local API endpoint dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      setApiServerUrl(window.location.origin);
    }
  }, []);

  // Fetch full status from the Express backend
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Server response error");
      const data = await res.json();
      setIotState(data.smart_home);
      setLogs(data.logs);
      setHistory(data.history);
      setPollingError(false);
    } catch (err) {
      console.error("Error fetching status:", err);
      setPollingError(true);
    } finally {
      if (loading) setLoading(false);
    }
  };

  // Poll status every 3.5 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      setPollCounter((prev) => prev + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  // Refetch when poll counter triggers
  useEffect(() => {
    if (pollCounter > 0) {
      fetchStatus();
    }
  }, [pollCounter]);

  // Trigger Notifications inside the browser UI for extra polish
  const triggerNotification = (text: string, type: "success" | "info" | "warning" = "success") => {
    setNotificationMsg({ text, type });
    setTimeout(() => {
      setNotificationMsg(null);
    }, 4000);
  };

  // Action: Toggle Relay
  const toggleRelay = async (relayId: string, currentValue: boolean) => {
    try {
      const targetVal = !currentValue;
      // Optimistic update
      setIotState((prev) => ({
        ...prev,
        relay: { ...prev.relay, [relayId]: targetVal }
      }));

      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relayId, value: targetVal, source: "web" })
      });
      if (!res.ok) throw new Error("Failed to toggle relay");
      const data = await res.json();
      setIotState(data.smart_home);
      fetchStatus();
      triggerNotification(`Lampu ${relayId.replace("relay", "")} berhasil diubah ke ${targetVal ? "ON" : "OFF"}`);
    } catch (err) {
      console.error(err);
      triggerNotification("Gagal mengubah relay", "warning");
    }
  };

  // Action: All Off
  const triggerAllOff = async () => {
    try {
      // Optimistic
      setIotState((prev) => ({
        ...prev,
        relay: { relay1: false, relay2: false, relay3: false, relay4: false }
      }));

      const res = await fetch("/api/all-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "web" })
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIotState(data.smart_home);
      fetchStatus();
      triggerNotification("Seluruh relay berhasil dinonaktifkan (ALL OFF)", "warning");
    } catch (err) {
      console.error(err);
      triggerNotification("Gagal menonaktifkan semua relay", "warning");
    }
  };

  // Action: Trigger Variation
  const triggerVariation = async (type: "variation1" | "variation2") => {
    try {
      const res = await fetch("/api/variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, source: "web" })
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIotState(data.smart_home);
      fetchStatus();
      triggerNotification(`Pola '${type === "variation1" ? "Variasi Lampu 1" : "Variasi Lampu 2"}' dijalankan!`);
    } catch (err) {
      console.error(err);
      triggerNotification("Gagal mengaktifkan pola variasi", "warning");
    }
  };

  // Action: Simulator Telegram Command
  const simulateTelegramInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramCommand.trim()) return;
    setSimulatingLog(true);

    try {
      const res = await fetch("/api/telegram-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: telegramCommand })
      });
      if (!res.ok) throw new Error("Simulation error");
      setTelegramCommand("");
      fetchStatus();
      triggerNotification("Telegram message simulated successfully!", "success");
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setSimulatingLog(false), 300);
    }
  };

  // Click standard commands directly for Telegram Bot emulation
  const handleQuickCommand = async (cmdText: string) => {
    setSimulatingLog(true);
    try {
      const res = await fetch("/api/telegram-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cmdText })
      });
      if (!res.ok) throw new Error("Simulation error");
      fetchStatus();
      triggerNotification(`Kirim Perintah Bot: "${cmdText}"`, "info");
    } catch (err) {
      console.error(err);
    } finally {
      setSimulatingLog(false);
    }
  };

  // Action: Speak Voice Command Simulator
  const handleVoiceCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceInput.trim()) return;
    setSimulatingLog(true);
    try {
      const res = await fetch("/api/telegram-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceInput, user: "@gusliyanza_voice" })
      });
      if (!res.ok) throw new Error("Voice command simulation error");
      setVoiceInput("");
      fetchStatus();
      triggerNotification(`Perintah Suara Diinput: "${voiceInput}"`, "success");
    } catch (err) {
      console.error(err);
    } finally {
      setSimulatingLog(false);
    }
  };

  // Action: Clear log list
  const clearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      if (res.ok) {
        fetchStatus();
        triggerNotification("Histori aktivitas berhasil dibersihkan", "info");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(true);
    triggerNotification("Kode Arduino berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedStatus(false), 3000);
  };

  // Hardcoded price estimates (Indonesia standards) for Quiz Section 4
  const costEstimates = [
    { id: 1, item: "ESP32 DEVKIT V1 ESP-WROOM-32", category: "Hardware", unitPrice: 45000, qty: 1, total: 45000 },
    { id: 2, item: "Sensor Suhu & Kelembaban DHT11 Module", category: "Hardware", unitPrice: 18000, qty: 1, total: 18000 },
    { id: 3, item: "Relay 4-Channel Pin Active LOW 5V DC Module", category: "Hardware", unitPrice: 28000, qty: 1, total: 28000 },
    { id: 4, item: "Kabel Jumper Dupont (Crimped breadboard wire)", category: "Hardware", unitPrice: 12000, qty: 1, total: 12000 },
    { id: 5, item: "Breadboard 400 Titik atau PCB Matrix", category: "Hardware", unitPrice: 15000, qty: 1, total: 15000 },
    { id: 6, item: "Adaptor micro USB 5V 2A", category: "Hardware", unitPrice: 22000, qty: 1, total: 22000 },
    { id: 7, item: "Hosting Cloud API Broker & Web Dashboard (Vercel/Cloud Run)", category: "Software", unitPrice: 0, qty: 1, total: 0, notes: "Free Tier" },
    { id: 8, item: "Firebase Realtime DB Cloud Hosting", category: "Software", unitPrice: 0, qty: 1, total: 0, notes: "Free Spark Plan" },
    { id: 9, item: "Telegram Bot API (BotFather Hub)", category: "Software", unitPrice: 0, qty: 1, total: 0, notes: "Gratis Semenetara" }
  ];

  const totalCost = costEstimates.reduce((acc, curr) => acc + curr.total, 0);

  // Hardcoded project timeline estimates for Quiz Section 5
  const projectTimeline = [
    { phase: "Analisis Kebutuhan", task: "Studi literatur komponen, perancangan skema kerja pin ESP32 dht11/relay", duration: "1 Hari", weight: "10%" },
    { phase: "Perancangan Arsitektur", task: "Membuat flowchart alur kerja, blok diagram sistem, integrasi BOT API", duration: "1 Hari", weight: "15%" },
    { phase: "Instalasi Hardware", task: "Perakitan kabel ESP32, sensor udara DHT11, pin modul relay 4 channel", duration: "1 Hari", weight: "15%" },
    { phase: "Pemrograman Arduino & Bot", task: "Coding ESP32 pada Arduino IDE, Library UniversalTelegramBot, wifi secure", duration: "2 Hari", weight: "25%" },
    { phase: "Pemrograman Web Dashboard", task: "Penyusunan dashboard React, koneksi Express REST API, grafik Recharts", duration: "2 Hari", weight: "20%" },
    { phase: "Pengujian & Kalibrasi", task: "QA pengujian perintah suara, validasi sinkron cloud database, debugging", duration: "1 Hari", weight: "10%" },
    { phase: "Penyusunan Laporan", task: "Penyusunan file laporan proyek sistem IoT smart home, dokumentasi quis", duration: "1 Hari", weight: "5%" }
  ];

  // Dynamically constructed ESP Code
  const currentESP32InoCode = generateESP32Code({
    wifiSsid,
    wifiPass,
    botToken,
    chatId,
    apiUrl: apiServerUrl || "http://192.168.1.108:3000",
    useActiveLow,
    dhtPin,
    dhtType,
    r1Pin,
    r2Pin,
    r3Pin,
    r4Pin
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans selection:bg-cyan-500 selection:text-slate-950" id="main_dashboard_container">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-[#0f172a]/50 border-r border-slate-800/80 p-5 flex flex-col justify-between shrink-0" id="smart_home_sidebar">
        
        <div className="space-y-6">
          {/* Sidebar Header */}
          <div className="flex items-center space-x-3 px-1 py-2">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide uppercase leading-none">LUX OS</h1>
              <span className="text-[10px] text-slate-500 font-mono">4-Channel System</span>
            </div>
          </div>

          {/* Sidebar Mini Profile (Quis Quiz Creator Info) */}
          <div className="p-3.5 rounded-2xl border border-slate-800/50 bg-slate-900/40 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono">
              GL
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">gusliyanza02@gmail.com</p>
              <p className="text-[10px] text-emerald-400 flex items-center mt-0.5">
                <span className="pulse-dot mr-1.5" /> Online Controller
              </p>
            </div>
          </div>

          {/* Navigation Menus */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "dashboard"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("devices")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "devices"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>Devices (Relay)</span>
            </button>

            <button
              onClick={() => setActiveTab("sensor")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "sensor"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <Thermometer className="w-4 h-4" />
              <span>Sensor & Grafik</span>
            </button>

            <button
              onClick={() => setActiveTab("automation")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "automation"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Otomatisasi</span>
            </button>

            <button
              onClick={() => setActiveTab("report")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "report"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Laporan Quis Proyek</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                activeTab === "settings"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-inner font-semibold"
                  : "hover:bg-slate-800/50 hover:text-white text-slate-400 border-transparent"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings & Code</span>
            </button>
          </nav>
        </div>

        {/* Footer info pin / safety warning */}
        <div className="mt-8 space-y-4">
          {/* Signal Indicator at Sidebar bottom */}
          {iotState.esp32.status === "online" && (
            <div className="p-4 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 rounded-2xl border border-indigo-500/20">
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-2">ESP32 Signal</p>
              <div className="flex items-end gap-1 h-8">
                <div className="w-1 h-3 bg-cyan-400 rounded-full"></div>
                <div className="w-1 h-5 bg-cyan-400 rounded-full"></div>
                <div className="w-1 h-8 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                <div className="w-1 h-6 bg-slate-700 rounded-full"></div>
                <span className="text-xs font-mono ml-2 text-white">{iotState.esp32.wifi_signal}</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="uppercase tracking-wider">Keselamatan AC:</span>
            </div>
            <p className="text-slate-400 leading-normal">
              Utamakan keselamatan tegangan AC 220V. Selalu isolasi kabel relay. Demo dinamis memakai lampu DC 5V sangatlah disarankan.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN APPLICATION CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(circle_at_50%_-20%,_#1e1b4b_0%,_#020617_100%)]" id="main_content_area">
        
        {/* TOPBAR */}
        <header className="h-20 border-b border-slate-800/50 px-8 flex items-center justify-between shrink-0">
          
          {/* Left: Section Search/Breadcrumbs */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-medium text-slate-400 capitalize">smart home controller</span>
              <ChevronRight className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">{activeTab}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1 capitalize">{activeTab === "dashboard" ? "Home Dashboard" : `${activeTab} Management`}</h1>
          </div>

          {/* Right: State indicators / Alerts */}
          <div className="flex items-center space-x-4">
            
            {/* Realtime ESP32 State Status Badge */}
            <div className={`flex items-center text-xs font-mono px-4 py-2 rounded-full border bg-slate-900/80 ${
              iotState.esp32.status === "online" 
                ? "border-emerald-500/30 text-emerald-400" 
                : "border-rose-500/30 text-rose-400"
            }`}>
              {iotState.esp32.status === "online" ? (
                <>
                  <span className="pulse-dot mr-1.5" />
                  <span>IP: {iotState.esp32.ip_address}</span>
                </>
              ) : (
                <>
                  <span className="pulse-dot-danger mr-1.5" />
                  <span>ESP32 STATE: OFFLINE</span>
                </>
              )}
            </div>

            {/* Signal strength indicator */}
            {iotState.esp32.status === "online" && (
              <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-305 border border-slate-800 rounded-xl py-2 px-3 bg-slate-900/40">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                <span>RSSI: {iotState.esp32.wifi_signal}</span>
              </div>
            )}

            {/* Notification trigger indicator */}
            <button className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-slate-800 hover:bg-slate-800/60 text-slate-400 transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            </button>

            {/* User Indicator */}
            <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
              <span className="text-xs font-medium font-mono text-slate-400 hidden sm:inline">gusliyanza02</span>
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-305 text-xs font-bold font-mono">
                GL
              </div>
            </div>
          </div>
        </header>

        {/* BROWSER NOTIFICATION ALERT POPUP */}
        <AnimatePresence>
          {notificationMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed top-18 right-6 z-50 rounded-xl p-4 shadow-xl border max-w-sm flex items-start space-x-3 ${
                notificationMsg.type === "success"
                  ? "bg-emerald-900 border-emerald-800 text-emerald-100"
                  : notificationMsg.type === "warning"
                  ? "bg-amber-900 border-amber-800 text-amber-100"
                  : "bg-blue-900 border-blue-800 text-blue-100"
              }`}
            >
              {notificationMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : notificationMsg.type === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs font-medium leading-relaxed">
                {notificationMsg.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* POLLING ERROR STICKY */}
        {pollingError && (
          <div className="bg-amber-500 text-slate-900 text-xs px-6 py-2 flex items-center justify-between font-mono font-medium text-center shadow-inner">
            <span className="mx-auto flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-slate-900" />
              <span>Gagal menghubungi broker server API. Menampilkan data cache lokal.</span>
            </span>
            <button onClick={fetchStatus} className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded hover:bg-slate-800 transition">
              Coba Lagi
            </button>
          </div>
        )}

        {/* CONTAINER CONTENT VIEW */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6" id="dashboard_view_content">
          
          {/* TAB 1: DASHBOARD VIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* HEADING WELCOME SMART HOME BLOCK */}
              <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900/85 rounded-3xl p-6 text-white shadow-[0_0_30px_rgba(99,102,241,0.15)] border border-indigo-500/20 backdrop-blur-md relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/15 via-indigo-500/5 to-transparent pointer-events-none" />
                <div className="relative z-10 max-w-2xl space-y-2">
                  <span className="text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">sistem IoT sinkron online</span>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Kontrol Smart Home dengan Telegram & Dashboard</h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Selamat datang di IoT Hub Smart Home. Kelola 4 Relay Channel Lampu, deteksi suhu & kelembaban DHT11 secara langsung, jalankan otomasi sensor, dan gunakan bot Telegram interaktif dengan text input.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-4 relative z-10 text-xs">
                  <div className="bg-slate-900/60 py-2 px-4 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-400">Telegram Bot ID:</span> <span className="text-cyan-400 font-semibold inline">@SmartHomeIoTQuizBot</span>
                  </div>
                  <div className="bg-slate-900/60 py-2 px-4 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-400">Modul Relay:</span> <span className="text-cyan-400 font-semibold inline">4 Channel Active LOW</span>
                  </div>
                  <div className="bg-slate-900/60 py-2 px-4 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-400">Suhu Aman:</span> <span className="text-emerald-400 font-semibold inline">≤ 31°C</span>
                  </div>
                </div>
              </div>

              {/* STATS OVERVIEWS: TEMPERATURE AND HUMIDITY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Temp Component */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold uppercase tracking-wider">DHT Sensor</span>
                    <Thermometer className="w-5 h-5 text-orange-400 animate-pulse" />
                  </div>
                  <div className="mt-4 flex flex-col gap-1">
                    <h3 className="text-slate-400 text-sm">Room Temperature</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-light text-white tracking-tighter">{iotState.sensor.temperature.toFixed(1)}</span>
                      <span className="text-2xl text-slate-500 font-light">&deg;C</span>
                    </div>
                  </div>
                  <div className="mt-6 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]" style={{ width: `${Math.min(100, Math.max(0, (iotState.sensor.temperature / 50) * 100))}%` }}></div>
                  </div>
                  <div className="mt-4 flex justify-between text-xs pt-1">
                    <span className="text-slate-500">Threshold aman</span>
                    <span className="text-orange-400 font-mono">31.0 &deg;C</span>
                  </div>
                </div>

                {/* Humidity Component */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider font-mono">Kelembapan</span>
                    <span className="text-sm font-mono text-cyan-400 font-bold bg-cyan-500/10 h-7 w-7 rounded-lg flex items-center justify-center border border-cyan-500/25">%</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-1">
                    <h3 className="text-slate-400 text-sm">Relative Humidity</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-light text-white tracking-tighter">{iotState.sensor.humidity.toFixed(1)}</span>
                      <span className="text-2xl text-slate-500 font-light">% RH</span>
                    </div>
                  </div>
                  <div className="mt-6 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" style={{ width: `${Math.min(100, Math.max(0, iotState.sensor.humidity))}%` }}></div>
                  </div>
                  <div className="mt-4 flex justify-between text-xs pt-1">
                    <span className="text-slate-500">Status udara</span>
                    <span className="text-cyan-400 font-mono">Stabil</span>
                  </div>
                </div>

                {/* Connection Widget Component */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider font-mono">ESP32 Core</span>
                    <div className={`p-1.5 rounded-lg border ${
                      iotState.esp32.status === "online" 
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                        : "bg-rose-500/20 border-rose-500/30 text-rose-400"
                    }`}>
                      {iotState.esp32.status === "online" ? (
                        <Wifi className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-1">
                    <h3 className="text-slate-400 text-sm">Signal & Connection</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-white tracking-tight">{iotState.esp32.status === "online" ? "CONNECTED" : "DISCONNECTED"}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                    Menghubungkan sensor DHT dan modul relay 4 channel ke cloud broker via Firebase.
                  </p>
                  <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>IP: {iotState.esp32.ip_address}</span>
                    <span>RSSI: {iotState.esp32.wifi_signal}</span>
                  </div>
                </div>
              </div>

              {/* RELAY DEVICE INTEGRATED FAST CONTROL LIST */}
              <div className="bg-slate-900/45 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-[0_0_20px_rgba(30,41,59,0.15)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-base tracking-tight">Kontrol Peralatan (4-Channel Relay)</h4>
                    <p className="text-xs text-slate-400">Klik switch toggle untuk mengubah relay. Command dikirim ke Cloud REST API</p>
                  </div>
                  <button onClick={triggerAllOff} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/25 transition-all text-xs font-bold font-mono px-4 py-2 rounded-xl flex items-center space-x-1.5">
                    <Power className="w-3.5 h-3.5" />
                    <span>Turn All OFF</span>
                  </button>
                </div>

                {/* GRID OF 4 RELAYS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  
                  {/* Relay 1 */}
                  <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                    iotState.relay.relay1 
                      ? "bg-slate-800/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-slate-850/10 border-slate-800/80 hover:bg-slate-800/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        iotState.relay.relay1 
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-550/20" 
                          : "bg-slate-800 text-slate-500 border border-slate-700/50"
                      }`}>
                        <Power className="w-5 h-5 animate-pulse" />
                      </div>
                      <button
                        onClick={() => toggleRelay("relay1", iotState.relay.relay1)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          iotState.relay.relay1 ? "bg-cyan-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            iotState.relay.relay1 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-4">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                        iotState.relay.relay1 ? "text-cyan-400" : "text-slate-500"
                      }`}>Channel 1 (GPIO 16)</span>
                      <h4 className="font-bold text-slate-200 text-sm mt-0.5">Lampu Utama (Ruang Tamu)</h4>
                      <p className={`text-xs font-semibold mt-1.5 font-mono ${
                        iotState.relay.relay1 ? "text-cyan-400" : "text-slate-500"
                      }`}>{iotState.relay.relay1 ? "● AKTIF / LOW" : "○ MATI / HIGH"}</p>
                    </div>
                  </div>

                  {/* Relay 2 */}
                  <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                    iotState.relay.relay2 
                      ? "bg-slate-800/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-slate-850/10 border-slate-800/80 hover:bg-slate-800/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        iotState.relay.relay2 
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-550/20" 
                          : "bg-slate-800 text-slate-500 border border-slate-700/50"
                      }`}>
                        <Power className="w-5 h-5 animate-pulse" />
                      </div>
                      <button
                        onClick={() => toggleRelay("relay2", iotState.relay.relay2)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          iotState.relay.relay2 ? "bg-cyan-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            iotState.relay.relay2 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-4">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                        iotState.relay.relay2 ? "text-cyan-400" : "text-slate-500"
                      }`}>Channel 2 (GPIO 17)</span>
                      <h4 className="font-bold text-slate-200 text-sm mt-0.5">Lampu Teras</h4>
                      <p className={`text-xs font-semibold mt-1.5 font-mono ${
                        iotState.relay.relay2 ? "text-cyan-400" : "text-slate-500"
                      }`}>{iotState.relay.relay2 ? "● AKTIF / LOW" : "○ MATI / HIGH"}</p>
                    </div>
                  </div>

                  {/* Relay 3 */}
                  <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                    iotState.relay.relay3 
                      ? "bg-slate-800/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-slate-850/10 border-slate-800/80 hover:bg-slate-800/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        iotState.relay.relay3 
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-550/20" 
                          : "bg-slate-800 text-slate-500 border border-slate-700/50"
                      }`}>
                        <Power className="w-5 h-5 animate-pulse" />
                      </div>
                      <button
                        onClick={() => toggleRelay("relay3", iotState.relay.relay3)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          iotState.relay.relay3 ? "bg-cyan-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            iotState.relay.relay3 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-4">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                        iotState.relay.relay3 ? "text-cyan-400" : "text-slate-500"
                      }`}>Channel 3 (GPIO 18)</span>
                      <h4 className="font-bold text-slate-200 text-sm mt-0.5">Lampu Kamar</h4>
                      <p className={`text-xs font-semibold mt-1.5 font-mono ${
                        iotState.relay.relay3 ? "text-cyan-400" : "text-slate-500"
                      }`}>{iotState.relay.relay3 ? "● AKTIF / LOW" : "○ MATI / HIGH"}</p>
                    </div>
                  </div>

                  {/* Relay 4 */}
                  <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                    iotState.relay.relay4 
                      ? "bg-slate-800/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-slate-850/10 border-slate-800/80 hover:bg-slate-800/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        iotState.relay.relay4 
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-550/20" 
                          : "bg-slate-800 text-slate-500 border border-slate-700/50"
                      }`}>
                        <Power className="w-5 h-5 animate-pulse" />
                      </div>
                      <button
                        onClick={() => toggleRelay("relay4", iotState.relay.relay4)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          iotState.relay.relay4 ? "bg-cyan-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            iotState.relay.relay4 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-4">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                        iotState.relay.relay4 ? "text-cyan-400" : "text-slate-500"
                      }`}>Channel 4 (GPIO 19)</span>
                      <h4 className="font-bold text-slate-200 text-sm mt-0.5">Lampu Tidur / Kipas AC</h4>
                      <p className={`text-xs font-semibold mt-1.5 font-mono ${
                        iotState.relay.relay4 ? "text-cyan-400" : "text-slate-500"
                      }`}>{iotState.relay.relay4 ? "● AKTIF / LOW" : "○ MATI / HIGH"}</p>
                    </div>
                  </div>

                </div>
              </div>

                 {/* TELEGRAM BOT CONSOLE SIMULATOR & VARIATION ACTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Simulated Telegram Client Chat Panel */}
                <div className="bg-slate-900/40 backdrop-blur-md text-slate-100 p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4 lg:col-span-2">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs uppercase shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                          TG
                        </div>
                        <div>
                          <h4 className="font-bold text-sm tracking-tight text-white">Simulator Telegram Bot Chat</h4>
                          <p className="text-[10px] text-slate-400">Emulasikan pengiriman teks bot untuk testing lokal</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 py-1 px-3 rounded-full text-cyan-400 font-mono font-medium">
                        Active Hub
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-slate-950/60 h-44 overflow-y-auto space-y-3 font-mono text-xs border border-slate-800/60 shadow-inner">
                      <div className="text-slate-550 text-[10px] text-center bg-slate-900/80 rounded-lg p-2 border border-slate-850">
                        Chat Session Started with @SmartHomeIoTQuizBot
                      </div>
                      <div className="bg-slate-800/70 p-3 rounded-2xl max-w-[85%] self-start border border-slate-700/30 space-y-1">
                        <p className="text-[10px] text-cyan-400 font-bold">@BotFather</p>
                        <p className="text-slate-250 leading-relaxed text-[11.5px]">Gunakan token untuk inisialisasi: <span className="text-emerald-450 font-bold">UniversalTelegramBot</span>.</p>
                      </div>
                      <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-2xl max-w-[85%] ml-auto text-right space-y-1">
                        <p className="text-[10px] text-cyan-400 font-bold font-mono">Pengguna (@gusliyanza)</p>
                        <p className="text-slate-100 font-mono text-[11.5px]">/status</p>
                      </div>
                      <div className="bg-slate-800/70 p-3 rounded-2xl max-w-[85%] self-start border border-slate-700/30 space-y-1">
                        <p className="text-[10px] text-emerald-400 font-bold">@SmartHomeIoTQuizBot</p>
                        <p className="text-slate-250 leading-relaxed text-[11.5px]">
                          📊 STATUS: L1:{iotState.relay.relay1 ? "ON" : "OFF"} | L2:{iotState.relay.relay2 ? "ON" : "OFF"} | L3:{iotState.relay.relay3 ? "ON" : "OFF"} | L4:{iotState.relay.relay4 ? "ON" : "OFF"}. Suhu: {iotState.sensor.temperature}°C.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Inputs to emulate sending commands */}
                  <div className="space-y-4">
                    <form onSubmit={simulateTelegramInput} className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Ketik perintah telegram (contoh: /lampu1_on atau /status)..."
                        value={telegramCommand}
                        onChange={(e) => setTelegramCommand(e.target.value)}
                        className="flex-1 bg-slate-950/65 border border-slate-800 text-xs font-mono rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={simulatingLog}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold p-3 px-5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline font-mono">Kirim</span>
                      </button>
                    </form>

                    {/* Quick Buttons for standard text commands */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                      <span className="text-slate-500 self-center mr-1">Quick:</span>
                      <button type="button" onClick={() => handleQuickCommand("/start")} className="bg-slate-850 border border-slate-850 hover:bg-slate-800 text-cyan-400 px-2.5 py-1 rounded-lg transition-all">/start</button>
                      <button type="button" onClick={() => handleQuickCommand("/lampu1_on")} className="bg-slate-850 border border-slate-850 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg transition-all">💡 L1 ON</button>
                      <button type="button" onClick={() => handleQuickCommand("/lampu1_off")} className="bg-slate-850 border border-slate-850 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg transition-all">🔌 L1 OFF</button>
                      <button type="button" onClick={() => handleQuickCommand("/sensor")} className="bg-slate-850 border border-slate-850 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg transition-all">🌡️ Sensor</button>
                      <button type="button" onClick={() => handleQuickCommand("/all_off")} className="bg-slate-855 border border-slate-855 hover:bg-slate-800 text-rose-400 px-2.5 py-1 rounded-lg transition-all">🛑 All Off</button>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-805 rounded-xl">
                      <form onSubmit={handleVoiceCommand} className="flex items-center space-x-2">
                        <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400">
                          <Mic className="w-4 h-4 animate-bounce" />
                        </div>
                        <input
                          type="text"
                          placeholder="Simulasi Perintah Suara: 'Nyalakan Lampu' atau 'Matikan Lampu 1'"
                          value={voiceInput}
                          onChange={(e) => setVoiceInput(e.target.value)}
                          className="flex-1 bg-transparent text-xs font-mono placeholder:text-slate-600 text-slate-200 border-none focus:outline-none"
                        />
                        <button type="submit" className="bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg font-mono transition-all">
                          Process Voice
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Variation Control Card */}
                <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg">
                  <div>
                    <div className="flex items-center space-x-2 text-cyan-400">
                      <Zap className="w-4 h-4" />
                      <h4 className="font-bold text-sm text-white tracking-tight">Opsi Pola Variasi Lampu</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Jalankan pola variasi kombinasi relay yang sudah terprogram di dalam flash loop ESP32.
                    </p>

                    <div className="mt-5 space-y-3">
                      {/* Variation 1 button */}
                      <button
                        onClick={() => triggerVariation("variation1")}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition text-left"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-indigo-300 font-mono tracking-wider">🔮 VARIANSI LAMPU 1</h5>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans">Relay 1 ke 4 menyala bergilir (sequencing) lalu OFF.</p>
                        </div>
                        <Play className="w-4 h-4 text-indigo-400 shrink-0 select-none" />
                      </button>

                      {/* Variation 2 button */}
                      <button
                        onClick={() => triggerVariation("variation2")}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition text-left"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-purple-300 font-mono tracking-wider">⭐ VARIANSI LAMPU 2</h5>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans">Selingan blink berkala: R1 & R3 ON bergantian R2 & R4.</p>
                        </div>
                        <Play className="w-4 h-4 text-purple-400 shrink-0 select-none" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-950/30 rounded-2xl border border-indigo-500/20 text-[10px] text-indigo-300 leading-relaxed font-mono">
                    💡 <span className="font-semibold text-white">Sync Status:</span> Perubahan status dari tombol variasi akan diteruskan ke ESP32 dalam 5 detik polling berikutnya.
                  </div>
                </div>
              </div>

              {/* LIVE SENSOR RECHARTS REALTIME GRAPH AREA */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual Chart - 2 cols on wide */}
                <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-lg lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base tracking-tight">Grafik Monitoring Sensor Historis</h4>
                      <p className="text-xs text-slate-400">Nilai Fluktuasi Suhu & Kelembaban udara ditarik real-time</p>
                    </div>
                    <span className="text-[10px] font-mono leading-none py-1.5 px-3 bg-slate-950 border border-slate-800 text-slate-400 rounded-full">
                      Update: tiap 5s
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    {history.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <defs>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorHumi" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} fontClass="font-mono" dy={10} />
                          <YAxis stroke="#64748b" fontSize={9} fontClass="font-mono" domain={["auto", "auto"]} />
                          <Tooltip contentStyle={{ backgroundColor: "#0b1329", border: "1px solid #1e293b", color: "#f8fafc", borderRadius: "12px", fontSize: "11px", fontFamily: "monospace" }} />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#94a3b8" }} />
                          <Area type="monotone" dataKey="temperature" name="Temperatur (°C)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTemp)" />
                          <Area type="monotone" dataKey="humidity" name="Kelembapan (%)" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHumi)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                        Mengumpulkan data sensor historis...
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTIVITY LOGS FEED - 1 col */}
                <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white text-sm tracking-tight">Riwayat Aktivitas IoT</h4>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight">Realtime Log Events</p>
                    </div>
                    <button onClick={clearLogs} className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 border border-slate-800 transition" title="Bersihkan log">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 max-h-64 pr-1">
                    {logs.length > 0 ? (
                      logs.map((log) => (
                        <div key={log.id} className="text-[11px] leading-relaxed border-b border-slate-800/50 pb-2.5 last:border-0">
                          <div className="flex items-center justify-between text-slate-400 font-mono text-[9px] mb-1">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                              log.source === "telegram"
                                ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                : log.source === "voice"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : log.source === "automation"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : log.source === "esp32"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700/30"
                            }`}>
                              {log.source}
                            </span>
                            <span className="text-slate-500 font-sans">{new Date(log.timestamp).toLocaleTimeString("id-ID")}</span>
                          </div>
                          <p className="text-slate-200 font-medium font-sans text-xs">{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 font-mono text-center text-[11px] py-12">
                        Belum ada aktivitas terekam.
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Database: Memory Mode</span>
                    <span>REST API: Online</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED DEVICE CONTROLS */}
          {activeTab === "devices" && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Detail Device & GPIO Relay</h3>
                  <p className="text-xs text-slate-500 font-medium">Monitor pin out, beban tersambung, dan konsumsi teoretis dari masing-masing relay 4 channel.</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={triggerAllOff} className="bg-rose-50 text-rose-700 hover:bg-rose-100 transition px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-rose-200">
                    <Power className="w-4 h-4" />
                    <span>Matikan Semua Peralatan</span>
                  </button>
                  <button onClick={() => {
                    setIotState(prev => ({
                      ...prev,
                      relay: { relay1: true, relay2: true, relay3: true, relay4: true }
                    }));
                    fetch("/api/telegram-simulate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: "/all_on" })
                    }).then(() => fetchStatus());
                  }} className="bg-emerald-600 text-white hover:bg-emerald-500 transition px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                    <span>Nyalakan Semua</span>
                  </button>
                </div>
              </div>

              {/* ROBUST LOAD/DEVICE DETAIL CARD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Lampu 1 detail */}
                <div className="bg-white p-6 rounded-2xl border border-slate-105 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                        iotState.relay.relay1 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Power className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Lampu Utama Ruang Tamu</h4>
                        <span className="text-[10px] font-mono text-slate-400">GPIO Pin: {r1Pin} (Pinout Relay 1)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRelay("relay1", iotState.relay.relay1)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                        iotState.relay.relay1 
                          ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {iotState.relay.relay1 ? "TURN OFF" : "TURN ON"}
                    </button>
                  </div>
                  <div className="pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Input Node</span>
                      <strong className="block text-slate-800 mt-0.5">GPIO {r1Pin}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Relay Logic</span>
                      <strong className="block text-slate-800 mt-0.5">{useActiveLow ? "Active LOW" : "Active HIGH"}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Simulated Load</span>
                      <strong className="block text-slate-800 mt-0.5">AC 220V Lamp</strong>
                    </div>
                  </div>
                </div>

                {/* Lampu 2 detail */}
                <div className="bg-white p-6 rounded-2xl border border-slate-105 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                        iotState.relay.relay2 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Power className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Lampu Teras Depan</h4>
                        <span className="text-[10px] font-mono text-slate-400">GPIO Pin: {r2Pin} (Pinout Relay 2)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRelay("relay2", iotState.relay.relay2)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                        iotState.relay.relay2 
                          ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {iotState.relay.relay2 ? "TURN OFF" : "TURN ON"}
                    </button>
                  </div>
                  <div className="pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Input Node</span>
                      <strong className="block text-slate-800 mt-0.5">GPIO {r2Pin}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Relay Logic</span>
                      <strong className="block text-slate-800 mt-0.5">{useActiveLow ? "Active LOW" : "Active HIGH"}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Simulated Load</span>
                      <strong className="block text-slate-800 mt-0.5">5V DC LED Lamp</strong>
                    </div>
                  </div>
                </div>

                {/* Lampu 3 detail */}
                <div className="bg-white p-6 rounded-2xl border border-slate-105 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                        iotState.relay.relay3 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Power className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Lampu Kamar Utama</h4>
                        <span className="text-[10px] font-mono text-slate-400">GPIO Pin: {r3Pin} (Pinout Relay 3)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRelay("relay3", iotState.relay.relay3)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                        iotState.relay.relay3 
                          ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {iotState.relay.relay3 ? "TURN OFF" : "TURN ON"}
                    </button>
                  </div>
                  <div className="pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Input Node</span>
                      <strong className="block text-slate-800 mt-0.5">GPIO {r3Pin}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Relay Logic</span>
                      <strong className="block text-slate-800 mt-0.5">{useActiveLow ? "Active LOW" : "Active HIGH"}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Simulated Load</span>
                      <strong className="block text-slate-800 mt-0.5">AC LED Bulb</strong>
                    </div>
                  </div>
                </div>

                {/* Lampu 4 detail */}
                <div className="bg-white p-6 rounded-2xl border border-slate-105 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                        iotState.relay.relay4 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Power className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Peralatan GPIO 4 / Kipas AC</h4>
                        <span className="text-[10px] font-mono text-slate-400">GPIO Pin: {r4Pin} (Pinout Relay 4)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRelay("relay4", iotState.relay.relay4)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                        iotState.relay.relay4 
                          ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {iotState.relay.relay4 ? "TURN OFF" : "TURN ON"}
                    </button>
                  </div>
                  <div className="pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Input Node</span>
                      <strong className="block text-slate-800 mt-0.5">GPIO {r4Pin}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Relay Logic</span>
                      <strong className="block text-slate-800 mt-0.5">{useActiveLow ? "Active LOW" : "Active HIGH"}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Simulated Load</span>
                      <strong className="block text-slate-800 mt-0.5">AC Stand Fan</strong>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: DETAILED SENSOR CHART & CALIBRATION */}
          {activeTab === "sensor" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Kondisi Udara Sekitar (Real-Time Sensor Feed)</h3>
                <p className="text-xs text-slate-500 font-medium">Bagan historis untuk analisis kelembapan relatif (RH) dan temperatur udara yang diperoleh dari sensor DHT11/DHT22.</p>
              </div>

              {/* CARD OF SENSOR SUMMARY METRICS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold leading-none">temperatur rata-rata</span>
                  <strong className="text-2xl text-slate-800 block mt-1.5">{(iotState.sensor.temperature + 0.1).toFixed(1)}°C</strong>
                  <span className="text-[10px] text-emerald-500 font-bold mt-1 inline-block">Suhu Kamar Ideal</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold leading-none">temperatur maksimum</span>
                  <strong className="text-2xl text-rose-500 block mt-1.5">31.2°C</strong>
                  <span className="text-[10px] text-rose-400 font-semibold mt-1 inline-block">Picu Alarm: &gt;31°C</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold leading-none">kelembapan rata-rata</span>
                  <strong className="text-2xl text-blue-500 block mt-1.5">{iotState.sensor.humidity.toFixed(0)}%</strong>
                  <span className="text-[10px] text-slate-400 mt-1 inline-block">Kategori: Normal Basah</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold leading-none">interval kirim data</span>
                  <strong className="text-2xl text-violet-500 block mt-1.5">5.0 detik</strong>
                  <span className="text-[10px] text-violet-400 font-semibold mt-1 inline-block">Polling non-blocking</span>
                </div>

              </div>

              {/* GRAPH PLOTS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">Fluktuasi Sensor Terkini (Last 12 Readings)</h4>
                  <div className="flex space-x-2 text-[10px] font-mono">
                    <span className="flex items-center space-x-1 text-rose-500">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Suhu (°C)</span>
                    </span>
                    <span className="flex items-center space-x-1 text-blue-500">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Kelembapan (%)</span>
                    </span>
                  </div>
                </div>

                <div className="h-80 w-full">
                  {history.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={9} fontClass="font-mono" dy={10} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontClass="font-mono" />
                        <Tooltip contentStyle={{ fontSize: "11px", fontFamily: "monospace", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="temperature" name="Temp" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="humidity" name="Humi" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-mono text-xs">
                      Mengumpulkan data grafik...
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: AUTOMATION LOGIC */}
          {activeTab === "automation" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Aturan Otomatisasi (Smart Rules)</h3>
                <p className="text-xs text-slate-500 font-medium">Bentuk pemicu otomatis yang bertindak sebagai skenario pintar tanpa campur tangan pengguna.</p>
              </div>

              {/* AUTOMATION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Rule 1: High Temperature AC Trigger */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] bg-red-50 text-red-650 font-bold px-2 py-0.5 rounded font-mono uppercase">suhu tinggi pengaman</span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5">Pemicu Kipas Pendingin Otomatis</h4>
                      <p className="text-xs text-slate-500 leading-normal">
                        Jika temperatur sensor DHT menembus suhu di atas <strong className="text-slate-805">31.0°C</strong>, maka relay 4 (Kipas AC) otomatis dinyalakan demi mencegah terjadinya overheat ruangan.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <Zap className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Pemicu Aktif Saat Ini?</span>
                    <span className={`font-bold px-2 py-1 rounded ${
                      iotState.sensor.temperature > 31 
                        ? "bg-red-50 text-red-600 animate-pulse" 
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {iotState.sensor.temperature > 31 ? "🔴 AKTIF TERPICU" : "🟢 STANDBY (Suhu Aman)"}
                    </span>
                  </div>
                </div>

                {/* Rule 2: Night Light Trigger (Lampu Teras) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] bg-indigo-50 text-indigo-650 font-bold px-2 py-0.5 rounded font-mono uppercase">pencahayaan malam</span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5">Lampu Teras Terjadwal</h4>
                      <p className="text-xs text-slate-500 leading-normal">
                        Fungsi simulasi otomatisasi lampu teras (Relay 2) menyala di malam hari (pukul 18:00 WIB) dan mati otomatis esok pagi (pukul 06:00 WIB) guna penghematan listrik.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Estimasi Jadwal Berikutnya</span>
                    <span className="font-bold text-slate-650">Set ON: 18:00 WIB</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: REPORT PROYEK / VIEW LAPORAN QUIS */}
          {activeTab === "report" && (
            <div className="space-y-6" id="quis_report_tab">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] bg-blue-100 text-blue-750 font-extrabold px-2.5 py-1 rounded-full font-mono uppercase tracking-wider">dokumen lengkap quis</span>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mt-1.5">Laporan Quis Sistem Smart Home Berbasis IoT</h3>
                  <p className="text-xs text-slate-500 font-medium">Bahan ajar, flowchart diagram, estimasi pengerjaan, rancangan biaya, dan dokumentasi lengkap siap print / PDF.</p>
                </div>
                <button
                  onClick={() => {
                    const printContents = document.getElementById("printable-quiz-report")?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      const newWin = window.open("", "_blank");
                      if (newWin) {
                        newWin.document.write(`
                          <html>
                            <head>
                              <title>Laporan_Quis_Smart_Home_IoT_gusliyanza</title>
                              <style>
                                body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #1e293b; background: white; }
                                table { width:100%; border-collapse: collapse; margin-top:15px; margin-bottom:15px; }
                                th, td { border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; text-align: left; }
                                th { background-color: #f8fafc; font-weight: bold; }
                                h1 { font-size: 20px; font-weight: bold; border-bottom: 2px solid #1e293b; padding-bottom: 5px; }
                                h2 { font-size: 14px; font-weight: bold; margin-top:20px; color: #0284c7; }
                                h3 { font-size: 11px; font-weight: bold; margin-top:10px; }
                                p, li { font-size: 11px; line-height: 1.5; color: #334155; }
                                .no-print { display: none; }
                                .mermaid-svg { max-width: 100%; border: 1px solid #f1f5f9; padding: 15px; margin: 10px 0; background: #fafafa; border-radius: 8px; }
                              </style>
                            </head>
                            <body>
                              ${printContents}
                              <script>window.print();</script>
                            </body>
                          </html>
                        `);
                        newWin.document.close();
                      }
                    }
                  }}
                  className="bg-slate-900 text-white hover:bg-slate-800 transition px-5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0 self-start"
                >
                  <Download className="w-4 h-4" />
                  <span>Cetak / Ekspor PDF</span>
                </button>
              </div>

              {/* REPORT PRINTABLE WRAPPER */}
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto" id="printable-quiz-report">
                
                {/* Title Header */}
                <div className="text-center space-y-2 border-b-2 border-slate-900 pb-5">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">DOKUMEN EVALUASI QUIS SISTEM IoT</span>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">LAPORAN QUIS SISTEM SMART HOME BERBASIS IOT</h1>
                  <p className="text-xs text-slate-500 font-medium">Universitas Smart Home DevKit v1 • Integrasi ESP32, Telegram Bot, Sensor DHT11, Relay 4 Channel & Web Dashboard</p>
                  
                  {/* Student profile */}
                  <div className="flex justify-center gap-6 pt-3 text-[10.5px] text-slate-600 font-mono">
                    <span className="bg-slate-50 px-2.5 py-1 rounded border border-slate-100"><strong>Penyusun:</strong> gusliyanza02@gmail.com</span>
                    <span className="bg-slate-50 px-2.5 py-1 rounded border border-slate-100"><strong>Status Web:</strong> Deployed Live (Vercel)</span>
                    <span className="bg-slate-50 px-2.5 py-1 rounded border border-slate-100"><strong>Tanggal:</strong> 27 Mei 2026</span>
                  </div>
                </div>

                {/* Section 1: Flowchart */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">1</span>
                    <span>FLOWCHART SISTEM (Diagram Alur Kerja)</span>
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Alur kerja sistem bermula ketika ESP32 booting dan mengaktifkan koneksi WiFi. Selanjutnya, pin sensor DHT membaca data temperatur sekitar dan melayani Telegram Bot polling secara non-blocking dengan interval 1 detik. Apabila mendeteksi pesan masuk dari pemilik (CHAT_ID tervalidasi), ESP32 mengeksekusi kontrol GPIO relay dan melaporkan status terbaru kembali ke API endpoint cloud.
                  </p>

                  {/* Flowchart Visual Grid Cards */}
                  <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl space-y-3 text-xs">
                    <h3 className="font-bold text-slate-700 text-xs uppercase font-mono tracking-wider">Visual Flow Skenario Integrasi</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-[10.5px]">
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg border border-slate-800">
                        <strong className="block text-[9px] uppercase tracking-wide text-slate-400 font-mono">01. Booting</strong>
                        ESP32 aktif & hubungkan WiFi Secure
                      </div>
                      <div className="flex items-center justify-center text-slate-400 font-bold">➔</div>
                      <div className="bg-blue-600 text-white p-2.5 rounded-lg border border-blue-500">
                        <strong className="block text-[9px] uppercase tracking-wide text-blue-100 font-mono">02. Baca Sensor</strong>
                        DHT11 membaca suhu & kelembaban
                      </div>
                      <div className="flex items-center justify-center text-slate-400 font-bold">➔</div>
                      <div className="bg-emerald-600 text-white p-2.5 rounded-lg border border-emerald-500 border-dashed">
                        <strong className="block text-[9px] uppercase tracking-wide text-emerald-100 font-mono">03. Listen Cmd</strong>
                        Mendengar Telegram & Web Dashboard API
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-[10.5px] pt-1">
                      <div className="bg-indigo-600 text-white p-2.5 rounded-lg border border-indigo-500">
                        <strong className="block text-[9px] uppercase tracking-wide text-indigo-100 font-mono">04. Actuating</strong>
                        Relay aktif (LOW) menyalakan beban 220V/5V
                      </div>
                      <div className="flex items-center justify-center text-slate-400 font-bold">➔</div>
                      <div className="bg-slate-700 text-white p-2.5 rounded-lg border border-slate-600">
                        <strong className="block text-[9px] uppercase tracking-wide text-slate-400 font-mono">05. Sync DB</strong>
                        Update status relay & sensor via POST REST API
                      </div>
                      <div className="flex items-center justify-center text-slate-400 font-bold">➔</div>
                      <div className="bg-amber-600 text-white p-2.5 rounded-lg border border-amber-500">
                        <strong className="block text-[9px] uppercase tracking-wide text-amber-100 font-mono">06. Telegram Notif</strong>
                        Bot kirim notifikasi eksekusi sukses kembali ke user
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Blok Diagram */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">2</span>
                    <span>BLOK DIAGRAM SISTEM (Peta Komponen)</span>
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Arsitektur Smart Home ini menempatkan ESP32 DevKit V1 sebagai mikrokontroler utama yang mengoordinasikan input sensor, pemrosesan logika, konektivitas cloud melalui API, dan output penggerak beban listrik.
                  </p>

                  <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
                      {/* INPUT */}
                      <div className="bg-white p-3 rounded-lg border border-blue-200 space-y-1.5">
                        <span className="block text-[9px] bg-blue-50 text-blue-700 font-bold rounded font-mono uppercase">input blocks</span>
                        <p className="font-bold text-slate-800">1. Sensor DHT11</p>
                        <p className="text-[10px] text-slate-500">2. Telegram Chat / Keyboard STT</p>
                        <p className="text-[10px] text-slate-500">3. Dashboard Web UI Switch</p>
                      </div>
                      
                      {/* PROCESS */}
                      <div className="bg-slate-900 text-white p-3 rounded-lg border border-slate-800 flex flex-col justify-center space-y-1">
                        <span className="block text-[9px] bg-slate-800 text-blue-400 font-bold rounded font-mono uppercase">central logic</span>
                        <p className="font-extrabold text-white text-xs">ESP32 DevKit v1</p>
                        <p className="text-[10px] text-slate-400 font-mono">GPIO Handler, Web SSL Secure Poll</p>
                      </div>

                      {/* OUTPUT */}
                      <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-1.5">
                        <span className="block text-[9px] bg-rose-50 text-rose-700 font-bold rounded font-mono uppercase">outputs Actuator</span>
                        <p className="font-bold text-slate-800">Relay 4-Ch Module</p>
                        <p className="text-[10px] text-slate-500">Lampu 1, 2, 3, 4 (AC / DC)</p>
                        <p className="text-[10px] text-rose-600 font-semibold">Alarm Notifikasi Telegram</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Project Management Methodology */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">3</span>
                    <span>METODE MANAJEMEN PROYEK TIK (SDLC Lifecycle)</span>
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pengembangan proyek TIK smart home ini diselenggarakan mengikuti tahapan model <strong>Waterfall (SDLC)</strong> teratur:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-600 space-y-2">
                    <li><strong>Analisis Kebutuhan (Requirements Analysis):</strong> Mendefinisikan jumlah relay, sensor kelembaban DHT, format payload data API JSON, dan kustomisasi token telegram bot.</li>
                    <li><strong>Desain Sistem (System Design):</strong> Membuat diagram skematis pin ESP32, rancangan database schema smart_home realtime, dan storyboard Web UI responsive.</li>
                    <li><strong>Implementasi (Implementation):</strong> Melakukan penyolderan pinout kabel dupont, membuat kode program di Arduino IDE, dan merilis API Backend dengan Express.</li>
                    <li><strong>Pengujian (Integration & Testing):</strong> Melakukan QA fungsionalitas tombol web, respon tanggapan chat bot, akurasi sensor DHT, dan transisi variasi lampu.</li>
                    <li><strong>Deployment (Production Release):</strong> Mengunggah kode web ke hosting ter-deploy (Vercel) dan menaruh file koordinat .ino pada mikrokontroler.</li>
                  </ul>
                </div>

                {/* Section 4: Costings Table */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">4</span>
                    <span>ESTIMASI BIAYA PROYEK (Hardware & Software)</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Berikut adalah rincian estimasi biaya pengadaan komponen rancang bangun sistem IoT smart home terintegrasi menggunakan harga pasar lokal Indonesia:
                  </p>

                  <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-150 text-xs">
                      <thead className="bg-slate-50 font-bold font-mono">
                        <tr>
                          <th className="px-3 py-2 text-left">Nama Komponen / Jasa</th>
                          <th className="px-3 py-2 text-left">Kategori</th>
                          <th className="px-3 py-2 text-center">Harga Unit (IDR)</th>
                          <th className="px-3 py-2 text-center">Jumlah</th>
                          <th className="px-3 py-2 text-right">Subtotal (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-600">
                        {costEstimates.map((cost) => (
                          <tr key={cost.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-medium text-slate-800">{cost.item}</td>
                            <td className="px-3 py-2.5 font-mono text-[10px]">{cost.category}</td>
                            <td className="px-3 py-2.5 text-center">{cost.unitPrice === 0 ? "Gratis" : cost.unitPrice.toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2.5 text-center">{cost.qty}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-800">
                              {cost.total === 0 ? (cost.notes || "Gratis") : cost.total.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold text-slate-900">
                          <td colSpan={4} className="px-3 py-2.5 text-right font-mono uppercase text-[10px]">Total Estimasi Biaya Rancang Bangun:</td>
                          <td className="px-3 py-2.5 text-right font-mono text-blue-650">IDR {totalCost.toLocaleString("id-ID")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 5: Timeline Estimate Table */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">5</span>
                    <span>ESTIMASI LAMA PENGERJAAN PROYEK</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Jadwal pengerjaan dirancang selama 1 minggu kerja (9 hari dari inisiasi hingga penyusunan laporan), terbagi menjadi beberapa fase terfokus:
                  </p>

                  <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-150 text-xs">
                      <thead className="bg-slate-50 font-bold font-mono">
                        <tr>
                          <th className="px-3 py-2 text-left">Fase Kerja</th>
                          <th className="px-3 py-2 text-left">Deskripsi Tugas Pengujian</th>
                          <th className="px-3 py-2 text-center">Durasi Kerja</th>
                          <th className="px-3 py-2 text-right">Bobot Proyek</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-600">
                        {projectTimeline.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-bold text-slate-800 text-[11px]">{item.phase}</td>
                            <td className="px-3 py-2.5 text-slate-600">{item.task}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-800">{item.duration}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500">{item.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 6: Source Code Placeholders & Deployment Links */}
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono mr-2">6</span>
                    <span>SOURCE CODE & DEPLOYMENT LINKS</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Komponen software terbagi menjadi dua bagian utama yang berkomunikasi melalui format JSON REST API standar secara live:
                  </p>
                  
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-700">1. Web Dashboard (Live App URL):</span>
                      <a href={apiServerUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono">{apiServerUrl || "https://ais-dev.run.app"}</a>
                    </div>
                    <div className="flex justify-between items-center text-[11px] border-t border-slate-200/60 pt-2">
                      <span className="font-bold text-slate-700">2. ESP32 Arduino IDE Code Template:</span>
                      <span className="text-slate-500 font-mono text-[10px]">Tersedia di tab Settings & Code Dashboard</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] border-t border-slate-200/60 pt-2">
                      <span className="font-bold text-slate-700">3. Firebase Realtime DB Hub Schema:</span>
                      <span className="bg-orange-50 text-orange-700 py-0.5 px-2 rounded border border-orange-100 font-mono text-[9px]">smart_home_relay_v1</span>
                    </div>
                  </div>
                </div>

                {/* Sign off */}
                <div className="border-t border-slate-200 pt-5 flex justify-between text-[11px] font-mono text-slate-500">
                  <span>Smart Home IoT Labs 2026</span>
                  <span>Verifikator Lapangan: Universitas TIK Hub</span>
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: SETTINGS, CONFIGURATION & CODE GENERATOR */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan IoT & Pembuat Kode Arduino</h3>
                <p className="text-xs text-slate-500 font-medium">Ubah isian kredensial WiFi, Token Bot Telegram, atau Chat ID Anda. Kode program Arduino IDE di bawah ini akan ter-update dan siap dicopy!</p>
              </div>

              {/* CONTROLS EXPANSION GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form to Customize Settings */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-1">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-50 pb-2 flex items-center space-x-1.5 text-blue-600">
                    <SettingsIcon className="w-4 h-4" />
                    <span>Konfigurasi API & WiFi</span>
                  </h4>

                  {/* WiFi SSID input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-400">WiFi SSID (Nama WiFi)</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                    />
                  </div>

                  {/* WiFi Pass input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-400">WiFi Password</label>
                    <input
                      type="password"
                      className="w-full bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                    />
                  </div>

                  {/* Bot Token input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-400">Telegram Bot Token</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                  </div>

                  {/* Chat ID input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-400">Telegram Chat ID</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                    />
                  </div>

                  {/* API Server origin url */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-400">Broker API Cloud URL</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-2.5 text-slate-800 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                      value={apiServerUrl}
                      onChange={(e) => setApiServerUrl(e.target.value)}
                    />
                  </div>

                  {/* Toggle Logic Active LOW or HIGH */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-50">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Active LOW Logic?</h5>
                      <p className="text-[10px] text-slate-500 leading-none mt-0.5">Disarankan modul relay 4 channel 5V.</p>
                    </div>
                    <button
                      onClick={() => setUseActiveLow(!useActiveLow)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        useActiveLow ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          useActiveLow ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Live Arduino Code Output Panel - 2 cols wide */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-lg lg:col-span-2">
                  
                  {/* Header copy buttons */}
                  <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Laptop className="w-4 h-4 text-emerald-400" />
                      <div>
                        <h4 className="font-bold text-xs text-white">smart_home_telegram_web_esp32.ino</h4>
                        <span className="text-[10px] text-slate-500 font-mono leading-none">Ready for Arduino IDE upload</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(currentESP32InoCode)}
                      className="bg-slate-850 text-slate-300 hover:text-white hover:bg-slate-800 transition py-1.5 px-3 rounded-lg text-[11px] font-bold font-mono flex items-center space-x-1.5 border border-slate-700/60"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedStatus ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>

                  {/* Large code presentation */}
                  <div className="flex-1 p-5 overflow-auto max-h-96 font-mono text-[10.5px] text-emerald-300/90 leading-relaxed scrollbar">
                    <pre className="whitespace-pre">{currentESP32InoCode}</pre>
                  </div>

                  {/* Footer instruction */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800 px-4 text-[10px] text-slate-400 font-mono leading-normal">
                    📌 <strong>TIPS ELEKTRONIKA:</strong> Install library <code>UniversalTelegramBot</code> oleh Brian Lough, <code>ArduinoJson</code> v6/7, dan <code>DHT Sensor Library</code> melalui Library Manager Arduino IDE sebelum melakukan kompilasi.
                  </div>
                </div>

              </div>

              {/* TELEGRAM BOT SETUP GUIDE & TUTORIALS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Panduan Konfigurasi Bot Telegram & Menemukan Chat ID</h4>
                  <p className="text-xs text-slate-500">Ikuti 3 tahapan mudah berikut agar perangkat ESP32 dan web dashboard sinkron melayani notifikasi telegram.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Step 1 */}
                  <div className="space-y-2 border-r border-slate-100 pr-4 last:border-0">
                    <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full font-mono">LANGKAH 1</span>
                    <h5 className="font-bold text-slate-900 text-xs mt-3">Buat Bot via @BotFather</h5>
                    <p className="text-xs text-slate-600 leading-normal">
                      Buka aplikasi Telegram Anda, cari penyedia bot resmi bernama <strong>@BotFather</strong>. Kirim perintah <code>/newbot</code>, masukkan nama Bot keinginan Anda dan tentukan username akhir akhiran _bot. Anda akan mendapatkan balasan <strong>TOKEN API</strong> resmi.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-2 border-r border-slate-100 pr-4 last:border-0">
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full font-mono">LANGKAH 2</span>
                    <h5 className="font-bold text-slate-900 text-xs mt-3">Dapatkan CHAT_ID Pemilik</h5>
                    <p className="text-xs text-slate-600 leading-normal">
                      Lakukan start chat dengan bot baru Anda dengan mengklik link bot. Lalu cari akun pembantu bernama <strong>@userinfobot</strong> di Telegram. Kirim pesan acak kepadanya, dia secara instan akan membalas dengan menampilkan nomor <strong>Id unik (9-10 digit)</strong> chat ID pribadi Anda. Masukkan ke isian form setting.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="space-y-2 last:border-0">
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full font-mono">LANGKAH 3</span>
                    <h5 className="font-bold text-slate-900 text-xs mt-3">Kompleksitas Keamanan SSL</h5>
                    <p className="text-xs text-slate-600 leading-normal">
                      ESP32 memerlukan koneksi SSL HTTPS untuk menghubungi API Telegram. Di dalam file program Arduino, perintah <code>client.setInsecure()</code> sengaja diaktifkan guna menyederhanakan handshake pemindah data tanpa perlu mengunggah root certificate rumit.
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
