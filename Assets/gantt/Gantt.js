class Gantt extends GanttInteraction {

    show() {
        this.data = this.prepareData($(this.options.container).data('records'));

        const containerWidth = $(this.options.container).width() - this.options.vHeaderWidth;
        const minDays = Math.floor(containerWidth / this.options.cellWidth) + 5;
        const range = this.getDateRange(minDays);
        this._startDate = range[0];
        this._endDate = range[1];
        const container = $(this.options.container);
        this._hasSubtaskdate = container.data('has-subtaskdate') === 1;
        const chart = jQuery("<div>", { "class": "ganttview" });

        chart.append(this.renderVerticalHeader());
        chart.append(this.renderSlider(this._startDate, this._endDate));
        container.append(chart);

        this.measureCellWidth();
        this.snapAllBlocks();
        this.snapTodayMarker();
        this.scrollToToday();

        jQuery("div.ganttview-grid-row div.ganttview-grid-row-cell:last-child", container).addClass("last");
        jQuery("div.ganttview-hzheader-days div.ganttview-hzheader-day:last-child", container).addClass("last");
        jQuery("div.ganttview-hzheader-months div.ganttview-hzheader-month:last-child", container).addClass("last");

        if (!$(this.options.container).data('readonly')) {
            this.listenForBlockResize();
            this.listenForBlockMove();
        } else {
            this.options.allowResizes = false;
            this.options.allowMoves = false;
        }

        this.buildDependencyIndex();
        this.highlightDependencyViolations();
        this.renderDependencyArrows();

        jQuery(this.options.container).on('click', '.ganttview-subtask-toggle', (e) => {
            e.preventDefault();
            const toggle = jQuery(e.currentTarget);
            const taskId = toggle.data('task-id');
            const icon = toggle.find('i');
            const expanded = icon.hasClass('fa-caret-down');
            icon.toggleClass('fa-caret-right fa-caret-down');
            const sel = `[data-parent-task="${taskId}"]`;
            const targets = jQuery(`.ganttview-subtask-row${sel}, .ganttview-subtask-block-row${sel}, .ganttview-subtask-grid-row${sel}`, this.options.container);
            if (expanded) {
                targets.slideUp(150);
                this.removeExpandedTask(taskId);
            } else {
                targets.slideDown(150);
                this.addExpandedTask(taskId);
            }
            setTimeout(() => { this.snapTodayMarker(); this.renderDependencyArrows(); }, 200);
        });

        jQuery(this.options.container).on('click', '.ganttview-block-edit, .ganttview-vtheader-edit, .ganttview-subtask-edit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            KB.modal.open(e.currentTarget.getAttribute('href'), 'medium', false);
        });

        if (this._hasSubtaskdate) {
            this.listenForSubtaskMove();
            this.restoreExpandedTasks();
            this.highlightSubtaskViolations();
        }
        this.snapTodayMarker();
        this.renderDependencyArrows();

        let resnapTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resnapTimer);
            resnapTimer = setTimeout(() => {
                this.measureCellWidth();
                this.snapAllBlocks();
                this.snapTodayMarker();
                this.renderDependencyArrows();
            }, 150);
        });
    }

    // --- Subtask expand/collapse state persistence ---

    getExpandedKey() {
        return `gantt-expanded-${window.location.pathname}${window.location.search}`;
    }

    getExpandedTasks() {
        try { return JSON.parse(localStorage.getItem(this.getExpandedKey())) || []; }
        catch (e) { return []; }
    }

    addExpandedTask(taskId) {
        const list = this.getExpandedTasks();
        if (!list.includes(taskId)) list.push(taskId);
        localStorage.setItem(this.getExpandedKey(), JSON.stringify(list));
    }

    removeExpandedTask(taskId) {
        const list = this.getExpandedTasks().filter(id => id !== taskId);
        localStorage.setItem(this.getExpandedKey(), JSON.stringify(list));
    }

    restoreExpandedTasks() {
        const list = this.getExpandedTasks();
        for (const taskId of list) {
            const toggle = jQuery(`.ganttview-subtask-toggle[data-task-id="${taskId}"]`, this.options.container);
            if (toggle.length) {
                toggle.find('i').removeClass('fa-caret-right').addClass('fa-caret-down');
                const sel = `[data-parent-task="${taskId}"]`;
                jQuery(`.ganttview-subtask-row${sel}, .ganttview-subtask-block-row${sel}, .ganttview-subtask-grid-row${sel}`, this.options.container).show();
            }
        }
    }
}
