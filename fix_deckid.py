with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'r') as f:
    lines = f.readlines()

out = []
skip = 0
for i in range(len(lines)):
    if skip > 0:
        skip -= 1
        continue
    
    line = lines[i]
    if "  useEffect(() => {" in line and "window.removeEventListener(\"vibe-progress-synced\", handleProgressSynced);" in lines[i+2]:
        skip = 10
        continue
        
    out.append(line)

with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'w') as f:
    f.writelines(out)

