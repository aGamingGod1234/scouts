import { z } from "zod";
import {
  AllocationStatus,
  EventCategory,
  EventStatus,
  EventTargetType,
  GroupType,
  MessageStatus,
  NotificationStatus,
  NotificationType,
  ResourceType,
  Role,
  TaskStatus
} from "@prisma/client";

const dateTime = z.string().datetime().transform((value) => new Date(value));

export const idSchema = z.string().uuid();
export const emailSchema = z.string().email().max(255);
export const nameSchema = z.string().min(1).max(120);
export const textSchema = z.string().min(1).max(4000);
export const roleSchema = z.nativeEnum(Role);
export const taskStatusSchema = z.nativeEnum(TaskStatus);
export const eventStatusSchema = z.nativeEnum(EventStatus);
export const eventCategorySchema = z.nativeEnum(EventCategory);
export const eventTargetTypeSchema = z.nativeEnum(EventTargetType);
export const groupTypeSchema = z.nativeEnum(GroupType);
export const notificationStatusSchema = z.nativeEnum(NotificationStatus);
export const notificationTypeSchema = z.nativeEnum(NotificationType);
export const messageStatusSchema = z.nativeEnum(MessageStatus);
export const allocationStatusSchema = z.nativeEnum(AllocationStatus);
export const resourceTypeSchema = z.nativeEnum(ResourceType);

// Deeplink validation: must be internal route, no protocol injection
export const deeplinkSchema = z.string()
  .max(500)
  .regex(/^\/[a-zA-Z0-9/_-]*$/)
  .optional();

export const listPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const listUsersSchema = listPaginationSchema.extend({
  orderBy: z.enum(["createdAt", "score"]).optional(),
  direction: z.enum(["asc", "desc"]).optional()
});

export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: z.string().min(8).max(200),
  role: roleSchema.optional(),
  score: z.coerce.number().int().min(0).optional()
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  password: z.string().min(8).max(200).optional(),
  role: roleSchema.optional(),
  score: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

export const listTasksSchema = listPaginationSchema.extend({
  assigneeId: idSchema.optional(),
  status: taskStatusSchema.optional(),
  from: dateTime.optional(),
  to: dateTime.optional()
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: taskStatusSchema.optional(),
  assigneeId: idSchema.optional(),
  dueDate: dateTime.optional()
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: taskStatusSchema.optional(),
  assigneeId: idSchema.optional(),
  dueDate: dateTime.optional()
});

export const listEventsSchema = listPaginationSchema.extend({
  assigneeId: idSchema.optional(),
  targetUserId: idSchema.optional(),
  targetRole: roleSchema.optional(),
  targetGroupId: idSchema.optional(),
  targetType: eventTargetTypeSchema.optional(),
  status: eventStatusSchema.optional(),
  from: dateTime.optional(),
  to: dateTime.optional()
});

export const eventTargetSchema = z.object({
  type: eventTargetTypeSchema,
  userId: idSchema.optional(),
  role: roleSchema.optional(),
  groupId: idSchema.optional()
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: eventStatusSchema.optional(),
  category: eventCategorySchema.optional(),
  targets: z.array(eventTargetSchema).min(1),
  startsAt: dateTime,
  endsAt: dateTime.optional(),
  location: z.string().max(200).optional()
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: eventStatusSchema.optional(),
  category: eventCategorySchema.optional(),
  targets: z.array(eventTargetSchema).min(1).optional(),
  startsAt: dateTime.optional(),
  endsAt: dateTime.optional(),
  location: z.string().max(200).optional()
});

export const listAnnouncementsSchema = listPaginationSchema;

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: textSchema,
  publishedAt: dateTime.optional()
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: textSchema.optional(),
  publishedAt: dateTime.optional()
});

export const listNotificationsSchema = listPaginationSchema.extend({
  userId: idSchema.optional(),
  status: notificationStatusSchema.optional(),
  cursor: idSchema.optional() // For cursor-based pagination on past notifications
});

export const createNotificationSchema = z.object({
  userId: idSchema,
  title: z.string().min(1).max(200),
  body: textSchema,
  type: notificationTypeSchema.optional(),
  deeplink: deeplinkSchema,
  status: notificationStatusSchema.optional(),
  readAt: dateTime.optional()
});

export const updateNotificationSchema = z.object({
  status: notificationStatusSchema.optional(),
  readAt: dateTime.optional()
});

// Schema for mark read/unread endpoint
export const markNotificationStatusSchema = z.object({
  status: notificationStatusSchema
});

export const listMessagesSchema = listPaginationSchema.extend({
  conversationWith: idSchema.optional(),
  status: messageStatusSchema.optional()
});

export const createMessageSchema = z.object({
  recipientId: idSchema,
  body: textSchema
});

export const updateMessageSchema = z.object({
  status: messageStatusSchema.optional(),
  readAt: dateTime.optional()
});

export const createTeacherSettingsSchema = z.object({
  userId: idSchema,
  settings: z.unknown()
});

export const updateTeacherSettingsSchema = z.object({
  settings: z.unknown()
});

export const listAllocationsSchema = listPaginationSchema.extend({
  userId: idSchema.optional(),
  resourceId: idSchema.optional(),
  status: allocationStatusSchema.optional()
});

export const createAllocationSchema = z.object({
  userId: idSchema,
  resourceId: idSchema,
  startsAt: dateTime,
  endsAt: dateTime.optional(),
  status: allocationStatusSchema.optional()
});

export const updateAllocationSchema = z.object({
  startsAt: dateTime.optional(),
  endsAt: dateTime.optional(),
  status: allocationStatusSchema.optional()
});

export const listResourcesSchema = listPaginationSchema.extend({
  type: resourceTypeSchema.optional()
});

export const listGroupsSchema = listPaginationSchema.extend({
  type: groupTypeSchema.optional()
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  type: groupTypeSchema
});

export const createResourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: resourceTypeSchema,
  url: z.string().url().optional(),
  metadata: z.unknown().optional()
});

export const updateResourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: resourceTypeSchema.optional(),
  url: z.string().url().optional(),
  metadata: z.unknown().optional()
});

export const listApiKeysSchema = listPaginationSchema.extend({
  userId: idSchema.optional()
});

export const createApiKeySchema = z.object({
  userId: idSchema,
  label: z.string().min(1).max(200)
});

export const listCalendarSchema = listPaginationSchema.extend({
  from: dateTime.optional(),
  to: dateTime.optional()
});

export const plcSummaryRequestSchema = z.object({
  meetingTitle: z.string().min(1).max(200).optional(),
  transcript: z.string().min(1).max(20000),
  focus: z.string().max(400).optional()
});

export const plcSummaryResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  actionItems: z.array(z.string().min(1).max(200)).max(20)
});

export const announcementGenerateRequestSchema = z.object({
  topic: z.string().min(1).max(200),
  audience: z.string().max(120).optional(),
  tone: z.enum(["formal", "friendly", "urgent", "celebratory", "neutral"]).optional(),
  details: z.string().max(2000).optional(),
  length: z.enum(["short", "medium", "long"]).optional()
});

export const announcementGenerateResponseSchema = z.object({
  title: z.string().min(1).max(200),
  body: textSchema
});

export const nameParseRequestSchema = z.object({
  fullName: z.string().min(1).max(200)
});

export const nameParseResponseSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  middleName: z.string().max(120).optional(),
  suffix: z.string().max(50).optional()
});
