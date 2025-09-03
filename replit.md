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
2. **Dashboard**: Real-time operational statistics, key metrics, upcoming schedule changes alerts, and feeding management with "Start Feeding" buttons
3. **Pen Management**: View cattle pen status with detailed weight tracking and cattle type information
4. **Feeding Schedules**: View detailed feeding schedules with comprehensive ingredient breakdowns
5. **Feeding Execution**: Interactive feeding pages where operators can enter actual ingredient amounts and submit feeding records
6. **Operation Settings**: Update operation details and preferences
7. **Weight Tracking**: Update current cattle weights with history maintenance and external system integration

## Recent Changes

- **January 13, 2025**: Added invite code functionality to onboarding process - users must provide a valid invite code that matches their email address to create an operation
- **January 13, 2025**: Updated database schema to include inviteCode field in operations table with validation system
- **January 13, 2025**: Enhanced onboarding form with invite code field as first input, improved error handling for invalid codes
- **January 13, 2025**: Added logout functionality with "Sign Out" button on operation page that clears localStorage and query cache
- **January 13, 2025**: Implemented sample invite codes for testing: RANCH2025 (johnrob1880@gmail.com), CATTLE123 (jane.smith@example.com), FEEDLOT456 (bob.johnson@example.com)
- **January 13, 2025**: Added comprehensive feeding details page showing expected vs actual ingredient amounts with variance indicators (over/under/on-target with color coding and percentage differences)
- **January 13, 2025**: Created clickable "View Details" links on dashboard for completed feeding schedules that navigate to detailed feeding record view
- **January 13, 2025**: Implemented feeding status tracking system that shows completed vs pending feeds on dashboard with visual indicators (green backgrounds and checkmarks for completed feeds)
- **January 13, 2025**: Fixed feeding records API call error by correcting parameter order in apiRequest function call
- **January 13, 2025**: Added cache invalidation for feeding records when feeding is completed to ensure dashboard updates in real-time
- **January 13, 2025**: Enhanced dashboard UI to show feeding completion status with different colors and icons for completed schedules
- **January 13, 2025**: Added tabbed interface to cattle pens page with "Active Pens" and "Sold Cattle" tabs for better organization and data separation
- **January 13, 2025**: Implemented sold cattle overview display with comprehensive sale details including cattle count, final weight, sale price, total revenue, and sale dates
- **January 13, 2025**: Added cattle selling functionality with "Sell" buttons on pens page that opens dialog for final weight, price per hundredweight, and sale date input with live revenue calculation preview
- **January 13, 2025**: Implemented cattle sale backend with CattleSale schema, API endpoints, and pen status updates (sets pen to inactive with 0 cattle after sale)
- **January 13, 2025**: Added nutritionist concept with unique ID, personal name, and business name for external system collaboration
- **January 13, 2025**: Implemented invitation-based nutritionist workflow where nutritionists have "Invited" status that operations can accept to activate collaboration
- **January 13, 2025**: Updated operations page with tabs for operation info and nutritionist management with invitation acceptance functionality
- **January 13, 2025**: Enhanced pen creation to require nutritionist selection from active nutritionists for feed type management
- **January 13, 2025**: Added sample nutritionist invitations for testing with mixed statuses (invited and active)
- **January 13, 2025**: Added feeding plan details page accessible by clicking feed type links on pens page showing comprehensive plan information and complete feeding history with variance analysis
- **January 13, 2025**: Renamed "Nutritionists" tab to "Team" in operation profile and added veterinarians section with mock Dr. Sarah Mitchell card
- **January 13, 2025**: Removed ingredient category badges from schedules page to improve data alignment and visual consistency

## Technical Considerations

- **Mobile Responsiveness**: Bottom navigation and touch-friendly interfaces
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Optimized bundle sizes and lazy loading strategies
- **Type Safety**: End-to-end TypeScript with shared schema validation
- **Accessibility**: ARIA-compliant components from Radix UI foundation