"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { Notification, NotificationStatus } from "@prisma/client";

// API response types
interface NotificationsListResponse {
    ok: true;
    data: {
        notifications: Notification[];
        hasMore: boolean;
        nextCursor: string | null;
    };
}

interface NotificationResponse {
    ok: true;
    data: Notification;
}

interface ApiError {
    ok: false;
    error: {
        code: string;
        message: string;
    };
}

// Context type for optimistic mutations
interface MutationContext {
    previousUnread: NotificationsListResponse | undefined;
    previousPast: unknown;
}

// Get auth token from storage (adjust based on your auth setup)
function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("apiKey") || null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = getAuthToken();
    if (!token) {
        throw new Error("Not authenticated");
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...options.headers
        }
    });

    return response.json();
}

/**
 * Fetch unread notifications
 */
export function useUnreadNotifications() {
    return useQuery<NotificationsListResponse, Error>({
        queryKey: ["notifications", "unread"],
        queryFn: () => fetchWithAuth("/api/notifications?status=UNREAD"),
        staleTime: 30_000 // 30 seconds
    });
}

/**
 * Infinite query for past (read) notifications
 * Only fetches when enabled (when section is expanded)
 */
export function usePastNotifications(enabled: boolean) {
    return useInfiniteQuery<NotificationsListResponse, Error>({
        queryKey: ["notifications", "past"],
        queryFn: ({ pageParam }) => {
            const url = pageParam
                ? `/api/notifications?status=READ&cursor=${pageParam}`
                : "/api/notifications?status=READ";
            return fetchWithAuth(url);
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.data.nextCursor,
        enabled,
        staleTime: 60_000 // 1 minute
    });
}

/**
 * Get unread notifications count
 */
export function useUnreadCount() {
    const { data } = useUnreadNotifications();
    return data?.data?.notifications?.length ?? 0;
}

/**
 * Mark notification as read with optimistic update
 */
export function useMarkRead() {
    const queryClient = useQueryClient();

    return useMutation<NotificationResponse, Error, string, MutationContext>({
        mutationFn: async (notificationId: string) => {
            return fetchWithAuth(`/api/notifications/${notificationId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "READ" })
            });
        },
        onMutate: async (notificationId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["notifications"] });

            // Snapshot current state
            const previousUnread = queryClient.getQueryData<NotificationsListResponse>(["notifications", "unread"]);
            const previousPast = queryClient.getQueryData(["notifications", "past"]);

            // Optimistically update unread list (remove the notification)
            queryClient.setQueryData<NotificationsListResponse>(
                ["notifications", "unread"],
                (old) => {
                    if (!old) return old;
                    const notification = old.data.notifications.find(n => n.id === notificationId);
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            notifications: old.data.notifications.filter(n => n.id !== notificationId)
                        }
                    };
                }
            );

            return { previousUnread, previousPast };
        },
        onError: (_err, _id, context) => {
            // Rollback on error
            if (context?.previousUnread) {
                queryClient.setQueryData(["notifications", "unread"], context.previousUnread);
            }
            if (context?.previousPast) {
                queryClient.setQueryData(["notifications", "past"], context.previousPast);
            }
        },
        onSettled: () => {
            // Invalidate to ensure consistency
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });
}

/**
 * Mark notification as unread with optimistic update
 */
export function useMarkUnread() {
    const queryClient = useQueryClient();

    return useMutation<NotificationResponse, Error, string, MutationContext>({
        mutationFn: async (notificationId: string) => {
            return fetchWithAuth(`/api/notifications/${notificationId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "UNREAD" })
            });
        },
        onMutate: async (notificationId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["notifications"] });

            // Snapshot current state
            const previousUnread = queryClient.getQueryData<NotificationsListResponse>(["notifications", "unread"]);
            const previousPast = queryClient.getQueryData(["notifications", "past"]);

            return { previousUnread, previousPast };
        },
        onError: (_err, _id, context) => {
            // Rollback on error
            if (context?.previousUnread) {
                queryClient.setQueryData(["notifications", "unread"], context.previousUnread);
            }
            if (context?.previousPast) {
                queryClient.setQueryData(["notifications", "past"], context.previousPast);
            }
        },
        onSettled: () => {
            // Invalidate to ensure consistency
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });
}
