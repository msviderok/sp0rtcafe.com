import { getUserProfileByEmail } from "./userProfiles";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";

export async function requireAdminAccess(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.email) {
    throw new Error("Not authenticated");
  }

  const profile = await getUserProfileByEmail(ctx, identity.email);

  if (!profile?.isAdmin) {
    throw new Error("Forbidden");
  }

  return identity;
}

export const getCurrentAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const profile = await getUserProfileByEmail(ctx, identity?.email);
    const isAdmin = profile?.isAdmin ?? false;
    const isCharacterPrivileged = profile?.isCharacterPrivileged ?? false;

    return {
      isAdmin,
      isCharacterPrivileged,
      canSelectCharacter: isAdmin || isCharacterPrivileged,
    };
  },
});
