const fs = require('fs');
const https = require('https');

const OWNER = 'uuacpmaster';
const REPO = 'filesrepo2';
const BRANCH = 'main';
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;
const USER_AGENT = 'StaticSiteBuilder';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API error ${res.statusCode} for ${url}`));
        }
      });
    }).on('error', reject);
  });
}

async function buildTree(path = '') {
  const fullPath = `${API_BASE}/${path}`;
  let entries;
  try {
    entries = await fetchJSON(fullPath);
  } catch (e) {
    console.error(`Failed to fetch ${fullPath}:`, e.message);
    return [];
  }

  const result = [];

  for (const entry of entries) {
    if (entry.type === 'file') {
      result.push({
        name: entry.name,
        url: entry.download_url,
        isFolder: false
      });
    } else if (entry.type === 'dir') {
      const children = await buildTree(`${path}/${entry.name}`);
      result.push({
        name: entry.name,
        isFolder: true,
        children
      });
    }
  }
  return result;
}

function renderTree(tree, indent = 0) {
  const pad = '  '.repeat(indent);
  let html = `${pad}<ul>\n`;

  for (const item of tree) {
    if (item.isFolder) {
      html += `${pad}  <li><strong>${item.name}</strong>\n`;
      html += renderTree(item.children, indent + 2);
      html += `${pad}  </li>\n`;
    } else {
      html += `${pad}  <li><a href="${item.url}" target="_blank">${item.name}</a></li>\n`;
    }
  }

  html += `${pad}</ul>\n`;
  return html;
}

async function buildSite() {
  console.log('🚧 Building static site...');

  const template = fs.readFileSync('template.html', 'utf-8');

  const currentTree = await buildTree('current');
  const pastTree = await buildTree('past');

  const currentHTML = renderTree(currentTree);
  const pastHTML = renderTree(pastTree);

  const finalHTML = template
    .replace('{{CURRENT_LIST}}', currentHTML)
    .replace('{{PAST_LIST}}', pastHTML);

  if (!fs.existsSync('docs')) fs.mkdirSync('docs');
  fs.writeFileSync('docs/index.html', finalHTML);

  console.log('✅ Static site built successfully → docs/index.html');
}

buildSite().catch(err => {
  console.error('❌ Build failed:', err);
});
