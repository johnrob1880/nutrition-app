# Spec Requirements Document

> Spec: Consultant Registration and Profiles
> Created: 2025-09-07

## Overview

Implement a unified user authentication system with username/password and JWT tokens, supporting multiple user types (consultant, producer, staff) to enable nutrition and veterinary consultants to create professional profiles and connect with cattle producers. This feature establishes the foundation for the consultant platform, allowing consultants to manage their credentials and invite producers to collaborate.

## User Stories

### Consultant Registration and Profile Setup

As a cattle nutrition or veterinary consultant, I want to register for an account and create my professional profile, so that I can establish my presence on the platform and begin inviting producer clients.

The consultant navigates to the registration page, enters their username, email, password, and basic information including their specialization (nutritionist or veterinarian). After email verification, they access their dashboard to complete their profile with a credentials summary. The system generates a JWT token for authenticated sessions, and the consultant can immediately begin inviting producers via email.

### Producer Invitation and Connection

As a consultant, I want to invite my producer clients by email, so that I can manage their nutrition programs through the platform.

From the consultant dashboard, the consultant enters a producer's email address to send an invitation. The producer receives an email with a link to accept the invitation and create their account (converting from email-only to username/password authentication). Once accepted, the consultant gains access to manage that producer's operation data, with the producer retaining ownership and control permissions.

### Unified Authentication Migration

As an existing producer using email-only authentication, I want to seamlessly transition to username/password authentication when accepting a consultant invitation, so that I can access both my existing data and new consultant features.

When a producer with an existing email-based account accepts a consultant invitation, they are prompted to create a username and password. The system links their new credentials to their existing operation data, maintaining all historical records and settings while enabling the new authentication features.

## Spec Scope

1. **Unified Authentication System** - JWT-based authentication supporting username/password for all user types (consultant, producer, staff)
2. **Consultant Registration Flow** - Multi-step registration with email verification and profile creation
3. **Professional Profile Management** - Consultant profiles with specialization (nutritionist/veterinarian), credentials text field and contact information
4. **Producer Invitation System** - Email-based invitation workflow for consultants to connect with producers
5. **User Type Management** - Database schema and API support for differentiating user types and permissions

## Out of Scope

- Public consultant directory or search functionality
- Complex certification verification systems
- Payment processing for consultant services
- Advanced analytics or reporting features
- Mobile application development
- Third-party OAuth providers (Google, Facebook, etc.)

## Expected Deliverable

1. Functional consultant registration with email verification, accessible at /consultant/register
2. JWT-based authentication system working for consultants with secure token management
3. Consultant dashboard showing profile information and ability to invite producers via email