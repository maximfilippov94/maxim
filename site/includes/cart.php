<div id="shade" onclick="closeCart()"></div>
<aside id="cartPanel" class="cartPanel">
  <div class="cartHead">
    <h2>Корзина</h2>
    <button class="close" onclick="closeCart()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div id="cartItems" class="cartItemsList"></div>
  <div class="cartFooter">
    <div class="cartTotal">
      <span>Итого</span>
      <b id="cartTotal">0 ₽</b>
    </div>
    <a id="checkoutBtn" href="/checkout.php" class="btn primary cartCheckoutBtn" style="display:none">
      Оформить заказ →
    </a>
  </div>
</aside>
<div id="cartToast" class="cartToast" aria-live="polite">Добавлено в корзину</div>
