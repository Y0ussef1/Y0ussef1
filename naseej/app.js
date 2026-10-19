(function () {
  "use strict";

  const CART_KEY = "naseej-cart";
  const app = document.getElementById("app");
  const cartCount = document.getElementById("cart-count");
  let category = "All";

  // ---------- Small DOM helper (never uses innerHTML with data) ----------
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "style") Object.assign(node.style, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of children.flat()) {
      if (child === undefined || child === null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  // ---------- Cart state (localStorage, with graceful fallback) ----------
  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      return sanitizeCart(parsed);
    } catch (_) {
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (_) {
      // Storage unavailable (private mode, blocked); the cart still works for this page view.
    }
  }

  // Keep only known product ids with positive integer quantities.
  function sanitizeCart(raw) {
    const clean = {};
    if (!raw || typeof raw !== "object") return clean;
    for (const product of PRODUCTS) {
      const qty = Number(raw[product.id]);
      if (Number.isInteger(qty) && qty > 0 && qty <= 99) clean[product.id] = qty;
    }
    return clean;
  }

  let cart = loadCart();

  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, 99);
    saveCart();
    updateCartCount();
  }

  function addToCart(id) {
    setQty(id, (cart[id] || 0) + 1);
  }

  function cartItems() {
    return PRODUCTS.filter((p) => cart[p.id]).map((p) => ({ product: p, qty: cart[p.id] }));
  }

  function cartTotal() {
    return cartItems().reduce((sum, item) => sum + item.product.price * item.qty, 0);
  }

  function cartSize() {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }

  function updateCartCount() {
    cartCount.textContent = String(cartSize());
  }

  const money = (value) => `$${value.toFixed(2)}`;

  // ---------- Views ----------
  function swatch(product) {
    return el("div", { class: "swatch", style: { background: product.color }, role: "img", "aria-label": product.name });
  }

  function renderCatalog() {
    const categories = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
    const visible = PRODUCTS.filter((p) => category === "All" || p.category === category);

    return el(
      "section",
      null,
      el("h1", null, "Shop"),
      el(
        "div",
        { class: "filters", role: "group", "aria-label": "Filter by category" },
        categories.map((name) =>
          el(
            "button",
            {
              class: "chip",
              type: "button",
              "aria-pressed": String(name === category),
              onclick: () => {
                category = name;
                render();
              },
            },
            name,
          ),
        ),
      ),
      el(
        "div",
        { class: "grid" },
        visible.map((product) =>
          el(
            "article",
            { class: "card" },
            swatch(product),
            el(
              "div",
              { class: "card-body" },
              el("h3", null, el("a", { href: `#/product/${product.id}` }, product.name)),
              el("span", { class: "muted" }, product.category),
              el("span", { class: "price" }, money(product.price)),
              el(
                "button",
                {
                  class: "button",
                  type: "button",
                  onclick: () => {
                    addToCart(product.id);
                    render();
                  },
                },
                "Add to cart",
              ),
            ),
          ),
        ),
      ),
    );
  }

  function renderProduct(id) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) return renderNotFound();

    let qty = 1;
    const qtyValue = el("span", null, String(qty));
    const addButton = el(
      "button",
      {
        class: "button",
        type: "button",
        onclick: () => {
          for (let i = 0; i < qty; i++) addToCart(product.id);
          render();
          window.location.hash = "#/cart";
        },
      },
      "Add to cart",
    );

    const setDisplayedQty = (next) => {
      qty = Math.min(Math.max(next, 1), 99);
      qtyValue.textContent = String(qty);
    };

    return el(
      "section",
      null,
      el("a", { class: "back", href: "#/" }, "← Back to shop"),
      el(
        "div",
        { class: "product" },
        swatch(product),
        el(
          "div",
          { class: "product-info" },
          el("h1", null, product.name),
          el("span", { class: "muted" }, product.category),
          el("span", { class: "price" }, money(product.price)),
          el("p", null, product.description),
          el(
            "div",
            { class: "qty-row" },
            el(
              "div",
              { class: "qty" },
              el("button", { type: "button", "aria-label": "Decrease quantity", onclick: () => setDisplayedQty(qty - 1) }, "−"),
              qtyValue,
              el("button", { type: "button", "aria-label": "Increase quantity", onclick: () => setDisplayedQty(qty + 1) }, "+"),
            ),
            addButton,
          ),
        ),
      ),
    );
  }

  function renderCart() {
    const items = cartItems();
    if (items.length === 0) {
      return el(
        "section",
        null,
        el("h1", null, "Your cart"),
        el("div", { class: "notice" }, "Your cart is empty. ", el("a", { href: "#/" }, "Continue shopping")),
      );
    }

    const rows = items.map(({ product, qty }) =>
      el(
        "tr",
        null,
        el("td", null, el("a", { href: `#/product/${product.id}` }, product.name)),
        el("td", { class: "num hide-sm" }, money(product.price)),
        el(
          "td",
          null,
          el(
            "div",
            { class: "qty" },
            el("button", { type: "button", "aria-label": `Decrease ${product.name}`, onclick: () => { setQty(product.id, qty - 1); render(); } }, "−"),
            el("span", null, String(qty)),
            el("button", { type: "button", "aria-label": `Increase ${product.name}`, onclick: () => { setQty(product.id, qty + 1); render(); } }, "+"),
          ),
        ),
        el("td", { class: "num" }, money(product.price * qty)),
        el("td", null, el("button", { class: "button danger", type: "button", onclick: () => { setQty(product.id, 0); render(); } }, "Remove")),
      ),
    );

    return el(
      "section",
      null,
      el("h1", null, "Your cart"),
      el(
        "table",
        { class: "cart-table" },
        el(
          "thead",
          null,
          el(
            "tr",
            null,
            el("th", null, "Item"),
            el("th", { class: "num hide-sm" }, "Price"),
            el("th", null, "Qty"),
            el("th", { class: "num" }, "Total"),
            el("th", null, ""),
          ),
        ),
        el("tbody", null, rows),
      ),
      el(
        "div",
        { class: "summary" },
        el("strong", null, `Subtotal: ${money(cartTotal())}`),
        el("a", { class: "button", href: "#/checkout" }, "Checkout"),
      ),
    );
  }

  function renderCheckout() {
    if (cartSize() === 0) {
      return el("section", null, el("h1", null, "Checkout"), el("div", { class: "notice" }, "Your cart is empty. ", el("a", { href: "#/" }, "Browse the shop")));
    }

    const fields = [
      { name: "name", label: "Full name", type: "text", autocomplete: "name", required: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", required: true },
      { name: "address", label: "Shipping address", type: "text", autocomplete: "street-address", required: true },
      { name: "city", label: "City", type: "text", autocomplete: "address-level2", required: true },
      { name: "postcode", label: "Postcode", type: "text", autocomplete: "postal-code", required: true },
    ];

    const errorNodes = {};
    const inputs = {};

    const form = el(
      "form",
      {
        class: "form",
        novalidate: true,
        onsubmit: (event) => {
          event.preventDefault();
          let valid = true;
          for (const field of fields) {
            const value = inputs[field.name].value.trim();
            const message = validate(field, value);
            errorNodes[field.name].textContent = message;
            inputs[field.name].setAttribute("aria-invalid", String(Boolean(message)));
            if (message) valid = false;
          }
          if (!valid) return;

          cart = {};
          saveCart();
          updateCartCount();
          app.replaceChildren(
            el(
              "section",
              null,
              el("h1", null, "Thank you"),
              el("div", { class: "notice" }, "Your order has been received. This is a demo, so no payment was taken. ", el("a", { href: "#/" }, "Back to shop")),
            ),
          );
        },
      },
      fields.map((field) => {
        inputs[field.name] = el("input", {
          id: `field-${field.name}`,
          name: field.name,
          type: field.type,
          autocomplete: field.autocomplete,
          required: field.required,
        });
        errorNodes[field.name] = el("span", { class: "error", "aria-live": "polite" });
        return el("label", null, field.label, inputs[field.name], errorNodes[field.name]);
      }),
      el("button", { class: "button", type: "submit" }, `Place order · ${money(cartTotal())}`),
    );

    return el("section", null, el("h1", null, "Checkout"), form);
  }

  function validate(field, value) {
    if (!value) return "This field is required.";
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
    if (value.length > 200) return "Please shorten this value.";
    return "";
  }

  function renderNotFound() {
    return el("section", null, el("h1", null, "Not found"), el("div", { class: "notice" }, el("a", { href: "#/" }, "Back to shop")));
  }

  // ---------- Router ----------
  function route() {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);

    if (parts.length === 0) return renderCatalog();
    if (parts[0] === "product" && parts[1]) return renderProduct(decodeURIComponent(parts[1]));
    if (parts[0] === "cart") return renderCart();
    if (parts[0] === "checkout") return renderCheckout();
    return renderNotFound();
  }

  function render() {
    app.replaceChildren(route());
    updateCartCount();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);
  render();
})();
