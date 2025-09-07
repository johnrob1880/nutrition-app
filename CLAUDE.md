# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack nutrition management application for cattle operations built with:
- **Frontend**: React + TypeScript, Vite, Wouter routing, Tanstack Query, Tailwind CSS
- **Backend**: Express.js, Drizzle ORM with PostgreSQL (Neon)
- **UI Components**: Radix UI primitives with shadcn/ui components

## Common Development Commands

```bash
# Development
npm run dev                  # Start development server (Vite + Express)

# Build & Production
npm run build               # Build client (Vite) and server (esbuild)
npm run start               # Start production server

# Type Checking
npm run check               # Run TypeScript type checking

# Database
npm run db:push             # Push schema changes to database (Drizzle)
```

## Architecture & Key Files

### Database Layer
- **shared/schema.ts**: All database schemas using Drizzle ORM with Zod validation
  - Tables: operations, staffMembers, staffInvitations, pens, feedingRecords, etc.
- **server/db.ts**: Database connection setup with Neon
- **server/storage.ts**: Data access layer with all database operations

### API Layer
- **server/routes.ts**: All API endpoints (RESTful)
- **server/index.ts**: Express server setup with middleware
- Pattern: `/api/*` routes for all backend endpoints

### Frontend Structure
- **client/src/pages/**: Page components (dashboard, pens, feeding, schedules, etc.)
- **client/src/components/ui/**: Reusable UI components (shadcn/ui based)
- **client/src/hooks/**: Custom React hooks (useOperation, useUserAuth, etc.)
- **client/src/lib/**: Utilities and query client setup

### Key Patterns
- Authentication: Email-based operation identification stored in localStorage
- State Management: Tanstack Query for server state
- Routing: Wouter for client-side routing
- Forms: React Hook Form with Zod validation
- Styling: Tailwind CSS with CSS variables for theming

## Environment Variables

Required in `.env`:
```
DATABASE_URL=         # Neon PostgreSQL connection string
SENDGRID_API_KEY=    # SendGrid API key for email invitations
```

## Path Aliases

- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

## Notes

- The app manages cattle feeding operations with pen management, feeding schedules, and staff collaboration
- Email invitations are sent via SendGrid for staff member onboarding
- Operations are identified by operator email (unique constraint)
- Windows environment (path separators are backslash)