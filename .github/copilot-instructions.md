# Copilot Instructions for InventoryTW

## Project Overview
- **InventoryTW** is a Next.js 14 + AWS Amplify inventory management system for TRACTO AGRÍCOLA.
- Major features: multi-warehouse stock, product groups, transaction documents, full audit (Kardex), user roles, and valuation reports.
- Backend: AWS Amplify (GraphQL, DynamoDB). Frontend: Next.js, Tailwind CSS, Radix UI.

## Architecture & Key Patterns
- **Amplify Integration**: All backend logic and data access use Amplify. See `amplify/` for config and models.
- **Server Actions**: Located in `src/actions/`, grouped by domain (auth, users, products, documents, kardex). Always use Amplify APIs for data.
- **Services Layer**: Centralized business logic in `src/services/` (e.g., `auth-service.ts`, `inventory-service.ts`).
- **React Components**: UI in `src/components/`, with Radix UI primitives in `ui/`. Layout and dashboard components are in their respective folders.
- **Pages**: Next.js pages in `src/app/`, organized by feature (login, dashboard, products, documents, kardex, settings).
- **Data Migration**: Scripts in `src/scripts/` for importing/migrating data. Use Amplify for all new data operations.

## Developer Workflow
- **Install**: `pnpm install`
- **Amplify Setup**: `npx ampx sandbox` (required before running dev)
- **Run Dev**: `pnpm run dev`
- **Environment**: Copy `.env.example` to `.env.local` and set required keys (see README_PROYECTO.md)
- **Feature Branches**: Use `git checkout -b feature/<name>`
- **Documentation**: Update docs in `ANALISIS_COMPLETO.md`, `PLAN_MODULOS.md`, `RECOMENDACIONES.md` as needed.

## Conventions & Patterns
- **NoSQL Models**: Defined in `amplify/data/resource.ts` (30+ models). Always use these for new entities.
- **Amplify Client**: Use `amplifyClient` from `src/lib/amplify-config.ts` for all backend calls.
- **Validation**: Use Zod for schema validation. See usage in actions/services.
- **Forms**: Use React Hook Form for UI forms.
- **Tables/Charts**: Use TanStack Table and Recharts for data display.
- **Error Handling**: Prefer returning structured error objects from actions/services.
- **Testing**: No formal tests yet; follow patterns in `PLAN_MODULOS.md` for manual validation.

## Common Issues
- If you see "Module not found: Can't resolve '@/lib/db-connection'", switch to Amplify (`amplifyClient`).
- If Amplify fails to initialize, run `npx ampx sandbox` and check env vars.
- For port conflicts, run `pnpm run dev -- -p 3001`.

## Key References
- `README_PROYECTO.md`: Full architecture, setup, and workflow details
- `ANALISIS_COMPLETO.md`: Deep technical analysis
- `PLAN_MODULOS.md`: Implementation plan
- `RECOMENDACIONES.md`: Best practices and improvements

---
_Last updated: January 9, 2026_
