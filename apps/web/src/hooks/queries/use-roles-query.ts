'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export type OperatorRole = 'observer' | 'reviewer' | 'approver' | 'operator';

export interface UserProfile {
  id: string;
  display_name: string | null;
  role: OperatorRole;
  created_at: string;
  updated_at: string;
}

export interface RoleChangeEntry {
  id: string;
  target_user_id: string;
  changed_by: string;
  old_role: OperatorRole;
  new_role: OperatorRole;
  reason: string | null;
  created_at: string;
}

export interface RolesResponse {
  profiles: UserProfile[];
  history: RoleChangeEntry[];
  currentUserId: string;
}

export interface MyProfileResponse {
  profile: UserProfile;
}

export interface RoleUpdateRequest {
  targetUserId: string;
  newRole: OperatorRole;
  reason?: string | undefined;
}

export const ROLE_LABELS: Record<OperatorRole, string> = {
  observer: 'Observer',
  reviewer: 'Reviewer',
  approver: 'Approver',
  operator: 'Operator',
};

export const ROLE_DESCRIPTIONS: Record<OperatorRole, string> = {
  observer: 'Read-only access to all dashboards and data',
  reviewer: 'Can view and comment on recommendations',
  approver: 'Can approve or reject trade recommendations',
  operator: 'Full control including role management and policy changes',
};

export const ROLE_LEVELS: Record<OperatorRole, number> = {
  observer: 1,
  reviewer: 2,
  approver: 3,
  operator: 4,
};

export function hasRoleLevel(userRole: OperatorRole, requiredRole: OperatorRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

export function useMyProfileQuery() {
  return useQuery<MyProfileResponse>({
    queryKey: queryKeys.roles.me(),
    queryFn: async () => {
      const res = await fetch('/api/roles?scope=me');
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRolesQuery() {
  return useQuery<RolesResponse>({
    queryKey: queryKeys.roles.all(),
    queryFn: async () => {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: RoleUpdateRequest) => {
      const res = await fetch('/api/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.roles.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.roles.me(),
      });
    },
  });
}
