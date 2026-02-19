# EduStack IS – Backend

NestJS REST API pro školní informační systém.

## Spuštění

Backend běží v Docker kontejneru (viz kořenový `docker-compose.yml`). Pro lokální vývoj bez Dockeru:

```bash
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Vyžaduje běžící PostgreSQL s `DATABASE_URL` v `.env`.

## API dokumentace

Swagger UI je dostupný na `/api/docs` (pouze v non-production režimu).

## Hlavní příkazy

| Příkaz | Popis |
|--------|-------|
| `npm run start:dev` | Vývoj s hot reload |
| `npm run build` | Produkční build |
| `npm run start:prod` | Produkční spuštění |
| `npx prisma studio` | GUI pro databázi |
| `npx prisma db push` | Synchronizace schématu |

## Adresářová struktura

```
src/
├── auth/           # JWT, SSO, guards, decorators
├── prisma/         # PrismaService, PrismaModule
├── init/           # Prvotní setup systému
├── users/          # Správa uživatelů
├── registry/       # Matrika – třídy, profily
├── grading/        # Klasifikace, vysvědčení
├── schedule/       # Rozvrh, suplování
├── attendance/     # Docházka
├── classbook/      # Třídní kniha
├── messaging/      # Zprávy, nástěnka
├── community/      # Události, kalendář
├── ai/             # AI funkce
├── export/         # CSV/XML/JSON export
├── reports/        # Statistiky, výkazy ČŠI/MŠMT
├── gdpr/           # GDPR export/smazání dat
├── deputy/         # Správa školy
├── principal/      # Ředitel – audit
├── system-admin/   # Systémová správa, zálohy
└── utils/          # Sdílené utility
```
