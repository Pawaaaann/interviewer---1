import Vapi from "@vapi-ai/web";

const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;

export const isVapiConfigured = () => {
  return !!token && token.length > 0 && token !== "undefined";
};

let vapiInstance: Vapi | null = null;

export const getVapi = () => {
  if (!isVapiConfigured()) {
    throw new Error("VAPI is not configured. Please set NEXT_PUBLIC_VAPI_WEB_TOKEN.");
  }
  
  if (!vapiInstance) {
    vapiInstance = new Vapi(token!);
  }
  
  return vapiInstance;
};

// Keep vapi export for backwards compatibility
export const vapi = isVapiConfigured()
  ? new Vapi(token!)
  : ({
      start: () => Promise.reject(new Error("VAPI is not configured. Please set NEXT_PUBLIC_VAPI_WEB_TOKEN.")),
      stop: () => Promise.resolve(),
      on: () => {},
      off: () => {},
    } as any);
