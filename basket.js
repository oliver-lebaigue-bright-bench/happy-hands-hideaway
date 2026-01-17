// basket.js — Site-wide basket with Firebase stock, delivery validation, street autocomplete, and orders
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase globals ---
    const db = window.firebaseDB;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    const runTransaction = window.firebaseTransaction;
    const set = window.firebaseSet || ((r, v) => runTransaction(r, () => v)); // fallback

    // --- Basket data ---
    const basket = JSON.parse(localStorage.getItem('basket')) || [];
    function saveBasket() { localStorage.setItem('basket', JSON.stringify(basket)); }

    // --- Basket UI ---
    const basketBtn = document.createElement('button');
    basketBtn.id = 'basket-btn';
    basketBtn.className = `
      fixed top-6 right-6 bg-accent text-white font-bold py-3 px-6 rounded-xl shadow-xl z-50
      hover:bg-yellow-500 transition text-lg
    `;
    document.body.appendChild(basketBtn);

    const overlay = document.createElement('div');
    overlay.id = 'basket-overlay';
    overlay.className = `
      fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50
      backdrop-blur-sm
    `;

    const basketModal = document.createElement('div');
    basketModal.id = 'basket-modal';
    basketModal.className = `
      bg-white w-11/12 max-w-lg rounded-2xl shadow-2xl p-6 relative
      max-h-[85vh] overflow-y-auto flex flex-col
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'absolute top-4 right-4 text-ink font-bold text-2xl hover:text-red-600';
    closeBtn.addEventListener('click', () => hideBasket());
    basketModal.appendChild(closeBtn);

    const basketTitle = document.createElement('h3');
    basketTitle.textContent = 'Your Basket';
    basketTitle.className = 'font-bold text-2xl mb-4 text-center';
    basketModal.appendChild(basketTitle);

    const basketList = document.createElement('div');
    basketList.id = 'basket-list';
    basketList.className = 'space-y-4';
    basketModal.appendChild(basketList);

    const basketTotal = document.createElement('p');
    basketTotal.id = 'basket-total';
    basketTotal.className = 'font-bold text-lg mt-4 text-right';
    basketModal.appendChild(basketTotal);

    const checkoutBtn = document.createElement('button');
    checkoutBtn.textContent = 'Checkout';
    checkoutBtn.className = 'mt-4 w-full bg-hero text-white py-3 rounded-xl font-semibold hover:bg-ink transition';
    basketModal.appendChild(checkoutBtn);

    overlay.appendChild(basketModal);
    document.body.appendChild(overlay);

    // --- Delivery Modal ---
    const deliveryModal = document.createElement('div');
    deliveryModal.id = 'delivery-modal';
    deliveryModal.className = `
      fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50
      backdrop-blur-sm
    `;

    const deliveryForm = document.createElement('div');
    deliveryForm.className = `
      bg-white w-11/12 max-w-lg rounded-2xl shadow-2xl p-6 flex flex-col relative
    `;

    const closeDeliveryBtn = document.createElement('button');
    closeDeliveryBtn.textContent = '✕';
    closeDeliveryBtn.className = 'absolute top-4 right-4 text-ink font-bold text-2xl hover:text-red-600';
    closeDeliveryBtn.addEventListener('click', () => deliveryModal.classList.add('hidden'));
    deliveryForm.appendChild(closeDeliveryBtn);

    const title = document.createElement('h3');
    title.textContent = 'Delivery Details';
    title.className = 'font-bold text-2xl mb-4 text-center';
    deliveryForm.appendChild(title);

    const postcodeInput = document.createElement('input');
    postcodeInput.placeholder = 'Postcode (e.g., SW1A 1AA)';
    postcodeInput.className = 'mb-3 p-2 border rounded';
    deliveryForm.appendChild(postcodeInput);

    const streetInput = document.createElement('input');
    streetInput.placeholder = 'Street & House No.';
    streetInput.className = 'mb-3 p-2 border rounded';
    deliveryForm.appendChild(streetInput);

    const streetSuggestions = document.createElement('div');
    streetSuggestions.className = 'mb-3 p-2 border rounded bg-white max-h-40 overflow-y-auto';
    deliveryForm.appendChild(streetSuggestions);

    const cityInput = document.createElement('input');
    cityInput.placeholder = 'City/Town';
    cityInput.className = 'mb-3 p-2 border rounded';
    cityInput.disabled = true;
    deliveryForm.appendChild(cityInput);

    const submitDeliveryBtn = document.createElement('button');
    submitDeliveryBtn.textContent = 'Confirm & Pay';
    submitDeliveryBtn.className = 'mt-4 bg-hero text-white py-3 rounded-xl font-semibold hover:bg-ink transition';
    deliveryForm.appendChild(submitDeliveryBtn);

    deliveryModal.appendChild(deliveryForm);
    document.body.appendChild(deliveryModal);

    // --- Modal Animations ---
    function showBasket() {
      overlay.classList.remove('hidden');
      basketModal.style.transform = 'translateY(-50px) scale(0.95)';
      basketModal.style.opacity = '0';
      basketModal.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
      requestAnimationFrame(() => {
        basketModal.style.transform = 'translateY(0) scale(1)';
        basketModal.style.opacity = '1';
      });
    }

    function hideBasket() {
      basketModal.style.transform = 'translateY(-50px) scale(0.95)';
      basketModal.style.opacity = '0';
      setTimeout(() => overlay.classList.add('hidden'), 350);
    }

    // --- Firebase stock helpers ---
    async function getStock(itemName) {
      const key = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const itemRef = ref(db, `items/${key}/stock`);
      const snapshot = await get(itemRef);
      if (snapshot.exists()) return snapshot.val();
      await set(ref(db, `items/${key}`), {
        name: itemName,
        price: parseFloat(document.querySelector(`button[data-name="${itemName}"]`)?.dataset.price || 0),
        stock: 1
      });
      return 1;
    }

    async function deductStock(item) {
      const itemRef = ref(db, `items/${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}/stock`);
      return runTransaction(itemRef, current => {
        if (current === null) return 0;
        if (current >= item.qty) return current - item.qty;
        else throw new Error(`Not enough stock for ${item.name}`);
      });
    }

    // --- Basket UI update ---
    async function updateBasketUI() {
      basketList.innerHTML = '';
      let total = 0, count = 0;

      for (let i = 0; i < basket.length; i++) {
        const item = basket[i];
        const stock = await getStock(item.name);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center';

        const left = document.createElement('div');
        left.className = 'text-sm';
        left.textContent = item.name;

        const qtyContainer = document.createElement('div');
        qtyContainer.className = 'flex items-center space-x-2';

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.className = 'bg-hero text-white px-2 rounded hover:bg-ink transition';
        minusBtn.addEventListener('click', () => {
          if (item.qty > 1) item.qty--; else basket.splice(i, 1);
          saveBasket(); updateBasketUI();
        });

        const qtyText = document.createElement('span');
        qtyText.textContent = item.qty;
        qtyText.className = 'w-5 text-center';

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.className = 'bg-hero text-white px-2 rounded hover:bg-ink transition';
        plusBtn.disabled = item.qty >= stock;
        plusBtn.addEventListener('click', async () => {
          const currentStock = await getStock(item.name);
          if (item.qty < currentStock) item.qty++;
          saveBasket(); updateBasketUI();
        });

        qtyContainer.append(minusBtn, qtyText, plusBtn);

        const right = document.createElement('div');
        right.className = 'flex items-center space-x-2';
        const priceSpan = document.createElement('span');
        priceSpan.textContent = `£${(item.price * item.qty).toFixed(2)}`;
        priceSpan.className = 'font-semibold';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'text-red-500 hover:text-red-700';
        removeBtn.addEventListener('click', () => {
          basket.splice(i, 1); saveBasket(); updateBasketUI();
        });

        right.append(priceSpan, removeBtn);
        itemDiv.append(left, qtyContainer, right);
        basketList.appendChild(itemDiv);

        total += item.price * item.qty;
        count += item.qty;
      }

      basketTotal.textContent = `Total: £${total.toFixed(2)}`;
      basketBtn.textContent = `🛒 Basket (${count})`;

      // Update buttons
      document.querySelectorAll('button.add-to-basket').forEach(async btn => {
        const name = btn.dataset.name;
        const stock = await getStock(name);
        const inBasket = basket.find(i => i.name === name);

        if (stock <= 0) {
          btn.textContent = 'Out of Stock'; btn.disabled = true;
          btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        } else if (inBasket) {
          btn.textContent = 'In Basket'; btn.disabled = false;
          btn.classList.add('bg-ink','text-white'); btn.classList.remove('bg-hero','hover:bg-ink','hover:text-white','bg-gray-400','cursor-not-allowed');
        } else {
          btn.textContent = 'Add to Basket'; btn.disabled = false;
          btn.classList.add('bg-hero','hover:bg-ink','hover:text-white'); btn.classList.remove('bg-ink','text-white','bg-gray-400','cursor-not-allowed');
        }
      });
    }

    // --- Add to Basket ---
    document.querySelectorAll('button.add-to-basket').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        const price = parseFloat(btn.dataset.price);
        const stock = await getStock(name);

        const existing = basket.find(i => i.name === name);
        if (existing) {
          if (existing.qty < stock) existing.qty++;
        } else if (stock > 0) {
          basket.push({name, price, qty:1});
        }

        saveBasket(); updateBasketUI();
      });
    });

    // --- Checkout ---
    checkoutBtn.addEventListener('click', () => {
      hideBasket(); deliveryModal.classList.remove('hidden');
    });

    // --- Street Autocomplete ---
    streetInput.addEventListener('input', async () => {
      const postcode = postcodeInput.value.trim();
      const term = streetInput.value.trim();
      streetSuggestions.innerHTML = '';
      if (!postcode || term.length < 2) return;
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}/autocomplete`);
        const data = await res.json();
        if (data.status === 200 && data.result) {
          const matches = data.result.filter(s => s.toLowerCase().includes(term.toLowerCase()));
          matches.forEach(s => {
            const div = document.createElement('div');
            div.textContent = s;
            div.className = 'p-1 hover:bg-gray-200 cursor-pointer';
            div.addEventListener('click', () => {
              streetInput.value = s; streetSuggestions.innerHTML = '';
            });
            streetSuggestions.appendChild(div);
          });
        }
      } catch (err) {}
    });

    // --- Confirm Delivery & Create Order ---
    submitDeliveryBtn.addEventListener('click', async () => {
      const postcode = postcodeInput.value.trim();
      const street = streetInput.value.trim();
      if (!postcode || !street) { alert("Fill all fields"); return; }

      let city = '';
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
        const data = await res.json();
        if (data.status !== 200 || !data.result) { alert("Invalid postcode"); return; }
        city = data.result.admin_district;
      } catch (err) { alert("Error validating postcode"); return; }

      cityInput.value = city;

      try {
        for (const item of basket) await deductStock(item);

        // --- Add order to Firebase ---
        const orderRef = ref(db, `orders/${Date.now()}`);
        await set(orderRef, {
          timestamp: new Date().toISOString(),
          postcode,
          city,
          street,
          items: basket.map(i => ({name:i.name, qty:i.qty, price:i.price})),
          price: basket.reduce((acc,i)=>acc+i.price*i.qty,0)
        });

        alert(`Purchase complete!\nDelivery to:\n${street}\n${city}\n${postcode}`);
        basket.length = 0; saveBasket(); updateBasketUI();
        deliveryModal.classList.add('hidden');
        postcodeInput.value=''; streetInput.value=''; cityInput.value=''; streetSuggestions.innerHTML='';
      } catch (err) { alert(err.message); }
    });

    // --- Init ---
    updateBasketUI();
    basketBtn.addEventListener('click', showBasket);
    overlay.addEventListener('click', e => { if(e.target === overlay) hideBasket(); });
  });
})();
