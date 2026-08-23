document.addEventListener('DOMContentLoaded', function () {

    var navBtn = document.getElementById('nav-hamburger-btn');
    var navMenu = document.getElementById('nav-menu');

    if (navBtn && navMenu) {
        navBtn.addEventListener('click', function () {
            var isOpen = navMenu.classList.toggle('open');
            navBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    var authBtn = document.getElementById('auth-toggle-btn');
    var cardSwitch = document.getElementById('card-switch');

    if (authBtn && cardSwitch) {
        authBtn.addEventListener('click', function () {
            var isSignup = cardSwitch.classList.toggle('is-signup');
            authBtn.setAttribute('aria-pressed', isSignup ? 'true' : 'false');
        });
    }

});
