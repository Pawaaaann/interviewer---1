import Vapi from "@vapi-ai/web";

const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
if (!token) {
  console.warn("VAPI token not configured. Interview features will not work.");
}

export const vapi = new Vapi(token || "");
