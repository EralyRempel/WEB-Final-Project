(function (Cafe) {
  'use strict';

  const USERS_KEY = 'cafe_users';
  const SESSION_KEY = 'cafe_session';

  /*data layer*/
  const auth = {
    users() { return Cafe.store.get(USERS_KEY, []); },

    findUser(email) {
      const wanted = String(email).trim().toLowerCase();
      return this.users().find(user => user.email === wanted) || null;
    },

    currentUser() {
      const session = Cafe.store.get(SESSION_KEY, null);
      return session ? this.findUser(session.email) : null;
    },

    signUp(data) {
      if (this.findUser(data.email)) {
        return { ok: false, field: 'email', error: 'An account with this email already exists. Try logging in.' };
      }
      const users = this.users();
      users.push({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
        createdAt: new Date().toISOString()
      });
      Cafe.store.set(USERS_KEY, users);
      return { ok: true };
    },

    logIn(email, password) {
      const user = this.findUser(email);
      if (!user) return { ok: false, field: 'email', error: 'No account found with this email. Please sign up first.' };
      if (user.password !== password) return { ok: false, field: 'password', error: 'Incorrect password. Please try again.' };
      Cafe.store.set(SESSION_KEY, { email: user.email, loggedInAt: Date.now() });
      return { ok: true, user };
    },

    logOut() { Cafe.store.remove(SESSION_KEY); },

    deleteAccount(email) {
      Cafe.store.set(USERS_KEY, this.users().filter(user => user.email !== email));
      this.logOut();
    }
  };
  Cafe.auth = auth;

  // Only allow redirects to local pages such as "profile.html"
  function safeNextPage(value) {
    return /^[a-z-]+\.html$/.test(value || '') ? value : 'profile.html';
  }

  /* header: Log in / Sign up  <->  Profile / Log out*/
  function renderHeaderAuth() {
    const box = document.getElementById('auth-links');
    if (!box) return;
    const user = auth.currentUser();
    box.textContent = '';

    function link(text, href, extraClass) {
      const a = document.createElement('a');
      a.href = href;
      a.className = 'btn btn-small ' + (extraClass || '');
      a.textContent = text;
      return a;
    }

    if (user) {
      const profile = link(user.name.split(' ')[0], 'profile.html', 'btn-outline');
      profile.setAttribute('aria-label', 'Open profile of ' + user.name);
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'btn btn-small';
      logout.textContent = 'Log out';
      logout.addEventListener('click', () => {
        auth.logOut();
        window.location.href = 'index.html';
      });
      box.append(profile, logout);
    } else {
      box.append(link('Log in', 'login.html', 'btn-outline'), link('Sign up', 'signup.html'));
    }
  }

  /*Sign-up page*/
  function initSignup() {
    const form = document.getElementById('signup-form');
    if (!form) return;
    if (auth.currentUser()) { window.location.replace('profile.html'); return; }

    const message = document.getElementById('signup-message');
    const passwordInput = document.getElementById('password');
    const checklist = document.getElementById('password-rules');

    // live password checklist (length + complexity)
    function updateChecklist() {
      Cafe.passwordChecks(passwordInput.value).forEach(check => {
        const item = checklist.querySelector('[data-rule="' + check.id + '"]');
        if (item) item.classList.toggle('ok', check.ok);
      });
    }
    passwordInput.addEventListener('input', updateChecklist);
    updateChecklist();

    const handle = Cafe.validateForm(form, {
      name: Cafe.rules.name,
      email: Cafe.rules.email,
      phone: Cafe.rules.phone,
      password: Cafe.rules.newPassword,
      'confirm-password': Cafe.rules.confirmPassword
    }, () => {
      const result = auth.signUp({
        name: form.querySelector('#name').value,
        email: form.querySelector('#email').value,
        phone: form.querySelector('#phone').value,
        password: passwordInput.value
      });
      if (!result.ok) {
        handle.setError(result.field, result.error);
        Cafe.showMessage(message, result.error, 'error');
        return;
      }
      Cafe.showMessage(message, 'Account created! Redirecting to the log-in page…', 'success');
      Cafe.toast('Account created successfully');
      setTimeout(() => { window.location.href = 'login.html?registered=1'; }, 1200);
    });
  }

  /*Log-in page*/
  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const params = new URLSearchParams(window.location.search);
    const message = document.getElementById('login-message');

    if (auth.currentUser()) { window.location.replace('profile.html'); return; }
    if (params.get('registered')) Cafe.showMessage(message, 'Registration complete. Please log in.', 'success');
    else if (params.get('next')) Cafe.showMessage(message, 'Please log in to see this page.', 'error');

    const handle = Cafe.validateForm(form, {
      email: Cafe.rules.email,
      password: Cafe.rules.password
    }, () => {
      const result = auth.logIn(form.querySelector('#email').value, form.querySelector('#password').value);
      if (!result.ok) {
        handle.setError(result.field, result.error);
        return;
      }
      Cafe.showMessage(message, 'Welcome back, ' + result.user.name + '! Opening your profile…', 'success');
      setTimeout(() => { window.location.href = safeNextPage(params.get('next')); }, 600);
    });
  }

  /*Profile page*/
  function initProfile() {
    const page = document.getElementById('profile-page');
    if (!page) return;
    const user = auth.currentUser();
    if (!user) { window.location.replace('login.html?next=profile.html'); return; }

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('profile-name', user.name);
    setText('profile-email', user.email);
    setText('profile-phone', user.phone);
    setText('profile-since', new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    setText('profile-initial', user.name.charAt(0).toUpperCase());

    // booking requests made by this user
    const bookings = Cafe.store.get('cafe_bookings', []).filter(item => item.userEmail === user.email);
    const bookingList = document.getElementById('profile-bookings');
    setText('profile-booking-count', String(bookings.length));
    if (bookings.length) {
      bookingList.textContent = '';
      bookings.slice().reverse().forEach(item => {
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = item.zone;
        li.append(strong, document.createTextNode(' - sent ' + new Date(item.createdAt).toLocaleString()));
        bookingList.appendChild(li);
      });
    }

    // saved game deals
    function renderSaved() {
      const saved = Cafe.favorites.all();
      const list = document.getElementById('profile-saved');
      setText('profile-saved-count', String(saved.length));
      list.textContent = '';
      if (!saved.length) {
        const li = document.createElement('li');
        li.className = 'empty-note';
        li.textContent = 'No saved deals yet. Open the Game Deals page and press “Save”.';
        list.appendChild(li);
        return;
      }
      saved.forEach(deal => {
        const li = document.createElement('li');
        li.className = 'saved-item';
        const title = document.createElement('span');
        title.textContent = deal.title + ' - $' + Number(deal.salePrice).toFixed(2);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-small btn-outline';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove ' + deal.title + ' from saved deals');
        remove.addEventListener('click', () => { Cafe.favorites.remove(deal.dealID); renderSaved(); });
        li.append(title, remove);
        list.appendChild(li);
      });
    }
    renderSaved();

    document.getElementById('profile-logout').addEventListener('click', () => {
      auth.logOut();
      window.location.href = 'index.html';
    });
    document.getElementById('profile-delete').addEventListener('click', () => {
      if (window.confirm('Delete your account from this browser? This cannot be undone.')) {
        auth.deleteAccount(user.email);
        window.location.href = 'index.html';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHeaderAuth();
    initSignup();
    initLogin();
    initProfile();
  });
})(window.Cafe);
