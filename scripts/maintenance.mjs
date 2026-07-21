import {
  loadSiteConfig,
  writeSiteConfig,
} from './lib/site-config.mjs';

const command = String(process.argv[2] || '').toLowerCase();
if (!['on', 'off', 'status'].includes(command)) {
  console.error('Usage: node scripts/maintenance.mjs <on|off|status>');
  process.exitCode = 1;
} else {
  try {
    let config = await loadSiteConfig();
    if (command !== 'status') {
      config = await writeSiteConfig({
        maintenance: { enabled: command === 'on' },
      });
    }

    console.log(`Maintenance mode: ${config.maintenance.enabled ? 'ON' : 'OFF'}`);
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}
