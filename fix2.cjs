const fs = require('fs');

const fixFile = (path, replacements) => {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  let original = content;
  for (const [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
  }
  if (content !== original) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed', path);
  }
};

fixFile('src/components/TeamDirectory.jsx', {
  'Ã¢â€ â‚¬': '─',
  'Ã¢â‚¬Âº': '›',
  'Ã¢â‚¬â€ ': '—',
  'Ã°Å¸â€ â€™': '🚪',
  'Ã¢Å“…': '✅',
  'Ã°Å¸—â€˜': '🗑️'
});

fixFile('src/components/MyDay.jsx', {
  'â† ': '←'
});

fixFile('src/components/InstantWork.jsx', {
  'â Œ': '❌',
  'âš ï¸ ': '⚠️'
});

fixFile('src/components/EvoBoard.jsx', {
  'â— ': '●'
});
