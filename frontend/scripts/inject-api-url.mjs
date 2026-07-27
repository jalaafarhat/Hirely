import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL?.trim();

if (!apiUrl && process.env.VERCEL === '1') {
  console.warn(
    'WARNING: API_URL is not set on Vercel. Set it to your Railway API URL, e.g. https://your-app.up.railway.app/api/v1',
  );
}

const resolvedApiUrl = apiUrl || '/api/v1';

const content = `export const environment = {
  production: true,
  apiUrl: '${resolvedApiUrl.replace(/'/g, "\\'")}',
};
`;

writeFileSync(resolve(__dirname, '../src/environments/environment.prod.ts'), content);
console.log(`Production API URL set to: ${resolvedApiUrl}`);
