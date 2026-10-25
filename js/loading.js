/* =========================================================
   BikeGlide - loading screen
   Preloads the home page photos, fills the bar as each one
   finishes, then opens the home page once they are all ready.
   ========================================================= */

const IMAGES = [
    'images/hero-bg.png',
    'images/vespa-gts-300.jpg',
    'images/ducati-panigale.jpg',
    'images/harley-fat-boy.jpg',
    'images/bmw-r1250gs.jpg',
    'images/chandigarh.png',
    'images/mohali.jpg',
    'images/delhi.png',
    'images/manali.png',
    'images/goa.png'
];

const bar = document.querySelector('.bar-fill');
let loaded = 0;

// Wraps one image load in a Promise.
// It resolves even if the image fails, so one broken photo can't block the site.
const loadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
}).then(() => {
    loaded++;
    bar.style.width = `${(loaded / IMAGES.length) * 100}%`;
});

// Short minimum wait so the logo is visible even when the photos are cached
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Promise.all waits for every image (and the minimum wait) to finish
Promise.all([...IMAGES.map(loadImage), wait(1200)])
    .then(() => wait(300))
    .then(() => {
        window.location.href = 'home.html';
    });
