function createNavItem(href, iconClass, text, isActive = false) {
    const div = document.createElement('div');
    if (isActive) {
        div.classList.add('active');
    }

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.innerHTML = `<i class="${iconClass}"></i> ${text}`;
    div.appendChild(anchor);

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-xmark';
    div.appendChild(icon);

    return div;
}

function createNav() {
    const nav = document.createElement('nav');
    const currentPath = window.location.pathname;
    const navItems = [
        { href: '/', iconClass: 'fa-brands fa-html5', text: 'home.html' },
        { href: '/projects/', iconClass: 'fa-brands fa-js', text: 'projects.js' },
        { href: '/contact/', iconClass: 'fa-brands fa-css3', text: 'contact.css' }
    ];

    navItems.forEach(item => {
        const isActive = currentPath === item.href;
        nav.appendChild(createNavItem(item.href, item.iconClass, item.text, isActive));
    });
    return nav;
}

function createBreadcrumb() {
    const div = document.createElement('div');
    div.className = 'bar';

    const cloneIcon = document.createElement('i');
    cloneIcon.className = 'fa-solid fa-clone';
    div.appendChild(cloneIcon);

    const angleRightIcon1 = document.createElement('i');
    angleRightIcon1.className = 'fa-solid fa-angle-right';
    div.appendChild(angleRightIcon1);

    const granthJainText = document.createTextNode(' granth-jain ');
    div.appendChild(granthJainText);

    const angleRightIcon2 = document.createElement('i');
    angleRightIcon2.className = 'fa-solid fa-angle-right';
    div.appendChild(angleRightIcon2);

    const homeText = document.createTextNode(' home.html');
    div.appendChild(homeText);

    return div;
}

function createAdditionalElements() {
    const columnLimitDiv = document.createElement('div');
    columnLimitDiv.className = 'column-limit';

    const closeDiv = document.createElement('div');
    closeDiv.className = 'close';
    const closeAnchor = document.createElement('a');
    closeAnchor.href = 'https://github.com/cat-loaf/';
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fa-solid fa-xmark';
    closeAnchor.appendChild(closeIcon);
    closeDiv.appendChild(closeAnchor);

    const bottomVignetteDiv = document.createElement('div');
    bottomVignetteDiv.className = 'bottom-vignette';

    return { columnLimitDiv, closeDiv, bottomVignetteDiv };
}

function createCarousel(imagePaths) {
    const carouselDiv = document.createElement('div');
    carouselDiv.className = 'carousel';
    
    const prevButton = document.createElement('button');
    prevButton.className = 'carousel-button prev';
    prevButton.onclick = () => changeSlide(-1);
    carouselDiv.appendChild(prevButton);

    const prevIcon = document.createElement('i');
    prevIcon.className = 'fa-solid fa-caret-left';
    prevButton.appendChild(prevIcon);

    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'carousel-images';
    imagePaths.forEach((path, index) => {
        const img = document.createElement('img');
        img.src = path;
        img.alt = `Image ${index}`;
        img.style.display = index === 0 ? 'block' : 'none';
        imagesDiv.appendChild(img);
    });
    carouselDiv.appendChild(imagesDiv);

    const nextButton = document.createElement('button');
    nextButton.className = 'carousel-button next';
    nextButton.onclick = () => changeSlide(1);
    carouselDiv.appendChild(nextButton);

    const nextIcon = document.createElement('i');
    nextIcon.className = 'fa-solid fa-caret-right';
    nextButton.appendChild(nextIcon);

    let currentSlide = 0;
    const slides = imagesDiv.querySelectorAll('img');

    function changeSlide(direction) {
        slides[currentSlide].style.display = 'none';
        currentSlide = (currentSlide + direction + slides.length) % slides.length;
        slides[currentSlide].style.display = 'block';
    }

    return carouselDiv;
}
function appendCarousel(selector, imagePaths) {
    const container = document.querySelector(selector);
    if (container) {
        container.appendChild(createCarousel(imagePaths));
    }
}


document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(createNav());
    document.body.appendChild(createBreadcrumb());
    
    const { columnLimitDiv, closeDiv, bottomVignetteDiv } = createAdditionalElements();
    document.body.appendChild(columnLimitDiv);
    document.body.appendChild(closeDiv);
    document.body.appendChild(bottomVignetteDiv);
});