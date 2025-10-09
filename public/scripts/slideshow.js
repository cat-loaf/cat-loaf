// Slideshow functionality for project images

// Global slideshow state
const slideshows = {};
const autoAdvanceIntervals = {};

// Initialize slideshows when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    // Initialize all slideshows on the page
    const slideshowContainers = document.querySelectorAll('.project-slideshow');
    
    slideshowContainers.forEach(container => {
        const slideshowId = container.id;
        if (slideshowId) {
            initializeSlideshow(slideshowId);
            setupAutoAdvance(slideshowId);
        }
    });
    
    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Setup touch/swipe support
    setupTouchSupport();
});

// Initialize a specific slideshow
function initializeSlideshow(slideshowId) {
    const container = document.getElementById(slideshowId);
    if (!container) return;
    
    const slides = container.querySelectorAll('.slide');
    const indicators = container.querySelectorAll('.indicator');
    
    slideshows[slideshowId] = {
        currentSlide: 1,
        totalSlides: slides.length,
        container: container,
        slides: slides,
        indicators: indicators
    };
    
    // Ensure first slide and indicator are active
    showSlide(slideshowId, 1);
}

// Setup auto-advance with hover pause functionality
function setupAutoAdvance(slideshowId) {
    const container = document.getElementById(slideshowId);
    if (!container) return;
    
    // Start auto-advance
    function startAutoAdvance() {
        if (autoAdvanceIntervals[slideshowId]) {
            clearInterval(autoAdvanceIntervals[slideshowId]);
        }
        autoAdvanceIntervals[slideshowId] = setInterval(() => {
            changeSlide(slideshowId, 1);
        }, 5000);
    }
    
    // Stop auto-advance
    function stopAutoAdvance() {
        if (autoAdvanceIntervals[slideshowId]) {
            clearInterval(autoAdvanceIntervals[slideshowId]);
            autoAdvanceIntervals[slideshowId] = null;
        }
    }
    
    // Pause on hover over slideshow container
    container.addEventListener('mouseenter', stopAutoAdvance);
    container.addEventListener('mouseleave', startAutoAdvance);
    
    // Pause on focus (for keyboard users)
    container.addEventListener('focusin', stopAutoAdvance);
    container.addEventListener('focusout', startAutoAdvance);
    
    // Start the auto-advance initially
    startAutoAdvance();
}

// Change slide by direction (-1 for previous, 1 for next)
function changeSlide(slideshowId, direction) {
    const slideshow = slideshows[slideshowId];
    if (!slideshow) return;
    
    slideshow.currentSlide += direction;
    
    // Wrap around if necessary
    if (slideshow.currentSlide > slideshow.totalSlides) {
        slideshow.currentSlide = 1;
    } else if (slideshow.currentSlide < 1) {
        slideshow.currentSlide = slideshow.totalSlides;
    }
    
    showSlide(slideshowId, slideshow.currentSlide);
}

// Go to a specific slide
function currentSlide(slideshowId, slideNumber) {
    const slideshow = slideshows[slideshowId];
    if (!slideshow) return;
    
    slideshow.currentSlide = slideNumber;
    showSlide(slideshowId, slideNumber);
}

// Display the specified slide
function showSlide(slideshowId, slideNumber) {
    const slideshow = slideshows[slideshowId];
    if (!slideshow) return;
    
    // Hide all slides
    slideshow.slides.forEach(slide => {
        slide.classList.remove('active');
    });
    
    // Remove active class from all indicators
    slideshow.indicators.forEach(indicator => {
        indicator.classList.remove('active');
    });
    
    // Show the current slide
    if (slideshow.slides[slideNumber - 1]) {
        slideshow.slides[slideNumber - 1].classList.add('active');
    }
    
    // Activate the current indicator
    if (slideshow.indicators[slideNumber - 1]) {
        slideshow.indicators[slideNumber - 1].classList.add('active');
    }
}

// Handle keyboard navigation
function handleKeyboardNavigation(event) {
    // Only handle keyboard navigation if focus is on a slideshow or its children
    const focusedElement = document.activeElement;
    const slideshowContainer = focusedElement.closest('.project-slideshow');
    
    if (!slideshowContainer || !slideshowContainer.id) return;
    
    const slideshowId = slideshowContainer.id;
    
    switch(event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            changeSlide(slideshowId, -1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            changeSlide(slideshowId, 1);
            break;
        case 'Home':
            event.preventDefault();
            currentSlide(slideshowId, 1);
            break;
        case 'End':
            event.preventDefault();
            const slideshow = slideshows[slideshowId];
            if (slideshow) {
                currentSlide(slideshowId, slideshow.totalSlides);
            }
            break;
    }
}

// Touch/swipe support for mobile devices
function setupTouchSupport() {
    const slideshowContainers = document.querySelectorAll('.slideshow-container');
    
    slideshowContainers.forEach(container => {
        const slideshowId = container.closest('.project-slideshow').id;
        let startX = 0;
        let endX = 0;
        
        container.addEventListener('touchstart', function(event) {
            startX = event.touches[0].clientX;
        });
        
        container.addEventListener('touchend', function(event) {
            endX = event.changedTouches[0].clientX;
            handleSwipe(slideshowId);
        });
        
        function handleSwipe(slideshowId) {
            const minSwipeDistance = 50; // Minimum distance for a swipe
            const swipeDistance = endX - startX;
            
            if (Math.abs(swipeDistance) > minSwipeDistance) {
                if (swipeDistance > 0) {
                    // Swiped right (previous slide)
                    changeSlide(slideshowId, -1);
                } else {
                    // Swiped left (next slide)
                    changeSlide(slideshowId, 1);
                }
            }
        }
    });
}