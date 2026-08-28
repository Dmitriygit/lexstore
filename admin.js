// ============================================================
// Lexstore — admin panel
// Not linked from anywhere in the public site; reachable only if you know
// the URL. The page itself is public (static hosting has no server-side
// gate), but every write requires a real Supabase login — row-level
// security on the `products`/`orders` tables rejects writes from anyone
// who isn't authenticated, regardless of what this page does.
// ============================================================
(function () {
  var supa = window.LEXSTORE_SUPABASE;

  var loginSection = document.querySelector("[data-admin-login]");
  var appSection = document.querySelector("[data-admin-app]");
  var loginForm = document.querySelector("[data-login-form]");
  var loginError = document.querySelector("[data-login-error]");
  var logoutBtn = document.querySelector("[data-logout]");
  var tabs = document.querySelectorAll("[data-admin-tab]");
  var panels = document.querySelectorAll("[data-admin-panel]");

  if (!supa) {
    if (loginError) {
      loginError.textContent = "Не удалось подключиться к базе данных — проверьте интернет и обновите страницу.";
      loginError.hidden = false;
    }
    return;
  }

  var CATEGORIES = [
    { slug: "headphones", name: "Беспроводные наушники" },
    { slug: "watches", name: "Смарт-часы" },
    { slug: "speakers", name: "Портативные колонки" },
    { slug: "power", name: "Аккумуляторы и зарядные устройства" },
    { slug: "gaming", name: "Игровые аксессуары" },
    { slug: "smart", name: "Smart-гаджеты" }
  ];

  var STATUS_LABELS = {
    new: "Новый",
    confirmed: "Подтверждён",
    shipped: "Отправлен",
    done: "Выполнен",
    cancelled: "Отменён"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function categoryOptionsHTML(selected) {
    return CATEGORIES.map(function (c) {
      return '<option value="' + c.slug + '"' + (c.slug === selected ? " selected" : "") + '>' + c.name + '</option>';
    }).join("");
  }

  /* ---------- auth ---------- */
  function showApp() {
    loginSection.hidden = true;
    appSection.hidden = false;
    logoutBtn.hidden = false;
    loadProducts();
    loadOrders();
  }

  function showLogin() {
    loginSection.hidden = false;
    appSection.hidden = true;
    logoutBtn.hidden = true;
  }

  supa.auth.getSession().then(function (res) {
    if (res.data && res.data.session) showApp(); else showLogin();
  });

  supa.auth.onAuthStateChange(function (_event, session) {
    if (session) showApp(); else showLogin();
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var email = loginForm.querySelector('[name="email"]').value.trim();
    var password = loginForm.querySelector('[name="password"]').value;
    var submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    supa.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      submitBtn.disabled = false;
      if (res.error) {
        loginError.textContent = "Не удалось войти: неверный email или пароль.";
        loginError.hidden = false;
      }
    });
  });

  logoutBtn.addEventListener("click", function () {
    supa.auth.signOut();
  });

  /* ---------- tabs ---------- */
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      var target = tab.getAttribute("data-admin-tab");
      panels.forEach(function (p) {
        p.hidden = p.getAttribute("data-admin-panel") !== target;
      });
    });
  });

  /* ---------- products ---------- */
  var productsBody = document.querySelector("[data-products-body]");
  var productsStatus = document.querySelector("[data-products-status]");
  var addForm = document.querySelector("[data-add-product-form]");
  var addCatSelect = addForm.querySelector('[name="cat"]');
  if (addCatSelect) addCatSelect.innerHTML = categoryOptionsHTML();

  function productRowHTML(p) {
    return (
      '<tr data-product-row data-id="' + esc(p.id) + '">' +
        '<td class="admin-table__id">' + esc(p.id) + '</td>' +
        '<td><input type="text" data-field="name" value="' + esc(p.name) + '"></td>' +
        '<td><select data-field="cat">' + categoryOptionsHTML(p.cat) + '</select></td>' +
        '<td><input type="number" data-field="price" value="' + p.price + '" min="0" step="1"></td>' +
        '<td><input type="number" data-field="old_price" value="' + (p.old_price === null || p.old_price === undefined ? "" : p.old_price) + '" min="0" step="1" placeholder="—"></td>' +
        '<td class="admin-table__center"><input type="checkbox" data-field="in_stock"' + (p.in_stock ? " checked" : "") + '></td>' +
        '<td class="admin-table__actions">' +
          '<button type="button" class="btn btn--outline admin-btn-sm" data-save-product>' +
            '<span class="btn__fill"></span><span class="btn__label">Сохранить</span>' +
          '</button>' +
          '<button type="button" class="admin-btn-sm admin-btn-danger" data-delete-product>Удалить</button>' +
        '</td>' +
      '</tr>'
    );
  }

  function loadProducts() {
    productsStatus.textContent = "Загрузка…";
    productsStatus.hidden = false;
    supa.from("products").select("*").order("created_at", { ascending: true }).then(function (res) {
      if (res.error) { productsStatus.textContent = "Ошибка загрузки: " + res.error.message; return; }
      productsStatus.hidden = true;
      productsBody.innerHTML = res.data.map(productRowHTML).join("");
    });
  }

  productsBody.addEventListener("click", function (e) {
    var row = e.target.closest("[data-product-row]");
    if (!row) return;
    var id = row.getAttribute("data-id");

    var saveBtn = e.target.closest("[data-save-product]");
    if (saveBtn) {
      var patch = {
        name: row.querySelector('[data-field="name"]').value.trim(),
        cat: row.querySelector('[data-field="cat"]').value,
        price: Number(row.querySelector('[data-field="price"]').value) || 0,
        old_price: row.querySelector('[data-field="old_price"]').value === "" ? null : Number(row.querySelector('[data-field="old_price"]').value),
        in_stock: row.querySelector('[data-field="in_stock"]').checked
      };
      saveBtn.disabled = true;
      supa.from("products").update(patch).eq("id", id).then(function (res) {
        saveBtn.disabled = false;
        var label = saveBtn.querySelector(".btn__label");
        if (res.error) {
          alert("Не удалось сохранить: " + res.error.message);
        } else if (label) {
          var original = label.textContent;
          label.textContent = "Сохранено";
          setTimeout(function () { label.textContent = original; }, 1200);
        }
      });
      return;
    }

    if (e.target.closest("[data-delete-product]")) {
      if (!confirm('Удалить товар "' + id + '"? Это нельзя отменить.')) return;
      supa.from("products").delete().eq("id", id).then(function (res) {
        if (res.error) alert("Не удалось удалить: " + res.error.message);
        else row.remove();
      });
    }
  });

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = addForm.querySelector('[name="id"]').value.trim();
    var name = addForm.querySelector('[name="name"]').value.trim();
    var cat = addForm.querySelector('[name="cat"]').value;
    var price = Number(addForm.querySelector('[name="price"]').value) || 0;
    var oldPriceRaw = addForm.querySelector('[name="old_price"]').value;
    var oldPrice = oldPriceRaw === "" ? null : Number(oldPriceRaw);

    if (!id || !name || !price) {
      alert("Заполните артикул (id), название и цену.");
      return;
    }

    supa.from("products").insert({ id: id, name: name, cat: cat, price: price, old_price: oldPrice, in_stock: true }).then(function (res) {
      if (res.error) { alert("Не удалось добавить: " + res.error.message); return; }
      addForm.reset();
      loadProducts();
    });
  });

  /* ---------- orders ---------- */
  var ordersBody = document.querySelector("[data-orders-body]");
  var ordersStatus = document.querySelector("[data-orders-status]");

  function orderRowHTML(o) {
    var date = new Date(o.created_at);
    var dateStr = isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    var itemsStr = (o.items || []).map(function (it) { return esc(it.name) + " × " + it.qty; }).join("<br>");
    var deliveryStr = o.delivery_type === "delivery" ? "Доставка: " + esc(o.address || "—") : "Самовывоз";
    var statusOptions = Object.keys(STATUS_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === o.status ? " selected" : "") + '>' + STATUS_LABELS[k] + '</option>';
    }).join("");
    return (
      '<tr data-order-row data-id="' + esc(o.id) + '">' +
        '<td>' + dateStr + '</td>' +
        '<td>' + esc(o.name) + '<br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></td>' +
        '<td>' + deliveryStr + '</td>' +
        '<td>' + (itemsStr || "—") + '</td>' +
        '<td>' + o.total + '&nbsp;Br.</td>' +
        '<td>' + (o.comment ? esc(o.comment) : "—") + '</td>' +
        '<td><select data-order-status>' + statusOptions + '</select></td>' +
        '<td><button type="button" class="admin-btn-danger" data-delete-order>Удалить</button></td>' +
      '</tr>'
    );
  }

  function loadOrders() {
    ordersStatus.textContent = "Загрузка…";
    ordersStatus.hidden = false;
    supa.from("orders").select("*").order("created_at", { ascending: false }).then(function (res) {
      if (res.error) { ordersStatus.textContent = "Ошибка загрузки: " + res.error.message; return; }
      if (!res.data.length) { ordersStatus.textContent = "Заказов пока нет."; return; }
      ordersStatus.hidden = true;
      ordersBody.innerHTML = res.data.map(orderRowHTML).join("");
    });
  }

  ordersBody.addEventListener("change", function (e) {
    var select = e.target.closest("[data-order-status]");
    if (!select) return;
    var row = select.closest("[data-order-row]");
    var id = row.getAttribute("data-id");
    supa.from("orders").update({ status: select.value }).eq("id", id).then(function (res) {
      if (res.error) alert("Не удалось обновить статус: " + res.error.message);
    });
  });

  ordersBody.addEventListener("click", function (e) {
    var delBtn = e.target.closest("[data-delete-order]");
    if (!delBtn) return;
    var row = delBtn.closest("[data-order-row]");
    var id = row.getAttribute("data-id");
    if (!confirm("Удалить этот заказ? Это нельзя отменить.")) return;
    supa.from("orders").delete().eq("id", id).then(function (res) {
      if (res.error) alert("Не удалось удалить: " + res.error.message);
      else row.remove();
    });
  });

  var refreshOrdersBtn = document.querySelector("[data-refresh-orders]");
  if (refreshOrdersBtn) refreshOrdersBtn.addEventListener("click", loadOrders);
})();
