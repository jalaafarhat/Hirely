import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL?.trim() || '/api/v1';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl.replace(/'/g, "\\'")}',
};
`;

writeFileSync(resolve(__dirname, '../src/environments/environment.prod.ts'), content);
console.log(`Production API URL set to: ${apiUrl}`);
