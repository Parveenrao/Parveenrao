import { fetchWeeks } from "./fetch-contributions.mjs";
import { buildRobotSVG } from "./generate-robot-svg.mjs";
import { writeFileSync, mkdirSync } from "fs";

const login = process.env.GITHUB_LOGIN;
const token = process.env.GH_TOKEN;

if (!login || !token) {
  console.error("Missing GITHUB_LOGIN or GH_TOKEN env vars.");
  process.exit(1);
}

const weeks = await fetchWeeks(login, token);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/robot.svg", buildRobotSVG(weeks, { theme: "light" }));
writeFileSync("dist/robot-dark.svg", buildRobotSVG(weeks, { theme: "dark" }));

console.log(`Built dist/robot.svg and dist/robot-dark.svg for ${login} (${weeks.length} weeks).`);
