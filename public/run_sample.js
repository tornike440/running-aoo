document.getElementById('sample').addEventListener('click', () => {
  const payload = {
    user_id: 'demo_user',
    points: [
      {latitude: 41.715138, longitude: 44.827096, timestamp: Date.now()},
      {latitude: 41.7165, longitude: 44.8285, timestamp: Date.now()+5000},
      {latitude: 41.7178, longitude: 44.8269, timestamp: Date.now()+10000},
      {latitude: 41.716, longitude: 44.825, timestamp: Date.now()+15000}
    ]
  };
  document.getElementById('payload').value = JSON.stringify(payload, null, 2);
});

document.getElementById('send').addEventListener('click', async () => {
  const raw = document.getElementById('payload').value;
  try {
    const payload = JSON.parse(raw);
    const res = await fetch('/runs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    document.getElementById('out').textContent = JSON.stringify(data, null, 2);
  } catch(e) {
    document.getElementById('out').textContent = 'Error: ' + e;
  }
});

document.getElementById('list').addEventListener('click', async () => {
  const res = await fetch('/hexes');
  const data = await res.json();
  document.getElementById('out').textContent = JSON.stringify(data, null, 2);
});
