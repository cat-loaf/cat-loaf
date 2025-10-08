let nav = 0;
let toggleNavButton = 0;
let header = 0;
let main = 0;

document.addEventListener("DOMContentLoaded", ()=>{
    nav = document.querySelector("nav")
    toggleNavButton = document.querySelector("nav button")
    header = document.querySelector("header")
    main = document.querySelector("main")
})

function toggleNav() {
    if (nav.classList.toggle("navHidden")) {
        toggleNavButton.innerText = "Open"
        main.style.marginTop = "6em"
    } else {
        toggleNavButton.innerText = "Close"
        main.style.marginTop = "16em"
    }
}