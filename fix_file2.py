with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    if "VibeProgressSyncManager.finishAndSyncSession" in line and "catch(console.error)" in line:
        # this is the middle line.
        # we need to skip the previous lines. Actually, let's just delete this line and the surrounding ones.
        pass
    new_lines.append(line)

with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'w') as f:
    f.writelines(new_lines)
