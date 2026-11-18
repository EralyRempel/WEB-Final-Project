(function (Cafe) {
  'use strict';

  const app = document.getElementById('deals-app');
  if (!app) return;                                   // runs only on games.html

  const API_URL = 'https://www.cheapshark.com/api/1.0';
  const PAGE_SIZE = 12;
  const FILTERS_KEY = 'cafe_deal_filters';
  const FALLBACK_IMAGE = 'images/emblem.jpg';

  const el = {
    form: document.getElementById('deal-form'),
    title: document.getElementById('deal-title'),
    store: document.getElementById('deal-store'),
    price: document.getElementById('deal-price'),
    sort: document.getElementById('deal-sort'),
    rated: document.getElementById('deal-rated'),
    reset: document.getElementById('deal-reset'),
    summary: document.getElementById('deal-summary'),
    grid: document.getElementById('deal-grid'),
    more: document.getElementById('deal-more'),
    tabLive: document.getElementById('tab-live'),
    tabSaved: document.getElementById('tab-saved'),
    savedCount: document.getElementById('saved-count')
  };

  const state = {
    view: 'live',            // "live" (API) or "saved" (localStorage)
    page: 0,
    deals: [],
    stores: {},              // storeID -> store name
    controller: null         // AbortController of the running request
  };

  /*helpers */
  const money = value => '$' + Number(value).toFixed(2);

  function isCafeGame(title) {
    const lower = title.toLowerCase();
    return (Cafe.GAMES || []).some(game => lower.includes(game.name.toLowerCase()));
  }

  function readFilters() {
    return {
      title: el.title.value.trim().slice(0, 60),
      store: el.store.value,
      price: el.price.value,
      sort: el.sort.value,
      rated: el.rated.checked
    };
  }

  function restoreFilters() {
    const saved = Cafe.store.get(FILTERS_KEY, null);
    if (!saved) return;
    el.title.value = saved.title || '';
    el.price.value = saved.price || '';
    el.sort.value = saved.sort || 'Deal Rating';
    el.rated.checked = Boolean(saved.rated);
    el.savedStore = saved.store || '';               // applied after the store list is loaded
  }

  function buildUrl(filters, page) {
    const params = new URLSearchParams({ pageSize: PAGE_SIZE, pageNumber: page, onSale: 1, sortBy: filters.sort });
    // price and title sort ascending, everything else shows the best first
    params.set('desc', ['Price', 'Title'].includes(filters.sort) ? 0 : 1);
    if (filters.title) params.set('title', filters.title);
    if (filters.store) params.set('storeID', filters.store);
    if (filters.price) params.set('upperPrice', filters.price);
    if (filters.rated) params.set('steamRating', 80);
    return API_URL + '/deals?' + params.toString();
  }

  /*status area*/
  function showSkeletons() {
    el.grid.textContent = '';
    el.grid.setAttribute('aria-busy', 'true');
    for (let i = 0; i < 6; i += 1) {
      const card = document.createElement('div');
      card.className = 'deal-card skeleton';
      card.setAttribute('aria-hidden', 'true');
      el.grid.appendChild(card);
    }
    el.summary.textContent = 'Loading deals…';
    el.more.hidden = true;
  }

  function showError(message) {
    el.grid.setAttribute('aria-busy', 'false');
    el.grid.textContent = '';
    const box = document.createElement('div');
    box.className = 'api-error';
    box.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => loadDeals(false));
    box.append(text, retry);
    el.grid.appendChild(box);
    el.summary.textContent = '';
    el.more.hidden = true;
  }

  /*deal cards*/
  function createCard(deal) {
    const card = document.createElement('article');
    card.className = 'deal-card';

    const media = document.createElement('div');
    media.className = 'deal-media';
    const img = document.createElement('img');
    img.src = deal.thumb || FALLBACK_IMAGE;
    img.alt = '';                                   // decorative: the title is right below
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.src = FALLBACK_IMAGE; }, { once: true });
    const badge = document.createElement('span');
    badge.className = 'deal-savings';
    badge.textContent = '-' + Math.round(Number(deal.savings)) + '%';
    media.append(img, badge);

    const body = document.createElement('div');
    body.className = 'deal-body';

    const title = document.createElement('h3');
    title.className = 'deal-title';
    title.textContent = deal.title;

    const meta = document.createElement('p');
    meta.className = 'deal-meta';
    const storeName = state.stores[deal.storeID] || ('Store #' + deal.storeID);
    const rating = deal.steamRatingText ? deal.steamRatingText + ' (' + deal.steamRatingPercent + '%)' : 'No Steam reviews';
    meta.textContent = storeName + ' · ' + rating;

    const prices = document.createElement('p');
    prices.className = 'deal-prices';
    const sale = document.createElement('span');
    sale.className = 'deal-sale';
    sale.textContent = money(deal.salePrice);
    const normal = document.createElement('s');
    normal.className = 'deal-normal';
    normal.textContent = money(deal.normalPrice);
    prices.append(sale, normal);

    body.append(title, meta, prices);

    if (isCafeGame(deal.title)) {
      const tag = document.createElement('span');
      tag.className = 'cafe-badge';
      tag.textContent = 'Also playable at our cafe';
      body.appendChild(tag);
    }

    const actions = document.createElement('div');
    actions.className = 'deal-actions';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn-small btn-outline fav-btn';
    const setSaved = isSaved => {
      save.setAttribute('aria-pressed', String(isSaved));
      save.classList.toggle('is-saved', isSaved);
      save.textContent = isSaved ? '♥ Saved' : '♡ Save';
      save.setAttribute('aria-label', (isSaved ? 'Remove ' : 'Save ') + deal.title + (isSaved ? ' from saved deals' : ' to saved deals'));
    };
    setSaved(Cafe.favorites.has(deal.dealID));
    save.addEventListener('click', () => {
      if (Cafe.favorites.has(deal.dealID)) {
        Cafe.favorites.remove(deal.dealID);
        Cafe.toast('Removed from saved deals', 'info');
        if (state.view === 'saved') { card.remove(); renderSavedSummary(); }
      } else {
        Cafe.favorites.add({
          dealID: deal.dealID, title: deal.title, thumb: deal.thumb, savings: deal.savings,
          salePrice: deal.salePrice, normalPrice: deal.normalPrice, storeID: deal.storeID,
          steamRatingText: deal.steamRatingText, steamRatingPercent: deal.steamRatingPercent
        });
        Cafe.toast('Saved “' + deal.title + '”');
      }
      setSaved(Cafe.favorites.has(deal.dealID));
      updateSavedCount();
    });

    const open = document.createElement('a');
    open.className = 'btn btn-small';
    open.href = 'https://www.cheapshark.com/redirect?dealID=' + encodeURIComponent(deal.dealID);
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'View deal';

    actions.append(save, open);
    card.append(media, body, actions);
    return card;
  }

  function updateSavedCount() {
    el.savedCount.textContent = String(Cafe.favorites.all().length);
  }

  /*live view (API)*/
  async function loadStores() {
    try {
      const response = await fetch(API_URL + '/stores');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const stores = await response.json();
      stores.filter(store => String(store.isActive) === '1').forEach(store => {
        state.stores[store.storeID] = store.storeName;
        const option = document.createElement('option');
        option.value = store.storeID;
        option.textContent = store.storeName;
        el.store.appendChild(option);
      });
      if (el.savedStore) el.store.value = el.savedStore;
    } catch (error) {
      // not critical: cards will show "Store #1" instead of the name
      console.warn('Could not load the store list:', error);
    }
  }

  async function loadDeals(append) {
    if (state.controller) state.controller.abort();       // cancel the previous request
    state.controller = new AbortController();
    const filters = readFilters();
    Cafe.store.set(FILTERS_KEY, filters);

    if (!append) { state.page = 0; state.deals = []; showSkeletons(); }
    el.more.disabled = true;

    try {
      const response = await fetch(buildUrl(filters, state.page), { signal: state.controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const deals = await response.json();
      if (!Array.isArray(deals)) throw new Error('Unexpected response');

      state.deals = state.deals.concat(deals);
      el.grid.setAttribute('aria-busy', 'false');
      if (!append) el.grid.textContent = '';
      deals.forEach(deal => el.grid.appendChild(createCard(deal)));

      if (!state.deals.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-note';
        empty.textContent = 'No deals match your search. Try a different title or relax the filters.';
        el.grid.appendChild(empty);
      }
      el.summary.textContent = state.deals.length
        ? 'Showing ' + state.deals.length + ' deal' + (state.deals.length === 1 ? '' : 's')
        : '';
      el.more.hidden = deals.length < PAGE_SIZE;           // a short page means there is nothing more
      el.more.disabled = false;
    } catch (error) {
      if (error.name === 'AbortError') return;             // a newer request replaced this one
      const offline = !navigator.onLine || error instanceof TypeError;
      showError(offline
        ? 'Could not reach the deals server. Check your internet connection and try again.'
        : 'The deals server returned an error (' + error.message + '). Please try again in a moment.');
    }
  }

  /*saved view (localStorage)*/
  function renderSavedSummary() {
    const count = el.grid.querySelectorAll('.deal-card').length;
    el.summary.textContent = count ? count + ' saved deal' + (count === 1 ? '' : 's') : '';
    if (!count) {
      el.grid.textContent = '';
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = el.title.value.trim()
        ? 'No saved deals match this title.'
        : 'You have not saved any deals yet. Press “Save” on a deal in the Live deals tab.';
      el.grid.appendChild(empty);
    }
  }

  function renderSaved() {
    const query = el.title.value.trim().toLowerCase();
    el.grid.setAttribute('aria-busy', 'false');
    el.grid.textContent = '';
    Cafe.favorites.all()
      .filter(deal => deal.title.toLowerCase().includes(query))
      .forEach(deal => el.grid.appendChild(createCard(deal)));
    el.more.hidden = true;
    renderSavedSummary();
  }

  function setView(view) {
    state.view = view;
    el.tabLive.setAttribute('aria-pressed', String(view === 'live'));
    el.tabSaved.setAttribute('aria-pressed', String(view === 'saved'));
    el.tabLive.classList.toggle('active', view === 'live');
    el.tabSaved.classList.toggle('active', view === 'saved');
    app.classList.toggle('saved-view', view === 'saved');
    if (view === 'live') loadDeals(false); else { if (state.controller) state.controller.abort(); renderSaved(); }
  }

  /*events*/
  function refresh() { if (state.view === 'live') loadDeals(false); else renderSaved(); }

  let typingTimer = null;
  el.title.addEventListener('input', () => {              // wait until the user stops typing
    clearTimeout(typingTimer);
    typingTimer = setTimeout(refresh, 450);
  });
  [el.store, el.price, el.sort, el.rated].forEach(control => control.addEventListener('change', refresh));
  el.form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(typingTimer); refresh(); });
  el.reset.addEventListener('click', () => {
    el.form.reset();
    Cafe.store.remove(FILTERS_KEY);
    refresh();
  });
  el.more.addEventListener('click', () => { state.page += 1; loadDeals(true); });
  el.tabLive.addEventListener('click', () => setView('live'));
  el.tabSaved.addEventListener('click', () => setView('saved'));

  /*start*/
  restoreFilters();
  updateSavedCount();
  loadStores().then(() => loadDeals(false));
})(window.Cafe);
