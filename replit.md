# Overview

This is a vendor deal optimization application that helps retail buyers score and rank vendor deals for weekly ad planning. The system ingests deal files (CSV, XLSX, PDF, PPTX), canonicalizes them into standardized deal records, applies a deterministic scoring engine with six components (margin, velocity, funding, theme, timing, competitive), and provides explanations and exportable results. The application follows a week-centric workflow where deals are processed for specific ad weeks and can be exported as pick lists for buyers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React + Vite** setup with TypeScript for the client application
- **Shadcn/ui components** with Radix UI primitives for consistent UI design
- **Tailwind CSS** for styling with a dark theme configuration
- **TanStack Query** for server state management and API calls
- **Wouter** for client-side routing
- **Component-based architecture** with reusable UI components and page-specific components

## Backend Architecture
- **Express.js server** with TypeScript running on Node.js
- **RESTful API design** with routes for weeks, documents, deals, scoring, and exports
- **Service layer pattern** with separate services for parsing, scoring, AI, and export functionality
- **Multer middleware** for handling file uploads with storage configuration
- **Database abstraction layer** through a storage interface for flexibility

## Data Storage
- **Drizzle ORM** for database operations with PostgreSQL as the primary dialect
- **SQLite fallback** for development environments when PostgreSQL is unavailable
- **Schema-first approach** with shared TypeScript types between client and server
- **Migration system** using Drizzle Kit for database schema changes

## Database Schema
- **AdWeeks table** - Manages weekly ad cycles with status tracking
- **SourceDocs table** - Stores uploaded file metadata and parsing information
- **DealRows table** - Canonical deal data with pricing, department, and vendor information
- **Scores table** - Computed scores with component breakdown and reasoning
- **ExportHistory table** - Tracks export operations and file generation

## Authentication and Authorization
- Currently uses basic session-based approach (evidenced by session configuration in dependencies)
- No complex role-based access control implemented in the current architecture

## External Dependencies

### Database Systems
- **PostgreSQL** - Primary database using Neon serverless connection
- **SQLite with better-sqlite3** - Development fallback database
- **WebSocket support** for real-time database connections

### AI/ML Services
- **Anthropic Claude** - AI service for document parsing and deal extraction
- **Provider-agnostic AI interface** - Abstracted to support multiple AI providers
- **Feature-flagged AI functionality** - Can operate without AI services enabled

### File Processing
- **XLSX parsing** - Excel spreadsheet processing for vendor planners
- **CSV parsing** - Comma-separated value file support
- **PDF processing** - Document parsing for group buy sheets
- **PPTX processing** - PowerPoint presentation parsing for sales plans

### UI Framework Integration
- **Radix UI primitives** - Comprehensive set of accessible UI components
- **Lucide React icons** - Icon library for consistent visual elements
- **Class Variance Authority** - Utility for managing component variants
- **TanStack Query** - Server state synchronization and caching

### Development Tools
- **Vite** - Fast development server and build tool
- **TypeScript** - Type safety across the entire application
- **ESBuild** - Fast JavaScript bundling for production builds
- **Replit-specific plugins** - Integration tools for Replit deployment environment