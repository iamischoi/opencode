const url = "http://127.0.0.1:10043/v1/chat/completions";
const body = {
  model: "sisyphus",
  messages: [
    { role: "user", content: "sisyphus 의 하위 에이전트들을 활용해서, src/server 폴더에 있는 모든 파일들을 스캔하고, 거기에 있는 모든 API 엔드포인트 목록을 마크다운으로 정리해서 scratch 폴더에 api_endpoints.md 라는 이름으로 저장해줘." }
  ],
  stream: true
};

console.log("Sending complex request to OpenCode server with Sisyphus...");

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
