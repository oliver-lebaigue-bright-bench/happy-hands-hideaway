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
      document.querySelectorAll('.add-to-basket').forEach(btn => {
        const name = btn.dataset.name;
        const heart = btn.nextElementSibling;
        if (heart && (heart.textContent === '❤️' || heart.textContent === '🤍')) {
           heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
        }
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
      nameInput.placeholder = 'Full Name';
      nameInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';
      
      const addrInput = document.createElement('input');
      addrInput.type = 'text';
      addrInput.placeholder = 'Address Line 1';
      addrInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const postcodeInput = document.createElement('input');
      postcodeInput.type = 'text';
      postcodeInput.placeholder = 'UK Postcode';
      postcodeInput.className = 'w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

      const placeBtn = document.createElement('button');
      placeBtn.textContent = 'Place Order';
      placeBtn.className = 'w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 transition mt-2 relative overflow-hidden';

      placeBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const addr = addrInput.value.trim();
        const postcode = postcodeInput.value.trim();

        if (!name || !addr || !postcode) {
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
                address: addr,
                postcode: postcode
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
                address: addr,
                postcode: postcode
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

      form.append(nameInput, addrInput, postcodeInput, placeBtn, backBtn);
      checkoutContainer.appendChild(form);
    }

    /* ================= ANIMATION LOGIC ================= */
    function playTruckAnimation(btn, onComplete) {
      isAnimating = true;

      // 1. Setup Canvas
      btn.innerHTML = '';
      btn.className = 'w-full bg-sky-100 border-2 border-sky-200 rounded-xl overflow-hidden shadow-inner relative';
      btn.style.height = '140px'; 
      btn.style.width = '100%';

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 400 140");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.display = 'block';

      // --- GRAPHICS ---
      
      // Road
      const road = document.createElementNS(svgNS, "line");
      road.setAttribute("x1", "0");
      road.setAttribute("y1", "115");
      road.setAttribute("x2", "400");
      road.setAttribute("y2", "115");
      road.setAttribute("stroke", "#94a3b8");
      road.setAttribute("stroke-width", "4");
      svg.appendChild(road);

      // Main Truck Group
      const truckGroup = document.createElementNS(svgNS, "g");
      
      // Trailer Body
      const trailer = document.createElementNS(svgNS, "path");
      trailer.setAttribute("d", "M 10 40 L 130 40 L 130 100 L 10 100 Z");
      trailer.setAttribute("fill", "#3b82f6");
      trailer.setAttribute("stroke", "#1d4ed8");
      trailer.setAttribute("stroke-width", "2");

      // Cab Body
      const cab = document.createElementNS(svgNS, "path");
      cab.setAttribute("d", "M 135 50 L 170 50 L 175 100 L 135 100 Z");
      cab.setAttribute("fill", "#2563eb");
      
      // Window
      const window = document.createElementNS(svgNS, "path");
      window.setAttribute("d", "M 138 55 L 165 55 L 168 75 L 138 75 Z");
      window.setAttribute("fill", "#bae6fd");

      // Wheels (Back)
      const wheelBack = createWheel(svgNS, 40, 100);
      const wheelMid = createWheel(svgNS, 90, 100);
      const wheelFront = createWheel(svgNS, 155, 100);

      // Package (Start High)
      const packageBox = document.createElementNS(svgNS, "rect");
      packageBox.setAttribute("x", "50");
      packageBox.setAttribute("y", "-60"); // High
      packageBox.setAttribute("width", "40");
      packageBox.setAttribute("height", "40");
      packageBox.setAttribute("fill", "#d97706");
      packageBox.setAttribute("stroke", "#92400e");
      packageBox.setAttribute("stroke-width", "3");
      // Add detail to box
      const boxDetail = document.createElementNS(svgNS, "line");
      boxDetail.setAttribute("x1", "50");
      boxDetail.setAttribute("y1", "-60");
      boxDetail.setAttribute("x2", "90");
      boxDetail.setAttribute("y2", "-20");
      boxDetail.setAttribute("stroke", "#92400e");
      boxDetail.setAttribute("stroke-width", "2");

      const packageGroup = document.createElementNS(svgNS, "g");
      packageGroup.appendChild(packageBox);
      packageGroup.appendChild(boxDetail);

      // Smoke Particles Group
      const smokeGroup = document.createElementNS(svgNS, "g");

      truckGroup.appendChild(trailer);
      truckGroup.appendChild(cab);
      truckGroup.appendChild(window);
      truckGroup.appendChild(wheelBack);
      truckGroup.appendChild(wheelMid);
      truckGroup.appendChild(wheelFront);
      truckGroup.appendChild(packageGroup);
      
      svg.appendChild(smokeGroup);
      svg.appendChild(truckGroup);
      btn.appendChild(svg);

      // --- ANIMATION SEQUENCER ---

      // Phase 1: Truck Enters (Smooth deceleration)
      const enterAnim = truckGroup.animate([
        { transform: 'translate(400px, 0)' },
        { transform: 'translate(130px, 0)' } // Stop in center
      ], {
        duration: 1000,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
      });

      // Wheel Spin during entry
      const spinWheels = (duration) => {
        [wheelBack, wheelMid, wheelFront].forEach(w => {
           w.animate([
             { transform: 'rotate(0deg)' },
             { transform: `rotate(${360 * (duration/1000) * 2}deg)` } // Rough spin calc
           ], { duration: duration, easing: 'linear', fill: 'forwards' });
        });
      };
      spinWheels(1000);

      enterAnim.onfinish = () => {
        // Phase 2: Package Drops (Heavy gravity)
        packageGroup.animate([
          { transform: 'translate(0, 0)' },
          { transform: 'translate(0, 110px)' } // Fall into trailer
        ], {
          duration: 600,
          easing: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)', // Heavy thud
          fill: 'forwards'
        }).onfinish = () => {
          
          // Phase 3: Impact & Bounce
          
          // Button Shake
          btn.animate([
            { transform: 'translate(0,0)' },
            { transform: 'translate(0,4px)' },
            { transform: 'translate(0,0)' }
          ], { duration: 150, easing: 'ease-out' });

          // Truck Suspension Dip
          const suspAnim = truckGroup.animate([
            { transform: 'translate(130px, 0)' },
            { transform: 'translate(130px, 8px)' },
            { transform: 'translate(130px, 0)' }
          ], {
            duration: 400,
            easing: 'ease-out'
          });

          suspAnim.onfinish = () => {
            // Phase 4: Drive Away (Accelerate)
            
            // Spawn Smoke
            createSmoke(svgNS, smokeGroup, 175, 95);
            setTimeout(() => createSmoke(svgNS, smokeGroup, 175, 95), 200);

            const exitAnim = truckGroup.animate([
              { transform: 'translate(130px, 0)' },
              { transform: 'translate(-250px, 0)' }
            ], {
              duration: 1200,
              easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)', // Fast start
              fill: 'forwards'
            });

            // Spin wheels fast
            spinWheels(1200);

            exitAnim.onfinish = () => {
              // Phase 5: Success
              btn.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
                  <div style="font-size:24px;">🎉</div>
                  <div style="font-weight:bold; color:#15803d; font-size:20px;">Order Placed!</div>
                </div>
              `;
              btn.className = 'w-full bg-white border-2 border-green-500 rounded-xl shadow-lg';
              
              setTimeout(() => {
                onComplete();
              }, 1200);
            };
          };
        };
      };
    }

    // Helper to create a wheel
    function createWheel(svgNS, cx, cy) {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(${cx}, ${cy})`);
      
      const tire = document.createElementNS(svgNS, "circle");
      tire.setAttribute("r", "14");
      tire.setAttribute("fill", "#333");
      
      const rim = document.createElementNS(svgNS, "circle");
      rim.setAttribute("r", "8");
      rim.setAttribute("fill", "#cbd5e1");
      
      const spoke1 = document.createElementNS(svgNS, "rect");
      spoke1.setAttribute("x", "-1");
      spoke1.setAttribute("y", "-8");
      spoke1.setAttribute("width", "2");
      spoke1.setAttribute("height", "16");
      spoke1.setAttribute("fill", "#94a3b8");

      const spoke2 = document.createElementNS(svgNS, "rect");
      spoke2.setAttribute("x", "-8");
      spoke2.setAttribute("y", "-1");
      spoke2.setAttribute("width", "16");
      spoke2.setAttribute("height", "2");
      spoke2.setAttribute("fill", "#94a3b8");

      g.appendChild(tire);
      g.appendChild(rim);
      g.appendChild(spoke1);
      g.appendChild(spoke2);
      return g;
    }

    // Helper to create smoke puff
    function createSmoke(svgNS, group, x, y) {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", "5");
      circle.setAttribute("fill", "#cbd5e1");
      circle.setAttribute("opacity", "0.8");
      group.appendChild(circle);

      circle.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 0.8 },
        { transform: 'translate(-20px, -10px) scale(2)', opacity: 0 }
      ], {
        duration: 800,
        easing: 'ease-out',
        fill: 'forwards'
      }).onfinish = () => circle.remove();
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

    /* ================= PRODUCT BUTTONS ================= */
    document.querySelectorAll('.add-to-basket').forEach(btn => {
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);

      btn.onclick = async () => {
        const stock = await getStock(name);
        const existing = basket.find(i => i.name === name);

        if (existing && existing.qty < stock) existing.qty++;
        else if (!existing && stock > 0)
          basket.push({ name, price, qty: 1 });

        updateBasketUI();
      };

      const heart = document.createElement('button');
      heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
      heart.className = 'ml-3 text-2xl hover:scale-110 transition';

      heart.onclick = () => {
        if (wishlist.includes(name))
          wishlist.splice(wishlist.indexOf(name), 1);
        else wishlist.push(name);

        heart.textContent = wishlist.includes(name) ? '❤️' : '🤍';
        updateWishlistUI();
      };

      btn.after(heart);
    });

    /* ================= INIT ================= */
    updateBasketUI();
    updateWishlistUI();
    refreshAddButtons();
  });
})();