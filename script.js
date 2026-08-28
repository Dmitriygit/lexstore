// ============================================================
// Lexstore — shared front-end behaviour
// ============================================================

/* ---------- header: solid on scroll ---------- */
(function headerScroll() {
  var header = document.querySelector(".site-header");
  if (!header) return;
  var onScroll = function () {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* ---------- header: search toggle + submit ---------- */
(function headerSearch() {
  var toggle = document.querySelector("[data-search-toggle]");
  var panel = document.querySelector("[data-search-panel]");
  var form = document.querySelector("[data-search-form]");
  var input = document.querySelector("[data-search-input]");
  if (!toggle || !panel || !form || !input) return;

  function open() {
    panel.hidden = false;
    requestAnimationFrame(function () {
      panel.classList.add("is-open");
      input.focus();
    });
    toggle.setAttribute("aria-expanded", "true");
  }

  function close() {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    window.setTimeout(function () { panel.hidden = true; }, 420);
  }

  toggle.addEventListener("click", function () {
    var isOpen = panel.classList.contains("is-open");
    if (isOpen) close();
    else {
      if (window.LEXSTORE_CLOSE_MOBILE_NAV) window.LEXSTORE_CLOSE_MOBILE_NAV();
      open();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) close();
  });

  window.LEXSTORE_CLOSE_SEARCH = close;

  // pre-fill from ?q= so the box reflects an active search after landing on catalog.html
  var existingQuery = new URLSearchParams(window.location.search).get("q");
  if (existingQuery) input.value = existingQuery;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (window.LEXSTORE_APPLY_SEARCH) {
      window.LEXSTORE_APPLY_SEARCH(q);
      close();
    } else {
      window.location.href = "catalog.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    }
  });
})();

/* ---------- header: mobile nav drawer (burger) ---------- */
(function mobileNav() {
  var toggle = document.querySelector("[data-menu-toggle]");
  var panel = document.querySelector("[data-mobile-nav]");
  if (!toggle || !panel) return;

  function open() {
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add("is-open"); });
    toggle.setAttribute("aria-expanded", "true");
  }

  function close() {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    window.setTimeout(function () { panel.hidden = true; }, 420);
  }

  toggle.addEventListener("click", function () {
    var isOpen = panel.classList.contains("is-open");
    if (isOpen) close();
    else {
      if (window.LEXSTORE_CLOSE_SEARCH) window.LEXSTORE_CLOSE_SEARCH();
      open();
    }
  });

  panel.addEventListener("click", function (e) {
    if (e.target.closest("a")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) close();
  });

  window.LEXSTORE_CLOSE_MOBILE_NAV = close;
})();

/* ---------- cart: items + quantities, persisted in localStorage ----------
   The cart itself is still local to the browser (add/remove/qty, survives a
   reload) — only the catalog data and the final order now go through the
   database; nothing here needed to change for that. */
(function cart() {
  var KEY = "lexstore_cart_items";

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }

  function count(items) {
    return (items || read()).reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  function paint() {
    var n = count();
    document.querySelectorAll("[data-cart-badge]").forEach(function (b) { b.textContent = n; });
  }

  function add(id, qty) {
    qty = qty || 1;
    var items = read();
    var found = items.filter(function (it) { return it.id === id; })[0];
    if (found) found.qty += qty; else items.push({ id: id, qty: qty });
    write(items);
    paint();
    return items;
  }

  function setQty(id, qty) {
    var items = read();
    var found = items.filter(function (it) { return it.id === id; })[0];
    if (!found) return items;
    if (qty <= 0) items = items.filter(function (it) { return it.id !== id; });
    else found.qty = qty;
    write(items);
    paint();
    return items;
  }

  function remove(id) {
    var items = read().filter(function (it) { return it.id !== id; });
    write(items);
    paint();
    return items;
  }

  function clear() {
    write([]);
    paint();
  }

  paint();
  window.LEXSTORE_CART = { read: read, write: write, add: add, setQty: setQty, remove: remove, clear: clear, count: count, paint: paint };

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add-to-cart]");
    if (!btn || btn.disabled || btn.classList.contains("is-added")) return;
    var id = btn.getAttribute("data-id");
    if (!id) return;

    var qty = 1;
    var detail = btn.closest("[data-product-detail]");
    if (detail) {
      var qtyInput = detail.querySelector("[data-qty-input]");
      if (qtyInput) qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    }

    add(id, qty);
    var label = btn.querySelector(".btn__label");
    if (!label) return;
    var original = label.textContent;
    btn.classList.add("is-added");
    label.textContent = "Добавлено";
    window.setTimeout(function () {
      label.textContent = original;
      btn.classList.remove("is-added");
    }, 1400);
  });
})();

/* ---------- wishlist: a plain list of ids, persisted in localStorage ---------- */
(function wishlist() {
  var KEY = "lexstore_wishlist";

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function write(ids) {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
  }

  function has(id) { return read().indexOf(id) !== -1; }

  function toggle(id) {
    var ids = read();
    var i = ids.indexOf(id);
    if (i === -1) ids.push(id); else ids.splice(i, 1);
    write(ids);
    paint();
    return ids;
  }

  function paint() {
    var ids = read();
    document.querySelectorAll("[data-wishlist-badge]").forEach(function (b) { b.textContent = ids.length; });
    document.querySelectorAll("[data-wishlist-toggle]").forEach(function (btn) {
      var id = btn.getAttribute("data-id");
      var active = ids.indexOf(id) !== -1;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");
    });
  }

  window.LEXSTORE_WISHLIST = { read: read, has: has, toggle: toggle, paint: paint };

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-wishlist-toggle]");
    if (!btn) return;
    e.preventDefault();
    toggle(btn.getAttribute("data-id"));
  });

  paint();
})();

/* ---------- shared quantity stepper (product page + cart rows) ---------- */
(function qtySteppers() {
  document.addEventListener("click", function (e) {
    var minus = e.target.closest("[data-qty-minus]");
    var plus = e.target.closest("[data-qty-plus]");
    if (!minus && !plus) return;
    var wrap = (minus || plus).closest("[data-qty-stepper]");
    var input = wrap && wrap.querySelector("[data-qty-input]");
    if (!input) return;
    var val = parseInt(input.value, 10) || 1;
    val = minus ? Math.max(1, val - 1) : val + 1;
    input.value = val;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();

/* ---------- staggered entrance ---------- */
(function entrances() {
  var groups = document.querySelectorAll("[data-rise-group]");
  if (!groups.length) return;

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  groups.forEach(function (group) {
    io.observe(group);
    // safety net: a hard scroll jump (End key, anchor jump, programmatic
    // scrollTo) can skip every intersecting frame for a short element and
    // leave it at opacity:0 forever — force it visible after a short wait.
    setTimeout(function () { group.classList.add("is-in"); }, 2200);
  });
})();

/* ---------- hero: cascade card stack (hover fans it out, pure CSS) ---------- */
// the pin-and-scroll 3D spin this used to be lived here, but it needed the
// hero to stay pinned for a full extra viewport of scroll — directly at
// odds with keeping hero short enough for the next section to peek through.
// A static, slightly-fanned stack with a CSS hover keeps some life in the
// hero without costing that height back.

/* ---------- catalog: shared data + helpers ---------- */
// `LEXSTORE_PRODUCTS` now loads from Supabase (see loadProducts() below) so
// price/stock/new-product changes go live without a redeploy. The array
// below is only the offline fallback — used if the database is unreachable
// — kept in sync with what's in the `products` table by hand.
var LEXSTORE_PRODUCTS = [];
var LEXSTORE_FALLBACK_PRODUCTS = [
  { id: "airpods-pro-2", name: "Наушники AirPods Pro 2 + чехол в подарок", price: 65, oldPrice: 75, cat: "headphones", inStock: true },
  { id: "airpods-pro-3", name: "Наушники AirPods Pro 3 + чехол в подарок", price: 75, oldPrice: 85, cat: "headphones", inStock: true },
  { id: "airpods-4", name: "Наушники AirPods 4 + чехол в подарок", price: 70, oldPrice: 80, cat: "headphones", inStock: true },
  { id: "airpods-max-2", name: "Наушники AirPods Max 2", price: 220, oldPrice: 250, cat: "headphones", inStock: true },
  { id: "marshall-major-5", name: "Наушники Marshall Major 5", price: 190, oldPrice: 220, cat: "headphones", inStock: true },
  { id: "watch-s10", name: "Часы Watch S10", price: 110, oldPrice: 120, cat: "watches", inStock: true },
  { id: "hk11-pro-max", name: "Часы HK 11 Pro Max", price: 120, oldPrice: 135, cat: "watches", inStock: true },
  { id: "flip-7", name: "Колонка Flip 7", price: 80, oldPrice: 85, cat: "speakers", inStock: true },
  { id: "go-4", name: "Колонка Go 4", price: 95, oldPrice: 110, cat: "speakers", inStock: true },
  { id: "powerbank-xiaomi", name: "Powerbank Xiaomi", price: 65, oldPrice: 75, cat: "power", inStock: true },
  { id: "powerbank-hoco", name: "PowerBank Hoco 80000 mAh", price: 100, oldPrice: 120, cat: "power", inStock: true },
  { id: "cable-type-c", name: "Кабель Type-C — Type-C 60W", price: 15, oldPrice: null, cat: "power", inStock: true },
  { id: "adapter-usb-c", name: "Оригинальный адаптер USB-C 20W", price: 80, oldPrice: 90, cat: "power", inStock: true },
  { id: "dualshock-4", name: "DualShock 4 для PS4", price: 40, oldPrice: null, cat: "gaming", inStock: true },
  { id: "smart-glasses", name: "Smart Glasses с камерой", price: 200, oldPrice: 220, cat: "smart", inStock: true }
];

function loadProducts() {
  if (!window.LEXSTORE_SUPABASE) return Promise.resolve(LEXSTORE_FALLBACK_PRODUCTS.slice());
  return window.LEXSTORE_SUPABASE
    .from("products")
    .select("*")
    .order("created_at", { ascending: true })
    .then(function (res) {
      if (res.error || !res.data || !res.data.length) {
        if (res.error) console.error("Products load failed, using offline list:", res.error.message);
        return LEXSTORE_FALLBACK_PRODUCTS.slice();
      }
      return res.data.map(function (row) {
        return {
          id: row.id,
          name: row.name,
          price: Number(row.price),
          oldPrice: row.old_price === null || row.old_price === undefined ? null : Number(row.old_price),
          cat: row.cat,
          inStock: row.in_stock !== false
        };
      });
    })
    .catch(function (err) {
      console.error("Products load threw, using offline list:", err);
      return LEXSTORE_FALLBACK_PRODUCTS.slice();
    });
}

var LEXSTORE_CATEGORIES = [
  { slug: "headphones", name: "Беспроводные наушники",
    icon: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="1" y="15" width="6" height="7" rx="2"/><rect x="17" y="15" width="6" height="7" rx="2"/>' },
  { slug: "watches", name: "Смарт-часы",
    icon: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 7V4h6v3M9 17v3h6v-3"/>' },
  { slug: "speakers", name: "Портативные колонки",
    icon: '<rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="6" r="1"/>' },
  { slug: "power", name: "Аккумуляторы и зарядные устройства",
    icon: '<path d="M17 8V4a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v4"/><rect x="4" y="8" width="16" height="13" rx="2"/><path d="M12 12v5M9.5 14.5h5"/>' },
  { slug: "gaming", name: "Игровые аксессуары",
    icon: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="10.5" r="1"/><circle cx="18" cy="13" r="1"/>' },
  { slug: "smart", name: "Smart-гаджеты",
    icon: '<circle cx="6" cy="14" r="3"/><circle cx="18" cy="14" r="3"/><path d="M9 14h6M3 14l1-5a2 2 0 0 1 2-2M21 14l-1-5a2 2 0 0 0-2-2"/>' }
];

var PLACEHOLDER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5.2-5.2a2 2 0 0 0-2.8 0L5 19"/>' +
  '</svg>';

var WISHLIST_HEART_PATH =
  '<path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.7 1.2 6 3.7C14.3 5.2 15.8 4 18 4c4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z"/>';

function categoryBySlug(slug) {
  return LEXSTORE_CATEGORIES.filter(function (c) { return c.slug === slug; })[0];
}

function wishlistButtonHTML(id) {
  return (
    '<button class="wishlist-btn" type="button" data-wishlist-toggle data-id="' + id + '" aria-pressed="false" aria-label="Добавить в избранное">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + WISHLIST_HEART_PATH + '</svg>' +
    '</button>'
  );
}

// shared product-card markup used by the catalog grid, homepage hits, the
// wishlist page and "related products" — one template, one place to fix.
function productCardHTML(p, delay) {
  var old = p.oldPrice ? '<span class="old">' + p.oldPrice + '&nbsp;Br.</span>' : "";
  var inStock = p.inStock !== false;
  var stockBadge = inStock ? "" : '<span class="stock-badge stock-pill stock-pill--out">Нет в наличии</span>';
  return (
    '<article class="product-card rise" style="--d:' + delay + 'ms">' +
      '<a class="product-card__link" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="product-card__frame product-card__frame--empty">' + PLACEHOLDER_ICON + stockBadge + '</div>' +
        '<p class="product-card__name">' + p.name + '</p>' +
      '</a>' +
      wishlistButtonHTML(p.id) +
      '<div class="product-card__footer">' +
        '<div class="product-card__price"><span class="now">' + p.price + '&nbsp;Br.</span>' + old + '</div>' +
        '<button class="btn btn--outline product-card__cta" type="button" data-add-to-cart data-id="' + p.id + '"' + (inStock ? "" : " disabled") + '>' +
          '<span class="btn__fill"></span>' +
          '<span class="btn__label">' + (inStock ? "В корзину" : "Нет в наличии") + '</span>' +
        '</button>' +
      '</div>' +
    '</article>'
  );
}

// parts: [{ label, href? }] — last entry (or any without href) renders as the
// current, non-clickable crumb.
function breadcrumbsHTML(parts) {
  return (
    '<nav class="breadcrumbs" aria-label="Хлебные крошки"><ol>' +
      parts.map(function (part, i) {
        var isLast = i === parts.length - 1 || !part.href;
        var sep = i === parts.length - 1 ? "" : '<span class="breadcrumbs__sep" aria-hidden="true">/</span>';
        var crumb = isLast
          ? '<span aria-current="page">' + part.label + '</span>'
          : '<a href="' + part.href + '">' + part.label + '</a>';
        return "<li>" + crumb + sep + "</li>";
      }).join("") +
    '</ol></nav>'
  );
}

// Wired for when real product photography comes back: give an <img>'s frame
// the shimmer class, call this once, and it clears itself on load/error.
// Nothing calls it yet because no card renders a real <img> today.
function bindLazyImage(img) {
  if (!img) return;
  var frame = img.closest(".product-card__frame, .product-detail__frame");
  if (frame) frame.classList.add("img-skeleton");
  function clear() { if (frame) frame.classList.remove("img-skeleton"); }
  if (img.complete && img.naturalWidth) { clear(); return; }
  img.addEventListener("load", clear, { once: true });
  img.addEventListener("error", clear, { once: true });
}
window.LEXSTORE_BIND_LAZY_IMAGE = bindLazyImage;

/* ---------- everything below needs LEXSTORE_PRODUCTS, so it only runs
   once loadProducts() resolves (see the bottom of this file) ---------- */

function catalogPageModule() {
  var grid = document.querySelector("[data-product-grid]");
  var chipsRow = document.querySelector("[data-filters]");
  var filtersBar = chipsRow ? chipsRow.closest(".filters") : null;
  var searchStatus = document.querySelector("[data-search-status]");
  var sortSelect = document.querySelector("[data-sort]");
  var loadMoreWrap = document.querySelector("[data-load-more]");
  var loadMoreBtn = document.querySelector("[data-load-more-btn]");
  var breadcrumbsEl = document.querySelector("[data-breadcrumbs]");
  if (!grid || !chipsRow) return;

  var PAGE_SIZE = 8;
  var state = { cat: "all", q: "", sort: "default", visible: PAGE_SIZE, fullList: [] };

  function sortList(list) {
    var arr = list.slice();
    if (state.sort === "price-asc") arr.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === "price-desc") arr.sort(function (a, b) { return b.price - a.price; });
    else if (state.sort === "name") arr.sort(function (a, b) { return a.name.localeCompare(b.name, "ru"); });
    return arr;
  }

  function computeList() {
    var base = state.q
      ? LEXSTORE_PRODUCTS.filter(function (p) { return p.name.toLowerCase().indexOf(state.q.toLowerCase()) !== -1; })
      : (state.cat === "all" ? LEXSTORE_PRODUCTS : LEXSTORE_PRODUCTS.filter(function (p) { return p.cat === state.cat; }));
    return sortList(base);
  }

  function paintBreadcrumbs() {
    if (!breadcrumbsEl) return;
    var parts = [{ label: "Главная", href: "index.html" }];
    if (state.q) {
      parts.push({ label: "Каталог", href: "catalog.html" });
      parts.push({ label: "Поиск: «" + state.q + "»" });
    } else if (state.cat !== "all") {
      var c = categoryBySlug(state.cat);
      parts.push({ label: "Каталог", href: "catalog.html" });
      parts.push({ label: c ? c.name : state.cat });
    } else {
      parts.push({ label: "Каталог" });
    }
    breadcrumbsEl.innerHTML = breadcrumbsHTML(parts);
  }

  function render(emptyMessage) {
    var group = grid.closest("[data-rise-group]");
    if (group) group.classList.remove("is-in"); // reset so re-filtering replays the stagger
    state.fullList = computeList();
    var slice = state.fullList.slice(0, state.visible);
    grid.innerHTML = slice.length
      ? slice.map(function (p, i) { return productCardHTML(p, Math.min(i, 8) * 50); }).join("")
      : '<p class="empty-state">' + (emptyMessage || "В этой категории пока пусто.") + '</p>';
    if (loadMoreWrap) loadMoreWrap.hidden = state.visible >= state.fullList.length;
    paintBreadcrumbs();
    if (window.LEXSTORE_WISHLIST) window.LEXSTORE_WISHLIST.paint();
    if (group) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { group.classList.add("is-in"); });
      });
    }
  }

  function clearSearch() {
    if (searchStatus) searchStatus.hidden = true;
    if (filtersBar) filtersBar.hidden = false;
    var input = document.querySelector("[data-search-input]");
    if (input) input.value = "";
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    var activeChip = chipsRow.querySelector(".chip.is-active") || chipsRow.querySelector('.chip[data-cat="all"]');
    state.q = "";
    state.cat = activeChip ? activeChip.getAttribute("data-cat") : "all";
    state.visible = PAGE_SIZE;
    render();
  }

  function applySearch(q) {
    q = (q || "").trim();
    if (!q) { clearSearch(); return; }
    state.q = q;
    state.visible = PAGE_SIZE;
    if (filtersBar) filtersBar.hidden = true;
    window.history.replaceState({}, "", window.location.pathname + "?q=" + encodeURIComponent(q));
    render("Ничего не нашлось. Проверьте запрос или посмотрите весь каталог.");
    if (searchStatus) {
      searchStatus.hidden = false;
      searchStatus.innerHTML =
        'Результаты по запросу «' + q.replace(/</g, "&lt;") + '» — ' + state.fullList.length + '&nbsp;найдено' +
        ' <button type="button" class="search-status__clear" data-search-clear>Сбросить</button>';
    }
  }
  window.LEXSTORE_APPLY_SEARCH = applySearch;

  if (searchStatus) {
    searchStatus.addEventListener("click", function (e) {
      if (e.target.closest("[data-search-clear]")) applySearch("");
    });
  }

  chipsRow.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    chipsRow.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
    chip.classList.add("is-active");
    state.cat = chip.getAttribute("data-cat");
    state.visible = PAGE_SIZE;
    render();
  });

  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      state.sort = sortSelect.value;
      render();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function () {
      state.visible += PAGE_SIZE;
      render();
    });
  }

  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) applySearch(initialQuery);
  else render();

  // catalog.html: pick up a #hash category once the chips actually exist
  var hash = window.location.hash.replace("#", "");
  if (hash) {
    var hashChip = document.querySelector('.chip[data-cat="' + hash + '"]');
    if (hashChip) hashChip.click();
  }
}

function heroCascadeModule() {
  var stage = document.querySelector("[data-hero-cascade]");
  if (!stage) return;
  var picks = ["watch-s10", "flip-7", "dualshock-4"];
  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  stage.innerHTML = picks.map(function (id, i) {
    var p = byId[id];
    if (!p) return "";
    return (
      '<div class="hero__cascade-card rise" style="--d:' + (1040 + i * 90) + 'ms">' +
        PLACEHOLDER_ICON +
        '<span class="hero__cascade-card__name">' + p.name + '</span>' +
        '<span class="hero__cascade-card__price">' + p.price + '&nbsp;Br.</span>' +
      '</div>'
    );
  }).join("");
}

function homeCategoriesModule() {
  var grid = document.querySelector("[data-category-grid]");
  if (!grid) return;
  var counts = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });

  function plural(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "товар";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "товара";
    return "товаров";
  }

  grid.innerHTML = LEXSTORE_CATEGORIES.map(function (c, i) {
    var n = counts[c.slug] || 0;
    return (
      '<a class="cat-card rise" style="--d:' + i * 60 + 'ms" href="catalog.html#' + c.slug + '">' +
        '<span class="cat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + c.icon + '</svg></span>' +
        '<span class="cat-card__body">' +
          '<h3>' + c.name + '</h3>' +
          '<span class="cat-card__count">' + n + '&nbsp;' + plural(n) + '</span>' +
        '</span>' +
        '<span class="cat-card__arrow"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>' +
      '</a>'
    );
  }).join("");
}

function homeHitsModule() {
  var grid = document.querySelector("[data-hits-grid]");
  if (!grid) return;
  var ids = ["airpods-pro-3", "watch-s10", "flip-7", "smart-glasses"];
  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var picks = ids.map(function (id) { return byId[id]; }).filter(Boolean);

  grid.innerHTML = picks.map(function (p, i) { return productCardHTML(p, Math.min(i, 8) * 50); }).join("");
  if (window.LEXSTORE_WISHLIST) window.LEXSTORE_WISHLIST.paint();
}

function productPageModule() {
  var root = document.querySelector("[data-product-detail]");
  var notFound = document.querySelector("[data-product-not-found]");
  if (!root && !notFound) return;

  var id = new URLSearchParams(window.location.search).get("id");
  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var p = id ? byId[id] : null;

  if (!p) {
    if (root) root.hidden = true;
    if (notFound) notFound.hidden = false;
    var missingBc = document.querySelector("[data-breadcrumbs]");
    if (missingBc) {
      missingBc.innerHTML = breadcrumbsHTML([
        { label: "Главная", href: "index.html" },
        { label: "Каталог", href: "catalog.html" },
        { label: "Товар не найден" }
      ]);
    }
    return;
  }

  var catInfo = categoryBySlug(p.cat);
  var inStock = p.inStock !== false;

  document.title = p.name + " — Lexstore";
  var descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute("content", p.name + " — купить в Lexstore за " + p.price + " Br.");
  var ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", p.name + " — Lexstore");
  var ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", p.name + " — купить в Lexstore за " + p.price + " Br.");

  var bc = document.querySelector("[data-breadcrumbs]");
  if (bc) {
    bc.innerHTML = breadcrumbsHTML([
      { label: "Главная", href: "index.html" },
      { label: "Каталог", href: "catalog.html" },
      { label: catInfo ? catInfo.name : "Категория", href: "catalog.html#" + p.cat },
      { label: p.name }
    ]);
  }

  var frame = root.querySelector("[data-product-frame]");
  if (frame) frame.innerHTML = PLACEHOLDER_ICON;

  var nameEl = root.querySelector("[data-product-name]");
  if (nameEl) nameEl.textContent = p.name;

  var priceNow = root.querySelector("[data-product-price-now]");
  if (priceNow) priceNow.textContent = p.price + " Br.";

  var priceOld = root.querySelector("[data-product-price-old]");
  if (priceOld) {
    if (p.oldPrice) { priceOld.textContent = p.oldPrice + " Br."; priceOld.hidden = false; }
    else priceOld.hidden = true;
  }

  var stockEl = root.querySelector("[data-product-stock]");
  if (stockEl) {
    stockEl.textContent = inStock ? "В наличии" : "Нет в наличии";
    stockEl.className = "stock-pill " + (inStock ? "stock-pill--in" : "stock-pill--out");
  }

  var catLink = root.querySelector("[data-product-cat-link]");
  if (catLink) {
    catLink.textContent = catInfo ? catInfo.name : p.cat;
    catLink.setAttribute("href", "catalog.html#" + p.cat);
  }

  var addBtn = root.querySelector("[data-add-to-cart]");
  if (addBtn) {
    addBtn.setAttribute("data-id", p.id);
    if (!inStock) {
      addBtn.disabled = true;
      var label = addBtn.querySelector(".btn__label");
      if (label) label.textContent = "Нет в наличии";
    }
  }

  var wishBtn = root.querySelector("[data-wishlist-toggle]");
  if (wishBtn) wishBtn.setAttribute("data-id", p.id);

  var related = LEXSTORE_PRODUCTS.filter(function (x) { return x.cat === p.cat && x.id !== p.id; }).slice(0, 4);
  var relatedSection = document.querySelector("[data-related]");
  var relatedGrid = document.querySelector("[data-related-grid]");
  if (relatedGrid) {
    if (related.length) {
      relatedGrid.innerHTML = related.map(function (x, i) { return productCardHTML(x, i * 60); }).join("");
      if (relatedSection) relatedSection.hidden = false;
    } else if (relatedSection) {
      relatedSection.hidden = true;
    }
  }

  if (window.LEXSTORE_WISHLIST) window.LEXSTORE_WISHLIST.paint();
}

function cartPageModule() {
  var listEl = document.querySelector("[data-cart-list]");
  if (!listEl) return;

  var summaryEl = document.querySelector("[data-cart-summary]");
  var emptyEl = document.querySelector("[data-cart-empty]");
  var toastEl = document.querySelector("[data-cart-toast]");
  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var undoTimer = null;
  var lastRemoved = null;

  function rowHTML(item) {
    var p = byId[item.id];
    if (!p) return "";
    var lineTotal = p.price * item.qty;
    return (
      '<div class="cart-row" data-cart-row data-id="' + p.id + '">' +
        '<a class="cart-row__thumb" href="product.html?id=' + p.id + '">' + PLACEHOLDER_ICON + '</a>' +
        '<div class="cart-row__info">' +
          '<a class="cart-row__name" href="product.html?id=' + p.id + '">' + p.name + '</a>' +
          '<span class="cart-row__unit">' + p.price + '&nbsp;Br. / шт.</span>' +
        '</div>' +
        '<div class="cart-row__controls">' +
          '<div class="qty-stepper" data-qty-stepper>' +
            '<button type="button" data-qty-minus aria-label="Уменьшить количество">−</button>' +
            '<input type="number" min="1" value="' + item.qty + '" data-qty-input inputmode="numeric" aria-label="Количество">' +
            '<button type="button" data-qty-plus aria-label="Увеличить количество">+</button>' +
          '</div>' +
          '<span class="cart-row__total">' + lineTotal + '&nbsp;Br.</span>' +
          '<button class="cart-row__remove" type="button" data-cart-remove aria-label="Убрать из корзины">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    var items = window.LEXSTORE_CART.read();
    if (!items.length) {
      listEl.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = items.map(rowHTML).join("");

    var subtotal = items.reduce(function (sum, it) { var p = byId[it.id]; return sum + (p ? p.price * it.qty : 0); }, 0);
    var qtyCount = items.reduce(function (sum, it) { return sum + it.qty; }, 0);
    if (summaryEl) {
      summaryEl.hidden = false;
      var countEl = summaryEl.querySelector("[data-cart-count]");
      var subtotalEl = summaryEl.querySelector("[data-cart-subtotal]");
      if (countEl) countEl.textContent = qtyCount;
      if (subtotalEl) subtotalEl.textContent = subtotal + " Br.";
    }
  }

  listEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-cart-remove]");
    if (!removeBtn) return;
    var row = removeBtn.closest("[data-cart-row]");
    var id = row.getAttribute("data-id");
    var items = window.LEXSTORE_CART.read();
    var idx = -1;
    items.forEach(function (it, i) { if (it.id === id) idx = i; });
    if (idx === -1) return;
    lastRemoved = { item: items[idx], index: idx };
    window.LEXSTORE_CART.remove(id);
    render();
    showToast();
  });

  listEl.addEventListener("change", function (e) {
    var input = e.target.closest("[data-qty-input]");
    if (!input) return;
    var row = input.closest("[data-cart-row]");
    var id = row.getAttribute("data-id");
    var qty = Math.max(1, parseInt(input.value, 10) || 1);
    window.LEXSTORE_CART.setQty(id, qty);
    render();
  });

  function showToast() {
    if (!toastEl || !lastRemoved) return;
    toastEl.hidden = false;
    requestAnimationFrame(function () { toastEl.classList.add("is-visible"); });
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideToast, 5000);
  }

  function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove("is-visible");
    setTimeout(function () { toastEl.hidden = true; }, 320);
    lastRemoved = null;
  }

  if (toastEl) {
    toastEl.addEventListener("click", function (e) {
      if (!e.target.closest("[data-cart-undo]") || !lastRemoved) return;
      var items = window.LEXSTORE_CART.read();
      items.splice(lastRemoved.index, 0, lastRemoved.item);
      window.LEXSTORE_CART.write(items);
      window.LEXSTORE_CART.paint();
      clearTimeout(undoTimer);
      hideToast();
      render();
    });
  }

  render();
}

/* ---------- checkout.html: form validation + real order + mailto backup ----------
   Submitting now inserts the order straight into the `orders` table (visible
   in admin.html) and, either way, still opens a pre-filled email and shows
   the raw order text — a mail client isn't always configured on the device,
   and this keeps a paper trail even if the database write ever fails. */
function checkoutPageModule() {
  var form = document.querySelector("[data-checkout-form]");
  if (!form) return;

  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  var summaryList = document.querySelector("[data-checkout-summary-list]");
  var summaryTotal = document.querySelector("[data-checkout-summary-total]");
  var emptyEl = document.querySelector("[data-checkout-empty]");
  var formWrap = document.querySelector("[data-checkout-form-wrap]");
  var successEl = document.querySelector("[data-checkout-success]");
  var addressField = form.querySelector("[data-address-field]");
  var deliveryRadios = form.querySelectorAll('input[name="delivery"]');

  var items = window.LEXSTORE_CART.read();
  if (!items.length) {
    if (formWrap) formWrap.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  var subtotal = 0;
  if (summaryList) {
    summaryList.innerHTML = items.map(function (it) {
      var p = byId[it.id];
      if (!p) return "";
      var lineTotal = p.price * it.qty;
      subtotal += lineTotal;
      return "<li><span>" + p.name + " × " + it.qty + "</span><span>" + lineTotal + "&nbsp;Br.</span></li>";
    }).join("");
  } else {
    items.forEach(function (it) { var p = byId[it.id]; if (p) subtotal += p.price * it.qty; });
  }
  if (summaryTotal) summaryTotal.textContent = subtotal + " Br.";

  function toggleAddress() {
    var checked = form.querySelector('input[name="delivery"]:checked');
    var needsAddress = checked && checked.value === "delivery";
    document.querySelectorAll(".radio-option").forEach(function (el) { el.classList.remove("is-checked"); });
    if (checked) checked.closest(".radio-option").classList.add("is-checked");
    if (addressField) {
      addressField.hidden = !needsAddress;
      var addressInput = addressField.querySelector("textarea, input");
      if (addressInput) addressInput.required = !!needsAddress;
    }
  }
  deliveryRadios.forEach(function (r) { r.addEventListener("change", toggleAddress); });
  toggleAddress();

  function setError(field, message) {
    var wrap = field.closest(".form-field");
    if (!wrap) return;
    wrap.classList.toggle("is-invalid", !!message);
    var err = wrap.querySelector(".form-field__error");
    if (err) err.textContent = message || "";
  }

  function validate() {
    var ok = true;
    var name = form.querySelector('[name="name"]');
    var phone = form.querySelector('[name="phone"]');

    if (!name.value.trim()) { setError(name, "Укажите имя"); ok = false; } else setError(name, "");

    var phoneDigits = phone.value.replace(/\D/g, "");
    if (phoneDigits.length < 9) { setError(phone, "Проверьте номер телефона"); ok = false; } else setError(phone, "");

    var delivery = form.querySelector('input[name="delivery"]:checked');
    if (delivery && delivery.value === "delivery") {
      var address = form.querySelector('[name="address"]');
      if (!address.value.trim()) { setError(address, "Укажите адрес доставки"); ok = false; } else setError(address, "");
    }
    return ok;
  }

  function buildOrderText() {
    var name = form.querySelector('[name="name"]').value.trim();
    var phone = form.querySelector('[name="phone"]').value.trim();
    var delivery = form.querySelector('input[name="delivery"]:checked');
    var isDelivery = delivery && delivery.value === "delivery";
    var address = form.querySelector('[name="address"]');
    var comment = form.querySelector('[name="comment"]');

    var lines = [];
    lines.push("Заказ Lexstore");
    lines.push("Имя: " + name);
    lines.push("Телефон: " + phone);
    lines.push("Получение: " + (isDelivery ? "Доставка — " + (address ? address.value.trim() : "") : "Самовывоз"));
    lines.push("");
    lines.push("Товары:");
    items.forEach(function (it) {
      var p = byId[it.id];
      if (p) lines.push("— " + p.name + " × " + it.qty + " = " + (p.price * it.qty) + " Br.");
    });
    lines.push("");
    lines.push("Итого: " + subtotal + " Br.");
    if (comment && comment.value.trim()) {
      lines.push("");
      lines.push("Комментарий: " + comment.value.trim());
    }
    return lines.join("\n");
  }

  function finishSubmit(text) {
    var mailto = "mailto:elb00304@g.bstu.by" +
      "?subject=" + encodeURIComponent("Новый заказ — Lexstore") +
      "&body=" + encodeURIComponent(text);
    window.location.href = mailto;

    if (formWrap) formWrap.hidden = true;
    if (successEl) {
      successEl.hidden = false;
      var box = successEl.querySelector("[data-order-text]");
      if (box) box.value = text;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      var firstInvalid = form.querySelector(".is-invalid input, .is-invalid textarea");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var text = buildOrderText();
    var name = form.querySelector('[name="name"]').value.trim();
    var phone = form.querySelector('[name="phone"]').value.trim();
    var delivery = form.querySelector('input[name="delivery"]:checked');
    var isDelivery = delivery && delivery.value === "delivery";
    var address = form.querySelector('[name="address"]');
    var comment = form.querySelector('[name="comment"]');

    if (window.LEXSTORE_SUPABASE) {
      var orderItems = items.map(function (it) {
        var p = byId[it.id];
        return { id: it.id, name: p ? p.name : it.id, qty: it.qty, price: p ? p.price : 0 };
      });
      window.LEXSTORE_SUPABASE.from("orders").insert({
        name: name,
        phone: phone,
        delivery_type: isDelivery ? "delivery" : "pickup",
        address: isDelivery && address ? address.value.trim() : null,
        comment: comment && comment.value.trim() ? comment.value.trim() : null,
        items: orderItems,
        total: subtotal,
        status: "new"
      }).then(function (res) {
        if (res.error) console.error("Order insert failed:", res.error.message);
        finishSubmit(text);
      }).catch(function (err) {
        console.error("Order insert threw:", err);
        finishSubmit(text);
      });
    } else {
      finishSubmit(text);
    }
  });

  var copyBtn = document.querySelector("[data-copy-order]");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var box = document.querySelector("[data-order-text]");
      if (!box) return;
      box.focus();
      box.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      var label = copyBtn.querySelector(".btn__label");
      if (label) {
        var original = label.textContent;
        label.textContent = ok ? "Скопировано" : "Выделите и скопируйте вручную";
        setTimeout(function () { label.textContent = original; }, 1800);
      }
    });
  }

  var clearBtn = document.querySelector("[data-clear-cart-confirm]");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      window.LEXSTORE_CART.clear();
      clearBtn.disabled = true;
      var label = clearBtn.querySelector(".btn__label");
      if (label) label.textContent = "Корзина очищена";
    });
  }
}

function wishlistPageModule() {
  var grid = document.querySelector("[data-wishlist-grid]");
  if (!grid) return;
  var emptyEl = document.querySelector("[data-wishlist-empty]");
  var byId = {};
  LEXSTORE_PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  function render() {
    var ids = window.LEXSTORE_WISHLIST.read();
    var list = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    if (!list.length) {
      grid.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    grid.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    grid.innerHTML = list.map(function (p, i) { return productCardHTML(p, i * 60); }).join("");
    window.LEXSTORE_WISHLIST.paint();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-wishlist-toggle]")) setTimeout(render, 0);
  });

  render();
}

loadProducts().then(function (products) {
  LEXSTORE_PRODUCTS = products;
  catalogPageModule();
  heroCascadeModule();
  homeCategoriesModule();
  homeHitsModule();
  productPageModule();
  cartPageModule();
  checkoutPageModule();
  wishlistPageModule();
});
