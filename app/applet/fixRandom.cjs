const fs = require('fs');

function fix(f) {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/\`\w+-\$\{Math\.random\(\)\}\`/g, "index");
    fs.writeFileSync(f, text);
  }
}

fix('src/components/TopPerformersWidget.tsx');
fix('src/components/AchievementCardExport.tsx');
fix('src/components/FramerFireworks.tsx');
fix('src/components/GlobalErrorToast.tsx');
fix('src/components/Agent3Widget.tsx');
fix('src/pages/ApiHealthMonitor.tsx');
fix('src/components/GlobalActivityFeed.tsx');

console.log('Fixed math.randoms to use index');
