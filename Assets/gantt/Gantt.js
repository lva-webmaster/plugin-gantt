class Gantt extends GanttInteraction {

    show() {
        if (!this._rawJson) {
            this._rawJson = $(this.options.container).attr('data-records');
        }
        this.data = this.prepareData(JSON.parse(this._rawJson));
        this.data = this.applyGrouping(this.data, this._groupBy);

        const containerWidth = $(this.options.container).width() - this.options.vHeaderWidth;
        const minDays = Math.floor(containerWidth / this.options.cellWidth) + 5;
        const range = this.getDateRange(minDays);
        this._startDate = range[0];
        this._endDate = range[1];
        const container = $(this.options.container);
        this._hasSubtaskdate = container.data('has-subtaskdate') === 1;

        const zoomClass = `zoom-${this._zoomLevel}`;
        const chart = jQuery("<div>", { "class": `ganttview ${zoomClass}` });

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
        this.computeCriticalPath();
        this.highlightDependencyViolations();
        this.highlightCriticalPath();
        this.renderDependencyArrows();

        this._bindSubtaskToggles();
        this._bindEditModals();
        this._bindGroupToggles();

        if (this._hasSubtaskdate) {
            this.listenForSubtaskMove();
            this.restoreExpandedTasks();
            this.highlightSubtaskViolations();
        }
        this.snapTodayMarker();
        this.renderDependencyArrows();

        this._bindToolbar();

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

    // --- Grouping ---

    applyGrouping(data, groupBy) {
        if (!groupBy || groupBy === 'none') return data;

        const fieldMap = {
            swimlane: 'swimlane_name',
            assignee: 'assignee',
            category: 'category',
            column: 'column_title',
            priority: 'priority'
        };

        const field = fieldMap[groupBy];
        if (!field) return data;

        const groups = new Map();
        for (const item of data) {
            if (item.type === 'group') continue;
            let key = item[field];
            if (key === null || key === undefined || key === '') {
                key = groupBy === 'priority' ? '0' : 'None';
            }
            if (groupBy === 'priority') key = `P${key}`;
            const label = String(key);
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(item);
        }

        const result = [];
        for (const [name, items] of groups) {
            result.push({ type: 'group', name, count: items.length, collapsed: false });
            result.push(...items);
        }
        return result;
    }

    // --- Zoom ---

    setZoom(level) {
        const config = GanttBase.ZOOM_LEVELS[level];
        if (!config) return;
        this._zoomLevel = level;
        this.options.cellWidth = config.cellWidth;
        localStorage.setItem('gantt-zoom', level);
        this._rerender();
    }

    setGrouping(groupBy) {
        this._groupBy = groupBy;
        localStorage.setItem('gantt-group', groupBy);
        this._rerender();
    }

    _rerender() {
        jQuery(this.options.container).empty();
        this.show();
    }

    // --- Toolbar bindings ---

    _bindToolbar() {
        jQuery('.gantt-zoom-btn').off('click.gantt').on('click.gantt', (e) => {
            const level = jQuery(e.currentTarget).data('zoom');
            jQuery('.gantt-zoom-btn').removeClass('active');
            jQuery(e.currentTarget).addClass('active');
            this.setZoom(level);
        });

        const savedZoom = this._zoomLevel;
        jQuery('.gantt-zoom-btn').removeClass('active');
        jQuery(`.gantt-zoom-btn[data-zoom="${savedZoom}"]`).addClass('active');

        const groupSelect = jQuery('#gantt-group-select');
        groupSelect.val(this._groupBy);
        groupSelect.off('change.gantt').on('change.gantt', (e) => {
            this.setGrouping(e.currentTarget.value);
        });
    }

    // --- Event bindings ---

    _bindSubtaskToggles() {
        jQuery(this.options.container).off('click.gantt-subtask').on('click.gantt-subtask', '.ganttview-subtask-toggle', (e) => {
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
    }

    _bindEditModals() {
        jQuery(this.options.container).off('click.gantt-edit').on('click.gantt-edit', '.ganttview-block-edit, .ganttview-vtheader-edit, .ganttview-subtask-edit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            KB.modal.open(e.currentTarget.getAttribute('href'), 'medium', false);
        });
    }

    _bindGroupToggles() {
        const isSubtaskRow = (el) => el.hasClass('ganttview-subtask-row') || el.hasClass('ganttview-subtask-grid-row') || el.hasClass('ganttview-subtask-block-row');
        const expandedTasks = () => this.getExpandedTasks();

        jQuery(this.options.container).off('click.gantt-group').on('click.gantt-group', '.ganttview-group-toggle', (e) => {
            e.preventDefault();
            const header = jQuery(e.currentTarget).closest('.ganttview-group-header');
            const groupName = header.data('group-name');
            const icon = jQuery(e.currentTarget).find('i');
            const collapsing = icon.hasClass('fa-caret-down');
            icon.toggleClass('fa-caret-right fa-caret-down');

            const expanded = expandedTasks();
            const toggleEl = (el) => {
                if (collapsing) {
                    el.slideUp(150);
                } else if (isSubtaskRow(el)) {
                    const parentId = el.data('parent-task');
                    if (expanded.includes(parentId)) el.slideDown(150);
                } else {
                    el.slideDown(150);
                }
            };

            let el = header.next();
            while (el.length && !el.hasClass('ganttview-group-header')) {
                toggleEl(el);
                el = el.next();
            }

            const gridName = `[data-group-name="${groupName}"]`;
            let nextGrid = jQuery(`.ganttview-group-grid-row${gridName}`, this.options.container).next();
            while (nextGrid.length && !nextGrid.hasClass('ganttview-group-grid-row')) {
                toggleEl(nextGrid);
                nextGrid = nextGrid.next();
            }

            const blockName = `[data-group-name="${groupName}"]`;
            let nextBlock = jQuery(`.ganttview-group-block-row${blockName}`, this.options.container).next();
            while (nextBlock.length && !nextBlock.hasClass('ganttview-group-block-row')) {
                toggleEl(nextBlock);
                nextBlock = nextBlock.next();
            }

            setTimeout(() => { this.snapTodayMarker(); this.renderDependencyArrows(); }, 200);
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
