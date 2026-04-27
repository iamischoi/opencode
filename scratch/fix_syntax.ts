
const path = "packages/opencode/src/server/routes/instance/openai.ts";
const content = await Bun.file(path).text();

// Replace with a regex that handles whitespace
let newContent = content.replace(
    /currentTaskSummary = `내용 검색: \${args.query}`\s+\/\/ 2. Question Tool/g,
    "currentTaskSummary = `내용 검색: ${args.query}`\n                      }\n                      // 2. Question Tool"
);

await Bun.write(path, newContent);
console.log("Fixed syntax error in openai.ts (take 2)");
