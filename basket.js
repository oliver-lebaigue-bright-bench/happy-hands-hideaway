// basket.js — Modern Basket with full delivery modal and Firebase stock
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

    // --- Overlay ---
    const overlay = document.createElement('div');
    overlay.id = 'basket-overlay';
    overlay.className = `
      fixed inset-0 bg-black bg-opacity-50 hidden flex justify-center items-center z-50
      backdrop-blur-sm transition-opacity
    `;
    document.body.appendChild(overlay);

    // --- Basket Modal ---
    const basketModal = document.createElement('div');
    basketModal.id = 'basket-modal';
    basketModal.className = `
      bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 flex flex-col relative
      max-h-[85vh] overflow-y-auto animate-fadeIn
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'absolute top-4 right-4 text-gray-600 hover:text-red-600 font-bold text-2xl transition';
    closeBtn.addEventListener('click', () => hideBasket());
    basketModal.appendChild(closeBtn);

    // Title
    const basketTitle = document.createElement('h3');
    basketTitle.textContent = 'Your Basket';
    basketTitle.className = 'text-center font-bold text-3xl mb-6 text-gray-800';
    basketModal.appendChild(basketTitle);

    // Basket list
    const basketList = document.createElement('div');
    basketList.id = 'basket-list';
    basketList.className = 'space-y-4';
    basketModal.appendChild(basketList);

    // Total
    const basketTotal = document.createElement('p');
    basketTotal.id = 'basket-total';
    basketTotal.className = 'font-bold text-lg mt-6 text-right text-gray-800';
    basketModal.appendChild(basketTotal);

    // Checkout button
    const checkoutBtn = document.createElement('button');
    checkoutBtn.textContent = 'Checkout';
    checkoutBtn.className = `
      mt-6 w-full bg-hero text-white py-3 rounded-2xl font-semibold text-lg hover:bg-ink
      transition shadow-lg
    `;
    basketModal.appendChild(checkoutBtn);

    overlay.appendChild(basketModal);

    // --- Delivery Modal ---
    const deliveryModal = document.createElement('div');
    deliveryModal.id = 'delivery-modal';
    deliveryModal.className = `
      fixed inset-0 bg-black bg-opacity-50 hidden flex justify-center items-center z-50
      backdrop-blur-sm transition-opacity
    `;

    const deliveryForm = document.createElement('div');
    deliveryForm.className = `
      bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 flex flex-col relative
      max-h-[90vh] overflow-y-auto animate-fadeIn
    `;

    const closeDeliveryBtn = document.createElement('button');
    closeDeliveryBtn.textContent = '✕';
    closeDeliveryBtn.className = 'absolute top-4 right-4 text-gray-600 hover:text-red-600 font-bold text-2xl transition';
    closeDeliveryBtn.addEventListener('click', () => deliveryModal.classList.add('hidden'));
    deliveryForm.appendChild(closeDeliveryBtn);

    const deliveryTitle = document.createElement('h3');
    deliveryTitle.textContent = 'Delivery Details';
    deliveryTitle.className = 'text-center font-bold text-3xl mb-6 text-gray-800';
    deliveryForm.appendChild(deliveryTitle);

    // Helper to create labeled input
    function createLabeledInput(labelText, placeholder, type='text', required=true) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-4 flex flex-col';
      const label = document.createElement('label');
      label.textContent = labelText;
      label.className = 'mb-1 font-semibold text-gray-700';
      const input = document.createElement('input');
      input.placeholder = placeholder;
      input.type = type;
      input.className = `
        p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-hero
        transition
      `;
      if (required) input.required = true;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      deliveryForm.appendChild(wrapper);
      return input;
    }

    // Delivery fields
    const fullNameInput = createLabeledInput('Full Name', 'John Doe');
    const phoneInput = createLabeledInput('Phone Number', '07123 456789', 'tel');
    const houseInput = createLabeledInput('House Number / Name', '12B');
    const streetInput = createLabeledInput('Street', 'Baker Street');
    const cityInput = createLabeledInput('City/Town', 'London');
    const countyInput = createLabeledInput('County', 'Greater London', 'text', false);
    const postcodeInput = createLabeledInput('Postcode', 'SW1A 1AA');

    // Street suggestions
    const streetSuggestions = document.createElement('div');
    streetSuggestions.className = 'mb-4 p-2 border border-gray-300 rounded-xl bg-white max-h-36 overflow-y-auto';
    deliveryForm.appendChild(streetSuggestions);

    // Confirm & Pay
    const submitDeliveryBtn = document.createElement('button');
    submitDeliveryBtn.textContent = 'Confirm & Pay';
    submitDeliveryBtn.className = `
      mt-6 bg-hero text-white py-3 rounded-2xl font-semibold text-lg hover:bg-ink
      transition shadow-lg
    `;
    deliveryForm.appendChild(submitDeliveryBtn);
    deliveryModal.appendChild(deliveryForm);
    document.body.appendChild(deliveryModal);

    // --- Basket Button ---
    const basketBtn = document.createElement('button');
    basketBtn.id = 'basket-btn';
    basketBtn.className = `
      fixed top-6 right-6 bg-accent text-white font-bold py-3 px-6 rounded-2xl shadow-xl z-50
      hover:bg-yellow-500 transition text-lg
    `;
    document.body.appendChild(basketBtn);

    // --- Modal show/hide ---
    function showBasket() {
      overlay.classList.remove('hidden');
      basketModal.style.transform = 'translateY(-20px)';
      basketModal.style.opacity = '0';
      basketModal.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      requestAnimationFrame(() => {
        basketModal.style.transform = 'translateY(0)';
        basketModal.style.opacity = '1';
      });
    }
    function hideBasket() { overlay.classList.add('hidden'); }

    basketBtn.addEventListener('click', showBasket);
    overlay.addEventListener('click', e => { if(e.target === overlay) hideBasket(); });
    checkoutBtn.addEventListener('click', () => { hideBasket(); deliveryModal.classList.remove('hidden'); });

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

    // --- Update basket UI ---
    async function updateBasketUI() {
      basketList.innerHTML = '';
      let total = 0, count = 0;

      for (let i = 0; i < basket.length; i++) {
        const item = basket[i];
        const stock = await getStock(item.name);

        // Item card
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-xl shadow-sm hover:shadow-md transition';

        const left = document.createElement('div');
        left.className = 'flex flex-col';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameSpan.className = 'font-semibold text-gray-800';
        left.appendChild(nameSpan);

        const qtyContainer = document.createElement('div');
        qtyContainer.className = 'flex items-center space-x-2 mt-1';

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.className = 'bg-hero text-white px-3 rounded-full hover:bg-ink transition';
        minusBtn.addEventListener('click', () => {
          if (item.qty > 1) item.qty--; else basket.splice(i, 1);
          saveBasket(); updateBasketUI();
        });

        const qtyText = document.createElement('span');
        qtyText.textContent = item.qty;
        qtyText.className = 'w-6 text-center font-medium';

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.className = 'bg-hero text-white px-3 rounded-full hover:bg-ink transition';
        plusBtn.disabled = item.qty >= stock;
        plusBtn.addEventListener('click', async () => {
          const currentStock = await getStock(item.name);
          if (item.qty < currentStock) item.qty++;
          saveBasket(); updateBasketUI();
        });

        qtyContainer.append(minusBtn, qtyText, plusBtn);
        left.appendChild(qtyContainer);

        const right = document.createElement('div');
        right.className = 'flex flex-col items-end space-y-1';
        const priceSpan = document.createElement('span');
        priceSpan.textContent = `£${(item.price * item.qty).toFixed(2)}`;
        priceSpan.className = 'font-semibold text-gray-800';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'text-red-500 hover:text-red-700';
        removeBtn.addEventListener('click', () => { basket.splice(i, 1); saveBasket(); updateBasketUI(); });

        right.append(priceSpan, removeBtn);

        itemDiv.append(left, right);
        basketList.appendChild(itemDiv);

        total += item.price * item.qty;
        count += item.qty;
      }

      basketTotal.textContent = `Total: £${total.toFixed(2)}`;
      basketBtn.textContent = `🛒 Basket (${count})`;

      // Update add-to-basket buttons
      document.querySelectorAll('button.add-to-basket').forEach(async btn => {
        const name = btn.dataset.name;
        const stock = await getStock(name);
        const inBasket = basket.find(i => i.name === name);

        if (stock <= 0) {
          btn.textContent = 'Out of Stock'; btn.disabled = true;
          btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        } else if (inBasket) {
          btn.textContent = 'In Basket'; btn.disabled = false;
          btn.classList.add('bg-ink','text-white'); 
          btn.classList.remove('bg-hero','hover:bg-ink','hover:text-white','bg-gray-400','cursor-not-allowed');
        } else {
          btn.textContent = 'Add to Basket'; btn.disabled = false;
          btn.classList.add('bg-hero','hover:bg-ink','hover:text-white'); 
          btn.classList.remove('bg-ink','text-white','bg-gray-400','cursor-not-allowed');
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

    // --- Confirm Delivery ---
    submitDeliveryBtn.addEventListener('click', async () => {
      const fullName = fullNameInput.value.trim();
      const phone = phoneInput.value.trim();
      const house = houseInput.value.trim();
      const street = streetInput.value.trim();
      const city = cityInput.value.trim();
      const county = countyInput.value.trim();
      const postcode = postcodeInput.value.trim();

      if (!fullName || !phone || !house || !street || !city || !postcode) {
        alert("Please fill in all required fields.");
        return;
      }

      try {
        for (const item of basket) await deductStock(item);

        const orderRef = ref(db, `orders/${crypto.randomUUID()}`);
        await set(orderRef, {
          timestamp: new Date().toISOString(),
          fullName, phone, house, street, city, county, postcode,
          items: basket.map(i => ({name:i.name, qty:i.qty, price:i.price})),
          price: basket.reduce((acc,i)=>acc+i.price*i.qty,0)
        });

        alert(`Purchase complete!\nDelivery to:\n${house} ${street}, ${city}, ${county || ''}, ${postcode}`);
        basket.length = 0; saveBasket(); updateBasketUI();
        deliveryModal.classList.add('hidden');

        fullNameInput.value=''; phoneInput.value=''; houseInput.value='';
        streetInput.value=''; cityInput.value=''; countyInput.value=''; postcodeInput.value='';
        streetSuggestions.innerHTML='';

      } catch(err){ alert(err.message); }
    });

    // --- Init ---
    updateBasketUI();
  });
})();
