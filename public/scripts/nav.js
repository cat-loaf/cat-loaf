let nav = 0;
let toggleNavButton = 0;
let header = 0;
let main = 0;

document.addEventListener("DOMContentLoaded", ()=>{
    nav = document.querySelector("nav")
    toggleNavButton = document.querySelector("nav button")
    header = document.querySelector("header")
    main = document.querySelector("main")
    
    // Add smooth scrolling to navigation links
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Close nav on mobile after clicking a link
                if (!nav.classList.contains("navHidden")) {
                    toggleNav();
                }
            }
        });
    });
})

function toggleNav() {
    if (nav.classList.toggle("navHidden")) {
        toggleNavButton.innerText = "+"
        main.style.marginTop = "8em"
    } else {
        toggleNavButton.innerText = "-"
        main.style.marginTop = "30em"
    }
}