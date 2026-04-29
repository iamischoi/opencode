
try {
  const mod = await import("@ai-sdk/openai-compatible");
  console.log("Exports:", Object.keys(mod));
} catch (e) {
  console.error("Failed to import @ai-sdk/openai-compatible:", e);
}
