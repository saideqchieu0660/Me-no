import re
with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'r') as f:
    content = f.read()

pattern = r'  useEffect\(\(\) => \{\n    if \(finished \&\& user\?\.id \&\& deckId\) \{\n      VibeProgressSyncManager\.finishAndSyncSession\(user\.id, deckId\)\.catch\(console\.error\);\n    \}\n  \}, \[finished, user\?\.id, deckId\]\);\n'
content = content.replace(pattern, '')

with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'w') as f:
    f.write(content)
