/* =========================================================
   BikeGlide - main script
   There is no backend, so users, bookings and contact
   messages are saved in the browser with localStorage.
   ========================================================= */

/* ---------- Storage ---------- */

const store = {
    get: (key) => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value))
};

const findUser = (email) => store.get('bg_users').find((u) => u.email === email);

const getCurrentUser = () => {
    const email = localStorage.getItem('bg_current') || sessionStorage.getItem('bg_current');
    return email ? findUser(email) : null;
};

const setCurrentUser = (email, remember) => {
    // "Remember me" keeps you signed in after the browser closes
    (remember ? localStorage : sessionStorage).setItem('bg_current', email);
};

const logoutUser = () => {
    localStorage.removeItem('bg_current');
    sessionStorage.removeItem('bg_current');
};

/* ---------- Helpers ---------- */

const $ = (id) => document.getElementById(id);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone);

const showMsg = (el, text, type) => {
    el.textContent = text;
    el.className = `form-msg ${type}`;
};

const hideMsg = (el) => {
    el.textContent = '';
    el.className = 'form-msg';
};

const markError = (input, hasError) => input.classList.toggle('input-error', hasError);

const clearErrors = (form) => {
    form.querySelectorAll('.input-error').forEach((el) => el.classList.remove('input-error'));
};

// Runs a list of [input, isInvalid, message] checks and stops at the first failure
const validate = (checks, msgEl) => {
    for (const [input, isInvalid, message] of checks) {
        if (isInvalid) {
            if (input) {
                markError(input, true);
                input.focus();
            }
            showMsg(msgEl, message, 'error');
            return false;
        }
    }
    return true;
};

// Pretends to talk to a server so buttons can show a loading state
const fakeRequest = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

const setLoading = (button, isLoading, text) => {
    if (isLoading) {
        button.dataset.label = button.textContent;
        button.textContent = text;
    } else {
        button.textContent = button.dataset.label;
    }
    button.disabled = isLoading;
};

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const pad = (n) => String(n).padStart(2, '0');

// Today's date as "YYYY-MM-DD" (local time)
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Rental days between two "YYYY-MM-DD" dates, minimum 1
const countDays = (from, to) => {
    const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
    return Math.max(diff, 1);
};

const formatDate = (str) =>
    new Date(`${str}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const formatPrice = (n) => `₹${n.toLocaleString('en-IN')}`;

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const getParam = (name) => new URLSearchParams(window.location.search).get(name);

// home.html is in the root folder, every other page is inside /pages/
const inPagesFolder = window.location.pathname.includes('/pages/');
const pagePath = (file) => (inPagesFolder ? file : `pages/${file}`);

/* ---------- Listed bikes ---------- */

const BIKE_TYPES = ['scooter', 'adventure', 'cruiser', 'sports'];

// Bikes listed by users are stored in localStorage next to the fixed fleet
const getListings = () => store.get('bg_listings');

const getAllBikes = () => [...BIKES, ...getListings()];

// Uploaded photos are saved as data URLs, fleet photos are files in /images/
const bikeImgSrc = (img) => (img.startsWith('data:') ? img : `../images/${img}`);

// Shown when an owner lists a bike without uploading a photo
const PLACEHOLDER_IMG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="#1b1d22"/>' +
    '<g fill="none" stroke="#475569" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="140" cy="120" r="30"/><circle cx="260" cy="120" r="30"/>' +
    '<path d="M140 120l35-45h40l45 45M175 75l-10-15h-20M215 75l10-15h20"/></g>' +
    '<text x="200" y="182" fill="#64748b" font-family="sans-serif" font-size="14" text-anchor="middle">No photo yet</text></svg>'
)}`;

// Bookings for a bike pay the owner the rent, the deposit is refunded to the rider
const bookingRent = (b) => b.total - DEPOSIT;

// Shrinks an uploaded photo so it fits comfortably in localStorage
const resizePhoto = (file, maxWidth = 800) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

// Is this bike already booked on any day between from and to?
const isBikeBooked = (bikeId, from, to) =>
    store.get('bg_bookings').some((b) => b.bikeId === bikeId && from <= b.dropoff && to >= b.pickup);

/* ---------- Use my location ---------- */

// The browser's location API uses callbacks, so we wrap it in a Promise
const getLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
        reject(new Error('Location is not supported'));
        return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
});

// Straight-line distance in km between two [lat, lng] points (haversine formula)
const distanceKm = ([lat1, lng1], [lat2, lng2]) => {
    const rad = (deg) => (deg * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const nearestCity = (point) => CITIES
    .map((city) => ({ city, km: Math.round(distanceKm(point, CITY_COORDS[city])) }))
    .sort((a, b) => a.km - b.km)[0];

// A button that picks the closest city in a <select> and shows the result on itself
const setupLocateButton = (button, select, onPicked) => {
    if (!button || !select) return;

    button.addEventListener('click', () => {
        button.disabled = true;
        button.textContent = 'Locating...';

        getLocation()
            .then((position) => {
                const { latitude, longitude } = position.coords;
                const { city, km } = nearestCity([latitude, longitude]);
                select.value = city;
                button.textContent = `📍 ${capitalize(city)} · ${km} km away`;
                if (onPicked) onPicked(city);
            })
            .catch(() => {
                button.textContent = '📍 Location unavailable';
            })
            .finally(() => {
                button.disabled = false;
            });
    });
};

/* ---------- Modal ---------- */

const openModal = (modal) => {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
};

const closeModal = (modal) => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
};

const setupModal = (modal) => {
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));

    // Clicking the dark background closes the modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(modal);
    });
};

/* ---------- Navbar ---------- */

function setupNavbar() {
    const navBtn = $('nav-hamburger-btn');
    const navMenu = $('nav-menu');

    if (navBtn && navMenu) {
        const setMenu = (isOpen) => {
            navMenu.classList.toggle('open', isOpen);
            navBtn.setAttribute('aria-expanded', String(isOpen));
        };

        navBtn.addEventListener('click', () => setMenu(!navMenu.classList.contains('open')));
        navMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
    }

    // Signed in: replace "Sign In" with the user's name, bookings and logout
    const user = getCurrentUser();
    const navRight = document.querySelector('.nav-right');

    if (user && navRight) {
        const [firstName] = user.name.split(' ');
        const onBookings = window.location.pathname.includes('bookings.html');

        navRight.innerHTML = `
            <span class="nav-user">Hi, ${escapeHtml(firstName)}</span>
            <a href="${pagePath('bookings.html')}" class="nav-signin ${onBookings ? 'active' : ''}">My Bookings</a>
            <a href="${pagePath('logout.html')}" class="nav-btn">Logout</a>
        `;
    }
}

/* ---------- Sign In / Sign Up ---------- */

let currentCaptcha = '';

const newCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    currentCaptcha = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    $('captcha-code').textContent = currentCaptcha;
};

const goAfterLogin = () => {
    const redirect = getParam('redirect');
    // Only allow simple local pages such as "bikes.html" or "bikes.html?book=duke-200"
    const isSafe = redirect && /^[a-z]+\.html(\?[a-z0-9=&-]*)?$/.test(redirect);
    window.location.href = isSafe ? redirect : '../home.html';
};

// Rates a password from 0 to 4
const passwordScore = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
};

function setupAuthPage() {
    const loginPanel = $('login-panel');
    if (!loginPanel) return;

    const tabs = document.querySelectorAll('.auth-tab');

    const showTab = (name) => {
        tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
        loginPanel.classList.toggle('active', name === 'login');
        $('signup-panel').classList.toggle('active', name === 'signup');
    };

    // Both the top tabs and the "Create an account / Sign in" links switch panels
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // Links ending with #signup open the Sign Up panel (also when already on this page)
    const checkHash = () => {
        if (window.location.hash === '#signup') showTab('signup');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    // Show / hide password buttons
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = $(btn.dataset.target);
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.textContent = isHidden ? 'Hide' : 'Show';
        });
    });

    // Password strength meter
    const strengthLevels = [
        { width: '10%', color: '#dc2626', label: 'Too short' },
        { width: '25%', color: '#dc2626', label: 'Weak' },
        { width: '50%', color: '#f97316', label: 'Fair' },
        { width: '75%', color: '#eab308', label: 'Good' },
        { width: '100%', color: '#15803d', label: 'Strong' }
    ];

    $('signup-password').addEventListener('input', (e) => {
        const { value } = e.target;
        const { width, color, label } = strengthLevels[passwordScore(value)];
        $('strength-bar').style.width = value ? width : '0';
        $('strength-bar').style.background = color;
        $('strength-text').textContent = value ? `Strength: ${label}` : 'Use 8+ characters with letters, numbers and symbols.';
    });

    newCaptcha();
    $('captcha-refresh').addEventListener('click', newCaptcha);

    const loginMsg = $('login-msg');
    const signupMsg = $('signup-msg');

    const user = getCurrentUser();
    if (user) {
        showMsg(loginMsg, `You are already signed in as ${user.email}.`, 'success');
    } else if (getParam('redirect')) {
        showMsg(loginMsg, 'Please sign in or create an account to continue.', 'error');
    }

    /* Sign in */
    const loginForm = $('login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(loginForm);

        const email = $('login-email');
        const password = $('login-password');
        const captcha = $('login-captcha');
        const emailVal = email.value.trim().toLowerCase();

        const ok = validate([
            [email, !isValidEmail(emailVal), 'Please enter a valid email address.'],
            [password, password.value.length < 8, 'Password must be at least 8 characters.'],
            [captcha, captcha.value.trim().toUpperCase() !== currentCaptcha, 'Captcha does not match. Please try again.']
        ], loginMsg);

        if (!ok) {
            captcha.value = '';
            newCaptcha();
            return;
        }

        const button = loginForm.querySelector('button[type="submit"]');
        setLoading(button, true, 'Signing in...');
        await fakeRequest();

        const found = findUser(emailVal);
        if (!found || found.password !== password.value) {
            setLoading(button, false);
            showMsg(loginMsg, 'Incorrect email or password.', 'error');
            captcha.value = '';
            newCaptcha();
            return;
        }

        setCurrentUser(found.email, $('remember-me').checked);
        showMsg(loginMsg, `Welcome back, ${found.name}! Redirecting...`, 'success');
        setTimeout(goAfterLogin, 700);
    });

    /* Sign up */
    const signupForm = $('signup-form');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(signupForm);

        const name = $('signup-name');
        const email = $('signup-email');
        const phone = $('signup-phone');
        const password = $('signup-password');
        const confirm = $('signup-confirm');
        const city = $('signup-city');
        const emailVal = email.value.trim().toLowerCase();

        const ok = validate([
            [name, name.value.trim().length < 3, 'Name must be at least 3 characters.'],
            [email, !isValidEmail(emailVal), 'Please enter a valid email address.'],
            [phone, !isValidPhone(phone.value.trim()), 'Enter a valid 10-digit Indian mobile number.'],
            [password, password.value.length < 8, 'Password must be at least 8 characters.'],
            [confirm, password.value !== confirm.value, 'Passwords do not match.'],
            [city, city.value === '', 'Please select your city.'],
            [null, !$('signup-terms').checked, 'Please accept the Terms & Privacy Policy.'],
            [email, Boolean(findUser(emailVal)), 'An account with this email already exists. Please sign in.']
        ], signupMsg);

        if (!ok) return;

        const button = signupForm.querySelector('button[type="submit"]');
        setLoading(button, true, 'Creating account...');
        await fakeRequest();

        const newUser = {
            name: name.value.trim(),
            email: emailVal,
            phone: phone.value.trim(),
            password: password.value,
            city: city.value,
            joined: todayStr()
        };
        store.set('bg_users', [...store.get('bg_users'), newUser]);

        setCurrentUser(emailVal, false);
        showMsg(signupMsg, 'Account created! Redirecting...', 'success');
        setTimeout(goAfterLogin, 700);
    });

    /* Google sign-in is not part of this project */
    $('google-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showMsg(loginMsg, 'Google sign-in is coming soon. Please use your email for now.', 'error');
    });

    /* Terms & Privacy */
    const termsModal = $('terms-modal');
    setupModal(termsModal);
    document.querySelectorAll('.terms-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(termsModal);
        });
    });

    /* Forgot password */
    const resetModal = $('reset-modal');
    const resetForm = $('reset-form');
    const resetMsg = $('reset-msg');
    setupModal(resetModal);

    $('forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        resetForm.reset();
        clearErrors(resetForm);
        hideMsg(resetMsg);
        $('reset-email').value = $('login-email').value;
        openModal(resetModal);
    });

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(resetForm);

        const email = $('reset-email');
        const pass = $('reset-password');
        const confirm = $('reset-confirm');
        const emailVal = email.value.trim().toLowerCase();

        const ok = validate([
            [email, !findUser(emailVal), 'No account found with this email.'],
            [pass, pass.value.length < 8, 'Password must be at least 8 characters.'],
            [confirm, pass.value !== confirm.value, 'Passwords do not match.']
        ], resetMsg);

        if (!ok) return;

        const button = resetForm.querySelector('button[type="submit"]');
        setLoading(button, true, 'Updating...');
        await fakeRequest();

        const users = store.get('bg_users').map((u) =>
            u.email === emailVal ? { ...u, password: pass.value } : u
        );
        store.set('bg_users', users);

        setLoading(button, false);
        showMsg(resetMsg, 'Password updated! You can now sign in.', 'success');
        setTimeout(() => {
            closeModal(resetModal);
            $('login-email').value = emailVal;
            $('login-password').focus();
        }, 1200);
    });
}

/* ---------- Logout ---------- */

function setupLogoutPage() {
    if ($('logout-heading')) logoutUser();
}

/* ---------- Bikes page ---------- */

const bikeCardHTML = (bike) => {
    const { id, type, engine, mileage, price, img, maintenance, paused, owner, ownerName } = bike;
    const name = escapeHtml(bike.name);
    const bookedToday = isBikeBooked(id, todayStr(), todayStr());
    const user = getCurrentUser();
    const isMine = Boolean(owner && user && owner === user.email);
    const unavailable = maintenance || paused || isMine;

    let tag = '<span class="availability-tag available">Available</span>';
    if (maintenance) tag = '<span class="availability-tag booked">In Service</span>';
    else if (paused) tag = '<span class="availability-tag booked">Paused</span>';
    else if (bookedToday) tag = '<span class="availability-tag booked">Booked Today</span>';

    let buttonText = 'Book Now';
    if (isMine) buttonText = 'Your Listing';
    else if (unavailable) buttonText = 'Unavailable';

    return `
        <article class="bike-card">
            <div class="bike-img">
                <img src="${img ? bikeImgSrc(img) : PLACEHOLDER_IMG}" alt="${name}">
            </div>
            <div class="bike-info">
                <h3>${name}</h3>
                ${owner ? `<p class="owner-line">Listed by ${escapeHtml(ownerName)}</p>` : ''}
                <div class="bike-type">
                    <span class="type-tag">${escapeHtml(type)}</span>
                    ${tag}
                </div>
                <div class="bike-specs">
                    <div class="spec-item">
                        <span class="spec-label">Engine</span>
                        <span class="spec-value">${engine} CC</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Mileage</span>
                        <span class="spec-value">${mileage} kmpl</span>
                    </div>
                </div>
                <div class="bike-specs">
                    <div class="spec-item">
                        <span class="spec-label">Fuel</span>
                        <span class="spec-value">Petrol</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Per Day</span>
                        <span class="spec-value price-text">${formatPrice(price)}</span>
                    </div>
                </div>
                <button type="button" class="book-btn" data-id="${id}" ${unavailable ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        </article>
    `;
};

function setupBikesPage() {
    const grid = $('bikes-list');
    if (!grid) return;

    const searchInput = $('bike-search');
    const citySelect = $('bike-city');
    const sortSelect = $('bike-sort');
    const tabs = document.querySelectorAll('.category-tab');

    const filters = { type: 'all', search: '', city: 'all', sort: 'recommended' };

    const sorters = {
        recommended: () => 0,
        'price-low': (a, b) => a.price - b.price,
        'price-high': (a, b) => b.price - a.price,
        engine: (a, b) => b.engine - a.engine
    };

    const render = () => {
        const allBikes = getAllBikes();
        const results = allBikes
            .filter((bike) => filters.type === 'all' || bike.type === filters.type)
            .filter((bike) => bike.name.toLowerCase().includes(filters.search))
            .filter((bike) => filters.city === 'all' || bike.cities.includes(filters.city))
            .sort(sorters[filters.sort]);

        grid.innerHTML = results.map(bikeCardHTML).join('');
        $('results-count').textContent = `Showing ${results.length} of ${allBikes.length} bikes`;
        $('empty-state').style.display = results.length ? 'none' : 'block';
    };

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            filters.type = tab.dataset.type;
            render();
        });
    });

    searchInput.addEventListener('input', () => {
        filters.search = searchInput.value.trim().toLowerCase();
        render();
    });

    citySelect.addEventListener('change', () => {
        filters.city = citySelect.value;
        render();
    });

    sortSelect.addEventListener('change', () => {
        filters.sort = sortSelect.value;
        render();
    });

    setupLocateButton($('locate-btn'), citySelect, (city) => {
        filters.city = city;
        render();
    });

    $('reset-filters').addEventListener('click', () => {
        Object.assign(filters, { type: 'all', search: '', city: 'all', sort: 'recommended' });
        searchInput.value = '';
        citySelect.value = 'all';
        sortSelect.value = 'recommended';
        $('locate-btn').textContent = '📍 Use my location';
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.type === 'all'));
        render();
    });

    // City can come from the home page search or footer links (?city=goa)
    const cityParam = getParam('city');
    if (CITIES.includes(cityParam)) {
        citySelect.value = cityParam;
        filters.city = cityParam;
    }

    render();

    const booking = setupBookingModal();

    // Cards are re-rendered, so listen on the grid instead of each button
    grid.addEventListener('click', (e) => {
        const button = e.target.closest('.book-btn');
        if (button && !button.disabled) booking.open(button.dataset.id);
    });

    // "Book Now" on the home page links here with ?book=<id>
    const bookParam = getParam('book');
    if (bookParam) booking.open(bookParam);
}

/* ---------- Booking modal ---------- */

function setupBookingModal() {
    const modal = $('booking-modal');
    const form = $('booking-form');
    const msg = $('booking-msg');
    const citySelect = $('booking-city');
    const pickupInput = $('booking-pickup');
    const dropoffInput = $('booking-dropoff');
    let bike = null;

    setupModal(modal);

    const getDays = () => {
        const { value: pickup } = pickupInput;
        const { value: dropoff } = dropoffInput;
        return pickup && dropoff && dropoff >= pickup ? countDays(pickup, dropoff) : 1;
    };

    const updateSummary = () => {
        const days = getDays();
        const rent = bike.price * days;
        $('summary-rate').textContent = `${formatPrice(bike.price)} × ${days} ${days === 1 ? 'day' : 'days'}`;
        $('summary-rent').textContent = formatPrice(rent);
        $('summary-deposit').textContent = formatPrice(DEPOSIT);
        $('summary-total').textContent = formatPrice(rent + DEPOSIT);
    };

    const open = (bikeId) => {
        bike = getAllBikes().find((b) => b.id === bikeId);
        if (!bike || bike.maintenance || bike.paused) return;

        const user = getCurrentUser();
        if (!user) {
            window.location.href = `signin.html?redirect=${encodeURIComponent(`bikes.html?book=${bike.id}`)}`;
            return;
        }
        if (bike.owner === user.email) return;

        form.reset();
        hideMsg(msg);
        $('booking-bike-name').textContent = bike.name;

        // Only list the cities this bike is offered in
        citySelect.innerHTML = bike.cities
            .map((city) => `<option value="${city}">${capitalize(city)}</option>`)
            .join('');

        const pageCity = $('bike-city').value;
        if (bike.cities.includes(pageCity)) citySelect.value = pageCity;
        else if (bike.cities.includes(user.city)) citySelect.value = user.city;

        const today = todayStr();
        const pickupParam = getParam('pickup');
        pickupInput.min = today;
        pickupInput.value = pickupParam && pickupParam >= today ? pickupParam : today;
        dropoffInput.min = pickupInput.value;
        dropoffInput.value = pickupInput.value;

        updateSummary();
        openModal(modal);
    };

    pickupInput.addEventListener('change', () => {
        dropoffInput.min = pickupInput.value;
        if (dropoffInput.value < pickupInput.value) dropoffInput.value = pickupInput.value;
        updateSummary();
    });

    dropoffInput.addEventListener('change', updateSummary);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pickup = pickupInput.value;
        const dropoff = dropoffInput.value;

        const ok = validate([
            [pickupInput, !pickup, 'Please choose a pickup date.'],
            [dropoffInput, !dropoff, 'Please choose a return date.'],
            [pickupInput, pickup < todayStr(), 'Pickup date cannot be in the past.'],
            [dropoffInput, dropoff < pickup, 'Return date must be on or after the pickup date.'],
            [null, isBikeBooked(bike.id, pickup, dropoff), 'Sorry, this bike is already booked for those dates. Please try other dates.']
        ], msg);

        if (!ok) return;

        const button = form.querySelector('button[type="submit"]');
        setLoading(button, true, 'Confirming...');
        await fakeRequest();

        const days = countDays(pickup, dropoff);
        const newBooking = {
            id: `BG${Date.now().toString().slice(-6)}`,
            email: getCurrentUser().email,
            bikeId: bike.id,
            bikeName: bike.name,
            city: citySelect.value,
            pickup,
            dropoff,
            days,
            total: bike.price * days + DEPOSIT,
            bookedOn: todayStr()
        };
        store.set('bg_bookings', [...store.get('bg_bookings'), newBooking]);

        showMsg(msg, `Booking ${newBooking.id} confirmed! Taking you to My Bookings...`, 'success');
        setTimeout(() => {
            window.location.href = 'bookings.html';
        }, 1200);
    });

    return { open };
}

/* ---------- My Bookings page ---------- */

const getStatus = ({ pickup, dropoff }) => {
    const today = todayStr();
    if (dropoff < today) return 'completed';
    if (pickup <= today) return 'active';
    return 'upcoming';
};

const bookingCardHTML = (booking) => {
    const { id, bikeName, city, pickup, dropoff, days, total } = booking;
    const status = getStatus(booking);

    return `
        <article class="booking-card">
            <h3>${escapeHtml(bikeName)}<span class="booking-status ${status}">${status}</span></h3>
            <div class="booking-details">
                <div class="spec-item">
                    <span class="spec-label">Booking ID</span>
                    <span class="spec-value">${id} <button type="button" class="copy-btn" data-copy="${id}">Copy</button></span>
                </div>
                <div class="spec-item">
                    <span class="spec-label">City</span>
                    <span class="spec-value">${capitalize(city)}</span>
                </div>
                <div class="spec-item">
                    <span class="spec-label">Dates</span>
                    <span class="spec-value">${formatDate(pickup)} &ndash; ${formatDate(dropoff)}</span>
                </div>
                <div class="spec-item">
                    <span class="spec-label">Total (${days} ${days === 1 ? 'day' : 'days'})</span>
                    <span class="spec-value">${formatPrice(total)}</span>
                </div>
            </div>
            ${status === 'upcoming' ? `<button type="button" class="cancel-btn" data-id="${id}">Cancel Booking</button>` : ''}
        </article>
    `;
};

function setupBookingsPage() {
    const list = $('booking-list');
    if (!list) return;

    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html?redirect=bookings.html';
        return;
    }

    $('bookings-greeting').textContent = `Signed in as ${user.name} (${user.email})`;

    const render = () => {
        const mine = store.get('bg_bookings')
            .filter((b) => b.email === user.email)
            .sort((a, b) => b.pickup.localeCompare(a.pickup));

        const upcoming = mine.filter((b) => getStatus(b) !== 'completed').length;
        const spent = mine.reduce((sum, b) => sum + b.total, 0);
        $('stat-total').textContent = mine.length;
        $('stat-upcoming').textContent = upcoming;
        $('stat-spent').textContent = formatPrice(spent);

        list.innerHTML = mine.length
            ? mine.map(bookingCardHTML).join('')
            : `<div class="no-bookings">
                   <p>You have no bookings yet.</p>
                   <a href="bikes.html" class="btn-primary">Browse Bikes</a>
               </div>`;
    };

    list.addEventListener('click', (e) => {
        // Copy booking ID: clipboard.writeText() returns a Promise
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            navigator.clipboard.writeText(copyBtn.dataset.copy)
                .then(() => {
                    copyBtn.textContent = 'Copied!';
                })
                .catch(() => {
                    copyBtn.textContent = 'Failed';
                })
                .finally(() => {
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                    }, 1500);
                });
            return;
        }

        const button = e.target.closest('.cancel-btn');
        if (!button) return;
        if (!confirm('Are you sure you want to cancel this booking?')) return;

        const remaining = store.get('bg_bookings').filter((b) => b.id !== button.dataset.id);
        store.set('bg_bookings', remaining);
        render();
    });

    render();
}

/* ---------- List Your Bike page ---------- */

const listingRowHTML = (listing, bookings) => {
    const { id, name, type, price, img, cities, paused } = listing;
    const mine = bookings.filter((b) => b.bikeId === id);
    const earned = mine.reduce((sum, b) => sum + bookingRent(b), 0);

    return `
        <article class="booking-card listing-row ${paused ? 'paused' : ''}">
            <img class="listing-thumb" src="${img ? bikeImgSrc(img) : PLACEHOLDER_IMG}" alt="${escapeHtml(name)}">
            <div class="listing-body">
                <h3>${escapeHtml(name)}<span class="booking-status ${paused ? 'paused' : 'active'}">${paused ? 'paused' : 'live'}</span></h3>
                <div class="booking-details">
                    <div class="spec-item">
                        <span class="spec-label">Category</span>
                        <span class="spec-value">${capitalize(type)}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Per Day</span>
                        <span class="spec-value">${formatPrice(price)}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Cities</span>
                        <span class="spec-value">${cities.map(capitalize).join(', ')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Earned (${mine.length} ${mine.length === 1 ? 'rental' : 'rentals'})</span>
                        <span class="spec-value">${formatPrice(earned)}</span>
                    </div>
                </div>
                <div class="listing-actions">
                    <button type="button" class="outline-btn" data-action="toggle" data-id="${id}">${paused ? 'Resume Listing' : 'Pause Listing'}</button>
                    <a href="bikes.html" class="outline-btn">View on Browse Bikes</a>
                    <button type="button" class="cancel-btn" data-action="remove" data-id="${id}">Remove</button>
                </div>
            </div>
        </article>
    `;
};

function setupListingPage() {
    const form = $('listing-form');
    if (!form) return;

    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html?redirect=list-bike.html';
        return;
    }

    $('listing-greeting').textContent = `Signed in as ${user.name}. Listing is free, and you keep the full rent.`;

    const msg = $('listing-msg');
    const name = $('listing-name');
    const type = $('listing-type');
    const price = $('listing-price');
    const engine = $('listing-engine');
    const mileage = $('listing-mileage');
    const cityBox = $('listing-cities');
    const photo = $('listing-photo');
    const list = $('my-listings');
    let photoData = '';

    const selectedCities = () =>
        [...cityBox.querySelectorAll('input:checked')].map((input) => input.value);

    // The preview reuses the real bike card so owners see exactly what riders see
    const updatePreview = () => {
        $('listing-preview').innerHTML = bikeCardHTML({
            id: 'preview',
            name: name.value.trim() || 'Your Bike Name',
            type: type.value || 'category',
            engine: Number(engine.value) || 0,
            mileage: Number(mileage.value) || 0,
            price: Number(price.value) || 0,
            img: photoData,
            cities: selectedCities(),
            owner: 'preview',
            ownerName: user.name
        });
    };

    form.addEventListener('input', updatePreview);

    photo.addEventListener('change', () => {
        const [file] = photo.files;
        photoData = '';
        markError(photo, false);

        if (!file) {
            updatePreview();
            return;
        }

        if (!file.type.startsWith('image/')) {
            markError(photo, true);
            showMsg(msg, 'Please choose an image file (JPG or PNG).', 'error');
            photo.value = '';
            updatePreview();
            return;
        }

        // resizePhoto returns a Promise: then() gets the resized photo, catch() runs if it fails
        resizePhoto(file)
            .then((data) => {
                photoData = data;
                hideMsg(msg);
            })
            .catch(() => {
                markError(photo, true);
                showMsg(msg, 'That photo could not be read. Please try another one.', 'error');
                photo.value = '';
            })
            .finally(updatePreview);
    });

    const render = () => {
        const mine = getListings().filter((l) => l.owner === user.email);
        const myIds = mine.map((l) => l.id);
        const bookings = store.get('bg_bookings').filter((b) => myIds.includes(b.bikeId));

        $('stat-listed').textContent = mine.length;
        $('stat-rentals').textContent = bookings.length;
        $('stat-earned').textContent = formatPrice(bookings.reduce((sum, b) => sum + bookingRent(b), 0));

        list.innerHTML = mine.length
            ? mine.map((l) => listingRowHTML(l, bookings)).join('')
            : `<div class="no-bookings">
                   <p>You have not listed any bikes yet. Fill in the form above to publish your first one.</p>
               </div>`;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        cityBox.classList.remove('input-error');

        const cities = selectedCities();
        const priceVal = Number(price.value);
        const engineVal = Number(engine.value);
        const mileageVal = Number(mileage.value);
        const nameVal = name.value.trim();

        const ok = validate([
            [name, nameVal.length < 3, 'Bike name must be at least 3 characters.'],
            [type, !BIKE_TYPES.includes(type.value), 'Please select a category.'],
            [price, !(priceVal >= 199 && priceVal <= 19999), 'Price per day must be between ₹199 and ₹19,999.'],
            [engine, !(engineVal >= 50 && engineVal <= 2500), 'Engine size must be between 50 and 2500 CC.'],
            [mileage, !(mileageVal >= 10 && mileageVal <= 120), 'Mileage must be between 10 and 120 kmpl.'],
            [null, cities.length === 0, 'Pick at least one city where riders can collect the bike.'],
            [null, !$('listing-confirm').checked, 'Please confirm you own the bike and its papers are valid.']
        ], msg);

        if (!ok) {
            if (cities.length === 0) cityBox.classList.add('input-error');
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        setLoading(button, true, 'Publishing...');
        await fakeRequest();

        const listing = {
            id: `u${Date.now()}`,
            name: nameVal,
            type: type.value,
            engine: engineVal,
            mileage: mileageVal,
            price: priceVal,
            img: photoData,
            cities: CITIES.filter((c) => cities.includes(c)),
            owner: user.email,
            ownerName: user.name,
            listedOn: todayStr(),
            paused: false
        };

        try {
            store.set('bg_listings', [...getListings(), listing]);
        } catch {
            // localStorage is full, usually because of large photos
            setLoading(button, false);
            showMsg(msg, 'Storage is full. Try a smaller photo or remove an old listing.', 'error');
            return;
        }

        setLoading(button, false);
        form.reset();
        photoData = '';
        updatePreview();
        render();
        showMsg(msg, `${nameVal} is now live on Browse Bikes!`, 'success');
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    list.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;

        const { id, action } = button.dataset;
        const listings = getListings();
        const listing = listings.find((l) => l.id === id && l.owner === user.email);
        if (!listing) return;

        if (action === 'toggle') {
            store.set('bg_listings', listings.map((l) => (l.id === id ? { ...l, paused: !l.paused } : l)));
        } else if (action === 'remove') {
            const hasUpcoming = store.get('bg_bookings')
                .some((b) => b.bikeId === id && getStatus(b) !== 'completed');
            if (hasUpcoming) {
                alert('This bike has upcoming or active rentals. Pause it instead, and remove it after they finish.');
                return;
            }
            if (!confirm(`Remove ${listing.name} from BikeGlide?`)) return;
            store.set('bg_listings', listings.filter((l) => l.id !== id));
        }
        render();
    });

    updatePreview();
    render();
}

/* ---------- Contact page ---------- */

function setupContactPage() {
    const form = $('contact-form');
    if (!form) return;

    const msg = $('contact-msg');
    const name = $('full-name');
    const email = $('email');
    const phone = $('phone');
    const reason = $('contact-reason');
    const subject = $('subject');
    const message = $('message');
    const counter = $('message-count');

    // Pre-fill details for signed-in users
    const user = getCurrentUser();
    if (user) {
        name.value = user.name;
        email.value = user.email;
        phone.value = user.phone;
    }

    const updateCounter = () => {
        counter.textContent = `${message.value.length} / 1000`;
    };
    message.addEventListener('input', updateCounter);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);

        // Allow "+91", spaces and dashes in the phone number
        const phoneVal = phone.value.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');

        const ok = validate([
            [name, name.value.trim().length < 3, 'Please enter your full name (at least 3 characters).'],
            [email, !isValidEmail(email.value.trim()), 'Please enter a valid email address.'],
            [phone, phoneVal !== '' && !isValidPhone(phoneVal), 'Enter a valid 10-digit phone number, or leave it empty.'],
            [reason, reason.value === '', 'Please select a contact reason.'],
            [subject, subject.value.trim() === '', 'Please enter a subject.'],
            [message, message.value.trim().length < 20, 'Your message should be at least 20 characters.']
        ], msg);

        if (!ok) return;

        const button = form.querySelector('button[type="submit"]');
        setLoading(button, true, 'Sending...');
        await fakeRequest();

        const [firstName] = name.value.trim().split(' ');
        const entry = {
            name: name.value.trim(),
            email: email.value.trim(),
            phone: phoneVal,
            reason: reason.value,
            subject: subject.value.trim(),
            message: message.value.trim(),
            sentOn: new Date().toISOString()
        };
        store.set('bg_messages', [...store.get('bg_messages'), entry]);

        setLoading(button, false);
        form.reset();
        updateCounter();
        showMsg(msg, `Thanks ${firstName}! Your message has been sent. We'll reply within 24 hours.`, 'success');
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

/* ---------- Home page ---------- */

function setupHomePage() {
    const dateInput = $('hero-pickup');
    if (!dateInput) return;

    dateInput.min = todayStr();
    dateInput.value = todayStr();

    setupLocateButton($('hero-locate'), $('hero-city'));

    // Signed-in users already have an account, so point them to booking instead
    const user = getCurrentUser();
    if (user) {
        const [firstName] = user.name.split(' ');
        $('cta-title').textContent = `Ready for your next ride, ${firstName}?`;
        $('cta-text').textContent = 'Pick a bike, choose your dates and you are good to go.';
        $('cta-btn').textContent = 'Browse Bikes';
        $('cta-btn').href = 'pages/bikes.html';
    }
}

/* ---------- About page: count-up stats ---------- */

function setupCounters() {
    const counters = document.querySelectorAll('[data-count]');

    counters.forEach((el) => {
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const steps = 40;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const value = Math.round((target * step) / steps);
            el.textContent = `${value}${suffix}`;
            if (step === steps) clearInterval(timer);
        }, 30);
    });
}

/* ---------- Start ---------- */

document.addEventListener('DOMContentLoaded', () => {
    setupLogoutPage();
    setupNavbar();
    setupAuthPage();
    setupBikesPage();
    setupBookingsPage();
    setupListingPage();
    setupContactPage();
    setupHomePage();
    setupCounters();
});
