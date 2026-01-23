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

    // --- Wishlist data ---
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || []);
    function saveWishlist() { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }

    // --- Overlay ---
    const overlay = document.createElement('div');
    overlay.id = 'basket-overlay';
    overlay.className = `
      fixed inset-0 bg-black bg-opacity-50 hidden flex justify-center items-center z-50
      backdrop-blur-sm transition-opacity
    `;
    document.body.appendChild(overlay);

    // --- Cart Modal (merged basket and wishlist) ---
    const cartModal = document.createElement('div');
    cartModal.id = 'cart-modal';
    cartModal.className = `
      bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 flex flex-col relative
      max-h-[85vh] overflow-y-auto animate-fadeIn
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'absolute top-4 right-4 text-gray-600 hover:text-red-600 font-bold text-2xl transition';
    closeBtn.addEventListener('click', () => hideCart());
    cartModal.appendChild(closeBtn);

    // Tabs
    const tabContainer = document.createElement('div');
    tabContainer.className = 'flex justify-center mb-6 border-b border-gray-200';
    const basketTab = document.createElement('button');
    basketTab.textContent = 'Basket';
    basketTab.className = 'px-4 py-2 font-semibold text-gray-800 border-b-2 border-transparent hover:border-hero transition';
    const wishlistTab = document.createElement('button');
    wishlistTab.textContent = 'Wishlist';
    wishlistTab.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent hover:border-hero transition';
    tabContainer.appendChild(basketTab);
    tabContainer.appendChild(wishlistTab);
    cartModal.appendChild(tabContainer);

    // Basket Content
    const basketContent = document.createElement('div');
    basketContent.id = 'basket-content';
    basketContent.className = 'flex flex-col';

    const basketTitle = document.createElement('h3');
    basketTitle.textContent = 'Your Basket';
    basketTitle.className = 'text-center font-bold text-3xl mb-6 text-gray-800';
    basketContent.appendChild(basketTitle);

    const basketList = document.createElement('div');
    basketList.id = 'basket-list';
    basketList.className = 'space-y-4';
    basketContent.appendChild(basketList);

    const basketTotal = document.createElement('p');
    basketTotal.id = 'basket-total';
    basketTotal.className = 'font-bold text-lg mt-6 text-right text-gray-800';
    basketContent.appendChild(basketTotal);

    const checkoutBtn = document.createElement('button');
    checkoutBtn.textContent = 'Checkout';
    checkoutBtn.className = `
      mt-6 w-full bg-hero text-white py-3 rounded-2xl font-semibold text-lg hover:bg-ink
      transition shadow-lg
    `;
    basketContent.appendChild(checkoutBtn);

    // Wishlist Content
    const wishlistContent = document.createElement('div');
    wishlistContent.id = 'wishlist-content';
    wishlistContent.className = 'flex flex-col hidden';

    const wishlistTitle = document.createElement('h3');
    wishlistTitle.textContent = 'Your Wishlist';
    wishlistTitle.className = 'text-center font-bold text-3xl mb-6 text-gray-800';
    wishlistContent.appendChild(wishlistTitle);

    const wishlistList = document.createElement('div');
    wishlistList.id = 'wishlist-list';
    wishlistList.className = 'space-y-4';
    wishlistContent.appendChild(wishlistList);

    const wishlistEmpty = document.createElement('p');
    wishlistEmpty.textContent = 'Your wishlist is empty.';
    wishlistEmpty.className = 'text-center text-gray-500';
    wishlistList.appendChild(wishlistEmpty);

    cartModal.appendChild(basketContent);
    cartModal.appendChild(wishlistContent);

    overlay.appendChild(cartModal);

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

    // --- Cart Button (merged) ---
    const cartBtn = document.createElement('button');
    cartBtn.id = 'cart-btn';
    cartBtn.className = `
      fixed top-6 right-6 bg-accent text-white font-bold py-3 px-6 rounded-2xl shadow-xl
      hover:bg-yellow-500 transition text-lg z-50
    `;
    document.body.appendChild(cartBtn);
        // --- Modal show/hide ---
    let currentTab = 'basket';
    function showCart(tab = 'basket') {
      currentTab = tab;
      overlay.classList.remove('hidden');
      cartModal.classList.remove('hidden');
      cartModal.style.transform = 'translateY(-20px)';
      cartModal.style.opacity = '0';
      cartModal.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      requestAnimationFrame(() => {
        cartModal.style.transform = 'translateY(0)';
        cartModal.style.opacity = '1';
      });
      updateTabUI();
    }
    function hideCart() { overlay.classList.add('hidden'); }

    function updateTabUI() {
      if (currentTab === 'basket') {
        basketTab.className = 'px-4 py-2 font-semibold text-gray-800 border-b-2 border-hero transition';
        wishlistTab.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent hover:border-hero transition';
        basketContent.classList.remove('hidden');
        wishlistContent.classList.add('hidden');
      } else {
        basketTab.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent hover:border-hero transition';
        wishlistTab.className = 'px-4 py-2 font-semibold text-gray-800 border-b-2 border-hero transition';
        basketContent.classList.add('hidden');
        wishlistContent.classList.remove('hidden');
      }
    }

    basketTab.addEventListener('click', () => { currentTab = 'basket'; updateTabUI(); });
    wishlistTab.addEventListener('click', () => { currentTab = 'wishlist'; updateTabUI(); });

    cartBtn.addEventListener('click', () => showCart());
    checkoutBtn.addEventListener('click', () => { hideCart(); deliveryModal.classList.remove('hidden'); });
    closeBtn.addEventListener('click', hideCart);
    overlay.addEventListener('click', e => { if(e.target === overlay) hideCart(); });

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
      cartBtn.textContent = `🛒 Basket (${count}) ❤️ (${wishlist.length})`;

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

    // --- Update wishlist UI ---
    function updateWishlistUI() {
      wishlistList.innerHTML = '';
      if (wishlist.length === 0) {
        wishlistList.appendChild(wishlistEmpty);
        return;
      }

      wishlist.forEach((item, i) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-xl shadow-sm hover:shadow-md transition';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item;
        nameSpan.className = 'font-semibold text-gray-800';
        itemDiv.appendChild(nameSpan);

        const right = document.createElement('div');
        right.className = 'flex space-x-2';

        const addToBasketBtn = document.createElement('button');
        addToBasketBtn.textContent = 'Add to Basket';
        addToBasketBtn.className = 'bg-hero text-white px-4 py-2 rounded-lg hover:bg-ink transition';
        addToBasketBtn.addEventListener('click', () => {
          const price = parseFloat(document.querySelector(`button[data-name="${item}"]`)?.dataset.price || 0);
          const existing = basket.find(b => b.name === item);
          if (existing) existing.qty++;
          else basket.push({name: item, price, qty: 1});
          saveBasket(); updateBasketUI();
        });
        right.appendChild(addToBasketBtn);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'text-red-500 hover:text-red-700';
        removeBtn.addEventListener('click', () => { wishlist.splice(i, 1); saveWishlist(); updateWishlistUI(); });
        right.appendChild(removeBtn);

        itemDiv.appendChild(right);
        wishlistList.appendChild(itemDiv);
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

    // --- Wishlist Toggle (Heart Icon) ---
    document.querySelectorAll('button.add-to-basket').forEach(btn => {
      const name = btn.dataset.name;
      const heartBtn = document.createElement('button');
            heartBtn.addEventListener('click', () => {
        if (wishlist.includes(name)) {
          wishlist.splice(wishlist.indexOf(name), 1);
          heartBtn.textContent = '🤍';
        } else {
          wishlist.push(name);
          heartBtn.textContent = '❤️';
        }
        saveWishlist(); updateWishlistUI(); updateBasketUI(); // Update button text
      });
      btn.parentNode.insertBefore(heartBtn, btn.nextSibling);
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
    updateWishlistUI();
  });
})();