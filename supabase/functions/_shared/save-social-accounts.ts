// Grava as contas retornadas pelo login (OAuth) da plataforma: perfil em `social_accounts`
// e token em `social_account_secrets`. Usado pela conexão feita pela equipe (social-oauth)
// e pela conexão feita pelo próprio cliente no onboarding (client-onboarding).
// deno-lint-ignore-file no-explicit-any

export interface ConnectedAccount {
  externalId: string;
  username: string;
  displayName: string;
  profilePicture: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
}

export async function saveConnectedAccounts(
  admin: any,
  platform: string,
  accounts: ConnectedAccount[],
  opts: { createdBy: string | null; clientId: string | null },
): Promise<string[]> {
  const saved: string[] = [];
  for (const acc of accounts) {
    const { data: existing } = await admin
      .from("social_accounts")
      .select("id")
      .eq("platform", platform)
      .eq("external_id", acc.externalId)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      platform,
      external_id: acc.externalId,
      username: acc.username,
      display_name: acc.displayName,
      profile_picture: acc.profilePicture,
      status: "connected",
      token_status: "ok",
      token_error: null,
      token_checked_at: new Date().toISOString(),
      expires_at: acc.expiresAt ?? null,
      last_synced_at: new Date().toISOString(),
      created_by: opts.createdBy,
    };
    // Só define o cliente quando ele é conhecido: reconectar sem cliente não desfaz um vínculo existente
    if (opts.clientId || !existing) payload.client_id = opts.clientId;

    let accountId = existing?.id as string | undefined;
    if (accountId) {
      await admin.from("social_accounts").update(payload).eq("id", accountId);
    } else {
      const { data: inserted, error } = await admin
        .from("social_accounts").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      accountId = inserted.id;
    }

    await admin.from("social_account_secrets").upsert({
      account_id: accountId,
      access_token: acc.accessToken,
      refresh_token: acc.refreshToken ?? "",
      expires_at: acc.expiresAt ?? null,
      updated_at: new Date().toISOString(),
    });
    saved.push(acc.username);
  }
  return saved;
}
