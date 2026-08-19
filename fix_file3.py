with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'r') as f:
    lines = f.readlines()

out_lines = []
skip = 0
for i in range(len(lines)):
    if skip > 0:
        skip -= 1
        continue
    
    line = lines[i]
    if i + 4 < len(lines):
        if "useEffect(() => {" in lines[i] and "if (finished && user?.id && deckId) {" in lines[i+1] and "VibeProgressSyncManager.finishAndSyncSession" in lines[i+2]:
            skip = 4
            continue
            
    out_lines.append(line)

with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'w') as f:
    f.writelines(out_lines)
