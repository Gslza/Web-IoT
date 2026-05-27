/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RelayState {
  relay1: boolean;
  relay2: boolean;
  relay3: boolean;
  relay4: boolean;
}

export interface SensorState {
  temperature: number;
  humidity: number;
  last_update: string;
}

export interface ESP32State {
  status: "online" | "offline";
  wifi_signal: string;
  ip_address: string;
  last_seen?: string;
}

export interface CommandState {
  source: "web" | "telegram" | "voice" | "system";
  last_command: string;
  updated_at: string;
}

export interface SmartHomeSchema {
  relay: RelayState;
  sensor: SensorState;
  esp32: ESP32State;
  command: CommandState;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  source: "web" | "telegram" | "voice" | "automation" | "esp32" | "system";
  message: string;
  type: "info" | "success" | "warning" | "danger";
}

export interface SensorHistory {
  timestamp: string;
  temperature: number;
  humidity: number;
}
