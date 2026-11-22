import 'dotenv/config';
import { deployCommands } from './bot.js';

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required');
  process.exit(1);
}
await deployCommands();
