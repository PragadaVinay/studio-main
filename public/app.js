import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: ''
};

const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
let auth, db, storage;
let currentUser = null;
if (firebaseEnabled) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

const els = {
  form: document.getElementById('routeForm'),
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  status: document.getElementById('status'),
  suggestions: document.getElementById('suggestions'),
  aiCards: document.getElementById('aiCards'),
  comparisonTable: document.getElementById('comparisonTable'),
  hotelsList: document.getElementById('hotelsList'),
  restaurantsList: document.getElementById('restaurantsList'),
  googleLoginBtn: document.getElementById('googleLoginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userInfo: document.getElementById('userInfo'),
  reviewForm: document.getElementById('reviewForm'),
  reviewProvider: document.getElementById('reviewProvider'),
  reviewRating: document.getElementById('reviewRating'),
  reviewComment: document.getElementById('reviewComment'),
  reviewPhoto: document.getElementById('reviewPhoto'),
  reviewsList: document.getElementById('reviewsList'),
  tabButtons: Array.from(document.querySelectorAll('.tab-btn'))
};

function setupTabs() {
  els.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      els.tabButtons.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tab}`);
      });
    });
  });
}

const map = L.map('map').setView([22.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
let routeLayer;

const cityCoords = {
  bengaluru: [12.9716, 77.5946], mumbai: [19.076, 72.8777], delhi: [28.6139, 77.209],
  chennai: [13.0827, 80.2707], goa: [15.2993, 74.124], hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567], kolkata: [22.5726, 88.3639], jaipur: [26.9124, 75.7873],
  kochi: [9.9312, 76.2673], ahmedabad: [23.0225, 72.5714]
};

const cityPlaces = {
  goa: {
    hotels: [
      { name: 'Calangute Bay Stay', area: 'Calangute', price: '₹3,200 - ₹6,500 / night', type: 'Beach Resort' },
      { name: 'Panaji Boutique Inn', area: 'Panaji', price: '₹2,400 - ₹5,200 / night', type: 'Boutique Hotel' },
      { name: 'South Goa Premium Suites', area: 'Colva', price: '₹6,500 - ₹12,000 / night', type: 'Premium' }
    ],
    restaurants: [
      { name: 'Fisherman Wharf', cuisine: 'Goan Seafood', cost: '₹900 - ₹1,700 / person' },
      { name: 'Cafe Baga Breeze', cuisine: 'Continental', cost: '₹600 - ₹1,100 / person' },
      { name: 'Panaji Spice Kitchen', cuisine: 'Indian + Goan', cost: '₹700 - ₹1,300 / person' }
    ]
  }
};

function cityToCoord(city) {
  return cityCoords[city.trim().toLowerCase()] || [20.5937, 78.9629];
}

function parseRange(rangeText) {
  const nums = (rangeText || '').replace(/,/g, '').match(/\d+/g) || [];
  if (nums.length < 2) return { min: 0, max: 0, avg: 0 };
  const min = Number(nums[0]);
  const max = Number(nums[1]);
  return { min, max, avg: Math.round((min + max) / 2) };
}

function modeFlatten(data) {
  return data.modes.flatMap((m) => m.categories.map((c) => ({ mode: m.mode, ...c, ...parseRange(c.priceRangeINR) })));
}

function renderAICards(data) {
  const rows = modeFlatten(data).filter((r) => r.avg > 0);
  if (!rows.length) {
    els.aiCards.innerHTML = '<p class="meta">Run a search to view AI recommendations.</p>';
    return;
  }
  const cheapest = rows.reduce((a, b) => (a.avg < b.avg ? a : b));
  const premium = rows.find((r) => r.name.toLowerCase() === 'premium') || rows[0];
  const balanced = [...rows].sort((a, b) => a.avg - b.avg)[Math.floor(rows.length / 2)];

  const cards = [
    { title: 'Best Budget Pick', item: cheapest, why: 'Lowest average expected fare.' },
    { title: 'Balanced Choice', item: balanced, why: 'Good comfort-to-cost ratio.' },
    { title: 'Premium Comfort', item: premium, why: 'Best onboard comfort and flexibility.' }
  ];

  els.aiCards.innerHTML = cards.map((card) => `
    <article class="info-card">
      <h4>${card.title}</h4>
      <p><strong>${card.item.mode.toUpperCase()} · ${card.item.name}</strong></p>
      <p>${card.item.description}</p>
      <p class="meta">Estimated Price: ${card.item.priceRangeINR}</p>
      <p class="meta">Providers: ${card.item.providers.join(', ')}</p>
      <p class="meta">Why: ${card.why}</p>
    </article>
  `).join('');
}

function renderComparison(data) {
  const rows = modeFlatten(data);
  els.comparisonTable.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Category</th>
            <th>Price Range (₹)</th>
            <th>Providers</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.mode.toUpperCase()}</td>
              <td>${r.name}</td>
              <td>${r.priceRangeINR}</td>
              <td>${r.providers.join(', ')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCardList(el, items, template) {
  el.innerHTML = items.map(template).join('');
}

function renderHotelsAndRestaurants(toCity) {
  const cityKey = toCity.trim().toLowerCase();
  const fallback = {
    hotels: [
      { name: `${toCity} Central Residency`, area: 'City Center', price: '₹2,000 - ₹4,800 / night', type: 'Standard Hotel' },
      { name: `${toCity} Grand Suites`, area: 'Main Transit Hub', price: '₹4,500 - ₹9,000 / night', type: 'Premium Hotel' },
      { name: `${toCity} Budget Inn`, area: 'Near Bus/Train Station', price: '₹1,400 - ₹3,000 / night', type: 'Budget' }
    ],
    restaurants: [
      { name: `${toCity} Spice House`, cuisine: 'Regional Indian', cost: '₹500 - ₹1,000 / person' },
      { name: `${toCity} Family Bistro`, cuisine: 'Multi-cuisine', cost: '₹600 - ₹1,200 / person' },
      { name: `${toCity} Street Tadka Hub`, cuisine: 'Street Food', cost: '₹250 - ₹550 / person' }
    ]
  };

  const source = cityPlaces[cityKey] || fallback;

  renderCardList(els.hotelsList, source.hotels, (h) => `
    <article class="info-card">
      <h4>${h.name}</h4>
      <p><strong>${h.type}</strong> · ${h.area}</p>
      <p class="meta">Typical Price: ${h.price}</p>
    </article>
  `);

  renderCardList(els.restaurantsList, source.restaurants, (r) => `
    <article class="info-card">
      <h4>${r.name}</h4>
      <p><strong>${r.cuisine}</strong></p>
      <p class="meta">Average Spend: ${r.cost}</p>
    </article>
  `);
}

function renderSuggestions(list) {
  els.suggestions.innerHTML = '';
  list.forEach((item) => {
    const wrap = document.createElement('div');
    wrap.className = 'suggestion-item';
    wrap.innerHTML = `<div><strong>${item.name}</strong><div class="meta">${item.reason}</div></div>`;

    const btn = document.createElement('button');
    btn.className = 'plus-note';
    btn.setAttribute('aria-label', `Add note for ${item.name}`);
    btn.textContent = '+';
    btn.addEventListener('click', () => {
      const note = prompt(`Add instruction/note for ${item.name}`);
      if (!note) return;
      const all = JSON.parse(localStorage.getItem('route_notes') || '[]');
      all.push({ place: item.name, note, at: new Date().toISOString() });
      localStorage.setItem('route_notes', JSON.stringify(all));
      alert('Instruction added successfully.');
    });

    wrap.appendChild(btn);
    els.suggestions.appendChild(wrap);
  });
}

function drawRoute(from, to) {
  const fromCoord = cityToCoord(from);
  const toCoord = cityToCoord(to);
  if (routeLayer) map.removeLayer(routeLayer);

  routeLayer = L.polyline([fromCoord, toCoord], { color: '#176fd1', weight: 5 }).addTo(map);
  L.marker(fromCoord).addTo(map).bindPopup(`From: ${from}`);
  L.marker(toCoord).addTo(map).bindPopup(`To: ${to}`);
  map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
}

function buildLocalSuggestions(from, to) {
  return [
    { name: `${from} Scenic Viewpoint`, reason: 'Sunrise photo stop and tea break.' },
    { name: 'Heritage midpoint halt', reason: 'Popular short detour with historical architecture.' },
    { name: `${to} Local Market`, reason: 'Shopping and regional food before arrival.' }
  ];
}

async function fetchTransport(from, to) {
  const res = await fetch('/api/transport-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load route options');
  return json.data;
}

async function saveRoute(from, to, payload) {
  const routeData = { from, to, payload, savedAt: new Date().toISOString() };
  if (firebaseEnabled && currentUser) {
    await addDoc(collection(db, 'users', currentUser.uid, 'savedRoutes'), {
      ...routeData,
      savedAt: serverTimestamp()
    });
  } else {
    const local = JSON.parse(localStorage.getItem('saved_routes') || '[]');
    local.unshift(routeData);
    localStorage.setItem('saved_routes', JSON.stringify(local.slice(0, 20)));
  }
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = els.from.value.trim();
  const to = els.to.value.trim();
  if (!from || !to) return;

  els.status.textContent = 'Loading AI recommendations and comparisons...';
  try {
    drawRoute(from, to);
    const data = await fetchTransport(from, to);

    renderAICards(data);
    renderComparison(data);
    renderHotelsAndRestaurants(to);
    renderSuggestions(data.suggestions?.length ? data.suggestions : buildLocalSuggestions(from, to));
    await saveRoute(from, to, data);

    els.status.textContent = `Results ready for ${from} → ${to} in ₹.`;
  } catch (err) {
    els.status.textContent = err.message;
  }
});

async function listReviews() {
  let reviews = [];
  if (firebaseEnabled) {
    const snapshot = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
    reviews = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } else {
    reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
  }

  els.reviewsList.innerHTML = '';
  reviews.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'review';
    div.innerHTML = `<strong>${r.provider}</strong> · ${'★'.repeat(Number(r.rating || 0))}
      <p>${r.comment}</p>
      ${r.photoURL ? `<img src="${r.photoURL}" alt="review" style="max-width:120px;border-radius:8px;"/>` : ''}`;
    els.reviewsList.appendChild(div);
  });
}

els.reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const provider = els.reviewProvider.value.trim();
  const rating = Number(els.reviewRating.value);
  const comment = els.reviewComment.value.trim();
  const file = els.reviewPhoto.files[0];
  let photoURL = '';

  if (firebaseEnabled && file && currentUser) {
    const storageRef = ref(storage, `reviewPhotos/${currentUser.uid}-${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    photoURL = await getDownloadURL(storageRef);
  } else if (file) {
    photoURL = URL.createObjectURL(file);
  }

  const review = { provider, rating, comment, photoURL, createdAt: new Date().toISOString() };
  if (firebaseEnabled) {
    await addDoc(collection(db, 'reviews'), {
      ...review,
      user: currentUser?.displayName || 'Anonymous',
      createdAt: serverTimestamp()
    });
  } else {
    const local = JSON.parse(localStorage.getItem('reviews') || '[]');
    local.unshift(review);
    localStorage.setItem('reviews', JSON.stringify(local));
  }

  els.reviewForm.reset();
  await listReviews();
});

if (firebaseEnabled) {
  const provider = new GoogleAuthProvider();
  els.googleLoginBtn.addEventListener('click', async () => {
    await signInWithPopup(auth, provider);
  });
  els.logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      els.userInfo.textContent = user.displayName || user.email;
      els.googleLoginBtn.classList.add('hidden');
      els.logoutBtn.classList.remove('hidden');
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || '',
        email: user.email || '',
        updatedAt: serverTimestamp()
      }, { merge: true });

      const pref = await getDoc(doc(db, 'users', user.uid, 'profile', 'preferences'));
      if (pref.exists()) {
        const p = pref.data();
        if (p.lastFrom) els.from.value = p.lastFrom;
        if (p.lastTo) els.to.value = p.lastTo;
      }
    } else {
      els.userInfo.textContent = 'Guest mode';
      els.googleLoginBtn.classList.remove('hidden');
      els.logoutBtn.classList.add('hidden');
    }
    await listReviews();
  });
} else {
  els.googleLoginBtn.textContent = 'Firebase not configured';
  els.googleLoginBtn.disabled = true;
  listReviews();
}

els.form.addEventListener('change', async () => {
  if (firebaseEnabled && currentUser) {
    await setDoc(doc(db, 'users', currentUser.uid, 'profile', 'preferences'), {
      lastFrom: els.from.value.trim(),
      lastTo: els.to.value.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
});

setupTabs();
renderHotelsAndRestaurants('Destination');
els.aiCards.innerHTML = '<p class="meta">Search a route to get AI picks.</p>';
els.comparisonTable.innerHTML = '<p class="meta">Comparison table appears after route search.</p>';
