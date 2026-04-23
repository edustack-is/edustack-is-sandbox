# EduStack IS – Frontend

React SPA pro školní informační systém.

## Spuštění

```bash
npm install
npm run dev
```

Aplikace: http://localhost:5173 (proxy na backend http://localhost:3000)

## Hlavní příkazy

| Příkaz            | Popis                     |
| ----------------- | ------------------------- |
| `npm run dev`     | Vývoj s HMR               |
| `npm run build`   | Produkční build           |
| `npm run preview` | Náhled produkčního buildu |

## Technologie

- **React 18** + TypeScript
- **Vite** – build a dev server
- **Tailwind CSS** + CSS proměnné (dark mode)
- **shadcn/ui** – komponentová knihovna
- **Lucide** – ikony
- **PWA** – Service Worker, manifest.json

## Struktura

```
src/
├── api/            # API klient (fetch wrappery)
├── components/     # UI komponenty
│   ├── layout/     # MainLayout, Sidebar
│   └── ui/         # shadcn/ui (Button, Dialog, ...)
├── context/        # React kontexty (School, Auth)
├── pages/          # Stránky aplikace
├── hooks/          # Custom hooks
└── lib/            # Utility funkce
```
