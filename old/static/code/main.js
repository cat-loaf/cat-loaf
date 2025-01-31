function toggleHidden(id) {
    var el = document.getElementById(id)
    if (el.style.display == "none") {
        document.getElementById(id).style.display = "unset";
    } else {
        document.getElementById(id).style.display = "none";
    }
    console.log(el);
}
// toggleHidden('nav-links-content')
