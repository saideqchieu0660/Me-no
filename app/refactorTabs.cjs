const fs = require('fs');

function refactorTabs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace {activeTab === "something" && ( ... )} with <div className={activeTab === "something" ? "hardware-tab-active" : "hardware-tab-content"}> ... </div>
  
  // We need to match the opening '{activeTab === "something" && ('
  const tabRegex = /\{activeTab === "([^"]+)" && \(/g;
  
  let match;
  let modifications = [];
  while ((match = tabRegex.exec(content)) !== null) {
      let startIndex = match.index;
      let openBrackets = 1;
      let currentIndex = startIndex + match[0].length;
      
      while (openBrackets > 0 && currentIndex < content.length) {
          if (content[currentIndex] === '{') openBrackets++;
          if (content[currentIndex] === '}') openBrackets--;
          currentIndex++;
      }
      
      // currentIndex is now at the end of the matching block, but we want the ')' before '}' maybe?
      // Wait, the structure is: {activeTab === "tab" && ( ... )}
      // The outer block is {} which we matched. 
      // The last characters should be ')' and '}'
      let blockEnd = currentIndex - 1; // this is the '}'
      let prevChar = content.lastIndexOf(')', blockEnd);

      modifications.push({
          tabName: match[1],
          startBlock: startIndex,
          startInner: startIndex + match[0].length,
          endInner: prevChar,
          endBlock: blockEnd + 1
      });
  }

  // Apply backwards so offsets don't mess up
  for (let i = modifications.length - 1; i >= 0; i--) {
      let mod = modifications[i];
      let prefix = `<div className={activeTab === "${mod.tabName}" ? "hardware-tab-active w-full" : "hardware-tab-content w-full"}>`;
      let suffix = `</div>`;
      
      let innerContent = content.substring(mod.startInner, mod.endInner);
      
      content = content.substring(0, mod.startBlock) + prefix + innerContent + suffix + content.substring(mod.endBlock);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${modifications.length} tabs.`);
}

refactorTabs('./src/pages/StudentDashboard.tsx');
