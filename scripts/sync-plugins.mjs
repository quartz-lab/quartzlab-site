import { syncPlugins } from './lib/plugin-sync.mjs';

const result = await syncPlugins();
console.log(`Synced ${result.plugins.length} plugin(s) from latest published GitHub releases.`);
