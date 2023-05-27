import { createDeployment } from "@vercel/client";
import { readFile } from "fs/promises";
import path from "path";
import { logger } from "../data/logger";
import { delay } from "../data/util";

const fifteenMinutesAsMs = 15 * 60 * 1000;

interface DeploymentOptions {
  readonly token: string;
  readonly teamId: string;
  readonly projectName: string;
}

async function deploy(options: DeploymentOptions) {
  logger.info("Starting deployment");
  for await (const event of createDeployment(
    {
      token: options.token,
      path: path.resolve(__dirname, ".."),
      teamId: options.teamId,
      debug: true,
    },
    {
      name: options.projectName,
      target: "production",
    }
  )) {
    logger.info("Deployment event", { eventType: event.type });
    if (event.type === "error") {
      logger.error("Deployment error", {
        error: event,
        message: event.payload.toString(),
      });
    }
    if (event.type === "ready") {
      logger.info("Deployment succeeded");
      return;
    }
  }
  logger.warn("Deployment did not succeed, no ready event");
}

const tokenPathEnvName = "VERCEL_TOKEN_PATH";
const teamIdEnvName = "VERCEL_TEAM_ID";
const projectEnvName = "VERCEL_PROJECT_NAME";

function getEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} not defined`);
  }
  return value;
}

async function main() {
  const tokenPath = getEnv(tokenPathEnvName);
  const token = (await readFile(tokenPath, "utf-8")).trim();

  const deploymentOptions = {
    token,
    teamId: getEnv(teamIdEnvName),
    projectName: getEnv(projectEnvName),
  };

  while (true) {
    await deploy(deploymentOptions);
    logger.info("Delaying", { delayMs: fifteenMinutesAsMs });
    await delay(fifteenMinutesAsMs);
  }
}

main();
