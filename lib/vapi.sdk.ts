import Vapi from "@vapi-ai/web";

const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;

export const isVapiConfigured = () => {
  return !!token && token.length > 0 && token !== "undefined";
};

// Initialize Vapi only if token is valid
export const vapi = isVapiConfigured()
  ? new Vapi(token!)
  : ({
      start: () => Promise.reject(new Error("VAPI is not configured. Please set NEXT_PUBLIC_VAPI_WEB_TOKEN.")),
      stop: () => {},
      on: () => {},
    } as any);
