// Listen for the push event from your Vercel backend
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      // Try to parse the incoming text as JSON data
      data = event.data.json();
    } catch (e) {
      // Fallback if the data sent wasn't raw JSON strings
      data = { title: 'New Order Received!', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'Open your dashboard to view order details.',
    icon: '/resources/favicon.ico', // Changes banner icon to your site logo
    badge: '/resources/favicon.ico',
    tag: 'new-order-alert', // Prevents multiple alerts stacking up messily
    renotify: true, // Vibrates/alerts even if a prior notification is sitting there
    data: {
      url: '/admin.html' // Keeps track of where to send her when tapped
    }
  };

  // Wait until the notification is fully displayed before resting the worker
  event.waitUntil(
    self.registration.showNotification(data.title || 'New Order!', options)
  );
});

// When she taps the banner on her iPhone lock screen, open the admin panel
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Dimiss the banner immediately

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the admin panel app is already open in the background, just switch to it
      for (const client of clientList) {
        if (client.url.includes('/admin.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // If it isn't running, open a fresh window of the PWA admin app
      if (clients.openWindow) {
        return clients.openWindow('/admin.html');
      }
    })
  );
});