const fs = require('fs');
const path = require('path');

const dir = 'G:/Download Official/New folder (3)/evorise-workspace/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const replacements = {
  'Ã¢â€ â‚¬': '─',
  'Ã¢â‚¬Âº': '›',
  'Ã¢â‚¬â€ ': '—',
  'Ã°Å¸â€ â€™': '🚪',
  'Ã¢Å“â€¦': '✅',
  'Ã°Å¸—â€˜': '🗑️',
  'â Œ': '❌',
  'âš ï¸ ': '⚠️',
  'â— ': '●',
  'â† ': '←'
};

for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
  let content = fs.readFileSync(p, 'utf8');
  let original = content;
  
  for (const [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
  }
  
  if (content !== original) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed', f);
  }
}
