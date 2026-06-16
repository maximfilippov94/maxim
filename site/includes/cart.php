<div id="shade" onclick="closeCart()"></div>
<aside id="cartPanel" class="cartPanel">
  <button class="close" onclick="closeCart()">×</button>
  <h2>Корзина</h2>
  <div id="cartItems"></div>
  <div class="cartTotal">Итого: <b id="cartTotal">0 ₽</b></div>
  <a id="checkoutBtn" href="/checkout.php" class="btn primary" style="display:none;justify-content:center;margin-top:16px;text-align:center;text-decoration:none;width:100%;box-sizing:border-box">
    Оформить заказ →
  </a>
</aside>
<div id="cartToast" class="cartToast" aria-live="polite">Добавлено в корзину</div>
