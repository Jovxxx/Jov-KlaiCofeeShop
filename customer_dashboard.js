/* ==========================================================
   CUSTOMER DASHBOARD
   Coffee Shop Management System
========================================================== */

"use strict";

/* ==========================================================
   GET SUPABASE CLIENT
========================================================== */

const db = window.supabaseClient;

/* ==========================================================
   GET ELEMENTS
========================================================== */

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

const menuGrid = document.getElementById("menuGrid");
const menuStatus = document.getElementById("menuStatus");

const ordersList = document.getElementById("ordersList");
const ordersStatus = document.getElementById("ordersStatus");

const feedbackStars = document.getElementById("feedbackStars");
const feedbackMessage = document.getElementById("feedbackMessage");
const feedbackStatusMessage = document.getElementById("feedbackStatusMessage");
const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");

const cartToggleBtn = document.getElementById("cartToggleBtn");
const cartCloseBtn = document.getElementById("cartCloseBtn");
const cartOverlay = document.getElementById("cartOverlay");
const cartPanel = document.getElementById("cartPanel");
const cartCount = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartEmptyText = document.getElementById("cartEmptyText");
const cartTotal = document.getElementById("cartTotal");

const orderType = document.getElementById("orderType");
const paymentMethod = document.getElementById("paymentMethod");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const placeOrderMessage = document.getElementById("placeOrderMessage");


/* ==========================================================
   STATE
   currentProfileId is needed because orders.customer_id
   points at profiles.profile_id, not the auth user id.
   cart is kept in memory only - it does not need a table,
   it only becomes real once "Place Order" is clicked.
========================================================== */

let currentProfileId = null;

let cart = [];


/* ==========================================================
   AUTH GUARD
========================================================== */

async function requireLogin() {

    const { data, error } = await db.auth.getSession();

    if (error || !data.session) {

        window.location.href = "customer_login.html";

        return null;

    }

    return data.session.user;

}


/* ==========================================================
   LOAD PROFILE
========================================================== */

async function loadProfile(userId) {

    const { data, error } = await db

        .from("profiles")

        .select("profile_id, full_name, status")

        .eq("auth_user_id", userId)

        .single();

    if (error || !data) {

        console.error(error);

        welcomeText.textContent = "Welcome!";

        return true;

    }

    /* Catches the case where someone was already logged in
       when an admin blocked their account mid-session - the
       login page check alone wouldn't cover that */

    if (data.status !== "Active") {

        await db.auth.signOut();

        alert("This account has been blocked. Please contact the shop for help.");

        window.location.href = "customer_login.html";

        return false;

    }

    currentProfileId = data.profile_id;

    welcomeText.textContent = `Welcome, ${data.full_name}!`;

    return true;

}


/* ==========================================================
   LOAD MENU
========================================================== */

async function loadMenu() {

    menuStatus.textContent = "Loading menu...";

    const { data, error } = await db

        .from("menu")

        .select("menu_id, item_name, price, image_url, categories(category_name)")

        .eq("availability", true)

        .order("item_name", { ascending: true });

    if (error) {

        console.error(error);

        menuStatus.textContent =
            "Could not load the menu right now. Please try again later.";

        return;

    }

    if (!data || data.length === 0) {

        menuStatus.textContent =
            "No items available right now. Please check back later.";

        menuGrid.innerHTML = "";

        return;

    }

    menuStatus.textContent = "";

    renderMenu(data);

}


/* ==========================================================
   RENDER MENU
========================================================== */

function renderMenu(items) {

    menuGrid.innerHTML = "";

    items.forEach((item) => {

        const card = document.createElement("div");

        card.className = "menu-card";

        const categoryName = item.categories
            ? item.categories.category_name
            : "Uncategorized";

        const imageHtml = item.image_url
            ? `<img class="menu-card-image" src="${item.image_url}" alt="${item.item_name}">`
            : `<div class="menu-card-image"></div>`;

        card.innerHTML = `
            ${imageHtml}
            <div class="menu-card-name">${item.item_name}</div>
            <div class="menu-card-category">${categoryName}</div>
            <div class="menu-card-price">₱${Number(item.price).toFixed(2)}</div>
        `;

        const controls = document.createElement("div");

        controls.className = "menu-card-controls";

        const qtyInput = document.createElement("input");

        qtyInput.type = "number";
        qtyInput.min = "1";
        qtyInput.value = "1";
        qtyInput.className = "menu-card-qty";

        const addBtn = document.createElement("button");

        addBtn.className = "add-to-cart-btn";
        addBtn.textContent = "Add to Cart";

        addBtn.addEventListener("click", () => {

            const qty = parseInt(qtyInput.value, 10);

            if (isNaN(qty) || qty < 1) {

                qtyInput.focus();
                return;

            }

            addToCart({

                menu_id: item.menu_id,
                item_name: item.item_name,
                price: Number(item.price)

            }, qty);

            qtyInput.value = "1";

        });

        controls.appendChild(qtyInput);
        controls.appendChild(addBtn);

        card.appendChild(controls);

        menuGrid.appendChild(card);

    });

}


/* ==========================================================
   CART - ADD / CHANGE / REMOVE
========================================================== */

function addToCart(menuItem, quantity) {

    const existing = cart.find((c) => c.menu_id === menuItem.menu_id);

    if (existing) {

        existing.quantity += quantity;

    } else {

        cart.push({

            menu_id: menuItem.menu_id,
            item_name: menuItem.item_name,
            price: menuItem.price,
            quantity: quantity

        });

    }

    renderCart();

    openCart();

}

function changeCartQuantity(menuId, delta) {

    const item = cart.find((c) => c.menu_id === menuId);

    if (!item) {
        return;
    }

    item.quantity += delta;

    if (item.quantity <= 0) {

        cart = cart.filter((c) => c.menu_id !== menuId);

    }

    renderCart();

}

function removeFromCart(menuId) {

    cart = cart.filter((c) => c.menu_id !== menuId);

    renderCart();

}


/* ==========================================================
   CART - RENDER
========================================================== */

function renderCart() {

    const totalCount = cart.reduce((sum, c) => sum + c.quantity, 0);

    cartCount.textContent = totalCount;

    if (cart.length === 0) {

        cartItems.innerHTML = "";
        cartEmptyText.style.display = "block";
        cartTotal.textContent = "₱0.00";
        placeOrderBtn.disabled = true;

        return;

    }

    cartEmptyText.style.display = "none";
    placeOrderBtn.disabled = false;

    cartItems.innerHTML = "";

    let grandTotal = 0;

    cart.forEach((item) => {

        const lineTotal = item.price * item.quantity;

        grandTotal += lineTotal;

        const row = document.createElement("div");

        row.className = "cart-item-row";

        row.innerHTML = `
            <div class="cart-item-info">
                <span class="cart-item-name">${item.item_name}</span>
                <span class="cart-item-meta">₱${item.price.toFixed(2)} each</span>
            </div>
        `;

        const controls = document.createElement("div");

        controls.className = "cart-item-controls";

        const minusBtn = document.createElement("button");
        minusBtn.className = "qty-btn";
        minusBtn.textContent = "-";
        minusBtn.addEventListener("click", () => changeCartQuantity(item.menu_id, -1));

        const qtySpan = document.createElement("span");
        qtySpan.className = "cart-item-qty";
        qtySpan.textContent = item.quantity;

        const plusBtn = document.createElement("button");
        plusBtn.className = "qty-btn";
        plusBtn.textContent = "+";
        plusBtn.addEventListener("click", () => changeCartQuantity(item.menu_id, 1));

        const removeBtn = document.createElement("button");
        removeBtn.className = "cart-item-remove";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => removeFromCart(item.menu_id));

        controls.appendChild(minusBtn);
        controls.appendChild(qtySpan);
        controls.appendChild(plusBtn);
        controls.appendChild(removeBtn);

        row.appendChild(controls);

        cartItems.appendChild(row);

    });

    cartTotal.textContent = `₱${grandTotal.toFixed(2)}`;

}


/* ==========================================================
   CART - OPEN / CLOSE
========================================================== */

function openCart() {

    cartPanel.classList.add("open");
    cartOverlay.classList.add("open");

}

function closeCart() {

    cartPanel.classList.remove("open");
    cartOverlay.classList.remove("open");

}

cartToggleBtn.addEventListener("click", openCart);
cartCloseBtn.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);


/* ==========================================================
   PLACE ORDER
   Two inserts: one row in orders, then one row per cart item
   in order_items. The database's own triggers take it from
   there - set_order_item_details() fills item_name/unit_price/
   subtotal per row, and recalculate_order_total() keeps
   orders.total_amount in sync automatically.
========================================================== */

function showPlaceOrderMessage(text, type = "") {

    placeOrderMessage.textContent = text;
    placeOrderMessage.className = "";

    if (type !== "") {
        placeOrderMessage.classList.add(type);
    }

}

function setPlaceOrderLoading(isLoading) {

    if (isLoading) {

        placeOrderBtn.disabled = true;
        placeOrderBtn.dataset.originalText = placeOrderBtn.textContent;
        placeOrderBtn.textContent = "Placing order...";

    } else {

        placeOrderBtn.disabled = cart.length === 0;
        placeOrderBtn.textContent = placeOrderBtn.dataset.originalText || "Place Order";

    }

}

async function placeOrder() {

    if (cart.length === 0 || !currentProfileId) {
        return;
    }

    setPlaceOrderLoading(true);

    showPlaceOrderMessage("");

    try {

        /* Step 1: create the order shell */

        const { data: orderData, error: orderError } = await db

            .from("orders")

            .insert({

                customer_id: currentProfileId,

                order_type: orderType.value,

                payment_method: paymentMethod.value || null

            })

            .select("order_id")

            .single();

        if (orderError || !orderData) {

            console.error(orderError);

            showPlaceOrderMessage("Could not place your order. Please try again.", "error");

            return;

        }

        /* Step 2: insert each cart item as an order_item -
           only order_id, menu_id and quantity are needed,
           the trigger fills in the rest */

        const orderItemsPayload = cart.map((item) => ({

            order_id: orderData.order_id,

            menu_id: item.menu_id,

            quantity: item.quantity

        }));

        const { error: itemsError } = await db

            .from("order_items")

            .insert(orderItemsPayload);

        if (itemsError) {

            console.error(itemsError);

            showPlaceOrderMessage(

                "Order started, but some items could not be saved. Please contact staff.",

                "error"

            );

            return;

        }

        /* Success */

        showPlaceOrderMessage("Order placed! Thank you.", "success");

        cart = [];

        renderCart();

        paymentMethod.value = "";

        await loadOrders();

        setTimeout(() => {

            closeCart();
            showPlaceOrderMessage("");

        }, 1500);

    } catch (err) {

        console.error(err);

        showPlaceOrderMessage("Unexpected error. Please try again.", "error");

    } finally {

        setPlaceOrderLoading(false);

    }

}

placeOrderBtn.addEventListener("click", placeOrder);


/* ==========================================================
   LOAD ORDER HISTORY
   RLS ("Customers can view own orders") already limits this
   to the logged-in customer's own orders - no extra filter
   needed here beyond what the policy already enforces.
========================================================== */

async function loadOrders() {

    ordersStatus.textContent = "Loading your orders...";

    const { data, error } = await db

        .from("orders")

        .select(`
            order_id,
            order_status,
            order_type,
            payment_status,
            total_amount,
            order_date,
            order_items(item_name, quantity, subtotal)
        `)

        .order("order_date", { ascending: false });

    if (error) {

        console.error(error);

        ordersStatus.textContent = "Could not load your orders right now.";

        return;

    }

    if (!data || data.length === 0) {

        ordersStatus.textContent = "You haven't placed any orders yet.";

        ordersList.innerHTML = "";

        return;

    }

    ordersStatus.textContent = "";

    renderOrders(data);

}


/* ==========================================================
   RENDER ORDER HISTORY
========================================================== */

function renderOrders(orders) {

    ordersList.innerHTML = "";

    orders.forEach((order) => {

        const card = document.createElement("div");

        card.className = "order-card";

        const itemsSummary = (order.order_items || [])

            .map((it) => `${it.item_name} x${it.quantity}`)

            .join(", ");

        const orderDate = new Date(order.order_date).toLocaleString();

        card.innerHTML = `
            <div class="order-card-top">
                <span class="order-card-id">${orderDate} · ${order.order_type}</span>
                <span class="order-status-badge ${order.order_status}">${order.order_status}</span>
            </div>
            <div class="order-card-items">${itemsSummary || "No items"}</div>
            <div class="order-card-bottom">
                <span>Payment: ${order.payment_status}</span>
                <span>₱${Number(order.total_amount).toFixed(2)}</span>
            </div>
        `;

        ordersList.appendChild(card);

    });

}


/* ==========================================================
   SEND FEEDBACK
========================================================== */

let selectedRating = 0;

feedbackStars.addEventListener("click", (event) => {

    const btn = event.target.closest(".star-btn");

    if (!btn) {
        return;
    }

    selectedRating = parseInt(btn.dataset.value, 10);

    document

        .querySelectorAll(".star-btn")

        .forEach((star) => {

            const starValue = parseInt(star.dataset.value, 10);

            star.classList.toggle("selected", starValue <= selectedRating);

        });

});

function showFeedbackStatus(text, type = "") {

    feedbackStatusMessage.textContent = text;
    feedbackStatusMessage.className = "";

    if (type !== "") {
        feedbackStatusMessage.classList.add(type);
    }

}

function setFeedbackLoading(isLoading) {

    if (isLoading) {

        submitFeedbackBtn.disabled = true;
        submitFeedbackBtn.dataset.originalText = submitFeedbackBtn.textContent;
        submitFeedbackBtn.textContent = "Sending...";

    } else {

        submitFeedbackBtn.disabled = false;
        submitFeedbackBtn.textContent = submitFeedbackBtn.dataset.originalText || "Send Feedback";

    }

}

async function submitFeedback() {

    showFeedbackStatus("");

    const messageValue = feedbackMessage.value.trim();

    if (messageValue === "") {

        showFeedbackStatus("Please write a message before sending.", "error");
        feedbackMessage.focus();
        return;

    }

    if (!currentProfileId) {
        return;
    }

    setFeedbackLoading(true);

    try {

        const { error } = await db

            .from("feedback")

            .insert({

                customer_id: currentProfileId,

                message: messageValue,

                rating: selectedRating > 0 ? selectedRating : null

            });

        if (error) {

            console.error(error);
            showFeedbackStatus("Could not send your feedback. Please try again.", "error");
            return;

        }

        showFeedbackStatus("Thank you for your feedback!", "success");

        feedbackMessage.value = "";

        selectedRating = 0;

        document

            .querySelectorAll(".star-btn")

            .forEach((star) => star.classList.remove("selected"));

    } catch (err) {

        console.error(err);
        showFeedbackStatus("Unexpected error. Please try again.", "error");

    } finally {

        setFeedbackLoading(false);

    }

}

submitFeedbackBtn.addEventListener("click", submitFeedback);


/* ==========================================================
   LOGOUT
========================================================== */

logoutBtn.addEventListener("click", async () => {

    await db.auth.signOut();

    window.location.href = "customer_login.html";

});


/* ==========================================================
   INIT
========================================================== */

/* ==========================================================
   REFRESH ORDERS
   Orders can change status (e.g. an employee accepts/updates
   it) after this page already loaded, so we refresh on a
   timer instead of requiring the customer to log out and back
   in just to see the current status.
========================================================== */

const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");

refreshOrdersBtn.addEventListener("click", async () => {

    refreshOrdersBtn.classList.add("spinning");

    await loadOrders();

    refreshOrdersBtn.classList.remove("spinning");

});

setInterval(() => {

    loadOrders();

}, 20000);


(async function init() {

    const user = await requireLogin();

    if (!user) {
        return;
    }

    const isActive = await loadProfile(user.id);

    if (!isActive) {
        return;
    }

    await loadMenu();

    await loadOrders();

    renderCart();

})();
