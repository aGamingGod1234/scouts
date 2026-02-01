# Guidelines - Development History

## 2026-01-31: Notifications UX Implementation

### Prompt Summary
Implement notifications popup behavior with:
- Deep links for navigation
- Read/unread state persisted to PostgreSQL
- "Past notifications" collapsible section
- Optimistic UI with rollback on failure

### Changes Made

#### Database Schema (`prisma/schema.prisma`)
- FROM: `Notification` model with `status`, `readAt` fields only
- TO: Added `NotificationType` enum (`TASK`, `EVENT`, `ANNOUNCEMENT`, `MEET`, `MESSAGE`, `SYSTEM`) and `deeplink` field. Updated index to include `status`.

#### Zod Schemas (`src/lib/schemas.ts`)
- FROM: Basic `listNotificationsSchema` without cursor pagination
- TO: Added `notificationTypeSchema`, `deeplinkSchema`, cursor-based pagination (`cursor` field), `markNotificationStatusSchema`

#### RBAC (`src/lib/rbac.ts`)
- FROM: Students had `["read"]` permission for notifications
- TO: Students now have `["read", "write"]` permission (to mark their own notifications)

#### API Endpoints
- NEW: `PATCH /api/notifications/[id]/status` - Idempotent mark read/unread
- MODIFIED: `GET /api/notifications` - Added cursor-based pagination, `hasMore`, `nextCursor` response fields

#### Security
- NEW: `src/lib/deeplink.ts` - Validates deeplinks to prevent open redirects

#### Frontend
- NEW: `src/app/hooks/useNotifications.ts` - TanStack Query hooks with optimistic updates
- NEW: `src/app/components/NotificationsPopup.tsx` - Full notification popup component

### Design Decisions
1. Combined read/unread into single `/status` endpoint (idempotent)
2. Cursor-based pagination for past notifications (scalable for large datasets)
3. Optimistic UI with rollback pattern (better UX)
4. Deeplink allowlist approach (security by default)
