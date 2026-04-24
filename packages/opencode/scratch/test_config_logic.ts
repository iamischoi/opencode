
import { ProviderID, ModelID } from "../src/provider/schema";

const agentTypesEnv = "의뢰:manual,개발:auto,default:manual";
const agentModelsEnv = "prometheus:corp_main/qwen-72b-coder,sisyphus:corp_main/qwen-3-coder";

const resolveAgentModel = (name: string) => {
  if (!agentModelsEnv) return undefined;
  const map = Object.fromEntries(
    agentModelsEnv.split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.split(":"))
      .filter(parts => parts.length >= 2)
      .map(parts => [parts[0].trim().toLowerCase(), parts[1].trim()])
  );
  const modelStr = map[name.toLowerCase()];
  if (!modelStr) return undefined;
  const splitIdx = modelStr.indexOf("/");
  if (splitIdx <= 0) return undefined;
  return {
    providerID: modelStr.substring(0, splitIdx),
    modelID: modelStr.substring(splitIdx + 1)
  };
};

const agentTypesMap = Object.fromEntries(
  agentTypesEnv.split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.split(":"))
    .filter(parts => parts.length >= 2)
    .map(parts => [parts[0].trim(), parts[1].trim().toLowerCase() === "auto"])
);

console.log("Testing Intent Mapping:");
console.log("의뢰 ->", agentTypesMap["의뢰"]);
console.log("개발 ->", agentTypesMap["개발"]);
console.log("default ->", agentTypesMap["default"]);

console.log("\nTesting Agent Model Resolution:");
console.log("prometheus ->", resolveAgentModel("prometheus"));
console.log("sisyphus ->", resolveAgentModel("sisyphus"));
console.log("atlas ->", resolveAgentModel("atlas"));
