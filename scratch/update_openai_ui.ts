
const path = "packages/opencode/src/server/routes/instance/openai.ts";
const content = await Bun.file(path).text();

let newContent = content;

// Update toolMap
if (!content.includes("glob: \"파일 패턴 검색\"")) {
    const startIdx = content.indexOf("const toolMap: Record<string, string> = {");
    const endIdx = content.indexOf("}", startIdx) + 1;
    if (startIdx !== -1 && endIdx !== -1) {
        const toolMapNew = `const toolMap: Record<string, string> = {
                    bash: "터미널 명령",
                    run_command: "명령어 실행",
                    read: "파일/데이터 읽기",
                    read_file: "파일 읽기",
                    view_file: "파일 내용 확인",
                    write_file: "파일 생성/저장",
                    replace_file_content: "파일 내용 수정",
                    multi_replace_file_content: "여러 파일 일괄 수정",
                    grep_search: "파일 내용 검색",
                    grep: "파일 내용 정밀 검색",
                    glob: "파일 패턴 검색",
                    list_dir: "디렉토리 구조 분석",
                    search_web: "웹 검색",
                    google_search: "구글 검색",
                    read_url_content: "URL 콘텐츠 읽기",
                    question: "사용자 질문",
                    delegate_task: "에이전트 업무 위임",
                    task: "에이전트 업무 위임"
                  }`;
        newContent = newContent.substring(0, startIdx) + toolMapNew + newContent.substring(endIdx);
    }
}

// Update argsDesc for description with bold
newContent = newContent.replace(
    "argsDesc = `: ${args.description}`",
    "argsDesc = `: **${args.description}**`"
);

// Inject glob and grep logic after the description block
if (!newContent.includes("toolName === \"glob\"")) {
    const target = "currentTaskSummary = args.description";
    const injection = `
                      }
                      // 4. Glob Tool
                      else if (toolName === "glob" && args.pattern) {
                        argsDesc = \`: \\\`\${args.pattern}\\\` 패턴 검색\`
                        currentTaskSummary = \`파일 패턴 검색: \${args.pattern}\`
                      }
                      // 5. Grep Tool
                      else if ((toolName === "grep" || toolName === "grep_search") && args.query) {
                        const searchPath = args.SearchPath || args.path || ""
                        argsDesc = \`: \\\`\${args.query}\\\` (경로: \${formatPath(searchPath) || "전체"})\`
                        currentTaskSummary = \`내용 검색: \${args.query}\``;
    
    // We replace the part from "currentTaskSummary = args.description" to the next "}"
    const startIdx = newContent.indexOf(target);
    const endIdx = newContent.indexOf("}", startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
        newContent = newContent.substring(0, startIdx + target.length) + injection + newContent.substring(endIdx + 1);
    }
}

await Bun.write(path, newContent);
console.log("Updated openai.ts successfully (take 3)");
