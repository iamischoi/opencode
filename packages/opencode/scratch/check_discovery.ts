
import { mergeWithClaudeCodeAgents } from 'd:/sources/poc/ai/opencode/packages/openagent/src/tools/delegate-task/subagent-discovery.ts';

const agents = mergeWithClaudeCodeAgents([], 'd:/sources/poc/ai/opencode');
console.log('Discovered Agents:', agents.map(a => a.name));
