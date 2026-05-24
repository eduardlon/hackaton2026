const anonKey = 'ik_d1af5e06c1c856235efb7c21af791ea9';

async function testLogin(url) {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`Calling ${url} for 3001112233...`);
    const loginRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: '3001112233', pin: '1234' })
    });
    const loginData = await loginRes.json();
    console.log("Response:", JSON.stringify(loginData, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

async function run() {
  await testLogin('https://3j4dh2sn.functions.insforge.app/auth-login-pin');
  await testLogin('https://eh28u6b7.us-east.insforge.app/functions/v1/auth-login-pin');
}

run();
