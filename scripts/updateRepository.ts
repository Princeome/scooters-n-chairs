import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { repositoryUpdater } from "../src/data/data";
import fetch from "node-fetch";

async function main() {
  if (!globalThis.fetch) {
    globalThis.fetch = fetch as any;
  }
  await repositoryUpdater.updateData();
}

main();
