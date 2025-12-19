# Prepwise - AI Interview Preparation Platform

## Overview
Prepwise is a job interview preparation platform powered by Vapi AI Voice agents. Built with Next.js, Firebase for authentication and data storage, and styled with TailwindCSS.

## Project Structure
- `app/` - Next.js App Router pages
  - `(auth)/` - Authentication pages (sign-in, sign-up)
  - `(root)/` - Main application pages (dashboard, interviews)
  - `api/` - API routes
- `components/` - Reusable React components
- `firebase/` - Firebase client and admin configuration
- `lib/` - Utility functions and server actions
- `constants/` - Application constants
- `types/` - TypeScript type definitions
- `public/` - Static assets

## Tech Stack
- Next.js 15 with App Router
- Firebase (Authentication & Firestore)
- Vapi AI for voice interviews
- Google Gemini for AI feedback
- TailwindCSS for styling
- shadcn/ui components

## Required Environment Variables
The following environment variables must be configured:

### Firebase Client (public)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Firebase Admin (server-side)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (or `FIREBASE_PRIVATE_KEY_BASE64` or `FIREBASE_SERVICE_ACCOUNT`)

### Vapi AI
- `NEXT_PUBLIC_VAPI_WEB_TOKEN`
- `NEXT_PUBLIC_VAPI_WORKFLOW_ID`

### Google AI
- `GOOGLE_GENERATIVE_AI_API_KEY`

### Application
- `NEXT_PUBLIC_BASE_URL`

## Running the Application
- Development: `npm run dev:cloud` (runs on port 5000)
- Production: `npm run start:production`

## Deployment
Configured for autoscale deployment with:
- Build command: `npm run build`
- Run command: `npm run start:production`
