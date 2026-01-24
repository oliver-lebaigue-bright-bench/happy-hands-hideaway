// basket.js — Modern Basket with combined modal, delivery, wishlist, and Firebase stock
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase globals ---
    const db = window.firebaseDB;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    const runTransaction = window.firebaseTransaction;
    const set = window.firebaseSet || ((r, v) => runTransaction(r, () => v));

    // --- Basket and Wishlist ---
    const basket = JSON.parse(localStorage.getItem('basket')) || [];
    function saveBasket() { localStorage.setItem('basket', JSON.stringify(basket)); }

    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    function saveWishlist() { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }

    // --- Overlay ---
    const overlay = document.createElement('div');
    overlay.id = 'basket-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 hidden flex justify-center items-center z-50 backdrop-blur-sm transition-opacity';
    document.body.appendChild(overlay);

    // --- Combined Modal ---
    const modal = document.createElement('div');
    modal.id = 'basket-wishlist-modal';
    modal.className = 'bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 flex flex-col relative max-h-[85vh] overflow-y-auto animate-fadeIn hidden';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'absolute top-4 right-4 text-gray-600 hover:text-red-600 font-bold text-2xl transition';
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    modal.appendChild(closeBtn);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'flex justify-around mb-4 border-b-2 border-gray-200';
    const basketTab = document.createElement('button');
    basketTab.textContent = 'Basket';
    const wishlistTab = document.createElement('button');
    wishlistTab.textContent = 'Wishlist';

    [basketTab, wishlistTab].forEach(btn => {
      btn.className = 'py-2 px-4 font-semibold text-gray-700 transition';
    });

    tabs.append(basketTab, wishlistTab);
    modal.appendChild(tabs);

    // Containers
    const basketList = document.createElement('div');
    basketList.id = 'basket-list';
    basketList.className = 'space-y-4';

    const wishlistList = document.createElement('div');
    wishlistList.id = 'wishlist-list';
    wishlistList.className = 'space-y-4 hidden';

    const basketTotal = document.createElement('p');
    basketTotal.id = 'basket-total';
    basketTotal.className = 'font-bold text-lg mt-4 text-right text-gray-800';

    modal.append(basketList, wishlistList, basketTotal);
    overlay.appendChild(modal);

    let currentTab = 'basket';
    function switchTab(tab) {
      currentTab = tab;
      if (tab === 'basket') {
        basketList.classList.remove('hidden');
        wishlistList.classList.add('hidden');
        basketTab.classList.add('border-b-4', 'border-hero');
        wishlistTab.classList.remove('border-b-4', 'border-hero');
      } else {
        wishlistList.classList.remove('hidden');
        basketList.classList.add('hidden');
        wishlistTab.classList.add('border-b-4', 'border-hero');
        basketTab.classList.remove('border-b-4', 'border-hero');
      }
    }
    switchTab('basket');

    basketTab.addEventListener('click', () => switchTab('basket'));
    wishlistTab.addEventListener('click', () => switchTab('wishlist'));

    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.classList.add('hidden'); });

    // --- Firebase helpers ---
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

    // --- Update Buttons ---
    async function refreshAddButtons() {
      const buttons = document.querySelectorAll('button.add-to-basket');
      for (const btn of buttons) {
        const name = btn.dataset.name;
        const stock = await getStock(name);
        const inBasket = basket.find(i => i.name === name);

        btn.disabled = false;
        btn.classList.remove('bg-gray-400','cursor-not-allowed','bg-ink','text-white','bg-hero','hover:bg-ink','hover:text-white');

        if (stock <= 0) {
          btn.textContent = 'Out of Stock';
          btn.disabled = true;
          btn.classList.add('bg-gray-400','cursor-not-allowed');
        } else if (inBasket) {
          btn.textContent = 'In Basket';
          btn.classList.add('bg-ink','text-white');
        } else {
          btn.textContent = 'Add to Basket';
          btn.classList.add('bg-hero','hover:bg-ink','hover:text-white');
        }
      }
    }

    // --- Update Basket UI ---
    async function updateBasketUI() {
      for (let i = basket.length - 1; i >= 0; i--) {
        if (!document.querySelector(`button[data-name="${basket[i].name}"]`)) {
          basket.splice(i, 1);
        }
      }
      saveBasket();

      basketList.innerHTML = '';
      let total = 0;

      for (let i = 0; i < basket.length; i++) {
        const item = basket[i];
        const stock = await getStock(item.name);

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
      }

      basketTotal.textContent = `Total: £${total.toFixed(2)}`;
      updateCombinedButton();
      await refreshAddButtons();
    }

    // --- Update Wishlist UI ---
    async function updateWishlistUI() {
      for (let i = wishlist.length - 1; i >= 0; i--) {
        if (!document.querySelector(`button[data-name="${wishlist[i]}"]`)) {
          wishlist.splice(i, 1);
        }
      }
      saveWishlist();

      wishlistList.innerHTML = '';
      if (wishlist.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Your wishlist is empty.';
        empty.className = 'text-center text-gray-500';
        wishlistList.appendChild(empty);
      } else {
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
            if (existing) existing.qty++; else basket.push({name:item,price,qty:1});
            saveBasket(); updateBasketUI();
          });
          right.appendChild(addToBasketBtn);

          const removeBtn = document.createElement('button');
          removeBtn.textContent = '✕';
          removeBtn.className = 'text-red-500 hover:text-red-700';
          removeBtn.addEventListener('click', () => { wishlist.splice(i,1); saveWishlist(); updateWishlistUI(); });
          right.appendChild(removeBtn);

          itemDiv.appendChild(right);
          wishlistList.appendChild(itemDiv);
        });
      }
      updateCombinedButton();
      await refreshAddButtons();
    }

    // --- Combined Button ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'fixed top-6 right-6 flex z-50';
    const combinedBtn = document.createElement('button');
    combinedBtn.id = 'combined-btn';
    combinedBtn.className = 'bg-accent text-white font-bold py-3 px-6 rounded-2xl shadow-xl hover:bg-yellow-500 transition text-lg';
    buttonContainer.appendChild(combinedBtn);
    document.body.appendChild(buttonContainer);

    function updateCombinedButton() {
      combinedBtn.textContent = `🛒 Basket (${basket.reduce((a,b)=>a+b.qty,0)}) / ❤️ Wishlist (${wishlist.length})`;
    }

    combinedBtn.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      switchTab(currentTab);
    });

    // --- Initial render ---
    updateBasketUI();
    updateWishlistUI();

    // --- Product Buttons ---
    document.querySelectorAll('button.add-to-basket').forEach(btn => {
      const name = btn.dataset.name;
      btn.addEventListener('click', async () => {
        const price = parseFloat(btn.dataset.price);
        const stock = await getStock(name);
        const existing = basket.find(i => i.name === name);
        if (existing) { if (existing.qty < stock) existing.qty++; } 
        else if (stock > 0) { basket.push({name,price,qty:1}); }
        saveBasket(); updateBasketUI();
      });

      // Wishlist heart
      const heartBtn = document.createElement('button');
      heartBtn.textContent = wishlist.includes(name) ? '❤️' : '🤍';
      heartBtn.className = 'ml-4 text-2xl hover:scale-110 transition';
      heartBtn.addEventListener('click', () => {
        if (wishlist.includes(name)) { wishlist.splice(wishlist.indexOf(name),1); heartBtn.textContent='🤍'; }
        else { wishlist.push(name); heartBtn.textContent='❤️'; }
        saveWishlist(); updateWishlistUI();
      });
      btn.parentNode.insertBefore(heartBtn, btn.nextSibling);
    });
  });
})();