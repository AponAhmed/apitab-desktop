import type { PreparedRequest } from '@/types';

export type SnippetLanguage =
  | 'fetch'
  | 'axios'
  | 'php-curl'
  | 'laravel'
  | 'python';

export interface SnippetDef {
  id: SnippetLanguage;
  label: string;
  /** Hint used purely for the (lightweight) code styling. */
  language: 'javascript' | 'php' | 'python';
}

export const SNIPPETS: SnippetDef[] = [
  { id: 'fetch', label: 'Fetch API', language: 'javascript' },
  { id: 'axios', label: 'Axios', language: 'javascript' },
  { id: 'php-curl', label: 'PHP cURL', language: 'php' },
  { id: 'laravel', label: 'Laravel HTTP', language: 'php' },
  { id: 'python', label: 'Python Requests', language: 'python' },
];

/* --------------------------- escaping helpers --------------------------- */

const jsString = (s: string): string => JSON.stringify(s);
const pyString = (s: string): string => JSON.stringify(s); // shares JSON escapes
const phpString = (s: string): string =>
  `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function headerEntries(req: PreparedRequest): [string, string][] {
  return req.headers.filter((h) => h.key).map((h) => [h.key, h.value]);
}

function parsePairs(body: string | null): [string, string][] {
  if (!body) return [];
  return body
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const dec = (v: string) => {
        try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return v; }
      };
      return eq === -1
        ? [dec(pair), ''] as [string, string]
        : [dec(pair.slice(0, eq)), dec(pair.slice(eq + 1))] as [string, string];
    });
}

function indentLines(lines: string[], pad: string): string {
  return lines.map((l) => pad + l).join('\n');
}

/* ------------------------------- Fetch --------------------------------- */

function fetchSnippet(req: PreparedRequest): string {
  let prelude = '';
  let bodyRef: string | null = null;

  if (req.bodyType === 'form-data' && req.formData?.length) {
    const appends = req.formData
      .filter((f) => f.key)
      .map((f) => `formdata.append(${jsString(f.key)}, ${jsString(f.value)});`);
    prelude = `const formdata = new FormData();\n${appends.join('\n')}\n\n`;
    bodyRef = 'formdata';
  } else if (req.bodyType === 'form-urlencoded') {
    const appends = parsePairs(req.body).map(
      ([k, v]) => `urlencoded.append(${jsString(k)}, ${jsString(v)});`,
    );
    prelude = `const urlencoded = new URLSearchParams();\n${appends.join('\n')}\n\n`;
    bodyRef = 'urlencoded';
  } else if (req.body) {
    bodyRef = jsString(req.body);
  }

  const headerLines = headerEntries(req).map(
    ([k, v]) => `    ${jsString(k)}: ${jsString(v)},`,
  );

  const options: string[] = [`  method: ${jsString(req.method)},`];
  if (headerLines.length) options.push(`  headers: {\n${headerLines.join('\n')}\n  },`);
  if (bodyRef) options.push(`  body: ${bodyRef},`);
  options.push(`  redirect: "follow",`);

  return (
    `${prelude}const options = {\n${options.join('\n')}\n};\n\n` +
    `fetch(${jsString(req.url)}, options)\n` +
    `  .then((response) => response.text())\n` +
    `  .then((result) => console.log(result))\n` +
    `  .catch((error) => console.error(error));`
  );
}

/* ------------------------------- Axios --------------------------------- */

function axiosSnippet(req: PreparedRequest): string {
  let prelude = `const axios = require('axios');\n\n`;
  let dataRef: string | null = null;
  let extraHeaders = '';

  if (req.bodyType === 'form-data' && req.formData?.length) {
    prelude += `const FormData = require('form-data');\n`;
    const appends = req.formData
      .filter((f) => f.key)
      .map((f) => `data.append(${jsString(f.key)}, ${jsString(f.value)});`);
    prelude += `const data = new FormData();\n${appends.join('\n')}\n\n`;
    dataRef = 'data';
    extraHeaders = '\n    ...data.getHeaders(),';
  } else if (req.bodyType === 'form-urlencoded') {
    const appends = parsePairs(req.body).map(
      ([k, v]) => `data.append(${jsString(k)}, ${jsString(v)});`,
    );
    prelude += `const data = new URLSearchParams();\n${appends.join('\n')}\n\n`;
    dataRef = 'data';
  } else if (req.body) {
    prelude += `const data = ${jsString(req.body)};\n\n`;
    dataRef = 'data';
  }

  const headerLines = headerEntries(req).map(
    ([k, v]) => `    ${jsString(k)}: ${jsString(v)},`,
  );

  const config: string[] = [
    `  method: ${jsString(req.method.toLowerCase())},`,
    `  url: ${jsString(req.url)},`,
  ];
  if (headerLines.length || extraHeaders) {
    config.push(`  headers: {\n${headerLines.join('\n')}${extraHeaders}\n  },`);
  }
  if (dataRef) config.push(`  data: ${dataRef},`);

  return (
    `${prelude}const config = {\n${config.join('\n')}\n};\n\n` +
    `axios(config)\n` +
    `  .then((response) => console.log(JSON.stringify(response.data)))\n` +
    `  .catch((error) => console.error(error));`
  );
}

/* ------------------------------ PHP cURL ------------------------------- */

function phpCurlSnippet(req: PreparedRequest): string {
  const opts: string[] = [
    `  CURLOPT_URL => ${phpString(req.url)},`,
    `  CURLOPT_RETURNTRANSFER => true,`,
    `  CURLOPT_FOLLOWLOCATION => true,`,
    `  CURLOPT_CUSTOMREQUEST => ${phpString(req.method)},`,
  ];

  if (req.bodyType === 'form-data' && req.formData?.length) {
    const fields = req.formData
      .filter((f) => f.key)
      .map((f) => `    ${phpString(f.key)} => ${phpString(f.value)},`);
    opts.push(`  CURLOPT_POSTFIELDS => [\n${fields.join('\n')}\n  ],`);
  } else if (req.body) {
    opts.push(`  CURLOPT_POSTFIELDS => ${phpString(req.body)},`);
  }

  const headerList = headerEntries(req).map(
    ([k, v]) => `    ${phpString(`${k}: ${v}`)},`,
  );
  if (headerList.length) {
    opts.push(`  CURLOPT_HTTPHEADER => [\n${headerList.join('\n')}\n  ],`);
  }

  return (
    `<?php\n\n$curl = curl_init();\n\n` +
    `curl_setopt_array($curl, [\n${opts.join('\n')}\n]);\n\n` +
    `$response = curl_exec($curl);\n$err = curl_error($curl);\n\n` +
    `curl_close($curl);\n\n` +
    `if ($err) {\n  echo "cURL Error #:" . $err;\n} else {\n  echo $response;\n}`
  );
}

/* ----------------------------- Laravel HTTP ---------------------------- */

function laravelSnippet(req: PreparedRequest): string {
  const method = req.method.toLowerCase();
  const headers = headerEntries(req).filter(
    ([k]) => k.toLowerCase() !== 'content-type',
  );
  const headerLines = headers.map(
    ([k, v]) => `    ${phpString(k)} => ${phpString(v)},`,
  );

  let chain = 'Http::';
  if (headerLines.length) {
    chain += `withHeaders([\n${headerLines.join('\n')}\n])\n    ->`;
  }

  let call: string;
  if (req.bodyType === 'form-data' && req.formData?.length) {
    const attaches = req.formData
      .filter((f) => f.key)
      .map((f) => `attach(${phpString(f.key)}, ${phpString(f.value)})`)
      .join('\n    ->');
    call = `${attaches}\n    ->${method}(${phpString(req.url)})`;
  } else if (req.bodyType === 'form-urlencoded') {
    const fields = parsePairs(req.body).map(
      ([k, v]) => `    ${phpString(k)} => ${phpString(v)},`,
    );
    call = `asForm()->${method}(${phpString(req.url)}, [\n${fields.join('\n')}\n])`;
  } else if (req.body) {
    const ct = headerEntries(req).find(([k]) => k.toLowerCase() === 'content-type');
    const contentType = ct?.[1] ?? 'application/json';
    call = `withBody(<<<'BODY'\n${req.body}\nBODY, ${phpString(contentType)})\n    ->${method}(${phpString(req.url)})`;
  } else {
    call = `${method}(${phpString(req.url)})`;
  }

  return (
    `<?php\n\nuse Illuminate\\Support\\Facades\\Http;\n\n` +
    `$response = ${chain}${call};\n\n` +
    `return $response->json();`
  );
}

/* --------------------------- Python Requests --------------------------- */

function pythonSnippet(req: PreparedRequest): string {
  const lines: string[] = ['import requests', ''];
  lines.push(`url = ${pyString(req.url)}`);
  lines.push('');

  let bodyKwarg = '';

  if (req.bodyType === 'form-data' && req.formData?.length) {
    const fields = req.formData
      .filter((f) => f.key)
      .map((f) => `  ${pyString(f.key)}: (None, ${pyString(f.value)}),`);
    lines.push(`files = {\n${fields.join('\n')}\n}`);
    lines.push('');
    bodyKwarg = ', files=files';
  } else if (req.bodyType === 'form-urlencoded') {
    const fields = parsePairs(req.body).map(
      ([k, v]) => `  ${pyString(k)}: ${pyString(v)},`,
    );
    lines.push(`payload = {\n${fields.join('\n')}\n}`);
    lines.push('');
    bodyKwarg = ', data=payload';
  } else if (req.body) {
    lines.push(`payload = ${pyString(req.body)}`);
    lines.push('');
    bodyKwarg = ', data=payload';
  }

  const headerLines = headerEntries(req).map(
    ([k, v]) => `  ${pyString(k)}: ${pyString(v)},`,
  );
  const headersArg = headerLines.length
    ? (lines.push(`headers = {\n${headerLines.join('\n')}\n}`), lines.push(''), ', headers=headers')
    : '';

  lines.push(
    `response = requests.request(${pyString(req.method)}, url${headersArg}${bodyKwarg})`,
  );
  lines.push('');
  lines.push('print(response.text)');
  return lines.join('\n');
}

/* ------------------------------ dispatch ------------------------------- */

const GENERATORS: Record<SnippetLanguage, (req: PreparedRequest) => string> = {
  fetch: fetchSnippet,
  axios: axiosSnippet,
  'php-curl': phpCurlSnippet,
  laravel: laravelSnippet,
  python: pythonSnippet,
};

export function generateSnippet(id: SnippetLanguage, req: PreparedRequest): string {
  return GENERATORS[id](req);
}
