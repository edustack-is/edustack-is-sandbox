# EduStack Design Exports

Screen designs exported from Pencil (.pen) for use with AI CLI tools (Gemini CLI, Claude Code, etc.).

## Directory Structure

```
source/
├── screens/       # 37 app screen designs (PNG, 2x)
├── roles/         # 6 role-themed dashboard screens (PNG, 2x)
├── components/    # 12 reusable UI components (PNG, 2x)
└── SCREEN_MAP.md  # File-to-screen name mapping
```

## Usage with Gemini CLI

### Reference a single screen

```bash
gemini -f screens/iDPgD.png "Implement this Users management screen in React with Tailwind CSS"
```

### Reference multiple screens

```bash
gemini -f screens/riCaE.png -f screens/vqTji.png "Implement these two screens sharing common layout patterns"
```

### Reference components + screen

```bash
gemini -f components/v7qjLh.png -f components/Ojbbm.png -f screens/iDPgD.png \
  "Here are the Sidebar and TopBar components. Implement the Users screen using these shared components."
```

### Full design system context

```bash
gemini -f SCREEN_MAP.md -f components/*.png \
  "These are our design system components. Generate a shared component library in React + Tailwind."
```

### Role-themed screens

```bash
gemini -f roles/*.png \
  "Each role has a unique color theme and border. Implement a ThemeProvider that switches colors based on user role."
```
