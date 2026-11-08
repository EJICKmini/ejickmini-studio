import "./load-env.js";
import { createClient } from "@usenaive-sdk/managed-agents";

const apiKey = process.env.NAIVE_API_KEY;
if (!apiKey) {
  console.error("Set NAIVE_API_KEY first (export NAIVE_API_KEY=sk_... or copy .env.example).");
  process.exit(1);
}

const naive = createClient({
  baseUrl: "https://api.vetta.sh",
  apiKey,
});

const agent = await naive.agents.create({
  name: "smoke-test",
  model: "z-ai/glm-5.3-flash",
  system: "You are a one-line smoke test. Reply with exactly: smoke ok",
  budget: {
    cap_micro_usd: 1_000_000,
    max_task_micro_usd: 500_000,
    period: "day",
  },
});

console.log("agent", agent.id);

const session = await naive.sessions.create({
  agent_id: agent.id,
  message: "Confirm auth works in one short reply.",
});

console.log("session", session.id);

for await (const event of naive.stream(session.id)) {
  console.log(event.type, "seq" in event ? event.seq : "");
  if (event.type === "session.completed" || event.type === "session.failed") break;
}

console.log("smoke done");
