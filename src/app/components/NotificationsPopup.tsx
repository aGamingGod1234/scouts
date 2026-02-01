"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@prisma/client";
import {
    useUnreadNotifications,
    usePastNotifications,
    useMarkRead,
    useMarkUnread
} from "../hooks/useNotifications";
import { safeNavigate } from "@/lib/deeplink";

// Notification type icons
const TYPE_ICONS: Record<string, string> = {
    TASK: "📋",
    EVENT: "📅",
    ANNOUNCEMENT: "📢",
    MEET: "🎥",
    MESSAGE: "💬",
    SYSTEM: "🔔"
};

interface NotificationsPopupProps {
    onClose?: () => void;
}

export default function NotificationsPopup({ onClose }: NotificationsPopupProps) {
    const router = useRouter();
    const [isPastExpanded, setIsPastExpanded] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Queries
    const { data: unreadData, isLoading: unreadLoading, error: unreadError } = useUnreadNotifications();
    const {
        data: pastData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: pastLoading
    } = usePastNotifications(isPastExpanded);

    // Mutations
    const markRead = useMarkRead();
    const markUnread = useMarkUnread();

    const unreadNotifications = unreadData?.data?.notifications ?? [];
    const pastNotifications = pastData?.pages?.flatMap(page => page.data.notifications) ?? [];

    // Handle scroll for infinite loading
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || !hasNextPage || isFetchingNextPage) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight - scrollTop - clientHeight < 100) {
            fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    // Handle notification click - navigate to deeplink
    const handleNotificationClick = useCallback((notification: Notification) => {
        const navigated = safeNavigate(notification.deeplink, router);
        if (navigated && onClose) {
            onClose();
        }
    }, [router, onClose]);

    // Handle mark as read (X button on unread)
    const handleMarkRead = useCallback((e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation(); // Prevent navigation
        markRead.mutate(notificationId);
    }, [markRead]);

    // Handle mark as unread (↩ button on past)
    const handleMarkUnread = useCallback((e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation(); // Prevent navigation
        markUnread.mutate(notificationId);
    }, [markUnread]);

    // Toggle past section
    const togglePastSection = useCallback(() => {
        setIsPastExpanded(prev => !prev);
    }, []);

    // Render a notification row
    const renderNotificationRow = (notification: Notification, isUnread: boolean) => {
        const icon = TYPE_ICONS[notification.type] || TYPE_ICONS.SYSTEM;
        const hasDeeplink = Boolean(notification.deeplink);

        return (
            <div
                key={notification.id}
                onClick={() => hasDeeplink && handleNotificationClick(notification)}
                className={`
          flex items-start gap-3 p-3 border-b border-gray-100 dark:border-gray-700
          ${hasDeeplink ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}
          ${isUnread ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}
          transition-colors
        `}
                role="button"
                tabIndex={hasDeeplink ? 0 : -1}
                aria-label={`${notification.title}${hasDeeplink ? " - Click to navigate" : ""}`}
            >
                {/* Icon */}
                <span className="text-xl flex-shrink-0" aria-hidden="true">
                    {icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isUnread ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                        {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                        {notification.body}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        })}
                    </p>
                </div>

                {/* Action button */}
                <button
                    onClick={(e) => isUnread
                        ? handleMarkRead(e, notification.id)
                        : handleMarkUnread(e, notification.id)
                    }
                    className={`
            flex-shrink-0 p-1.5 rounded-full
            ${isUnread
                            ? "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                            : "hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-400 hover:text-blue-500"
                        }
            transition-colors
          `}
                    aria-label={isUnread ? "Mark as read" : "Mark as unread"}
                    title={isUnread ? "Mark as read" : "Mark as unread"}
                >
                    {isUnread ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    )}
                </button>
            </div>
        );
    };

    return (
        <div className="w-80 max-h-[32rem] flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>🔔</span> Notifications
                    {unreadNotifications.length > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {unreadNotifications.length}
                        </span>
                    )}
                </h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                        aria-label="Close notifications"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Scrollable content */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                {/* Unread section */}
                {unreadLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                        Loading notifications...
                    </div>
                ) : unreadError ? (
                    <div className="p-4 text-center text-sm text-red-500">
                        Failed to load notifications
                    </div>
                ) : unreadNotifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                        No new notifications
                    </div>
                ) : (
                    unreadNotifications.map(n => renderNotificationRow(n, true))
                )}

                {/* Past notifications section */}
                <div className="border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={togglePastSection}
                        className="w-full flex items-center justify-between p-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        aria-expanded={isPastExpanded}
                    >
                        <span>Past notifications</span>
                        <svg
                            className={`w-4 h-4 transition-transform ${isPastExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isPastExpanded && (
                        <div className="border-t border-gray-100 dark:border-gray-800">
                            {pastLoading ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    Loading past notifications...
                                </div>
                            ) : pastNotifications.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    No past notifications
                                </div>
                            ) : (
                                <>
                                    {pastNotifications.map(n => renderNotificationRow(n, false))}
                                    {isFetchingNextPage && (
                                        <div className="p-2 text-center text-xs text-gray-400">
                                            Loading more...
                                        </div>
                                    )}
                                    {!hasNextPage && pastNotifications.length > 0 && (
                                        <div className="p-2 text-center text-xs text-gray-400">
                                            End of notifications
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
