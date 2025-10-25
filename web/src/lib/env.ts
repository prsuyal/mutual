export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "",
  NEXT_PUBLIC_VAPI_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  LETTA_API_URL: process.env.LETTA_API_URL || "",
  LETTA_API_KEY: process.env.LETTA_API_KEY || "",
  LETTA_PROJECT_ID: process.env.LETTA_PROJECT_ID || "",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  DEMO_MODE: process.env.DEMO_MODE === "true",
};
