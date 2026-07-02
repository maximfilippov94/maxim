(function () {
  document.querySelectorAll('[data-faq-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('[data-faq-item]');
      var wasOpen = item.classList.contains('is-open');
      item.parentElement.querySelectorAll('[data-faq-item]').forEach(function (i) {
        i.classList.remove('is-open');
      });
      if (!wasOpen) item.classList.add('is-open');
    });
  });

  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('[data-lead-status]');
      var button = form.querySelector('button[type=submit]');
      status.textContent = '';
      status.className = 'vLeadForm__status';
      button.disabled = true;

      fetch('lead.php', { method: 'POST', body: new FormData(form) })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          status.textContent = data.message || '';
          status.classList.add(data.ok ? 'is-success' : 'is-error');
          if (data.ok) {
            form.reset();
            // Цель Яндекс.Метрики на успешную отправку заявки
            if (typeof ym === 'function') ym(110312362, 'reachGoal', 'lead');
          }
        })
        .catch(function () {
          status.textContent = 'Не удалось отправить заявку, попробуйте позже';
          status.classList.add('is-error');
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  });
})();
