import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://eh28u6b7.us-east.insforge.app',
  anonKey: 'ik_d1af5e06c1c856235efb7c21af791ea9'
});

async function run() {
  try {
    console.log("Listing tables...");
    const { data, error } = await client.database
      .rpc('get_tables_info'); // Wait, let's see if we can query pg_catalog or information_schema
    if (error) {
      console.log("RPC get_tables_info failed, trying select from pg_class...");
      const { data: data2, error: error2 } = await client.database
        .from('pg_tables') // pg_tables is exposed in PostgREST sometimes
        .select('*');
      if (error2) {
        console.log("pg_tables failed, let's try direct select from information_schema...");
        throw error2;
      }
      console.log("Tables:", data2);
    } else {
      console.log("Tables info:", data);
    }
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();
