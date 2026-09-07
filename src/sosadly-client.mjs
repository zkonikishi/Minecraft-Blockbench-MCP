// Replace the separate HTTP bridge with direct calls into the original handlers.
import { commands } from 'sosadly-commands';
export async function callBlockbench(action, params = {}) {
  if (!Object.hasOwn(commands,action)) throw new Error(`Unknown animation command: ${action}`);
  return await commands[action](params);
}
