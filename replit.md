# CattleNutrition Pro - Replit Project Guide

## Overview

CattleNutrition Pro is a full-stack web application designed for managing cattle feeding operations. The application provides a mobile-first interface for cattle operators to manage pens, feeding schedules, and monitor operational statistics. It follows a modern monorepo structure with separate frontend and backend concerns while sharing common schemas.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo architecture with clear separation of concerns:

- **Frontend**: React-based Single Page Application (SPA) using Vite
- **Backend**: Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM
- **Shared**: Common TypeScript schemas and types
- **UI Framework**: shadcn/ui with Tailwind CSS

### Directory Structure

```
├── client/                 # Frontend React application
├── server/                 # Backend Express.js API
├── shared/                 # Shared schemas and types
├── migrations/             # Database migration files
└── dist/                   # Build output directory
```

## Key Components

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling and development server
- Wouter for client-side routing
- TanStack Query for server state management
- React Hook Form with Zod validation
- shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling

**Key Design Decisions:**
- Mobile-first responsive design approach
- Component-based architecture with reusable UI components
- Form validation using Zod schemas shared between client and server
- Optimistic updates and caching with TanStack Query
- Bottom navigation for mobile user experience

### Backend Architecture

**Technology Stack:**
- Express.js with TypeScript
- Drizzle ORM for database operations
- Neon PostgreSQL as the database provider
- Zod for runtime type validation
- ESM module system

**Key Design Decisions:**
- RESTful API design with clear resource endpoints
- Middleware-based error handling and logging
- In-memory storage implementation for development/testing
- Separation of storage interface from implementation details
- Environment-based configuration management

### Database Schema

**Current Schema:**
- `operations` table: Core business entity storing operation details
- Uses PostgreSQL with Drizzle ORM for type-safe database operations
- Auto-generated TypeScript types from schema definitions

**External Data Integration:**
- Simulated external systems for pen management and feeding schedules
- Dashboard statistics aggregated from multiple data sources
- Read-only interfaces for external system data

## Data Flow

1. **User Authentication**: Email-based operation identification
2. **Operation Management**: CRUD operations for cattle operation setup
3. **Data Retrieval**: External system integration for real-time operational data
4. **State Management**: Client-side caching with server synchronization
5. **Form Handling**: Validated form submissions with optimistic updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form state management
- **zod**: Runtime type validation

### Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Backend bundling for production

### UI Components
- Complete shadcn/ui component library implementation
- Customized design tokens and CSS variables
- Responsive breakpoints and mobile-optimized components

## Deployment Strategy

**Development Environment:**
- Vite development server for frontend with HMR
- tsx for TypeScript execution in development
- Integrated development experience with shared types

**Production Build:**
- Frontend: Vite production build to `dist/public`
- Backend: ESBuild bundle to `dist/index.js`
- Static file serving from Express in production
- Environment variable configuration for database connections

**Database Management:**
- Drizzle Kit for schema migrations
- PostgreSQL database provisioning via environment variables
- Development and production database separation

## Key Features

1. **Operation Onboarding**: Initial setup flow for new cattle operations
2. **Dashboard**: Real-time operational statistics and key metrics
3. **Pen Management**: View and monitor individual cattle pen status
4. **Feeding Schedules**: Manage and track feeding schedules across pens
5. **Operation Settings**: Update operation details and preferences

## Technical Considerations

- **Mobile Responsiveness**: Bottom navigation and touch-friendly interfaces
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Optimized bundle sizes and lazy loading strategies
- **Type Safety**: End-to-end TypeScript with shared schema validation
- **Accessibility**: ARIA-compliant components from Radix UI foundation