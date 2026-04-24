const url = "http://127.0.0.1:10043/v1/chat/completions";

async function runTest(model: string, content: string, label: string) {
  console.log(`\n\n=== [${label}] Test with model: ${model} ===`);
  const body = {
    model,
    messages: [{ role: "user", content }],
    stream: true
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer 1234" },
    body: JSON.stringify(body)
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        if (dataStr === "[DONE]") break;
        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices[0].delta;
          if (delta.content) {
            process.stdout.write(delta.content);
            fullContent += delta.content;
          }
          if (delta.reasoning_content) {
            // Optional: print reasoning in yellow
            // process.stdout.write(`\x1b[33m${delta.reasoning_content}\x1b[0m`);
          }
        } catch (e) {}
      }
    }
  }
}

console.log("Starting comparison tests...");

// 1. AUTO case
await runTest("SOLT1 개발 AGENT", "test.txt 파일을 만들고 내용은 'Auto Handover'라고 해줘.", "AUTO HANDOVER");

// 2. MANUAL case
await runTest("SOLT1 의뢰 AGENT", "새로운 백엔드 시스템 아키텍처를 설계하고 싶어.", "MANUAL (CONSULTATION)");
