// basket.js — Modern Basket with animations + checkout + Firebase stock
(() => {
  document.addEventListener('DOMContentLoaded', () => {

    /* ================= FIREBASE ================= */
    const db = window.firebaseDB;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    const set = window.firebaseSet;
    const runTransaction = window.firebaseTransaction;

    /* ================= STORAGE ================= */
    const basket = JSON.parse(localStorage.getItem('basket')) || [];
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

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

    /* === CHECKOUT FOOTER (IMPORTANT FIX) === */
    const checkoutContainer = document.createElement('div');
    checkoutContainer.className =
      'sticky bottom-0 mt-4 pt-4 bg-white border-t';
    modal.appendChild(checkoutContainer);

    let currentTab = 'basket';
    function switchTab(tab) {
      currentTab = tab;
      basketList.classList.toggle('hidden', tab !== 'basket');
      basketTotal.classList.toggle('hidden', tab !== 'basket');
      checkoutContainer.classList.toggle('hidden', tab !== 'basket');
      wishlistList.classList.toggle('hidden', tab !== 'wishlist');
    }

    basketTab.onclick = () => switchTab('basket');
    wishlistTab.onclick = () => switchTab('wishlist');

    /* ================= BASKET UI ================= */
    async function updateBasketUI() {
      basketList.innerHTML = '';
      let total = 0;

      for (const item of basket) {
        const row = document.createElement('div');
        row.className =
          'flex justify-between items-center bg-gray-50 p-3 rounded-xl shadow-sm animate-[pop_0.2s_ease-out]';

        const left = document.createElement('div');
        left.textContent = `${item.name} × ${item.qty}`;

        const right = document.createElement('div');
        right.textContent = `£${(item.price * item.qty).toFixed(2)}`;

        row.append(left, right);
        basketList.appendChild(row);
        total += item.price * item.qty;
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
        wishlistList.textContent = 'Your wishlist is empty.';
        return;
      }

      wishlist.forEach(name => {
        const row = document.createElement('div');
        row.className =
          'flex justify-between items-center bg-gray-50 p-3 rounded-xl';
        row.textContent = name;
        wishlistList.appendChild(row);
      });

      saveWishlist();
      updateCombinedButton();
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
      });
    }

    /* ================= CHECKOUT ================= */
    function renderCheckoutButton() {
      checkoutContainer.innerHTML = '';
      if (!basket.length) return;

      const checkoutBtn = document.createElement('button');
      checkoutBtn.textContent = 'Checkout';
      checkoutBtn.className =
        'w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition';

      checkoutBtn.onclick = async () => {
        try {
          for (const item of basket) {
            await deductStock(item);
          }

          const orderRef = ref(db, `orders/${Date.now()}`);
          await set(orderRef, {
            items: basket,
            total: basket.reduce((a, b) => a + b.price * b.qty, 0),
            created: new Date().toISOString()
          });

          basket.length = 0;
          saveBasket();
          updateBasketUI();
          closeModal();
          alert('Order placed successfully 🎉');

        } catch (err) {
          alert(err.message);
        }
      };

      checkoutContainer.appendChild(checkoutBtn);
    }

    /* ================= FLOATING BUTTON ================= */
    const floating = document.createElement('button');
    floating.className =
      'fixed top-20 right-6 bg-accent text-white px-6 py-3 rounded-2xl shadow-xl hover:scale-105 transition';
    document.body.appendChild(floating);

    function updateCombinedButton() {
      const count = basket.reduce((a, b) => a + b.qty, 0);
      floating.textContent = `🛒 ${count} | ❤️ ${wishlist.length}`;
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
