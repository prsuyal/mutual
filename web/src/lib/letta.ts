import { LettaClient as Letta } from "@letta-ai/letta-client";
import { env } from "./env";

export const letta = new Letta({
  baseUrl: env.LETTA_API_URL,
  token: env.LETTA_API_KEY,
  project: env.LETTA_PROJECT_ID,
});
