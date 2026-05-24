module.exports = async function(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    // 1. Query demo_users
    const { data: users, error: usersError } = await client.database
      .from('demo_users')
      .select('*');

    // 2. Query wallet_accounts
    const { data: wallets } = await client.database
      .from('wallet_accounts')
      .select('*');

    return new Response(JSON.stringify({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      anonKey: Deno.env.get('ANON_KEY') ? 'present' : 'missing',
      users,
      usersError,
      wallets
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
