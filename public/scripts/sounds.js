(function () {
    // Create and cache audio element
    var audio = document.createElement('audio');
    audio.id = 'meow-audio';
    audio.src = '/public/sounds/meow.mp3';
    audio.preload = 'auto';
    audio.style.display = 'none';
    // Default volume (0.0 - 1.0). Lower this value to reduce loudness.
    var DEFAULT_VOLUME = 0.25;
    audio.volume = DEFAULT_VOLUME;
    document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(audio);

        var icon = document.getElementById('header-icon');
        if (!icon) return;

        // Add pointer cursor
        icon.style.cursor = 'pointer';

        // Add click animation CSS (scaling) once
        var style = document.createElement('style');
        style.textContent = "#header-icon.click-anim{transform: scale(0.85); transition: transform 120ms ease;}\n#header-icon{transition: transform 160ms ease;}";
        document.head.appendChild(style);

        // Handler
        function handleClick() {
            // play sound (safe promise handling)
            var p = audio.play();
            if (p && p.catch) p.catch(function () {});

            // trigger animation by toggling class
            icon.classList.remove('click-anim');
            // force reflow to restart animation
            void icon.offsetWidth;
            icon.classList.add('click-anim');

            // remove class after animation duration to keep DOM clean
            setTimeout(function () {
                icon.classList.remove('click-anim');
            }, 200);
        }

        icon.addEventListener('click', handleClick);
    });
    // Expose setter to allow runtime volume adjustments: window.setMeowVolume(0.2)
    window.setMeowVolume = function (v) {
        try {
            var vol = Number(v);
            if (isNaN(vol)) return;
            if (vol < 0) vol = 0;
            if (vol > 1) vol = 1;
            audio.volume = vol;
        } catch (e) { }
    };
})();
