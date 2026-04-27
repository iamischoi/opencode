
import { createOpencodeClient } from '@opencode-ai/sdk';

const client = createOpencodeClient({
  baseUrl: 'http://localhost:10043',
  directory: 'd:/sources/poc/ai/opencode'
});

const agents = await client.app.agents();
console.log('App Agents:', JSON.stringify(agents, null, 2));
