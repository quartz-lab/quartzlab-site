import { buildSite } from './build-site.mjs';

const result = await buildSite();
console.log(`Built the site with ${result.plugins.length} plugin(s) from published GitHub releases.`);
