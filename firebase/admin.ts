import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
function initFirebaseAdmin() {
  const apps = getApps();

  if (!apps.length) {
    // Check if we have all required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKeyB64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string of full service account

    if (!projectId || !clientEmail || (!privateKey && !privateKeyB64 && !serviceAccountJson)) {
      console.warn("Firebase Admin not properly configured - missing environment variables");
      // Initialize with minimal config for development
      try {
        initializeApp({
          projectId: projectId || "demo-project",
        });
      } catch (error) {
        console.error("Failed to initialize Firebase Admin:", error);
        return null;
      }
    } else {
      try {
        let credentials: { projectId: string; clientEmail: string; privateKey: string } | null = null;

        // 0) If a full service account JSON is provided, prefer it.
        if (serviceAccountJson) {
          try {
            const parsed = JSON.parse(serviceAccountJson);
            credentials = {
              projectId: parsed.project_id || projectId,
              clientEmail: parsed.client_email || clientEmail,
              privateKey: (parsed.private_key || "") as string,
            };
          } catch (e) {
            console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON. Falling back to key normalization.");
          }
        }

        // 1) If base64 private key is provided, decode it
        if (!credentials && privateKeyB64) {
          try {
            const decoded = Buffer.from(privateKeyB64, "base64").toString("utf8");
            credentials = { projectId, clientEmail, privateKey: decoded };
          } catch (e) {
            console.error("Failed to decode FIREBASE_PRIVATE_KEY_BASE64. Falling back to text key normalization.");
          }
        }

        // 2) Otherwise, normalize the text private key from environment to a valid PEM string
        let formattedPrivateKey = privateKey as string;

        // 1) Trim whitespace and remove surrounding single/double quotes
        formattedPrivateKey = formattedPrivateKey.trim().replace(/^["']|["']$/g, "");
        //    Also remove surrounding escaped quotes (e.g., \"...\")
        formattedPrivateKey = formattedPrivateKey.replace(/^\\"|\\"$/g, "");

        // 2) Handle double-escaped newlines often seen when the key was JSON-stringified ("\\n")
        //    Replace \\n with \n first, then replace literal \n with real newlines
        formattedPrivateKey = formattedPrivateKey.replace(/\\\\n/g, "\\n");
        formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, "\n");

        // 3) Normalize CRLF/CR to LF just in case
        formattedPrivateKey = formattedPrivateKey.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // 4) Remove stray control characters (except newlines)
        formattedPrivateKey = formattedPrivateKey.replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F]/g, "");

        // 5) Normalize header spacing and support RSA PRIVATE KEY variant
        formattedPrivateKey = formattedPrivateKey.replace(/-----BEGIN\s+PRIVATE\s+KEY-----/g, "-----BEGIN PRIVATE KEY-----");
        formattedPrivateKey = formattedPrivateKey.replace(/-----END\s+PRIVATE\s+KEY-----/g, "-----END PRIVATE KEY-----");
        const hasPkcs8Headers = formattedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") && formattedPrivateKey.includes("-----END PRIVATE KEY-----");
        const hasRsaHeaders = formattedPrivateKey.includes("-----BEGIN RSA PRIVATE KEY-----") && formattedPrivateKey.includes("-----END RSA PRIVATE KEY-----");

        // 6) Final sanity checks
        if (!hasPkcs8Headers && !hasRsaHeaders) {
          if (!credentials) {
            console.error("Private key (text) is missing PEM headers. Expected PKCS#8 or RSA headers. If on Windows, consider using FIREBASE_PRIVATE_KEY_BASE64 or FIREBASE_SERVICE_ACCOUNT.");
            throw new Error("Invalid private key format: missing PEM headers");
          }
        }

        // Safe diagnostics (no key content)
        const lineCount = (formattedPrivateKey.match(/\n/g) || []).length + 1;
        const startsWith = formattedPrivateKey.substring(0, 31);
        const endsWith = formattedPrivateKey.substring(formattedPrivateKey.length - 31);
        console.log("[Firebase Admin] Key diagnostics:", {
          length: formattedPrivateKey.length,
          lineCount,
          hasPkcs8Headers,
          hasRsaHeaders,
          startsWith,
          endsWith,
        });

        const finalCreds = credentials || { projectId, clientEmail, privateKey: formattedPrivateKey };

        initializeApp({
          credential: cert({
            projectId: finalCreds.projectId,
            clientEmail: finalCreds.clientEmail,
            privateKey: finalCreds.privateKey,
          }),
        });

        console.log("Firebase Admin initialized successfully with credentials");
      } catch (error) {
        console.error("Failed to initialize Firebase Admin with credentials:", error);
        console.log("Falling back to basic initialization without authentication");
        // Fallback to basic initialization
        try {
          initializeApp({
            projectId: projectId || "demo-project",
          });
        } catch (fallbackError) {
          console.error("Fallback initialization also failed:", fallbackError);
          return null;
        }
      }
    }
  }

  try {
    return {
      auth: getAuth(),
      db: getFirestore(),
    };
  } catch (error) {
    console.error("Failed to get Firebase services:", error);
    return null;
  }
}

const firebaseAdmin = initFirebaseAdmin();

export const auth = firebaseAdmin?.auth || null;
export const db = firebaseAdmin?.db || null;
