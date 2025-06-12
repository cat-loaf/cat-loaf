let heroLogoLink = document.getElementById('hero-logo-link');
let homeLink = document.getElementById('home-link');
let workLink = document.getElementById('work-link');
let socialsLink = document.getElementById('socials-link');

// add smooth scrolling to links
heroLogoLink.addEventListener('click', function(event) {
    event.preventDefault();
    let heroElement = document.getElementById('hero');
    let viewportHeight = window.innerHeight;
    let offset = heroElement.getBoundingClientRect().top + window.scrollY - (viewportHeight / 2 - heroElement.offsetHeight / 2);
    window.scrollTo({
        top: offset,
        behavior: 'smooth'
    });
    homeLink.classList.remove('is_active');
    workLink.classList.remove('is_active');
    socialsLink.classList.remove('is_active');
    heroLogoLink.classList.add('is_active');
    document.getElementById('hero').classList.add('flash');
    setTimeout(function() {
        document.getElementById('hero').classList.remove('flash');
    }, 1000);
});

homeLink.addEventListener('click', function(event) {
    event.preventDefault();
    let homeElement = document.getElementById('home');
    let viewportHeight = window.innerHeight;
    let offset = homeElement.getBoundingClientRect().top + window.scrollY - (viewportHeight / 2 - homeElement.offsetHeight / 2);
    window.scrollTo({
        top: offset,
        behavior: 'smooth'
    });

    // document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
    workLink.classList.remove('is_active');
    socialsLink.classList.remove('is_active');
    heroLogoLink.classList.remove('is_active');
    homeLink.classList.add('is_active');

    document.getElementById('home').classList.add('flash');
    setTimeout(function() {
        document.getElementById('home').classList.remove('flash');
    }, 1000);
});
workLink.addEventListener('click', function(event) {
    event.preventDefault();
    let workElement = document.getElementById('work');
    let viewportHeight = window.innerHeight;
    let offset = workElement.getBoundingClientRect().top + window.scrollY - (viewportHeight / 2 - workElement.offsetHeight / 2);
    window.scrollTo({
        top: offset,
        behavior: 'smooth'
    });
    homeLink.classList.remove('is_active');
    socialsLink.classList.remove('is_active');
    heroLogoLink.classList.remove('is_active');
    workLink.classList.add('is_active');
    document.getElementById('work').classList.add('flash');
    setTimeout(function() {
        document.getElementById('work').classList.remove('flash');
    }, 1000);
});
socialsLink.addEventListener('click', function(event) {
    event.preventDefault();
    let socialsElement = document.getElementById('socials');
    let viewportHeight = window.innerHeight;
    let offset = socialsElement.getBoundingClientRect().top + window.scrollY - (viewportHeight / 2 - socialsElement.offsetHeight / 2);
    window.scrollTo({
        top: offset,
        behavior: 'smooth'
    });
    homeLink.classList.remove('is_active');
    workLink.classList.remove('is_active');
    heroLogoLink.classList.remove('is_active');
    socialsLink.classList.add('is_active');
    document.getElementById('socials').classList.add('flash');
    setTimeout(function() {
        document.getElementById('socials').classList.remove('flash');
    }, 1000);
});

// all image carousels
// div.image-carousel > div.image-slide (can have .active class)
let carousels = document.querySelectorAll('.image-carousel');
carousels.forEach(carousel => {
    let slides = carousel.querySelectorAll('.image-slide');
    let currentIndex = 0;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % slides.length;
        showSlide(currentIndex);
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        showSlide(currentIndex);
    }

    let buttonsHolder = document.createElement('div');
    buttonsHolder.classList.add('carousel-buttons-holder');

    // Add next and prev buttons
    let nextButton = document.createElement('button');
    nextButton.textContent = '»';
    nextButton.classList.add('carousel-button', 'next');
    nextButton.addEventListener('click', nextSlide);
    let prevButton = document.createElement('button');
    prevButton.textContent = '«';
    prevButton.classList.add('carousel-button', 'prev');
    prevButton.addEventListener('click', prevSlide);

    buttonsHolder.appendChild(prevButton);
    buttonsHolder.appendChild(nextButton);
    
    carousel.appendChild(buttonsHolder);

    // Show the first slide initially
    showSlide(currentIndex);
});