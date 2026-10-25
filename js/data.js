// Bike fleet data - the bikes page renders its cards from this list
const BIKES = [
    { id: 'vespa-gts',     name: 'Vespa GTS 300',               type: 'scooter',   engine: 278,  mileage: 30, price: 1999, img: 'vespa-gts-300.jpg',      cities: ['chandigarh', 'mohali', 'delhi', 'goa'] },
    { id: 'panigale-959',  name: 'Ducati 959 Panigale',         type: 'sports',    engine: 955,  mileage: 16, price: 6999, img: 'ducati-panigale.jpg',    cities: ['delhi', 'goa'] },
    { id: 'fat-boy',       name: 'Harley-Davidson Fat Boy',     type: 'cruiser',   engine: 1584, mileage: 18, price: 7499, img: 'harley-fat-boy.jpg',     cities: ['chandigarh', 'delhi', 'goa'] },
    { id: 'r1250gs',       name: 'BMW R 1250 GS',               type: 'adventure', engine: 1254, mileage: 20, price: 7999, img: 'bmw-r1250gs.jpg',        cities: ['chandigarh', 'delhi', 'manali'] },
    { id: 'yamaha-tmax',   name: 'Yamaha TMAX 560',             type: 'scooter',   engine: 562,  mileage: 22, price: 2499, img: 'yamaha-tmax.jpg',        cities: ['chandigarh', 'mohali', 'goa'], maintenance: true },
    { id: 'zx10r',         name: 'Kawasaki Ninja ZX-10R',       type: 'sports',    engine: 998,  mileage: 15, price: 7499, img: 'kawasaki-zx10r.jpg',     cities: ['mohali', 'delhi', 'goa'] },
    { id: 'triumph-bobber', name: 'Triumph Bonneville Bobber',  type: 'cruiser',   engine: 1200, mileage: 21, price: 5499, img: 'triumph-bobber.jpg',     cities: ['chandigarh', 'mohali', 'manali'] },
    { id: 'ktm-1290-sar',  name: 'KTM 1290 Super Adventure',    type: 'adventure', engine: 1301, mileage: 17, price: 6499, img: 'ktm-1290-adventure.jpg', cities: ['chandigarh', 'delhi', 'manali'] }
];

const CITIES = ['chandigarh', 'mohali', 'delhi', 'manali', 'goa'];

// Latitude / longitude of each city, used by "Use my location"
const CITY_COORDS = {
    chandigarh: [30.7333, 76.7794],
    mohali:     [30.7046, 76.7179],
    delhi:      [28.6139, 77.2090],
    manali:     [32.2432, 77.1892],
    goa:        [15.2993, 74.1240]
};

// Flat refundable security deposit added to every booking
const DEPOSIT = 500;
