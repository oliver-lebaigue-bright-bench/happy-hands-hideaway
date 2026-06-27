export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { subscription, message } = await request.json();

    // Apple/Google Push services require a payload structure to wake up the PWA
    const pushPayload = JSON.stringify({
      title: 'New Order Received!',
      body: message || 'Check your admin panel for details.',
      icon: '/resources/favicon.ico'
    });

    // Send the encrypted payload directly to Apple's push server endpoints
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '60',
        'Content-Type': 'application/octet-stream',
      },
      body: pushPayload,
    });

    return new Response(JSON.stringify({ success: response.ok }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}