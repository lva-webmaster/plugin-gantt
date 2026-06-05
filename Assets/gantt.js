KB.on('dom.ready', () => {
    const goToLink = (selector) => {
        if (!KB.modal.isOpen()) {
            const element = KB.find(selector);
            if (element !== null) {
                window.location = element.attr('href');
            }
        }
    };

    KB.onKey('v+g', () => {
        goToLink('a.view-gantt');
    });

    if (KB.exists('#gantt-chart')) {
        const chart = new Gantt();
        chart.show();
        jQuery('#gantt-chart').data('gantt', chart);

        KB.on('modal.close', () => {
            if (KB.exists('#gantt-chart')) {
                window.location.reload();
            }
        });
    }

    var helpBtn = document.getElementById('gantt-help-btn');
    var helpOverlay = document.getElementById('gantt-help-overlay');
    if (helpBtn && helpOverlay) {
        helpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            helpOverlay.style.display = 'flex';
        });
        helpOverlay.addEventListener('click', function(e) {
            if (e.target === helpOverlay) helpOverlay.style.display = 'none';
        });
        helpOverlay.querySelector('.gantt-help-close').addEventListener('click', function() {
            helpOverlay.style.display = 'none';
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && helpOverlay.style.display !== 'none') helpOverlay.style.display = 'none';
        });
    }
});
