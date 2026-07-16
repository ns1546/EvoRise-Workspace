const fs = require('fs');

const fix = (file, regex, replaceWith) => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(regex, replaceWith);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Fixed', file);
  }
};

fix('src/components/MyDay.jsx', /placeholder="ðŸ”[^S]*Search/g, 'placeholder="🔍 Search');
console.log('Done');
