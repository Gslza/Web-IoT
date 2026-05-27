/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function generateESP32Code(config: {
  wifiSsid: string;
  wifiPass: string;
  botToken: string;
  chatId: string;
  apiUrl: string;
  useActiveLow: boolean;
  dhtPin: number;
  dhtType: string;
  r1Pin: number;
  r2Pin: number;
  r3Pin: number;
  r4Pin: number;
}): string {
  const onVal = config.useActiveLow ? "LOW" : "HIGH";
  const offVal = config.useActiveLow ? "HIGH" : "LOW";

  return `/**
 * Smart Home IoT 4-Relay & Telegram Bot Controller
 * File: smart_home_telegram_web_esp32.ino
 * 
 * Target Board: ESP32 DevKit V1 / NodeMCU ESP32
 * Sensor: DHT11 atau DHT22 (Suhu & Kelembaban)
 * Actuator: 4-Channel Relay 5V DC (Active ${config.useActiveLow ? "LOW" : "HIGH"})
 * Interaktivitas: Telegram Bot & Web Cloud Dashboard (REST API)
 * 
 * Tugas Quis Sistem Smart Home Berbasis IoT
 * AI-Generated Production ready implementation.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <UniversalTelegramBot.h>

// ==========================================
// 1. CONFIGURATION PART (DAPAT DISESUAIKAN)
// ==========================================
const char* ssid = "${config.wifiSsid || "NAMA_WIFI_ANDA"}";
const char* password = "${config.wifiPass || "PASSWORD_WIFI_ANDA"}";

// Telegram Configuration
#define BOTtoken "${config.botToken || "TOKEN_BOT_TELEGRAM_ANDA"}"
#define CHAT_ID "${config.chatId || "CHAT_ID_TELEGRAM_ANDA"}"

// Cloud REST API Configuration (Terhubung dengan Web Dashboard)
const char* serverName = "${config.apiUrl || "https://NAMA_APP_ANDA.run.app"}/api/esp32/update";

// Hardware Pin Configuration
#define DHTPIN ${config.dhtPin}
#define DHTTYPE ${config.dhtType} // DHT11 atau DHT22

#define RELAY_1 ${config.r1Pin}
#define RELAY_2 ${config.r2Pin}
#define RELAY_3 ${config.r3Pin}
#define RELAY_4 ${config.r4Pin}

// Logic Level untuk Relay
const int RELAY_ON = ${onVal};
const int RELAY_OFF = ${offVal};

// ==========================================
// 2. GLOBAL VARIABLES & OBJECTS
// ==========================================
DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure client;
UniversalTelegramBot bot(BOTtoken, client);

// Timer Milis untuk Pembacaan Sensor Tanpa Delay Blocking
unsigned long lastTimeSensorAndApi = 0;
const unsigned long apiInterval = 5000; // Kirim & Singkron data setiap 5 detik

unsigned long lastTimeTelegramBot = 0;
const unsigned long telegramInterval = 1000; // Cek Chat Telegram setiap 1 detik

float temperature = 0.0;
float humidity = 0.0;

// Status Relay saat ini
bool stateR1 = false;
bool stateR2 = false;
bool stateR3 = false;
bool stateR4 = false;

// ==========================================
// 3. HARDWARE CONTROL FUNCTIONS
// ==========================================

void initPins() {
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);
  
  // Set default semua relay ke OFF saat booting awal
  digitalWrite(RELAY_1, RELAY_OFF);
  digitalWrite(RELAY_2, RELAY_OFF);
  digitalWrite(RELAY_3, RELAY_OFF);
  digitalWrite(RELAY_4, RELAY_OFF);
}

void controlRelay(int relayPin, bool turnOn) {
  digitalWrite(relayPin, turnOn ? RELAY_ON : RELAY_OFF);
}

void allOff(bool sendNotification = true) {
  stateR1 = false;
  stateR2 = false;
  stateR3 = false;
  stateR4 = false;
  
  controlRelay(RELAY_1, false);
  controlRelay(RELAY_2, false);
  controlRelay(RELAY_3, false);
  controlRelay(RELAY_4, false);
  
  if (sendNotification) {
    bot.sendMessage(CHAT_ID, "⚠️ *NOTIFIKASI SMART HOME:*\\nSeluruh Relay / Peralatan telah DIMATIKAN.", "Markdown");
  }
}

// Variasi 1: Lampu menyala bergantian dari relay 1 sampai relay 4 dengan delay, lalu semua relay mati
void runVariation1() {
  bot.sendMessage(CHAT_ID, "🔮 [Pola 1] Memulai Variasi Lampu 1 (Sequencing ON)...", "");
  
  allOff(false);
  delay(300);
  
  stateR1 = true; controlRelay(RELAY_1, true); delay(800);
  stateR2 = true; controlRelay(RELAY_2, true); delay(800);
  stateR3 = true; controlRelay(RELAY_3, true); delay(800);
  stateR4 = true; controlRelay(RELAY_4, true); delay(1500);
  
  allOff(false);
  bot.sendMessage(CHAT_ID, "🔮 [Pola 1] Pola Variasi Lampu 1 selesai. Semua relay dimatikan.", "");
}

// Variasi 2: Lampu berkedip pola kombinasi (R1 & R3 ON, R2 & R4 OFF) bergantian beberapa kali
void runVariation2() {
  bot.sendMessage(CHAT_ID, "🔮 [Pola 2] Memulai Variasi Lampu 2 (Blink Alternating)...", "");
  
  for (int i = 0; i < 4; i++) {
    // Kombinasi A
    stateR1 = true; stateR3 = true; stateR2 = false; stateR4 = false;
    controlRelay(RELAY_1, true); controlRelay(RELAY_3, true);
    controlRelay(RELAY_2, false); controlRelay(RELAY_4, false);
    delay(600);
    
    // Kombinasi B
    stateR1 = false; stateR3 = false; stateR2 = true; stateR4 = true;
    controlRelay(RELAY_1, false); controlRelay(RELAY_3, false);
    controlRelay(RELAY_2, true); controlRelay(RELAY_4, true);
    delay(600);
  }
  
  allOff(false);
  bot.sendMessage(CHAT_ID, "🔮 [Pola 2] Pola Variasi Lampu 2 selesai.", "");
}

// ==========================================
// 4. CLOUD SYNCHRONIZATION VIA REST API
// ==========================================

void interactWithCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi terputus, tidak bisa sinkronisasi cloud.");
    return;
  }
  
  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");
  
  // Buat Payload JSON
  StaticJsonDocument<300> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["wifi_signal"] = String(WiFi.RSSI()) + " dBm";
  doc["ip_address"] = WiFi.localIP().toString();
  
  JsonObject relayObj = doc.createNestedObject("relay");
  relayObj["relay1"] = stateR1;
  relayObj["relay2"] = stateR2;
  relayObj["relay3"] = stateR3;
  relayObj["relay4"] = stateR4;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  Serial.print("Mengirim data ke cloud: ");
  Serial.println(requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Respon Cloud [Http " + String(httpResponseCode) + "]: ");
    Serial.println(response);
    
    // Parse perintah sinkronisasi dari Web Dashboard
    StaticJsonDocument<500> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      // Baca status relay target dari server (Web dashboard bertindak sebagai master)
      if (responseDoc.containsKey("relay")) {
        JsonObject relayTarget = responseDoc["relay"];
        
        bool targetR1 = relayTarget["relay1"];
        bool targetR2 = relayTarget["relay2"];
        bool targetR3 = relayTarget["relay3"];
        bool targetR4 = relayTarget["relay4"];
        
        // Apply status jika berbeda (Sinkronisasi Web -> ESP32)
        if (targetR1 != stateR1) {
          stateR1 = targetR1;
          controlRelay(RELAY_1, stateR1);
          bot.sendMessage(CHAT_ID, stateR1 ? "🔔 *Lampu 1 AKTIF* via Dashboard" : "🔔 *Lampu 1 MATI* via Dashboard", "Markdown");
        }
        if (targetR2 != stateR2) {
          stateR2 = targetR2;
          controlRelay(RELAY_2, stateR2);
          bot.sendMessage(CHAT_ID, stateR2 ? "🔔 *Lampu 2 AKTIF* via Dashboard" : "🔔 *Lampu 2 MATI* via Dashboard", "Markdown");
        }
        if (targetR3 != stateR3) {
          stateR3 = targetR3;
          controlRelay(RELAY_3, stateR3);
          bot.sendMessage(CHAT_ID, stateR3 ? "🔔 *Lampu 3 AKTIF* via Dashboard" : "🔔 *Lampu 3 MATI* via Dashboard", "Markdown");
        }
        if (targetR4 != stateR4) {
          stateR4 = targetR4;
          controlRelay(RELAY_4, stateR4);
          bot.sendMessage(CHAT_ID, stateR4 ? "🔔 *Lampu 4 AKTIF* via Dashboard" : "🔔 *Lampu 4 MATI* via Dashboard", "Markdown");
        }
      }
    } else {
      Serial.print("Gagal parse JSON dari Cloud: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.print("Error HTTP Request: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// ==========================================
// 5. TELEGRAM COMMANDS & STT VOICE HANDLER
// ==========================================

void handleTelegramCommand(int numNewMessages) {
  Serial.print("Menghandle ");
  Serial.print(numNewMessages);
  Serial.println(" pesan baru dari Telegram...");
  
  for (int i = 0; i < numNewMessages; i++) {
    String chat_id = String(bot.messages[i].chat_id);
    if (chat_id != CHAT_ID) {
      bot.sendMessage(chat_id, "⚠️ Akses Ditolak. Anda bukan pemilik Node Smart Home ini.", "");
      continue;
    }
    
    String text = bot.messages[i].text;
    String from_name = bot.messages[i].from_name;
    
    Serial.println("Pesan diterima: " + text + " dari " + from_name);
    
    // Konversi huruf kecil agar pencarian suara (voice typing text) tidak sensitif kapital huruf
    String command = text;
    command.toLowerCase();
    
    // Integrasi deteksi perintah suara berbasis text
    if (command == "/start") {
      String welcome = "🏠 *SELAMAT DATANG DI SMART HOME IoT BOT*\\n\\n";
      welcome += "Hallo " + from_name + ", bot ini terhubung secara online dengan Smart Home Web Dashboard.\\n\\n";
      welcome += "📌 *Daftar Perintah Kontrol Relay/Lampu:*\\n";
      welcome += "💡 /lampu1_on : Menyalakan Lampu 1\\n";
      welcome += "🔌 /lampu1_off : Mematikan Lampu 1\\n";
      welcome += "💡 /lampu2_on : Menyalakan Lampu 2\\n";
      welcome += "🔌 /lampu2_off : Mematikan Lampu 2\\n";
      welcome += "💡 /lampu3_on : Menyalakan Lampu 3\\n";
      welcome += "🔌 /lampu3_off : Mematikan Lampu 3\\n";
      welcome += "💡 /lampu4_on : Menyalakan Lampu 4\\n";
      welcome += "🔌 /lampu4_off : Mematikan Lampu 4\\n\\n";
      welcome += "📌 *Daftar Perintah Grup & Variasi:*\\n";
      welcome += "🟢 /all_on : Menyalakan semua Lampu\\n";
      welcome += "🔴 /all_off : Mematikan semua Lampu\\n";
      welcome += "🔮 /variasi1 : Pola Berurutan\\n";
      welcome += "🔮 /variasi2 : Pola Kelap-Kelip SelangSeling\\n\\n";
      welcome += "📌 *Daftar Perintah Sensor & Status:*\\n";
      welcome += "🌡️ /sensor : Cek Suhu & Kelembaban DHT\\n";
      welcome += "📊 /status : Cek status seluruh Relay\\n\\n";
      welcome += "🎤 *Dukungan Suara (Keyboard Voice-Typing):*\\n";
      welcome += "Ketik pesan suara lewat keyboard seperti: *'nyalakan lampu'* atau *'matikan lampu 1'*";
      
      bot.sendMessage(chat_id, welcome, "Markdown");
    }
    
    // Perintah Utama Relay 1
    else if (command == "/lampu1_on" || command.indexOf("nyalakan lampu 1") >= 0) {
      stateR1 = true;
      controlRelay(RELAY_1, true);
      bot.sendMessage(chat_id, "💡 *Lampu 1 AKTIF* (Relay 1 ON).", "Markdown");
    }
    else if (command == "/lampu1_off" || command.indexOf("matikan lampu 1") >= 0) {
      stateR1 = false;
      controlRelay(RELAY_1, false);
      bot.sendMessage(chat_id, "🔌 *Lampu 1 NONAKTIF* (Relay 1 OFF).", "Markdown");
    }
    
    // Perintah Utama Relay 2
    else if (command == "/lampu2_on" || command.indexOf("nyalakan lampu 2") >= 0) {
      stateR2 = true;
      controlRelay(RELAY_2, true);
      bot.sendMessage(chat_id, "💡 *Lampu 2 AKTIF* (Relay 2 ON).", "Markdown");
    }
    else if (command == "/lampu2_off" || command.indexOf("matikan lampu 2") >= 0) {
      stateR2 = false;
      controlRelay(RELAY_2, false);
      bot.sendMessage(chat_id, "🔌 *Lampu 2 NONAKTIF* (Relay 2 OFF).", "Markdown");
    }
    
    // Perintah Utama Relay 3
    else if (command == "/lampu3_on" || command.indexOf("nyalakan lampu 3") >= 0) {
      stateR3 = true;
      controlRelay(RELAY_3, true);
      bot.sendMessage(chat_id, "💡 *Lampu 3 AKTIF* (Relay 3 ON).", "Markdown");
    }
    else if (command == "/lampu3_off" || command.indexOf("matikan lampu 3") >= 0) {
      stateR3 = false;
      controlRelay(RELAY_3, false);
      bot.sendMessage(chat_id, "🔌 *Lampu 3 NONAKTIF* (Relay 3 OFF).", "Markdown");
    }
    
    // Perintah Utama Relay 4
    else if (command == "/lampu4_on" || command.indexOf("nyalakan lampu 4") >= 0) {
      stateR4 = true;
      controlRelay(RELAY_4, true);
      bot.sendMessage(chat_id, "💡 *Lampu 4 AKTIF* (Relay 4 ON).", "Markdown");
    }
    else if (command == "/lampu4_off" || command.indexOf("matikan lampu 4") >= 0) {
      stateR4 = false;
      controlRelay(RELAY_4, false);
      bot.sendMessage(chat_id, "🔌 *Lampu 4 NONAKTIF* (Relay 4 OFF).", "Markdown");
    }
    
    // Perintah Global All On / All Off
    else if (command == "/all_on" || command.indexOf("nyalakan semua") >= 0) {
      stateR1 = true; stateR2 = true; stateR3 = true; stateR4 = true;
      controlRelay(RELAY_1, true);
      controlRelay(RELAY_2, true);
      controlRelay(RELAY_3, true);
      controlRelay(RELAY_4, true);
      bot.sendMessage(chat_id, "🟢 *Semua Relay/Lampu telah DIAKTIFKAN.*", "Markdown");
    }
    else if (command == "/all_off" || command.indexOf("matikan semua") >= 0 || command == "matikan lampu") {
      allOff(true);
    }
    
    // Pola Variasi Lampu
    else if (command == "/variasi1" || command.indexOf("variasi 1") >= 0) {
      runVariation1();
    }
    else if (command == "/variasi2" || command.indexOf("variasi 2") >= 0) {
      runVariation2();
    }
    
    // Pembacaan DHT11 / DHT22
    else if (command == "/sensor" || command.indexOf("temperatur") >= 0 || command.indexOf("suhu") >= 0 || command.indexOf("kelembaban") >= 0) {
      String sensorMsg = "📊 *KONDISI SEKITAR SMART HOME:*\\n\\n";
      sensorMsg += "🌡️ *Suhu:* " + String(temperature, 1) + " °C\\n";
      sensorMsg += "💧 *Kelembaban:* " + String(humidity, 1) + " %\\n";
      bot.sendMessage(chat_id, sensorMsg, "Markdown");
    }
    
    // Status Sistem Keseluruhan
    else if (command == "/status") {
      String statMsg = "📊 *STATUS AKTIF PERANGKAT:*\\n\\n";
      statMsg += "💡 *Lampu 1:* " + String(stateR1 ? "AKTIF (LOW)" : "MATI (HIGH)") + "\\n";
      statMsg += "💡 *Lampu 2:* " + String(stateR2 ? "AKTIF (LOW)" : "MATI (HIGH)") + "\\n";
      statMsg += "💡 *Lampu 3:* " + String(stateR3 ? "AKTIF (LOW)" : "MATI (HIGH)") + "\\n";
      statMsg += "💡 *Lampu 4:* " + String(stateR4 ? "AKTIF (LOW)" : "MATI (HIGH)") + "\\n\\n";
      statMsg += "🌡️ *Suhu:* " + String(temperature, 1) + " °C | 💧 *Humi:* " + String(humidity, 1) + "%\\n";
      statMsg += "📶 *WiFi Res:* " + String(WiFi.RSSI()) + " dBm";
      bot.sendMessage(chat_id, statMsg, "Markdown");
    }
    
    // Text-based voice typing fallback
    else if (command.indexOf("nyalakan") >= 0 && command.indexOf("lampu") >= 0) {
      stateR1 = true; stateR2 = true; stateR3 = true; stateR4 = true;
      controlRelay(RELAY_1, true); controlRelay(RELAY_2, true); controlRelay(RELAY_3, true); controlRelay(RELAY_4, true);
      bot.sendMessage(chat_id, "🎙️ Perintah suara diakui: *Menyalakan semua lampu.*", "Markdown");
    }
    else if (command.indexOf("matikan") >= 0 && command.indexOf("lampu") >= 0) {
      allOff(true);
    }
  }
}

// ==========================================
// 6. SETUP & MAIN LOOP
// ==========================================

void setup() {
  Serial.begin(115200);
  Serial.println("Initializing Smart Home IoT Device Core...");
  
  initPins();
  dht.begin();
  
  // Hubungkan ke WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.print("WiFi Connected! IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Set SSL Client Certificate Ignore for Easy REST requests (Kritis untuk Cloud)
  client.setInsecure();
  
  // Kirim sinyal startup ke Telegram
  bot.sendMessage(CHAT_ID, "🟢 *SYSTEM REBOOTED:*\\nESP32 DevKit Smart Home terhubung secara online! Sinyal: " + String(WiFi.RSSI()) + " dBm", "Markdown");
}

void loop() {
  // 1. Baca Sensor Secara Periodik (millis non-blocking)
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastTimeSensorAndApi >= apiInterval) {
    lastTimeSensorAndApi = currentMillis;
    
    // Membaca suhu dan kelembaban dht
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    
    if (!isnan(t) && !isnan(h)) {
      temperature = t;
      humidity = h;
      Serial.printf("DHT Read Success - Temp: %.1fC, Humi: %.1f%%\\n", temperature, humidity);
    } else {
      Serial.println("Gagal membaca sensor DHT! Menggunakan data cache terakhir.");
    }
    
    // Kirim data ke REST API Cloud (Sinkronisasi Web Dashboard)
    interactWithCloud();
  }
  
  // 2. Layani Telegram Bot Polling (millis non-blocking)
  if (currentMillis - lastTimeTelegramBot >= telegramInterval) {
    lastTimeTelegramBot = currentMillis;
    
    int numNewMessages = bot.getUpdates(bot.last_message_received + 1);
    while (numNewMessages) {
      handleTelegramCommand(numNewMessages);
      numNewMessages = bot.getUpdates(bot.last_message_received + 1);
    }
  }
}
`;
}
