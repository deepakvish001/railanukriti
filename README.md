# RailAnukriti

> AI-assisted railway traffic optimisation and decision-support dashboard for section controllers.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)

RailAnukriti provides real-time train visibility, conflict analysis, delay predictions, operational recommendations, simulation tools and auditable controller actions. It is designed as decision support: safety-critical decisions remain with authorised railway personnel.

## Core modules

| Module | Purpose |
| --- | --- |
| Dashboard | Section status, occupancy and operational overview |
| Recommendations | Explainable precedence and crossing suggestions |
| Conflicts | Detect and prioritise incompatible movements |
| Predictions | Surface delay and congestion risk |
| Schedule | Compare planned and actual train movement |
| Simulation | Evaluate what-if operational scenarios |
| Infrastructure | Model capacity and infrastructure changes |
| Freight analysis | Review freight paths, throughput and stoppages |
| Audit | Preserve controller action history |
| Export | Produce controlled operational reports |

## Technology

- React 18 and TypeScript
- Vite and SWC
- Tailwind CSS and shadcn/ui
- TanStack Query
- Supabase authentication and database
- Mapbox GL for geographic views
- Recharts for operational analytics
- Framer Motion for interface transitions

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- A Supabase project
- A Mapbox token when map features are enabled

## Local setup

1. Clone the repository.

   ```bash
   git clone https://github.com/deepakvish001/railanukriti.git
   cd railanukriti
   ```

2. Install dependencies.

   ```bash
   npm ci
   ```

3. Create the local environment file.

   ```bash
   cp .env.example .env
   ```

4. Add the required public client configuration.

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   VITE_MAPBOX_TOKEN=your-mapbox-token
   ```

5. Start the development server.

   ```bash
   npm run dev
   ```

6. Open [http://localhost:8080](http://localhost:8080).

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Build with development mode settings |
| `npm run lint` | Run static analysis |
| `npm run preview` | Preview the production build |

## Application structure

```text
src/
├── components/       reusable interface and dashboard modules
├── hooks/            authentication, sound and shared React behaviour
├── integrations/     Supabase and external service clients
├── pages/            routed dashboard screens
├── services/         operational and data-processing logic
└── types/            shared TypeScript domain contracts
supabase/
├── functions/        server-side edge functions
└── migrations/       database schema history
```

## Security

- Use only the Supabase anonymous publishable key in the browser.
- Never commit service-role keys, provider secrets or production datasets.
- Enforce row-level security for every client-accessible table.
- Authorise operations on the server; hiding a control is not access control.
- Treat train, route and controller data according to its operational classification.

## Quality checks

Before opening a pull request:

```bash
npm ci
npm run lint
npm run build
```

Add focused tests for domain logic and manually verify the affected dashboard flow.

## Deployment

Build with environment variables supplied by the deployment platform:

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory behind HTTPS. Configure single-page application fallback to `index.html` and restrict production environment access.

## Operational disclaimer

RailAnukriti is a prototype decision-support system. Recommendations, predictions and simulations must not be treated as signalling authority or replace certified railway safety procedures.

## Contributing

Keep pull requests focused, document operational assumptions and include validation evidence. Security-sensitive reports should be disclosed privately.

## License

This repository currently identifies the project as proprietary software. Obtain explicit permission before reuse or redistribution.
