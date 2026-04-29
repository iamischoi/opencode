
const OPENROUTER_KEY = "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";
const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

async function testOpenRouter() {
  console.log(`Testing OpenRouter with model: ${MODEL}...`);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://opencode.ai", // Optional, for OpenRouter rankings
        "X-Title": "OpenCode Test", // Optional
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Say hello and identify yourself." }],
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log("✅ Success!");
      console.log("Response:", JSON.stringify(data, null, 2));
    } else {
      console.error("❌ Failed!");
      console.error("Status:", response.status);
      console.error("Error:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("❌ Request Error:", error);
  }
}

testOpenRouter();
