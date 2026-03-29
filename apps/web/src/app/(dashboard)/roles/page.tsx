'use client';

import { useState, useMemo } from 'react';
import {
  Shield,
  Eye,
  MessageSquare,
  CheckCircle2,
  Settings2,
  ChevronDown,
  Clock,
  AlertTriangle,
  User,
} from 'lucide-react';
import {
  useRolesQuery,
  useMyProfileQuery,
  useUpdateRoleMutation,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  hasRoleLevel,
} from '@/hooks/queries';
import type { OperatorRole, UserProfile, RoleChangeEntry } from '@/hooks/queries';

const ROLE_ICONS: Record<OperatorRole, typeof Eye> = {
  observer: Eye,
  reviewer: MessageSquare,
  approver: CheckCircle2,
  operator: Settings2,
};

const ROLE_COLORS: Record<OperatorRole, string> = {
  observer: 'bg-muted text-muted-foreground',
  reviewer: 'bg-primary/15 text-primary',
  approver: 'bg-profit/15 text-profit',
  operator: 'bg-amber/15 text-amber',
};

const ALL_ROLES: OperatorRole[] = ['observer', 'reviewer', 'approver', 'operator'];

function RoleBadge({ role }: { role: OperatorRole }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {ROLE_LABELS[role]}
    </span>
  );
}

function RolePermissionsGrid() {
  const permissions = [
    {
      action: 'View dashboards & data',
      observer: true,
      reviewer: true,
      approver: true,
      operator: true,
    },
    {
      action: 'View recommendations',
      observer: true,
      reviewer: true,
      approver: true,
      operator: true,
    },
    {
      action: 'Comment on recommendations',
      observer: false,
      reviewer: true,
      approver: true,
      operator: true,
    },
    {
      action: 'Approve / reject trades',
      observer: false,
      reviewer: false,
      approver: true,
      operator: true,
    },
    {
      action: 'Change risk policy',
      observer: false,
      reviewer: false,
      approver: false,
      operator: true,
    },
    {
      action: 'Manage trading mode',
      observer: false,
      reviewer: false,
      approver: false,
      operator: true,
    },
    {
      action: 'Halt / resume trading',
      observer: false,
      reviewer: false,
      approver: false,
      operator: true,
    },
    {
      action: 'Assign user roles',
      observer: false,
      reviewer: false,
      approver: false,
      operator: true,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="whitespace-nowrap p-2 text-left font-medium text-muted-foreground sm:p-3">
              Permission
            </th>
            {ALL_ROLES.map((role) => (
              <th key={role} className="p-2 text-center font-medium text-muted-foreground sm:p-3">
                <RoleBadge role={role} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {permissions.map((perm) => (
            <tr key={perm.action} className="hover:bg-muted">
              <td className="p-2 text-foreground sm:p-3">{perm.action}</td>
              {ALL_ROLES.map((role) => (
                <td key={role} className="p-2 text-center sm:p-3">
                  {perm[role] ? (
                    <CheckCircle2 className="inline h-4 w-4 text-profit" />
                  ) : (
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-border" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCard({
  profile,
  isCurrentUser,
  canChangeRoles,
  onChangeRole,
}: {
  profile: UserProfile;
  isCurrentUser: boolean;
  canChangeRoles: boolean;
  onChangeRole: (userId: string, newRole: OperatorRole) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div
      className={`rounded-lg border p-4 ${isCurrentUser ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {profile.display_name ?? 'Unknown User'}
              </span>
              {isCurrentUser && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="relative">
          {canChangeRoles ? (
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1"
            >
              <RoleBadge role={profile.role} />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : (
            <RoleBadge role={profile.role} />
          )}

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-lg">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onChangeRole(profile.id, role);
                      setShowDropdown(false);
                    }}
                    disabled={role === profile.role}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted ${role === profile.role ? 'opacity-50' : ''}`}
                  >
                    <RoleBadge role={role} />
                    <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ entry, profiles }: { entry: RoleChangeEntry; profiles: UserProfile[] }) {
  const changedBy = profiles.find((p) => p.id === entry.changed_by);
  const target = profiles.find((p) => p.id === entry.target_user_id);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{changedBy?.display_name ?? 'System'}</span>
          {' changed '}
          <span className="font-medium">{target?.display_name ?? 'Unknown'}</span>
          {' from '}
          <RoleBadge role={entry.old_role} />
          {' to '}
          <RoleBadge role={entry.new_role} />
        </p>
        {entry.reason && (
          <p className="mt-1 text-xs text-muted-foreground">Reason: {entry.reason}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(entry.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function OperatorRolesPage() {
  const { data: myProfile } = useMyProfileQuery();
  const { data, isLoading, error } = useRolesQuery();
  const updateRole = useUpdateRoleMutation();
  const [reasonDialogUser, setReasonDialogUser] = useState<{
    id: string;
    newRole: OperatorRole;
  } | null>(null);
  const [reason, setReason] = useState('');

  const myRole = myProfile?.profile?.role ?? 'operator';
  const canChangeRoles = hasRoleLevel(myRole, 'operator');
  const profiles = useMemo(() => data?.profiles ?? [], [data?.profiles]);

  const handleChangeRole = (userId: string, newRole: OperatorRole) => {
    setReasonDialogUser({ id: userId, newRole });
    setReason('');
  };

  const confirmRoleChange = () => {
    if (!reasonDialogUser) return;
    updateRole.mutate({
      targetUserId: reasonDialogUser.id,
      newRole: reasonDialogUser.newRole,
      reason: reason || undefined,
    });
    setReasonDialogUser(null);
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        Failed to load roles: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-heading-page text-foreground">Operator Roles</h1>
            <p className="text-sm text-muted-foreground">
              Manage access levels and approval permissions
            </p>
          </div>
        </div>
        {myProfile?.profile && <RoleBadge role={myProfile.profile.role} />}
      </div>

      {/* Your role summary */}
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium text-primary">Your Role: {ROLE_LABELS[myRole]}</span>
        </div>
        <p className="mt-1 text-sm text-primary/80">{ROLE_DESCRIPTIONS[myRole]}</p>
      </div>

      {/* Permissions matrix */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Permission Matrix</h2>
        <RolePermissionsGrid />
      </div>

      {/* Team Members */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Team Members</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <UserCard
                key={profile.id}
                profile={profile}
                isCurrentUser={profile.id === data?.currentUserId}
                canChangeRoles={canChangeRoles}
                onChangeRole={handleChangeRole}
              />
            ))}
            {profiles.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No team members found. Your profile will be created on first sign-in.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Role Change History */}
      {(data?.history?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Role Change History</h2>
          <div className="space-y-2">
            {data?.history?.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} profiles={profiles} />
            ))}
          </div>
        </div>
      )}

      {/* Role change confirmation dialog */}
      {reasonDialogUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Change Role</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Assigning role <RoleBadge role={reasonDialogUser.newRole} /> to this user.
            </p>
            <label className="mt-4 block text-sm font-medium text-foreground">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-muted p-2 text-sm text-foreground"
              placeholder="Why is this role being changed?"
            />
            {updateRole.error && (
              <p className="mt-2 text-sm text-destructive">{updateRole.error.message}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReasonDialogUser(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={updateRole.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateRole.isPending ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mutation error toast */}
      {updateRole.isSuccess && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-profit px-4 py-2 text-sm text-white shadow-lg">
          Role updated successfully
        </div>
      )}
    </div>
  );
}
