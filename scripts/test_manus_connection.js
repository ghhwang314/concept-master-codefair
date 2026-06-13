import { loadEnvFile } from "../src/env.js";
import { ManusAiClient } from "../src/manusClient.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
loadEnvFile(ROOT);

async function testConnection() {
  console.log("Checking Manus API credentials...");
  
  if (!process.env.MANUS_API_KEY) {
    console.error("FAIL: MANUS_API_KEY is not defined in environment or .env file.");
    process.exit(1);
  }
  
  console.log("MANUS_API_KEY is configured (length: " + process.env.MANUS_API_KEY.length + " characters)");
  
  const baseUrl = process.env.MANUS_API_BASE_URL || process.env.MANUS_API_URL || "https://api.manus.ai";
  console.log("Connecting to Manus API at: " + baseUrl);
  
  const client = new ManusAiClient();
  
  try {
    // Attempt to create a dummy task to verify auth
    const created = await client.postJson("/v2/task.create", {
      title: "Connection Test",
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: "manus-1.6-lite",
      message: {
        content: [
          {
            type: "text",
            text: "Hello, this is a connection test. Please return status 'OK'.",
          },
        ],
      },
      structured_output_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: { type: "string" }
        },
        required: ["status"]
      }
    });
    
    if (created && created.task_id) {
      console.log("SUCCESS: Manus API connection verified successfully!");
      console.log("Created Task ID: " + created.task_id);
      process.exit(0);
    } else {
      console.error("FAIL: Manus API responded, but did not return a task_id.", JSON.stringify(created));
      process.exit(1);
    }
  } catch (error) {
    console.error("FAIL: Manus API connection failed with error:");
    console.error(error.message);
    if (error.status) {
      console.error("HTTP Status Code: " + error.status);
    }
    process.exit(1);
  }
}

testConnection();
