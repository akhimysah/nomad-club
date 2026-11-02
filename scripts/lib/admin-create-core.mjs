// Création (ou promotion) d'une administratrice avec la clé service Supabase.
// Utilisé par scripts/admin-create.mjs (npm run admin:create -- email) et par le test du mode réel.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function findUserByEmail(supabase, email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`lecture des comptes impossible : ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * @param {{ supabase: import("@supabase/supabase-js").SupabaseClient, email: string, firstName?: string | null, force?: boolean, log?: (m: string) => void }} opts
 * @returns {Promise<{ userId: string, created: boolean, alreadyAdmin: boolean }>}
 */
export async function createAdmin({ supabase, email: rawEmail, firstName = null, force = false, log = console.log }) {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`adresse e-mail invalide : « ${rawEmail ?? ""} »`);

  const { data: admins, error: adminsErr } = await supabase.from("user_roles").select("profile_id").eq("role", "admin");
  if (adminsErr) throw new Error(`table user_roles illisible (migrations appliquées ?) : ${adminsErr.message}`);

  let user = await findUserByEmail(supabase, email);
  let created = false;
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: firstName ?? email.split("@")[0], terms_accepted: "false" },
    });
    if (error) throw new Error(`création du compte impossible : ${error.message}`);
    user = data.user;
    created = true;
    log(`✓ Compte créé pour ${email}`);
  } else log(`✓ Compte existant trouvé pour ${email}`);

  const alreadyAdmin = (admins ?? []).some((a) => a.profile_id === user.id);
  if (alreadyAdmin) {
    log("✓ Cette personne est déjà administratrice : rien à changer.");
    return { userId: user.id, created, alreadyAdmin: true };
  }
  if ((admins ?? []).length > 0 && !force) {
    throw new Error(
      `il existe déjà ${admins.length} administratrice(s). Pour en ajouter une, passez par l'appli (Fondatrices → Rôles et accès) ou relancez avec --force.`,
    );
  }

  // le déclencheur handle_new_user crée le profil ; on le vérifie (et on le crée au besoin, ex. compte antérieur aux migrations)
  const { data: profile, error: profileErr } = await supabase.from("profiles").select("id, first_name").eq("id", user.id).maybeSingle();
  if (profileErr) throw new Error(`profil illisible : ${profileErr.message}`);
  if (!profile) {
    const { error } = await supabase.from("profiles").insert({ id: user.id, email, first_name: firstName ?? email.split("@")[0] });
    if (error) throw new Error(`création du profil impossible : ${error.message}`);
  } else if (firstName && !profile.first_name) {
    await supabase.from("profiles").update({ first_name: firstName }).eq("id", user.id);
  }

  const { error: roleErr } = await supabase.from("user_roles").upsert({ profile_id: user.id, role: "admin", granted_by: null }, { onConflict: "profile_id,role", ignoreDuplicates: true });
  if (roleErr) throw new Error(`attribution du rôle impossible : ${roleErr.message}`);
  await supabase.from("audit_log").insert({
    actor_id: null,
    action: "role.grant",
    target_type: "profile",
    target_id: user.id,
    summary: `Rôle Administratrice donné à ${email} (npm run admin:create)`,
    details: { role: "admin", via: "script", force },
  });
  log("✓ Rôle « admin » attribué et journalisé.");
  return { userId: user.id, created, alreadyAdmin: false };
}
