with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = 0

deckid_lines = []

# first pass, find the deckid lines and extract them
for i in range(len(lines)):
    if "const { cooldownRemaining, startCooldown } = useAICooldown(user);" in lines[i]:
        deckid_lines = lines[i:i+3]

for i in range(len(lines)):
    if skip > 0:
        skip -= 1
        continue
    
    line = lines[i]
    if "const handleBack = async" in line:
        new_lines.extend(deckid_lines)
        new_lines.append(line)
    elif "const { cooldownRemaining, startCooldown } = useAICooldown(user);" in line:
        skip = 2
    else:
        new_lines.append(line)

with open('src/vibe-sandbox/VibeStudyRoom.tsx', 'w') as f:
    f.writelines(new_lines)
