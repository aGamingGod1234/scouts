"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

const roleLabels: Record<string, string> = {
  DEV: "Dev",
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student"
};

const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  CCA: "CCA",
  PUBLIC_HOLIDAY: "Public Holiday",
  HOLIDAY_OVERRIDE: "Holiday Override"
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type MeResponse = {
  id: string;
  email: string;
  name: string;
  role: "DEV" | "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  groupIds: string[];
};

type Group = {
  id: string;
  name: string;
  type: "PLC" | "KAH" | "PATROL" | "CUSTOM";
};

type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: "DEV" | "ADMIN" | "TEACHER" | "STUDENT";
};

type CalendarItem = {
  id: string;
  type: "event" | "task";
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  status?: string | null;
  category?: string | null;
  location?: string | null;
};

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">(
    "checking"
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarTotal, setCalendarTotal] = useState(0);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const isAuthenticated = authState === "authenticated";

  const today = new Date();
  const [rangeStart, setRangeStart] = useState(toDateInputValue(today));
  const [rangeEnd, setRangeEnd] = useState(
    toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))
  );

  const [formState, setFormState] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    location: "",
    status: "SCHEDULED",
    category: "GENERAL"
  });
  const [targetAll, setTargetAll] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetGroups, setTargetGroups] = useState<string[]>([]);
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadSessionData = async () => {
    const [meResponse, groupsResponse, usersResponse] = await Promise.all([
      fetchWithAuth<MeResponse>("/api/me"),
      fetchWithAuth<Group[]>("/api/groups?limit=100"),
      fetchWithAuth<UserSummary[]>("/api/users?limit=100")
    ]);

    setMe(meResponse);
    setGroups(groupsResponse);
    setUsers(usersResponse);
  };

  useEffect(() => {
    let isActive = true;
    setLoadingTargets(true);
    setCalendarError(null);

    loadSessionData()
      .then(() => {
        if (!isActive) return;
        setAuthState("authenticated");
      })
      .catch(() => {
        if (!isActive) return;
        setAuthState("unauthenticated");
        setMe(null);
        setGroups([]);
        setUsers([]);
        setCalendarItems([]);
        setCalendarTotal(0);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingTargets(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isActive = true;
    setLoadingCalendar(true);
    setCalendarError(null);

    const fromIso = new Date(`${rangeStart}T00:00:00`).toISOString();
    const toIso = new Date(`${rangeEnd}T23:59:59`).toISOString();
    const url = `/api/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=100`;

    fetchWithAuth<{ items: CalendarItem[]; totalCount: number }>(url)
      .then((data) => {
        if (!isActive) return;
        setCalendarItems(data.items);
        setCalendarTotal(data.totalCount);
      })
      .catch((error) => {
        if (!isActive) return;
        setCalendarError(error instanceof Error ? error.message : "Failed to load calendar.");
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingCalendar(false);
      });

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, rangeStart, rangeEnd]);

  const groupedItems = useMemo(() => {
    const entries = calendarItems
      .map((item) => ({
        ...item,
        startsAtDate: new Date(item.startsAt)
      }))
      .sort((a, b) => a.startsAtDate.getTime() - b.startsAtDate.getTime());

    return entries.reduce<Record<string, typeof entries>>((acc, item) => {
      const key = item.startsAtDate.toISOString().slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [calendarItems]);

  const availableRoleTargets = useMemo(() => {
    if (!me) return [] as string[];
    if (me.role === "ADMIN" || me.role === "DEV") {
      return ["DEV", "ADMIN", "TEACHER", "STUDENT"];
    }
    return ["TEACHER", "STUDENT"];
  }, [me]);

  const availableUsers = useMemo(() => {
    if (!me) return [] as UserSummary[];
    const allowedRoles = new Set(availableRoleTargets);
    return users.filter((user) => allowedRoles.has(user.role));
  }, [me, users, availableRoleTargets]);

  const canCreateEvents = me?.role === "ADMIN" || me?.role === "DEV" || me?.role === "TEACHER";
  const canTargetAll = me?.role === "ADMIN" || me?.role === "DEV";

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    setAuthState("checking");
    setLoadingTargets(true);
    setCalendarError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const payload = (await response.json()) as ApiResponse<{ user: MeResponse }>;
      if (!payload.ok) {
        throw new Error(payload.error.message);
      }

      await loadSessionData();
      setAuthState("authenticated");
      setLoginPassword("");
    } catch (error) {
      setAuthState("unauthenticated");
      setLoginError(error instanceof Error ? error.message : "Failed to log in.");
    } finally {
      setLoginLoading(false);
      setLoadingTargets(false);
    }
  };

  const handleAddUserTarget = () => {
    if (!selectedUser || targetUsers.includes(selectedUser)) return;
    setTargetUsers((prev) => [...prev, selectedUser]);
    setSelectedUser("");
  };

  const handleRemoveUserTarget = (userId: string) => {
    setTargetUsers((prev) => prev.filter((id) => id !== userId));
  };

  const handleToggleRoleTarget = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((value) => value !== role) : [...prev, role]
    );
  };

  const handleToggleGroupTarget = (groupId: string) => {
    setTargetGroups((prev) =>
      prev.includes(groupId) ? prev.filter((value) => value !== groupId) : [...prev, groupId]
    );
  };

  const handleCreateEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return;
    setCreateError(null);
    setCreateSuccess(null);

    const targets = [] as Array<{ type: string; userId?: string; role?: string; groupId?: string }>;
    if (targetAll) {
      targets.push({ type: "ALL" });
    } else {
      targetRoles.forEach((role) => targets.push({ type: "ROLE", role }));
      targetGroups.forEach((groupId) => targets.push({ type: "GROUP", groupId }));
      targetUsers.forEach((userId) => targets.push({ type: "USER", userId }));
    }

    if (targets.length === 0) {
      setCreateError("Select at least one target for this event.");
      return;
    }

    try {
      await fetchWithAuth("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: formState.title,
          description: formState.description || undefined,
          status: formState.status,
          category: formState.category,
          startsAt: new Date(formState.startsAt).toISOString(),
          endsAt: formState.endsAt ? new Date(formState.endsAt).toISOString() : undefined,
          location: formState.location || undefined,
          targets
        })
      });

      setCreateSuccess("Event created.");
      setFormState({
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        location: "",
        status: "SCHEDULED",
        category: "GENERAL"
      });
      setTargetAll(false);
      setTargetRoles([]);
      setTargetGroups([]);
      setTargetUsers([]);

      const fromIso = new Date(`${rangeStart}T00:00:00`).toISOString();
      const toIso = new Date(`${rangeEnd}T23:59:59`).toISOString();
      const url = `/api/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=100`;
      const data = await fetchWithAuth<{ items: CalendarItem[]; totalCount: number }>(url);
      setCalendarItems(data.items);
      setCalendarTotal(data.totalCount);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create event.");
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-12">
        <header className="animate-rise rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8 shadow-[0_20px_60px_-40px_rgba(32,25,15,0.8)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Scout HQ</p>
              <h1 className="mt-3 font-display text-4xl text-[var(--ink)] md:text-5xl">
                Calendar Command Center
              </h1>
              <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
                See what matters for your patrols, PLC and KAH circles, and assignments. Create events
                with precise targeting so every scout sees the right moments.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Sign in
              </p>
              {isAuthenticated && me ? (
                <div className="text-xs text-[var(--muted)]">
                  Signed in as <span className="font-semibold text-[var(--ink)]">{me.email}</span>
                </div>
              ) : (
                <form className="flex flex-col gap-2" onSubmit={handleLogin}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-inner focus:border-[var(--accent)] focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-inner focus:border-[var(--accent)] focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
                    disabled={loginLoading || authState === "checking"}
                  >
                    {loginLoading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              )}
              {authState === "checking" && (
                <p className="text-xs text-[var(--muted)]">Checking session...</p>
              )}
              {loginError && (
                <p className="text-xs text-red-600">{loginError}</p>
              )}
              {!isAuthenticated && !loginError && authState !== "checking" && (
                <p className="text-xs text-[var(--muted)]">Use your email and password to continue.</p>
              )}
            </div>
          </div>
        </header>

        <section className="animate-fade grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_25px_60px_-45px_rgba(15,14,10,0.8)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Calendar</p>
                <h2 className="mt-2 font-display text-2xl">Your next chapters</h2>
                <p className="text-sm text-[var(--muted)]">
                  {calendarTotal} items - scoped to your role and group assignments
                </p>
              </div>
              <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--border)] bg-white/80 p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  From
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  To
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {loadingCalendar && (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
                  Loading your calendar...
                </div>
              )}

              {calendarError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {calendarError}
                </div>
              )}

              {!isAuthenticated && (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
                  Sign in to load your calendar.
                </div>
              )}

              {isAuthenticated && !loadingCalendar && !calendarError && Object.keys(groupedItems).length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
                  No calendar items in this range yet.
                </div>
              )}

              {isAuthenticated &&
                !loadingCalendar &&
                !calendarError &&
                Object.entries(groupedItems).map(([dateKey, items]) => (
                  <div key={dateKey} className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{dateKey}</p>
                        <p className="mt-1 text-lg font-semibold">{formatDateLabel(dateKey)}</p>
                      </div>
                      <span className="rounded-full bg-[var(--accent-warm-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                        {items.length} items
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                                {item.type === "task" ? "Task" : "Event"}
                              </span>
                              {item.category && item.type === "event" && (
                                <span className="rounded-full bg-[var(--accent-warm-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                                  {categoryLabels[item.category] ?? item.category}
                                </span>
                              )}
                              {item.status && (
                                <span className="rounded-full bg-[var(--ink-soft)] px-3 py-1 text-xs text-[var(--muted)]">
                                  {item.status}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-base font-semibold">{item.title}</p>
                            {item.description && (
                              <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
                            )}
                          </div>
                          <div className="text-sm text-[var(--muted)]">
                            <p>{formatTime(item.startsAt)}</p>
                            {item.endsAt && <p>Ends {formatTime(item.endsAt)}</p>}
                            {item.location && <p>{item.location}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_25px_60px_-45px_rgba(15,14,10,0.8)]">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Profile</p>
              <h2 className="mt-2 font-display text-2xl">Visibility snapshot</h2>
              {!isAuthenticated && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Sign in to load your profile and group assignments.
                </p>
              )}
              {isAuthenticated && loadingTargets && (
                <p className="mt-3 text-sm text-[var(--muted)]">Loading your profile...</p>
              )}
              {isAuthenticated && !loadingTargets && me && (
                <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                  <p>
                    <span className="font-semibold text-[var(--ink)]">{me.name}</span> - {roleLabels[me.role]}
                  </p>
                  <p>{me.email}</p>
                  <p>Groups assigned: {me.groupIds.length}</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_25px_60px_-45px_rgba(15,14,10,0.8)]">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Create Event</p>
              <h2 className="mt-2 font-display text-2xl">Target the right scouts</h2>
              {!isAuthenticated && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Sign in to create events and set targeting rules.
                </p>
              )}
              {isAuthenticated && !canCreateEvents && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Your role can view events but cannot create or edit them.
                </p>
              )}

              {isAuthenticated && canCreateEvents && (
                <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Title
                    </label>
                    <input
                      value={formState.title}
                      onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Description
                    </label>
                    <textarea
                      value={formState.description}
                      onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Starts
                      <input
                        type="datetime-local"
                        value={formState.startsAt}
                        onChange={(event) => setFormState({ ...formState, startsAt: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Ends
                      <input
                        type="datetime-local"
                        value={formState.endsAt}
                        onChange={(event) => setFormState({ ...formState, endsAt: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Location
                      <input
                        value={formState.location}
                        onChange={(event) => setFormState({ ...formState, location: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Status
                      <select
                        value={formState.status}
                        onChange={(event) => setFormState({ ...formState, status: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="DRAFT">Draft</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELED">Canceled</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Category
                    </label>
                    <select
                      value={formState.category}
                      onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    >
                      <option value="GENERAL">General</option>
                      <option value="CCA">CCA Session</option>
                      <option value="PUBLIC_HOLIDAY">Public Holiday</option>
                      <option value="HOLIDAY_OVERRIDE">Holiday Override</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Targets
                    </p>
                    {canTargetAll && (
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={targetAll}
                          onChange={(event) => {
                            setTargetAll(event.target.checked);
                            if (event.target.checked) {
                              setTargetRoles([]);
                              setTargetGroups([]);
                              setTargetUsers([]);
                            }
                          }}
                          className="h-4 w-4"
                        />
                        All Users
                      </label>
                    )}

                    {!targetAll && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                            Roles
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableRoleTargets.map((role) => (
                              <button
                                type="button"
                                key={role}
                                onClick={() => handleToggleRoleTarget(role)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  targetRoles.includes(role)
                                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                    : "border-[var(--border)] text-[var(--muted)]"
                                }`}
                              >
                                {roleLabels[role] ?? role}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                            Groups
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {groups.length === 0 && (
                              <span className="text-xs text-[var(--muted)]">No groups yet.</span>
                            )}
                            {groups.map((group) => (
                              <button
                                type="button"
                                key={group.id}
                                onClick={() => handleToggleGroupTarget(group.id)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  targetGroups.includes(group.id)
                                    ? "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-strong)]"
                                    : "border-[var(--border)] text-[var(--muted)]"
                                }`}
                              >
                                {group.name} - {group.type}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                            Specific Users
                          </p>
                          <div className="mt-2 flex gap-2">
                            <select
                              value={selectedUser}
                              onChange={(event) => setSelectedUser(event.target.value)}
                              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                            >
                              <option value="">Select a user</option>
                              {availableUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({roleLabels[user.role]})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleAddUserTarget}
                              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold"
                            >
                              Add
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {targetUsers.map((userId) => {
                              const user = users.find((entry) => entry.id === userId);
                              if (!user) return null;
                              return (
                                <button
                                  key={userId}
                                  type="button"
                                  onClick={() => handleRemoveUserTarget(userId)}
                                  className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs"
                                >
                                  {user.name} - remove
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {createError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {createError}
                    </div>
                  )}
                  {createSuccess && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      {createSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[0_18px_35px_-25px_rgba(15,118,110,0.45)] transition hover:bg-[var(--accent-strong)]"
                    disabled={loadingTargets}
                  >
                    Create Event
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}


