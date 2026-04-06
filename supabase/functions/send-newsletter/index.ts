import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!resendApiKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { newsletter_id } = await req.json();
    if (!newsletter_id) {
      return new Response(JSON.stringify({ error: 'newsletter_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load newsletter
    const { data: newsletter, error: nlError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', newsletter_id)
      .eq('user_id', user.id)
      .single();

    if (nlError || !newsletter) {
      return new Response(JSON.stringify({ error: 'Newsletter not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load company settings for sender name
    const { data: company } = await supabase
      .from('company_settings')
      .select('company_name, email')
      .eq('user_id', user.id)
      .maybeSingle();

    // Collect recipients based on type
    let recipientEmails: { email: string; name: string }[] = [];

    if (newsletter.recipient_type === 'customers' || newsletter.recipient_type === 'all') {
      const { data: customers } = await supabase
        .from('customers')
        .select('display_name, email, is_archived, newsletter_opt_out')
        .eq('user_id', user.id);
      if (customers) {
        for (const c of customers) {
          if (c.email && !c.is_archived && !c.newsletter_opt_out) {
            recipientEmails.push({ email: c.email.toLowerCase(), name: c.display_name });
          }
        }
      }
    }

    if (newsletter.recipient_type === 'members' || newsletter.recipient_type === 'all') {
      const { data: members } = await supabase
        .from('members')
        .select('display_name, email, is_active, newsletter_opt_out, member_type')
        .eq('user_id', user.id);
      if (members) {
        const filter = newsletter.recipient_filter as Record<string, unknown> | null;
        for (const m of members) {
          if (m.email && m.is_active !== false && !m.newsletter_opt_out) {
            if (filter?.member_type && m.member_type !== filter.member_type) continue;
            recipientEmails.push({ email: m.email.toLowerCase(), name: m.display_name });
          }
        }
      }
    }

    // Deduplicate by email
    const seen = new Set<string>();
    recipientEmails = recipientEmails.filter(r => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    // Update newsletter status
    await supabase
      .from('newsletters')
      .update({ status: 'sending', total_recipients: recipientEmails.length } as any)
      .eq('id', newsletter_id);

    // Insert recipients
    if (recipientEmails.length > 0) {
      const recipientRows = recipientEmails.map(r => ({
        newsletter_id,
        email: r.email,
        name: r.name,
        status: 'pending',
      }));
      await supabase.from('newsletter_recipients').insert(recipientRows as any);
    }

    // Send emails with rate limiting
    let sentCount = 0;
    let failedCount = 0;
    const senderName = company?.company_name || 'BillMonk';
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://billmonk.lovable.app';

    // Add unsubscribe footer
    const htmlWithFooter = `${newsletter.html_content}
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 15px;">
        Du erhältst diese E-Mail, weil du als Kontakt bei ${senderName} registriert bist.<br/>
        Wenn du keine weiteren E-Mails erhalten möchtest, kontaktiere uns bitte direkt.
      </p>`;

    for (const recipient of recipientEmails) {
      try {
        const response = await fetch(`${GATEWAY_URL}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
            'X-Connection-Api-Key': resendApiKey,
          },
          body: JSON.stringify({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [recipient.email],
            subject: newsletter.subject,
            html: htmlWithFooter,
          }),
        });

        if (response.ok) {
          sentCount++;
          await supabase
            .from('newsletter_recipients')
            .update({ status: 'sent', sent_at: new Date().toISOString() } as any)
            .eq('newsletter_id', newsletter_id)
            .eq('email', recipient.email);
        } else {
          const errText = await response.text();
          failedCount++;
          await supabase
            .from('newsletter_recipients')
            .update({ status: 'failed', error_message: errText.substring(0, 500) } as any)
            .eq('newsletter_id', newsletter_id)
            .eq('email', recipient.email);
        }

        // Rate limit: ~10 per second
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err: any) {
        failedCount++;
        await supabase
          .from('newsletter_recipients')
          .update({ status: 'failed', error_message: err.message?.substring(0, 500) } as any)
          .eq('newsletter_id', newsletter_id)
          .eq('email', recipient.email);
      }
    }

    // Update final status
    await supabase
      .from('newsletters')
      .update({
        status: failedCount === recipientEmails.length ? 'failed' : 'sent',
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
      } as any)
      .eq('id', newsletter_id);

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
