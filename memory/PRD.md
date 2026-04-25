# EFCIS LMS — Product Requirements

## Original Problem Statement
Build a modern, responsive Loan Management System (EFCIS LMS — Easy Finance Credit Investigation Services Loan Management System, by Darwin IT Dev). Modern dashboard with green gradient theme #16A34A → #22C55E → #4ADE80. Authentication start page, collapsible sidebar, top navbar with date/time + user avatar. Sidebar: Loan Application, Loan Management, Payments, Forms, Attendance. 7 user roles (admin, field_collector, branch_assistant, branch_manager, verifier, area_manager, releasing_officer). 8-step loan application wizard with photo capture (rear camera + geolocation).

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) at `/api/*`. JWT auth (bcrypt). Collections: `users`, `loan_applications`, `loan_management`, `settings`.
- **Frontend**: React 19 + Tailwind + Shadcn UI + Sonner. Routes under `/login`, `/loan-application`, `/loan-management`, `/payments`, `/forms`, `/attendance`, `/settings`.
- **Photos**: stored as base64 inline in app `data` JSON (with optional location overlay).

## User Personas (Roles)
- Admin — full control, settings (logo upload), schedules releases (Step 7).
- Field Collector — creates applications, fills Steps 1 & 2.
- Branch Assistant — Step 3 processing.
- Branch Manager — Step 4 approval w/ computed proceeds.
- Verifier — Step 5 verification photos.
- Area Manager — Step 6 final approval / rejection.
- Releasing Officer — Step 8 disbursement.

## Status Flow
Draft → New loan → Processed → Reviewed → Verified → Approved | Rejected → Scheduled → Released (Ongoing)

## What's Implemented (2026-02-25)
- JWT auth with 7 seeded test accounts (idempotent).
- Login page with logo (admin can upload), email/password, gradient login.
- Protected app shell: collapsible sidebar, header w/ live clock + user avatar dropdown logout.
- Loan Application page: searchable table (Control No., Date, Collector, Names, Contact, Address, Status, Action), role-aware action button (Add for FC, Continue/Process/Review/Verify/Approval/Schedule/Disbursement for others).
- 8-step wizard modal with all groups, photo capture (real getUserMedia rear camera + Geolocation API + location-blur gating), draft/save flows, dynamic add lists (children, relatives), 60d/80d term selection with auto-calculated proceeds (interest, daily payment, 1% insurance, tiered notarial 150/250/300, released amount), SOA preview by release date.
- Reject (Area Manager) → moves to loan_management as Rejected. Release (Releasing Officer) → moves as Released + Ongoing.
- Loan Management page lists released/rejected.
- Settings page (admin) for logo + system name.
- Empty panels for Payments / Forms / Attendance.
- 21/21 backend tests passing.

## Backlog
**P1**
- Backend hardening: role gating on PUT /loan-applications/{id}, status-transition validation on /release & /reject, FC ownership check on edit.
- Atomic counter for control_no generation.
- Payments module (collections, balances, daily payment marking).
- Forms module (printable contracts, SOA PDF export).
- Attendance module (check-in/out, branch reports).

**P2**
- Dashboard analytics charts (loan portfolio, daily collections, delinquency).
- Multi-branch scoping & branch-level reports.
- Push/email notifications on status transitions.
- Brute-force lockout, password reset flow.
- Object storage (S3) for photos instead of base64.
- Audit log viewer for step_history.

## Next Tasks
1. Backend role gating + transition validation.
2. Payments module MVP.
3. Reports / dashboards.
