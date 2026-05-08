import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, confirm } = await req.json();
    if (!user_id || confirm !== 'YES') {
      return new Response(JSON.stringify({ error: 'missing user_id or confirm' }), { status: 400, headers: corsHeaders });
    }

    // Authn: require admin
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: corsHeaders });
    const supaUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supaUser.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: 'invalid auth' }), { status: 401, headers: corsHeaders });
    const { data: roles } = await supaUser.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin');
    if (!roles || roles.length === 0) return new Response(JSON.stringify({ error: 'not admin' }), { status: 403, headers: corsHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Recursively list all files under user_id/
    async function listAll(prefix: string): Promise<string[]> {
      const out: string[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await admin.storage.from('receipts').list(prefix, { limit: 1000, offset });
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const item of data) {
          const path = `${prefix}/${item.name}`;
          if (item.id === null) {
            const sub = await listAll(path);
            out.push(...sub);
          } else {
            out.push(path);
          }
        }
        if (data.length < 1000) break;
        offset += 1000;
      }
      return out;
    }

    const files = await listAll(user_id);
    let deleted = 0;
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const { error } = await admin.storage.from('receipts').remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }

    return new Response(JSON.stringify({ ok: true, deleted, total: files.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
