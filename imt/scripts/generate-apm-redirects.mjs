import { readFileSync, writeFileSync } from 'node:fs';
import {
  apmRedirectPairs,
  apmShellConfigPath,
  appConfigPath,
  appRedirects,
  renderApmShellConfig,
  renderAppConfig,
} from '../lib/apm-redirects.mjs';

const oldHosts = ['apmoverflow.xyz', 'www.apmoverflow.xyz'];

writeFileSync(
  apmShellConfigPath,
  renderApmShellConfig(readFileSync(apmShellConfigPath, 'utf8'))
);
writeFileSync(
  appConfigPath,
  renderAppConfig(readFileSync(appConfigPath, 'utf8'), oldHosts)
);
console.log(
  `wrote apmoverflow/vercel.json (${apmRedirectPairs().length} redirects) and imt/vercel.json (${appRedirects(oldHosts).length} redirects)`
);
