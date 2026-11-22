/** Preserve other branches' parked tabs when saving the active branch.
 * Legacy (pre-branch) local tabs are assigned to Main only; never deleted
 * while editing another branch.
 */
export type ParkedBranchEntry = { id: string; branchId?: string };
export function visibleParkedForBranch<T extends ParkedBranchEntry>(
  all: T[], branchId: string, isMain: boolean,
): T[] {
  if (!branchId) return [];
  return all.filter(item => item.branchId
    ? item.branchId === branchId : isMain);
}
export function mergeParkedForBranch<T extends ParkedBranchEntry>(
  all: T[], activeBranch: T[], branchId: string, isMain: boolean,
): T[] {
  return [
    ...all.filter(item => item.branchId
      ? item.branchId !== branchId : !isMain),
    ...activeBranch,
  ];
}
