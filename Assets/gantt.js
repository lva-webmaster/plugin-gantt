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

        KB.on('modal.close', () => {
            if (KB.exists('#gantt-chart')) {
                window.location.reload();
            }
        });
    }
});
