import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  [key: string]: any;
}

export const EXPECTED_FIREBASE_PROJECT_ID = "tejascanavssingstore";

/**
 * Verified non-sensitive public client web configuration for tejascanavssingstore.
 * Client configuration contains standard web application credentials, never service account private keys.
 */
export const DEFAULT_CONFIG: Readonly<FirebaseAppletConfig> = Object.freeze({
  projectId: "tejascanavssingstore",
  appId: "1:1063501578322:web:03bec37f537e6303ad9f8b",
  apiKey: "AIzaSyCrSNFnMxwSFIMQamZaNmwy1yWVqBU42l4",
  authDomain: "tejascanavssingstore.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "tejascanavssingstore.firebasestorage.app",
  messagingSenderId: "1063501578322",
  measurementId: "G-DZFNV0HYN5",
});

/**
 * Validates that a Firebase configuration object is well-formed, contains all required fields,
 * and matches the strictly intended project (tejascanavssingstore).
 * Fails clearly if any required value is missing or inconsistent.
 */
export function validateFirebaseConfig(
  config: FirebaseAppletConfig,
  sourceLabel = "configuration"
): FirebaseAppletConfig {
  if (!config || typeof config !== "object") {
    throw new Error(`[Firebase Config Error] ${sourceLabel} is null, undefined, or not an object.`);
  }

  const requiredFields: (keyof FirebaseAppletConfig)[] = ["projectId", "appId", "apiKey", "authDomain"];
  for (const field of requiredFields) {
    const val = config[field];
    if (!val || typeof val !== "string" || !val.trim()) {
      throw new Error(`[Firebase Config Error] ${sourceLabel} is missing required non-empty field: "${field}".`);
    }
  }

  if (config.projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    throw new Error(
      `[Firebase Config Error] Security mismatch in ${sourceLabel}: expected projectId "${EXPECTED_FIREBASE_PROJECT_ID}", but received "${config.projectId}". Unintended project selection is strictly blocked.`
    );
  }

  return config;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  let loadedConfig: FirebaseAppletConfig | null = null;
  let configSource = "DEFAULT_CONFIG";

  try {
    let currentDir = "";
    try {
      if (typeof import.meta !== "undefined" && import.meta.url) {
        currentDir = path.dirname(fileURLToPath(import.meta.url));
      }
    } catch {}

    const candidatePaths = [
      currentDir ? path.join(currentDir, "../firebase-applet-config.json") : "",
      path.join(process.cwd(), "firebase-applet-config.json"),
      path.join(process.cwd(), "tejascanvassingone-main", "firebase-applet-config.json"),
      "/var/task/firebase-applet-config.json",
    ].filter(Boolean);

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          configSource = `file:${p}`;
          // Merge with defaults and validate strictly
          loadedConfig = validateFirebaseConfig({ ...DEFAULT_CONFIG, ...parsed }, configSource);
          break;
        }
      }
    }
  } catch (err: any) {
    // If it's an explicit validation failure (mismatch or missing field), fail immediately!
    if (err?.message?.includes("[Firebase Config Error]")) {
      throw err;
    }
    // Filesystem or JSON parse error falls through to default config
  }

  if (!loadedConfig) {
    loadedConfig = validateFirebaseConfig(DEFAULT_CONFIG, configSource);
  }

  return loadedConfig;
}

export const firebaseConfig: FirebaseAppletConfig = loadFirebaseConfig();
export default firebaseConfig;
