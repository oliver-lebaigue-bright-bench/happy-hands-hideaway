// basket.js — Modern Basket with animations + checkout + Firebase stock
(() => {
  document.addEventListener('DOMContentLoaded', () => {

    /* ================= FIREBASE ================= */
    const db = window.firebaseDB;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    // FIX: Use the global variable name directly from the window object to prevent "not a function" errors
    const set = window.firebaseSet || window.set; 
    const runTransaction = window.firebaseTransaction;

    /* ================= STORAGE ================= */
    const basket = JSON.parse(localStorage.getItem('basket')) || [];
    const rawWishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const wishlist = rawWishlist.filter(item => item && typeof item === 'string' && item.trim() !== '');

    const saveBasket = () =>
      localStorage.setItem('basket', JSON.stringify(basket));
    const saveWishlist = () =>
      localStorage.setItem('wishlist', JSON.stringify(wishlist));

    /* ================= HELPERS ================= */
    const keyFromName = name =>
      name.toLowerCase().replace(/[^a-z0-9]/g, '');

    async function getStock(name) {
      const stockRef = ref(db, `items/${keyFromName(name)}/stock`);
      const snap = await get(stockRef);
      return snap.exists() ? snap.val() : 0;
    }

    async function deductStock(item) {
      const itemRef = ref(db, `items/${keyFromName(item.name)}/stock`);
      return runTransaction(itemRef, current => {
        if (current === null) return 0;
        if (current >= item.qty) return current - item.qty;
        throw new Error(`Not enough stock for ${item.name}`);
      });
    }

    function getPriceFromName(name) {
      const btn = document.querySelector(`.add-to-basket[data-name="${name}"]`);
      return btn ? parseFloat(btn.dataset.price) : 0;
    }

    /* ================= OVERLAY & MODAL ================= */
    const overlay = document.createElement('div');
    overlay.className =
      'fixed inset-0 bg-black/50 hidden flex items-center justify-center z-50 backdrop-blur-sm';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className =
      'bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 relative max-h-[85vh] overflow-y-auto transform scale-95 opacity-0 transition-all duration-300';
    overlay.appendChild(modal);

    function openModal() {
      overlay.classList.remove('hidden');
      requestAnimationFrame(() => {
        modal.classList.remove('scale-95', 'opacity-0');
      });
      switchTab(currentTab);
    }

    function closeModal() {
      modal.classList.add('scale-95', 'opacity-0');
      setTimeout(() => overlay.classList.add('hidden'), 200);
      resetCheckoutState();
    }

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className =
      'absolute top-4 right-4 text-2xl text-gray-600 hover:text-red-600 transition';
    closeBtn.onclick = closeModal;
    modal.appendChild(closeBtn);

    /* ================= TABS ================= */
    const tabs = document.createElement('div');
    tabs.className = 'flex justify-around mb-4 border-b';

    const basketTab = document.createElement('button');
    const wishlistTab = document.createElement('button');
    basketTab.textContent = 'Basket';
    wishlistTab.textContent = 'Wishlist';

    [basketTab, wishlistTab].forEach(btn => {
      btn.className = 'py-2 px-4 font-semibold transition';
      tabs.appendChild(btn);
    });

    modal.appendChild(tabs);

    const basketList = document.createElement('div');
    const wishlistList = document.createElement('div');
    wishlistList.classList.add('hidden');

    const basketTotal = document.createElement('p');
    basketTotal.className = 'font-bold text-right mt-4';

    modal.append(basketList, wishlistList, basketTotal);

    /* === CHECKOUT FOOTER === */
    const checkoutContainer = document.createElement('div');
    checkoutContainer.className =
      'sticky bottom-0 mt-4 pt-4 bg-white border-t';
    modal.appendChild(checkoutContainer);

    let currentTab = 'basket';
    let isAnimating = false; 

    function switchTab(tab) {
      currentTab = tab;
      basketList.classList.toggle('hidden', tab !== 'basket');
      basketTotal.classList.toggle('hidden', tab !== 'basket');
      if (tab !== 'basket') resetCheckoutState();
      else renderCheckoutButton();
      checkoutContainer.classList.toggle('hidden', tab !== 'basket');
      wishlistList.classList.toggle('hidden', tab !== 'wishlist');
    }

    basketTab.onclick = () => switchTab('basket');
    wishlistTab.onclick = () => switchTab('wishlist');

    function resetCheckoutState() {
      if (isAnimating) return;
      renderCheckoutButton();
    }

    /* ================= BASKET UI ================= */
    async function updateBasketUI() {
      if (isAnimating) return;

      basketList.innerHTML = '';
      let total = 0;

      if (basket.length === 0) {
        basketList.innerHTML = '<div class="text-center text-gray-500 py-4">Your basket is empty.</div>';
      } else {
        for (const item of basket) {
          const row = document.createElement('div');
          row.className =
            'flex justify-between items-center bg-gray-50 p-3 rounded-xl shadow-sm mb-2';
          
          const left = document.createElement('div');
          left.textContent = `${item.name} × ${item.qty}`;

          const right = document.createElement('div');
          right.className = 'flex items-center gap-3';
          
          const price = document.createElement('span');
          price.textContent = `£${(item.price * item.qty).toFixed(2)}`;
          
          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.className = 'w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition text-lg leading-none';
          removeBtn.onclick = () => {
            const index = basket.indexOf(item);
            if (index > -1) {
              basket.splice(index, 1);
              updateBasketUI();
            }
          };

          right.append(price, removeBtn);
          row.append(left, right);
          basketList.appendChild(row);
          total += item.price * item.qty;
        }
      }

      basketTotal.textContent = `Total: £${total.toFixed(2)}`;
      saveBasket();
      updateCombinedButton();
      refreshAddButtons();
      renderCheckoutButton();
    }

    /* ================= WISHLIST UI ================= */
    function updateWishlistUI() {
      wishlistList.innerHTML = '';

      if (!wishlist.length) {
        wishlistList.innerHTML = '<div class="text-center text-gray-500 py-4">Your wishlist is empty.</div>';
      } else {
        wishlist.forEach(name => {
          const row = document.createElement('div');
          row.className =
            'flex justify-between items-center bg-gray-50 p-3 rounded-xl shadow-sm mb-2';

          const left = document.createElement('div');
          left.textContent = name;

          const right = document.createElement('div');
          right.className = 'flex items-center gap-2';

          const addBtn = document.createElement('button');
          addBtn.textContent = 'Add';
          addBtn.className = 'bg-hero text-white text-xs px-3 py-1 rounded-lg hover:opacity-90';
          addBtn.onclick = async () => {
            const price = getPriceFromName(name);
            if (price === 0) return;

            const stock = await getStock(name);
            const existing = basket.find(i => i.name === name);

            if (existing && existing.qty < stock) {
              existing.qty++;
            } else if (!existing && stock > 0) {
              basket.push({ name, price, qty: 1 });
            } else if (stock <= 0) {
              alert('Sorry, this item is now out of stock.');
              return;
            }

            wishlist.splice(wishlist.indexOf(name), 1);
            saveWishlist();
            updateWishlistUI();
            updateHeartButtons();
            updateBasketUI();
          };

          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.className = 'w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition text-lg leading-none';
          removeBtn.onclick = () => {
            const index = wishlist.indexOf(name);
            if (index > -1) {
              wishlist.splice(index, 1);
              saveWishlist();
              updateWishlistUI();
              updateHeartButtons();
            }
          };

          right.append(addBtn, removeBtn);
          row.append(left, right);
          wishlistList.appendChild(row);
        });
      }
      
      saveWishlist();
      updateCombinedButton();
    }

    function updateHeartButtons() {
      document.querySelectorAll('.wishlist-heart').forEach(heart => {
        const name = heart.dataset.name;
        heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
      });
    }

    /* ================= ADD BUTTON STATE ================= */
    async function refreshAddButtons() {
      document.querySelectorAll('.add-to-basket').forEach(async btn => {
        const name = btn.dataset.name;
        const stock = await getStock(name);
        const item = basket.find(i => i.name === name);

        btn.disabled = false;
        btn.className =
          'add-to-basket px-4 py-2 rounded-xl font-semibold transition';

        if (stock <= 0) {
          btn.textContent = 'Out of Stock';
          btn.disabled = true;
          btn.classList.add('bg-gray-400', 'text-white');
        } else if (item && item.qty >= stock) {
          btn.textContent = 'Max in Basket';
          btn.classList.add('bg-ink', 'text-white');
        } else if (item) {
          btn.textContent = 'In Basket';
          btn.classList.add('bg-ink', 'text-white');
        } else {
          btn.textContent = 'Add to Basket';
          btn.classList.add('bg-hero', 'text-white');
        }
        
        const heart = btn.nextElementSibling;
        if (heart) heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
      });
    }

        /* ================= CHECKOUT LOGIC ================= */
    function renderCheckoutButton() {
      checkoutContainer.innerHTML = '';
      if (!basket.length) return;

      const checkoutBtn = document.createElement('button');
      checkoutBtn.textContent = 'Checkout';
      checkoutBtn.className =
        'w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition';

      checkoutBtn.onclick = () => {
        renderDeliveryForm();
      };

      checkoutContainer.appendChild(checkoutBtn);
    }

    function renderDeliveryForm() {
      checkoutContainer.innerHTML = '';

      const form = document.createElement('div');
      form.className = 'space-y-3';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Full Name*';
      nameInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';
      
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.placeholder = 'Email Address';
      emailInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const addrInput = document.createElement('input');
      addrInput.type = 'text';
      addrInput.placeholder = 'Address Line 1';
      addrInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const postcodeInput = document.createElement('input');
      postcodeInput.type = 'text';
      postcodeInput.placeholder = 'UK Postcode';
      postcodeInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const notesInput = document.createElement('textarea');
      notesInput.rows = 3;
      notesInput.placeholder = 'Notes';
      notesInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const placeBtn = document.createElement('button');
      placeBtn.textContent = 'Place Order';
      placeBtn.className = 'w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 transition mt-2 relative overflow-hidden';
      
      nameInput.required = true;
      emailInput.required = true;
      addrInput.required = true;
      postcodeInput.required = true;


      placeBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const addr = addrInput.value.trim();
        const postcode = postcodeInput.value.trim();
        const notes = notesInput.value.trim();

        if (!name || !addr || !postcode || !email) {
          alert('Please fill in all delivery details.');
          return;
        }

        const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
        if (!postcodeRegex.test(postcode)) {
          alert('Please enter a valid UK Postcode.');
          return;
        }

        placeBtn.disabled = true;
        placeBtn.classList.add('opacity-100'); 
        placeBtn.classList.remove('hover:bg-green-800');

        try {
          // 1. Deduct Stock
          for (const item of basket) {
            await deductStock(item);
          }

          // 2. Save Order
          const orderRef = ref(db, `orders/${Date.now()}`);
          
          // === CRITICAL FIX ===
          // We dynamically look for the 'set' function on the window or firebase app object
          // to ensure we are calling the correct method.
          let firebaseSet = window.firebaseSet;
          if (!firebaseSet && window.firebaseApp) {
             firebaseSet = window.firebaseApp.database?.ref ? (path, val) => window.firebaseApp.database.ref(path).set(val) : null;
          }
          
          if (typeof firebaseSet === 'function') {
             await firebaseSet(orderRef, {
              items: basket,
              total: basket.reduce((a, b) => a + b.price * b.qty, 0),
              created: new Date().toISOString(),
              customer: {
                name: name,
                email: email,
                address: addr,
                postcode: postcode,
                notes: notes
              },
              status: 'pending'
            });
          } else {
            // Fallback or Error if set is still missing
            console.error('Firebase set function not found on window or app.');
            // Try standard set just in case variables were shadowed
            await set(orderRef, {
              items: basket,
              total: basket.reduce((a, b) => a + b.price * b.qty, 0),
              created: new Date().toISOString(),
              customer: {
                name: name,
                email: email,
                address: addr,
                postcode: postcode,
                notes: notes
              },
              status: 'pending'
            });
          }
          // === END FIX ===

          basket.length = 0; 
          saveBasket();

          playTruckAnimation(placeBtn, () => {
            isAnimating = false;
            updateBasketUI();
            closeModal();
          });

        } catch (err) {
          console.error(err);
          alert('Error placing order: ' + err.message);
          placeBtn.disabled = false;
          placeBtn.classList.add('hover:bg-green-800');
        }
      };

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back';
      backBtn.className = 'w-full text-gray-500 text-sm py-2 hover:underline';
      backBtn.onclick = renderCheckoutButton;

      form.append(nameInput, emailInput, addrInput, postcodeInput, notesInput, placeBtn, backBtn);
      checkoutContainer.appendChild(form);
    }

    /* ================= ANIMATION LOGIC ================= */
    function playTruckAnimation(btn, onComplete) {
      isAnimating = true;

      // Clear and setup button for animation
      btn.innerHTML = '';
      btn.className = 'w-full bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl overflow-hidden shadow-lg relative';
      btn.style.height = 'auto';
      btn.style.minHeight = '80px';
      btn.style.width = '100%';
      btn.style.padding = '0';

      // Create container for animation
      const animContainer = document.createElement('div');
      animContainer.style.cssText = 'position: relative; height: 200px; display: flex; align-items: center; justify-content: center; overflow: hidden;';
      
      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes confetti-fall {
          0% { transform: translate(0, -100%) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--tx), 300px) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-scale {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .success-icon {
          font-size: 60px;
          animation: pop-scale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .confetti {
          position: absolute;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);

      // Success checkmark
      const checkmark = document.createElement('div');
      checkmark.className = 'success-icon';
      checkmark.textContent = '✓';
      checkmark.style.cssText = 'color: #16a34a; z-index: 10;';
      animContainer.appendChild(checkmark);

      // Create confetti pieces
      for (let i = 0; i < 20; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        const emoji = ['🎉', '🎊', '✨', '🌟', '⭐'][Math.floor(Math.random() * 5)];
        confetti.textContent = emoji;
        confetti.style.cssText = `
          font-size: ${12 + Math.random() * 12}px;
          left: 50%;
          --tx: ${(Math.random() - 0.5) * 200}px;
          animation: confetti-fall ${1.5 + Math.random() * 1}s ease-out forwards;
          animation-delay: ${Math.random() * 0.3}s;
        `;
        animContainer.appendChild(confetti);
      }

      btn.appendChild(animContainer);

      // Phase 1: Show animation (1.5 seconds)
      setTimeout(() => {
        // Phase 2: Show success message
        animContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; animation: pop-scale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <div style="font-size: 36px; color: #16a34a;">🎉</div>
            <div style="font-weight: 700; color: #15803d; font-size: 18px;">Order Placed!</div>
            <div style="font-size: 12px; color: #4b5563;">Your delivery is on its way</div>
          </div>
        `;
        btn.className = 'w-full bg-white border-2 border-green-500 rounded-xl shadow-lg py-4';
        btn.style.minHeight = 'auto';

        // Phase 3: Complete after 2 more seconds
        setTimeout(() => {
          isAnimating = false;
          onComplete();
        }, 2000);
      }, 1500);
    }
    /* ================= FLOATING BUTTON ================= */
    const floating = document.createElement('button');
    floating.className =
      'fixed top-20 right-6 bg-accent text-white px-6 py-3 rounded-2xl shadow-xl hover:scale-105 transition';
    document.body.appendChild(floating);

    function updateCombinedButton() {
      const basketCount = basket.reduce((a, b) => a + b.qty, 0);
      const wishlistCount = Math.max(0, wishlist.length);
      floating.textContent = `🛒 ${basketCount} | ❤️ ${wishlistCount}`;
    }

    floating.onclick = openModal;

    /* ================= PRODUCT BUTTONS (EVENT DELEGATION FOR DYNAMIC ITEMS) ================= */
    // Use event delegation so buttons created dynamically still work
    document.addEventListener('click', async (e) => {
      // Handle Add to Basket button
      if (e.target.classList.contains('add-to-basket')) {
        const btn = e.target;
        const name = btn.dataset.name;
        const price = parseFloat(btn.dataset.price);
        
        const stock = await getStock(name);
        const existing = basket.find(i => i.name === name);

        if (existing && existing.qty < stock) existing.qty++;
        else if (!existing && stock > 0)
          basket.push({ name, price, qty: 1 });

        saveBasket();
        updateBasketUI();
      }

      // Handle Wishlist heart button
      if (e.target.classList.contains('wishlist-heart')) {
        const heart = e.target;
        const name = heart.dataset.name;
        
        if (wishlist.includes(name))
          wishlist.splice(wishlist.indexOf(name), 1);
        else wishlist.push(name);

        heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
        saveWishlist();
        updateWishlistUI();
      }
    });

    // Attach heart buttons to existing buttons and watch for new ones
    const attachHeartButtons = () => {
      document.querySelectorAll('.add-to-basket').forEach(btn => {
        if (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('wishlist-heart')) {
          const name = btn.dataset.name;
          const heart = document.createElement('button');
          heart.type = 'button';
          heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
          heart.className = 'wishlist-heart ml-3 text-2xl hover:scale-110 transition';
          heart.dataset.name = name;
          btn.after(heart);
        }
      });
    };

    // Initial attachment
    attachHeartButtons();

    // Re-attach when products load dynamically
    const observer = new MutationObserver(attachHeartButtons);
    observer.observe(document.body, { childList: true, subtree: true });

    /* ================= INIT ================= */
    updateBasketUI();
    updateWishlistUI();
    refreshAddButtons();
  });
})();