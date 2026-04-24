const url = "http://127.0.0.1:10043/v1/chat/completions";
const body = {
  model: "sisyphus",
  messages: [
    { role: "user", content: "현재 opencode 패키지의 src 폴더에 어떤 내용들이 있는지 아주 간단히 알려줘." }
  ],
  stream: true
};

console.log("Sending request to OpenCode server with Sisyphus...");

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer 1234"
  },
  body: JSON.stringify(body)
});

if (!response.ok) {
  console.error("Error:", response.status, await response.text());
  process.exit(1);
}

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");
  
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6);
      if (dataStr === "[DONE]") {
        console.log("\n--- [DONE] ---");
        break;
      }
      
      try {
        const json = JSON.parse(dataStr);
        const delta = json.choices[0].delta;
        
        if (delta.reasoning_content) {
          process.stdout.write(`\x1b[33m[THINKING]\x1b[0m ${delta.reasoning_content}`);
        }
        if (delta.content) {
          process.stdout.write(`\x1b[32m[CONTENT]\x1b[0m ${delta.content}`);
        }
      } catch (e) {
        // Skip non-json data
      }
    }
  }
}
