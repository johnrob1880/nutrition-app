# Technical Stack

## Frontend

- **Application Framework:** React 18.3.1
- **JavaScript Framework:** React with TypeScript 5.6.3
- **Build Tool:** Vite 5.4.19
- **Import Strategy:** node
- **CSS Framework:** Tailwind CSS 3.4.17
- **UI Component Library:** Radix UI primitives with shadcn/ui patterns
- **Fonts Provider:** System fonts with Tailwind defaults
- **Icon Library:** Lucide React 0.453.0

## Backend

- **Application Framework:** Express.js 4.21.2
- **Runtime:** Node.js with TypeScript 5.6.3
- **Database System:** PostgreSQL with Neon serverless
- **ORM:** Drizzle ORM 0.39.1
- **Validation:** Zod 3.24.2
- **Session Management:** express-session with connect-pg-simple

## State Management & Communication

- **Server State:** TanStack Query 5.60.5
- **Forms:** React Hook Form 7.55.0 with Zod validation
- **Routing:** Wouter 3.3.5
- **Real-time Communication:** WebSocket (ws 8.18.0)

## Development & Build

- **Package Manager:** npm
- **Bundler (Frontend):** Vite 5.4.19
- **Bundler (Backend):** ESBuild 0.25.0
- **Type Checking:** TypeScript 5.6.3
- **Development Server:** tsx 4.19.1
- **CSS Processing:** PostCSS 8.4.47 with Autoprefixer 10.4.20

## Authentication & Security

- **Authentication Strategy:** Passport.js 0.7.0 with passport-local
- **Session Storage:** PostgreSQL via connect-pg-simple
- **Email Service:** SendGrid 8.1.5

## Database & Migration

- **Database Hosting:** Neon PostgreSQL (serverless)
- **Migration Tool:** Drizzle Kit 0.30.4
- **Schema Management:** Drizzle ORM with TypeScript schema definitions

## Deployment & Hosting

- **Application Hosting:** TBD (prepared for Node.js deployment)
- **Database Hosting:** Neon PostgreSQL
- **Asset Hosting:** Express static file serving
- **Deployment Solution:** Standard Node.js deployment

## Code Repository

- **Code Repository URL:** https://github.com/[organization]/nutrition-app (TBD)

## Additional Libraries

- **Date Handling:** date-fns 3.6.0
- **UI Components:** 
  - Framer Motion 11.13.1 (animations)
  - Recharts 2.15.2 (data visualization)
  - React Day Picker 8.10.1 (date selection)
  - Embla Carousel React 8.6.0 (carousels)
  - Vaul 1.1.2 (drawer components)
- **Utilities:**
  - class-variance-authority 0.7.1
  - clsx 2.1.1
  - tailwind-merge 2.6.0
  - memoizee 0.4.17

## Environment Configuration

- **Environment Management:** dotenv 17.2.2
- **Cross-platform Scripts:** cross-env 10.0.0
- **Development:** Node.js development mode with hot reload
- **Production:** Optimized builds with static asset serving