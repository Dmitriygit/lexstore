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

  // Uploads one product photo to the "product-images" storage bucket and
  // resolves with its public URL. Resolves with null if no file was given.
  function uploadProductImage(id, file) {
    if (!file) return Promise.resolve(null);
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var path = id + "-" + Date.now() + "." + ext;
    return supa.storage.from("product-images").upload(path, file, { upsert: true, cacheControl: "3600" }).then(function (res) {
      if (res.error) throw res.error;
      return supa.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    });
  }

  // Uploads several files (a product's photo set) in parallel and resolves
  // with their public URLs, in the same order the files were given.
  function uploadProductImages(id, files) {
    return Promise.all(files.map(function (f) { return uploadProductImage(id, f); }));
  }

  // Best-effort: pulls the storage path back out of a public URL so the old
  // file can be deleted from the bucket when a photo is removed/replaced.
  function storagePathFromUrl(url) {
    var marker = "/product-images/";
    var i = url.indexOf(marker);
    return i === -1 ? null : url.slice(i + marker.length);
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

  // A product's photo set: prefers the new `images` array column, falls
  // back to the older single `image_url` column for rows not migrated yet.
  function productImages(p) {
    if (Array.isArray(p.images) && p.images.length) return p.images;
    return p.image_url ? [p.image_url] : [];
  }

  function productRowHTML(p) {
    var images = productImages(p);
    var thumbList = images.length
      ? images.map(function (url, i) {
          var isCover = i === 0;
          return (
            '<span class="admin-thumb-item">' +
              '<img class="admin-thumb" src="' + esc(url) + '" alt="">' +
              '<button type="button" class="admin-thumb-cover' + (isCover ? " is-cover" : "") + '" data-set-cover data-url="' + esc(url) + '"' + (isCover ? " disabled" : "") + ' title="' + (isCover ? "Это фото видят покупатели в каталоге" : "Сделать главным (видят покупатели в каталоге)") + '">' + (isCover ? "★" : "☆") + '</button>' +
              '<button type="button" class="admin-thumb-remove" data-remove-image data-url="' + esc(url) + '" title="Удалить это фото">×</button>' +
            '</span>'
          );
        }).join("")
      : '<span class="admin-thumb admin-thumb--empty">нет фото</span>';
    return (
      '<tr data-product-row data-id="' + esc(p.id) + '">' +
        '<td class="admin-table__id">' + esc(p.id) + '</td>' +
        '<td><div class="admin-thumb-cell"><div class="admin-thumb-list">' + thumbList + '</div><input type="file" accept="image/*" multiple data-field="image-files" title="Добавить ещё фото"></div></td>' +
        '<td><input type="text" data-field="name" value="' + esc(p.name) + '"></td>' +
        '<td><select data-field="cat">' + categoryOptionsHTML(p.cat) + '</select></td>' +
        '<td><input type="number" data-field="price" value="' + p.price + '" min="0" step="1"></td>' +
        '<td><input type="number" data-field="old_price" value="' + (p.old_price === null || p.old_price === undefined ? "" : p.old_price) + '" min="0" step="1" placeholder="—"></td>' +
        '<td><textarea data-field="description" rows="2" placeholder="Описание">' + esc(p.description || "") + '</textarea></td>' +
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

    var setCoverBtn = e.target.closest("[data-set-cover]");
    if (setCoverBtn) {
      var coverUrl = setCoverBtn.getAttribute("data-url");
      setCoverBtn.disabled = true;
      supa.from("products").select("images,image_url").eq("id", id).then(function (res) {
        if (res.error || !res.data[0]) throw (res.error || new Error("Товар не найден"));
        var current = productImages(res.data[0]);
        var reordered = [coverUrl].concat(current.filter(function (u) { return u !== coverUrl; }));
        return supa.from("products").update({ images: reordered }).eq("id", id);
      }).then(function (res) {
        if (res.error) throw res.error;
        loadProducts();
      }).catch(function (err) {
        setCoverBtn.disabled = false;
        alert("Не удалось сделать фото главным: " + err.message);
      });
      return;
    }

    var removeImageBtn = e.target.closest("[data-remove-image]");
    if (removeImageBtn) {
      var urlToRemove = removeImageBtn.getAttribute("data-url");
      if (!confirm("Удалить это фото товара?")) return;
      removeImageBtn.disabled = true;
      supa.from("products").select("images,image_url").eq("id", id).then(function (res) {
        if (res.error || !res.data[0]) throw (res.error || new Error("Товар не найден"));
        var updated = productImages(res.data[0]).filter(function (u) { return u !== urlToRemove; });
        return supa.from("products").update({ images: updated, image_url: null }).eq("id", id);
      }).then(function (res) {
        if (res.error) throw res.error;
        var path = storagePathFromUrl(urlToRemove);
        if (path) supa.storage.from("product-images").remove([path]);
        loadProducts();
      }).catch(function (err) {
        removeImageBtn.disabled = false;
        alert("Не удалось удалить фото: " + err.message);
      });
      return;
    }

    var saveBtn = e.target.closest("[data-save-product]");
    if (saveBtn) {
      var patch = {
        name: row.querySelector('[data-field="name"]').value.trim(),
        cat: row.querySelector('[data-field="cat"]').value,
        price: Number(row.querySelector('[data-field="price"]').value) || 0,
        old_price: row.querySelector('[data-field="old_price"]').value === "" ? null : Number(row.querySelector('[data-field="old_price"]').value),
        description: row.querySelector('[data-field="description"]').value.trim() || null,
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

  // Selecting files in a row's "add photo" input uploads and appends them
  // to that product's photo set right away — no separate save step needed.
  productsBody.addEventListener("change", function (e) {
    var input = e.target.closest('[data-field="image-files"]');
    if (!input) return;
    var row = input.closest("[data-product-row]");
    var id = row.getAttribute("data-id");
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    input.disabled = true;
    uploadProductImages(id, files).then(function (urls) {
      return supa.from("products").select("images,image_url").eq("id", id).then(function (res) {
        if (res.error || !res.data[0]) throw (res.error || new Error("Товар не найден"));
        var updated = productImages(res.data[0]).concat(urls);
        return supa.from("products").update({ images: updated }).eq("id", id);
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      loadProducts();
    }).catch(function (err) {
      input.disabled = false;
      alert("Не удалось загрузить фото: " + err.message);
    });
  });

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = addForm.querySelector('[name="id"]').value.trim();
    var name = addForm.querySelector('[name="name"]').value.trim();
    var cat = addForm.querySelector('[name="cat"]').value;
    var price = Number(addForm.querySelector('[name="price"]').value) || 0;
    var oldPriceRaw = addForm.querySelector('[name="old_price"]').value;
    var oldPrice = oldPriceRaw === "" ? null : Number(oldPriceRaw);
    var description = addForm.querySelector('[name="description"]').value.trim() || null;
    var imageFiles = Array.prototype.slice.call(addForm.querySelector('[name="images"]').files || []);

    if (!id || !name || !price) {
      alert("Заполните артикул (id), название и цену.");
      return;
    }

    var submitBtn = addForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    uploadProductImages(id, imageFiles).then(function (imageUrls) {
      return supa.from("products").insert({
        id: id, name: name, cat: cat, price: price, old_price: oldPrice,
        description: description, images: imageUrls, in_stock: true
      });
    }).then(function (res) {
      submitBtn.disabled = false;
      if (res.error) { alert("Не удалось добавить: " + res.error.message); return; }
      addForm.reset();
      loadProducts();
    }).catch(function (err) {
      submitBtn.disabled = false;
      alert("Не удалось загрузить фото: " + err.message);
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
