window.Cafe = window.Cafe || {};

(function (Cafe) {
  'use strict';

  /* 1. localStorage wrapper*/
  Cafe.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;            // storage blocked or corrupted JSON
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (error) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (error) { /* ignore */ }
    }
  };

  /*2. Validation rules*/
    
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_PATTERN = /^[\p{L}][\p{L}\s'’.-]*$/u;
  const PHONE_PATTERN = /^\+?\d{10,15}$/;

  // Used by the rule and by the live checklist on the sign-up page
  Cafe.passwordChecks = function (value) {
    return [
      { id: 'length',  label: 'At least 8 characters', ok: value.length >= 8 },
      { id: 'upper',   label: 'One uppercase letter',  ok: /[A-Z]/.test(value) },
      { id: 'lower',   label: 'One lowercase letter',  ok: /[a-z]/.test(value) },
      { id: 'number',  label: 'One number',            ok: /\d/.test(value) }
    ];
  };

  Cafe.rules = {
    name(value) {
      const text = value.trim();
      if (!text) return 'Please enter your full name.';
      if (text.length < 2) return 'Name must contain at least 2 characters.';
      if (!NAME_PATTERN.test(text)) return 'Name can contain only letters, spaces, hyphens and apostrophes.';
      return '';
    },
    email(value) {
      const text = value.trim();
      if (!text) return 'Please enter your email address.';
      if (!text.includes('@')) return 'Email address must contain the @ symbol.';
      if (!EMAIL_PATTERN.test(text)) return 'Enter a valid email address, for example name@example.com.';
      return '';
    },
    phone(value) {
      const text = value.trim();
      if (!text) return 'Please enter your phone number.';
      if (!/^[+\d\s()-]+$/.test(text)) return 'Phone number can contain only digits, spaces, +, - and brackets.';
      const compact = text.replace(/[\s()-]/g, '');
      if (!PHONE_PATTERN.test(compact)) return 'Enter 10-15 digits, for example +7 701 123 45 67.';
      return '';
    },
    // Password for sign-up: length + complexity
    newPassword(value) {
      if (!value) return 'Please create a password.';
      const failed = Cafe.passwordChecks(value).filter(check => !check.ok);
      if (failed.length) return 'Password needs: ' + failed.map(check => check.label.toLowerCase()).join(', ') + '.';
      return '';
    },
    // Password for log-in: only checks that something was typed
    password(value) {
      return value ? '' : 'Please enter your password.';
    },
    confirmPassword(value, form) {
      if (!value) return 'Please repeat your password.';
      const original = form.querySelector('#password');
      return original && original.value === value ? '' : 'Passwords do not match.';
    },
    select(label) {
      return function (value) { return value ? '' : 'Please select ' + label + '.'; };
    },
    required(label) {
      return function (value) { return value.trim() ? '' : 'Please enter ' + label + '.'; };
    }
  };

  /* 3. Form validation */
  Cafe.validateForm = function (form, schema, onValid) {
    if (!form) return null;
    form.setAttribute('novalidate', '');          // browser bubbles stay off
    const inputs = Object.keys(schema)
      .map(id => form.querySelector('#' + id))
      .filter(Boolean);

    function errorBox(input) {
      let box = form.querySelector('#' + input.id + '-error');
      if (!box) {
        box = document.createElement('p');
        box.id = input.id + '-error';
        box.className = 'field-error';
        box.setAttribute('aria-live', 'polite');
        input.insertAdjacentElement('afterend', box);
        const described = (input.getAttribute('aria-describedby') || '') + ' ' + box.id;
        input.setAttribute('aria-describedby', described.trim());
      }
      return box;
    }

    function checkField(input) {
      const message = schema[input.id](input.value, form);
      errorBox(input).textContent = message;
      input.classList.toggle('is-invalid', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      return !message;
    }

    // Errors appear when the form is submitted; after that each field is re-checked while the user fixes it.
    // (No check on blur: a new error message would push the submit button away from the mouse pointer.)
    inputs.forEach(input => {
      const recheck = () => { if (input.classList.contains('is-invalid')) checkField(input); };
      input.addEventListener('input', recheck);
      input.addEventListener('change', recheck);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      let firstInvalid = null;
      inputs.forEach(input => {
        if (!checkField(input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }
      onValid(event);
    });

    return {
      // remove all error messages (e.g. after form.reset())
      clear() {
        inputs.forEach(input => {
          errorBox(input).textContent = '';
          input.classList.remove('is-invalid');
          input.removeAttribute('aria-invalid');
        });
      },
      // show an error under one field (e.g. "wrong password")
      setError(id, message) {
        const input = form.querySelector('#' + id);
        if (!input) return;
        errorBox(input).textContent = message;
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
    };
  };

  // Shows a success / error box under a form
  Cafe.showMessage = function (element, text, type) {
    if (!element) return;
    element.className = 'form-message' + (type ? ' ' + type : '');
    element.textContent = text;
  };

  Cafe.toast = function (message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type || 'success');
  };

  /* 4. Favourite deals */
  const FAVORITES_KEY = 'cafe_favorites';
  Cafe.favorites = {
    all() { return Cafe.store.get(FAVORITES_KEY, []); },
    has(dealID) { return this.all().some(item => item.dealID === dealID); },
    add(deal) {
      const list = this.all();
      if (!list.some(item => item.dealID === deal.dealID)) list.unshift(deal);
      Cafe.store.set(FAVORITES_KEY, list);
    },
    remove(dealID) {
      Cafe.store.set(FAVORITES_KEY, this.all().filter(item => item.dealID !== dealID));
    }
  };
})(window.Cafe);
