console.error("do not run: superseded, see RUN_REPORT.md");
process.exit(1);
import "./load-env.js";
import { ApiError, createClient } from "@usenaive-sdk/managed-agents";
import { CEO_SYSTEM, FIRST_MESSAGE } from "./company.js";

const apiKey = process.env.NAIVE_API_KEY;
if (!apiKey) {
  console.error("Set NAIVE_API_KEY first.");
  process.exit(1);
}

const naive = createClient({
  baseUrl: "https://api.vetta.sh",
  apiKey,
});

const AGENT_NAME = "website-studio-ceo";

const tools = {
  default_config: { permission: "allow" as const },
  configs: {
    "email.send": { enabled: true, permission: "ask" as const },
    "social.post": { enabled: true, permission: "ask" as const },
    "neon.run_sql": { enabled: true, permission: "allow" as const },
    "neon.run_sql_transaction": { enabled: true, permission: "allow" as const },
    "neon.list_projects": { enabled: true, permission: "allow" as const },
    "neon.describe_project": { enabled: true, permission: "allow" as const },
    "mobilerun.list_devices": { enabled: true, permission: "allow" as const },
    "mobilerun.get_device": { enabled: true, permission: "allow" as const },
    "mobilerun.get_device_screenshot": { enabled: true, permission: "allow" as const },
    "mobilerun.list_apps_on_device": { enabled: true, permission: "allow" as const },
    "mobilerun.run_task": { enabled: true, permission: "ask" as const },
    "mobilerun.get_task": { enabled: true, permission: "allow" as const },
    "mobilerun.list_tasks": { enabled: true, permission: "allow" as const },
    "mobilerun.get_task_media": { enabled: true, permission: "allow" as const },
    "mobilerun.stop_task": { enabled: true, permission: "ask" as const },
    "mobilerun.numbers": { enabled: false, permission: "deny" as const },
    "mobilerun.messages": { enabled: false, permission: "deny" as const },
  },
};

function bearerServer(name: string, url: string, envName: string) {
  const token = process.env[envName];
  if (!token) {
    console.error(`Set ${envName} first to connect ${name}.`);
    process.exit(1);
  }
  return {
    name,
    url,
    headers: { Authorization: `Bearer ${token}` },
  };
}

const mcpServers = [
  bearerServer("neon", "https://mcp.neon.tech/mcp", "NEON_API_KEY"),
  bearerServer("mobilerun", "https://api.mobilerun.ai/v1/mcp", "MOBILERUN_API_KEY"),
];

const budget = {
  cap_micro_usd: 50_000_000,
  max_task_micro_usd: 5_000_000,
  period: "day" as const,
};

async function ensureAgent() {
  try {
    const created = await naive.agents.create({
      name: AGENT_NAME,
      model: "z-ai/glm-5.3-flash",
      system: CEO_SYSTEM,
      budget,
      tools,
      mcp_servers: mcpServers,
    });
    console.log("CEO agent created", created.id);
    return created;
  } catch (err) {
    if (!(err instanceof ApiError) || (err.code !== "name_conflict" && err.status !== 409)) {
      throw err;
    }
    const listed = await naive.agents.list({ limit: 100 });
    const existing = listed.data.find((a) => a.name === AGENT_NAME);
    if (!existing) throw err;
    const updated = await naive.agents.update(existing.id, {
      system: CEO_SYSTEM,
      budget,
      tools,
      mcp_servers: mcpServers,
    });
    console.log("CEO agent updated", updated.id);
    return updated;
  }
}

const agent = await ensureAgent();

const session = await naive.sessions.create({
  agent_id: agent.id,
  message: FIRST_MESSAGE,
});

console.log("session", session.id);

for await (const event of naive.stream(session.id)) {
  console.log(JSON.stringify(event));
  if (event.type === "session.completed" || event.type === "session.failed") break;
}
