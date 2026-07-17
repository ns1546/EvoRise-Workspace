const fs = require('fs');

const fix = (file, regex, replaceWith) => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(regex, replaceWith);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Fixed', file);
  }
};

fix('src/components/MyDay.jsx', /\{historyMode \? 'â[^']+' : 'History'\}/g, "{historyMode ? '← Queue' : 'History'}");
fix('src/components/InstantWork.jsx', /'â[^']* Mark Failed'/g, "'❌ Mark Failed'");
fix('src/components/InstantWork.jsx', /isLow \? 'â[^']*' : '🎯 YOUR MISSION'/g, "isLow ? '⚠️ URGENT' : '🎯 YOUR MISSION'");
fix('src/components/EvoBoard.jsx', />â[^<]*<\/span>/g, ">●</span>");

console.log('Done');
