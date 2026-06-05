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
        this._startDate = this.addDays(range[0], -14);
        this._endDate = this.addDays(this.cloneDate(range[1]), 14);
        const container = $(this.options.container);
        this._hasSubtaskdate = container.data('has-subtaskdate') === 1;

        const zoomClass = `zoom-${this._zoomLevel}`;
        const chart = jQuery("<div>", { "class": `ganttview ${zoomClass}` });

        chart.append(this.renderVerticalHeader());
        chart.append(this.renderSlider(this._startDate, this._endDate));
        container.append(chart);

        this.measureCellWidth();
        jQuery("div.ganttview-slide-container", container).scrollLeft(14 * this.options.cellWidth);
        this.snapAllBlocks();
        this.refreshBlockText();
        this.snapTodayMarker();

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

        this.restoreCollapsedGroups();
        this._renderToggleButtons();

        this.snapTodayMarker();
        this.renderDependencyArrows();

        this._bindToolbar();
        this._bindInfiniteScroll();

        let resnapTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resnapTimer);
            resnapTimer = setTimeout(() => {
                this.measureCellWidth();
                this.snapAllBlocks();
                this.refreshBlockText();
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

    // --- Infinite scroll ---

    _bindInfiniteScroll() {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        if (!container.length) return;

        let expanding = false;
        const threshold = 50;

        const expand = (direction) => {
            if (expanding) return;
            expanding = true;
            if (direction === 'right') {
                this.expandRight(14);
            } else {
                this.expandLeft(14);
            }
            this.snapAllBlocks();
            this.snapTodayMarker();
            this.renderDependencyArrows();
            requestAnimationFrame(() => { expanding = false; });
        };

        container.on('scroll.gantt-infinite', () => {
            const el = container[0];
            const scrollLeft = el.scrollLeft;
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (maxScroll > 0 && scrollLeft >= maxScroll - threshold) {
                expand('right');
            } else if (scrollLeft <= threshold) {
                expand('left');
            }
        });

        container[0].addEventListener('wheel', (e) => {
            const el = container[0];
            const scrollLeft = el.scrollLeft;
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (e.deltaX < 0 && scrollLeft <= threshold) {
                expand('left');
            } else if (e.deltaX > 0 && maxScroll > 0 && scrollLeft >= maxScroll - threshold) {
                expand('right');
            }
        }, { passive: true });
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
            this._updateToggleSubtasksButton();
            setTimeout(() => { this.snapTodayMarker(); this.renderDependencyArrows(); }, 200);
        });
    }

    _bindEditModals() {
        jQuery(this.options.container).off('click.gantt-edit').on('click.gantt-edit', '.ganttview-block-edit, .ganttview-vtheader-edit:not(.ganttview-link-btn), .ganttview-subtask-edit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            KB.modal.open(e.currentTarget.getAttribute('href'), 'medium', false);
        });

        jQuery(this.options.container).off('click.gantt-links').on('click.gantt-links', '.ganttview-link-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = jQuery(e.currentTarget);
            this._openLinkModal(btn.data('task-id'), btn.data('task-title'));
        });
    }

    // --- Internal Links Modal ---

    _openLinkModal(taskId, taskTitle) {
        const container = jQuery(this.options.container);
        const linksUrl = container.data('links-url');
        if (!linksUrl) return;

        const url = linksUrl + (linksUrl.includes('?') ? '&' : '?') + 'task_id=' + taskId;

        jQuery.ajax({
            url: url,
            cache: false,
            dataType: 'json',
            success: (data) => {
                this._renderLinkModal(data, taskId, taskTitle);
            },
            error: () => {
                GanttToast.show('Failed to load links', 'error');
            }
        });
    }

    _renderLinkModal(data, taskId, taskTitle) {
        jQuery('.gantt-link-overlay').remove();

        let linksChanged = false;
        const container = jQuery(this.options.container);
        const saveLinkUrl = container.data('save-link-url');
        const removeLinkUrl = container.data('remove-link-url');

        const overlay = jQuery('<div>', { 'class': 'gantt-link-overlay' });
        const modal = jQuery('<div>', { 'class': 'gantt-link-modal' });

        const header = jQuery('<div>', { 'class': 'gantt-link-header' })
            .append(jQuery('<h2>').html(`<i class="fa fa-link"></i> Links &mdash; #${taskId} ${this._escHtml(taskTitle)}`))
            .append(jQuery('<button>', { 'class': 'gantt-link-close', title: 'Close' }).html('&times;'));
        modal.append(header);

        const body = jQuery('<div>', { 'class': 'gantt-link-body' });

        const listSection = jQuery('<div>', { 'class': 'gantt-link-list' });
        this._renderLinkList(listSection, data.links, removeLinkUrl, taskId, () => { linksChanged = true; });
        body.append(listSection);

        if (saveLinkUrl) {
            body.append(jQuery('<hr>', { 'class': 'gantt-link-divider' }));

            const form = jQuery('<div>', { 'class': 'gantt-link-form' });
            form.append(jQuery('<h3>').text('Add link'));

            const row = jQuery('<div>', { 'class': 'gantt-link-form-row' });

            const typeSelect = jQuery('<select>', { 'class': 'gantt-link-type-select' });
            for (const [id, label] of Object.entries(data.labels)) {
                typeSelect.append(jQuery('<option>', { value: id }).text(label));
            }
            row.append(typeSelect);

            const taskSelect = jQuery('<select>', { 'class': 'gantt-link-task-select' });
            taskSelect.append(jQuery('<option>', { value: '' }).text('Select a task…'));
            for (const task of data.tasks) {
                taskSelect.append(jQuery('<option>', { value: task.id }).text(`#${task.id} ${task.title}`));
            }
            row.append(taskSelect);

            const addBtn = jQuery('<button>', { 'class': 'gantt-link-add-btn' }).text('Add');
            row.append(addBtn);

            form.append(row);

            const errorMsg = jQuery('<div>', { 'class': 'gantt-link-error', style: 'display:none' });
            form.append(errorMsg);

            addBtn.on('click', () => {
                const oppositeTaskId = taskSelect.val();
                const linkId = typeSelect.val();
                if (!oppositeTaskId) {
                    errorMsg.text('Please select a task.').show();
                    return;
                }
                errorMsg.hide();
                addBtn.prop('disabled', true).text('Adding…');

                jQuery.ajax({
                    url: saveLinkUrl,
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ task_id: taskId, opposite_task_id: parseInt(oppositeTaskId), link_id: parseInt(linkId) }),
                    success: () => {
                        linksChanged = true;
                        addBtn.prop('disabled', false).text('Add');
                        taskSelect.val('');
                        this._refreshLinkList(listSection, taskId, removeLinkUrl, () => { linksChanged = true; });
                    },
                    error: (xhr) => {
                        addBtn.prop('disabled', false).text('Add');
                        const msg = xhr.responseJSON ? xhr.responseJSON.message : 'Failed to add link';
                        errorMsg.text(msg).show();
                    }
                });
            });

            body.append(form);
        }

        modal.append(body);
        overlay.append(modal);

        const closeModal = () => {
            overlay.remove();
            if (linksChanged) {
                window.location.reload();
            }
        };

        header.find('.gantt-link-close').on('click', closeModal);
        overlay.on('click', (e) => { if (e.target === overlay[0]) closeModal(); });
        jQuery(document).on('keydown.gantt-link-modal', (e) => {
            if (e.key === 'Escape') { jQuery(document).off('keydown.gantt-link-modal'); closeModal(); }
        });

        jQuery('body').append(overlay);
        overlay.css('display', 'flex');
    }

    _renderLinkList(container, links, removeLinkUrl, taskId, onChanged) {
        container.empty();
        if (!links || !links.length) {
            container.append(jQuery('<div>', { 'class': 'gantt-link-empty' }).text('No links yet.'));
            return;
        }

        const grouped = {};
        for (const link of links) {
            if (!grouped[link.label]) grouped[link.label] = [];
            grouped[link.label].push(link);
        }

        for (const [label, items] of Object.entries(grouped)) {
            const group = jQuery('<div>', { 'class': 'gantt-link-group' });
            group.append(jQuery('<div>', { 'class': 'gantt-link-group-label' }).text(label));
            for (const item of items) {
                const row = jQuery('<div>', { 'class': 'gantt-link-row' });
                const taskInfo = jQuery('<span>', { 'class': 'gantt-link-task-info' });
                taskInfo.append(jQuery('<strong>').text(`#${item.task_id}`));
                taskInfo.append(document.createTextNode(` ${item.title}`));
                if (item.column_title) {
                    taskInfo.append(jQuery('<span>', { 'class': 'gantt-link-column' }).text(item.column_title));
                }
                row.append(taskInfo);
                if (removeLinkUrl) {
                    const removeBtn = jQuery('<button>', {
                        'class': 'gantt-link-remove-btn',
                        title: 'Remove link'
                    }).html('<i class="fa fa-times"></i>');
                    removeBtn.on('click', () => {
                        removeBtn.prop('disabled', true);
                        jQuery.ajax({
                            url: removeLinkUrl,
                            type: 'POST',
                            contentType: 'application/json',
                            data: JSON.stringify({ link_id: item.id }),
                            success: () => {
                                onChanged();
                                this._refreshLinkList(container, taskId, removeLinkUrl, onChanged);
                            },
                            error: () => {
                                removeBtn.prop('disabled', false);
                                GanttToast.show('Failed to remove link', 'error');
                            }
                        });
                    });
                    row.append(removeBtn);
                }
                group.append(row);
            }
            container.append(group);
        }
    }

    _refreshLinkList(container, taskId, removeLinkUrl, onChanged) {
        const linksUrl = jQuery(this.options.container).data('links-url');
        const url = linksUrl + (linksUrl.includes('?') ? '&' : '?') + 'task_id=' + taskId;
        jQuery.ajax({
            url: url,
            cache: false,
            dataType: 'json',
            success: (data) => {
                this._renderLinkList(container, data.links, removeLinkUrl, taskId, onChanged);
            }
        });
    }

    _escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _bindGroupToggles() {
        jQuery(this.options.container).off('click.gantt-group').on('click.gantt-group', '.ganttview-group-header', (e) => {
            e.preventDefault();
            const groupName = jQuery(e.currentTarget).data('group-name');
            const collapsing = jQuery(e.currentTarget).find('.ganttview-group-toggle i').hasClass('fa-caret-down');

            if (collapsing) {
                this._collapseGroup(groupName);
                this.addCollapsedGroup(groupName);
            } else {
                this._expandGroup(groupName);
                this.removeCollapsedGroup(groupName);
            }

            this._updateToggleGroupsButton();
            setTimeout(() => { this.snapTodayMarker(); this.renderDependencyArrows(); }, 200);
        });
    }

    // --- Group expand/collapse helpers ---

    _collapseGroup(groupName, animate = true) {
        const container = this.options.container;
        const hide = (el) => animate ? el.slideUp(150) : el.hide();

        const header = jQuery(`.ganttview-group-header[data-group-name="${groupName}"]`, container);
        if (header.length) {
            header.find('.ganttview-group-toggle i').removeClass('fa-caret-down').addClass('fa-caret-right');
            let el = header.next();
            while (el.length && !el.hasClass('ganttview-group-header')) { hide(el); el = el.next(); }
        }

        const gridRow = jQuery(`.ganttview-group-grid-row[data-group-name="${groupName}"]`, container);
        if (gridRow.length) {
            let el = gridRow.next();
            while (el.length && !el.hasClass('ganttview-group-grid-row')) { hide(el); el = el.next(); }
        }

        const blockRow = jQuery(`.ganttview-group-block-row[data-group-name="${groupName}"]`, container);
        if (blockRow.length) {
            let el = blockRow.next();
            while (el.length && !el.hasClass('ganttview-group-block-row')) { hide(el); el = el.next(); }
        }
    }

    _expandGroup(groupName, animate = true) {
        const container = this.options.container;
        const expanded = this.getExpandedTasks();
        const isSubtaskEl = (el) => el.hasClass('ganttview-subtask-row') || el.hasClass('ganttview-subtask-grid-row') || el.hasClass('ganttview-subtask-block-row');

        const show = (el) => {
            if (isSubtaskEl(el)) {
                const parentId = el.data('parent-task');
                if (expanded.includes(parentId)) {
                    animate ? el.slideDown(150) : el.show();
                }
            } else {
                animate ? el.slideDown(150) : el.show();
            }
        };

        const header = jQuery(`.ganttview-group-header[data-group-name="${groupName}"]`, container);
        if (header.length) {
            header.find('.ganttview-group-toggle i').removeClass('fa-caret-right').addClass('fa-caret-down');
            let el = header.next();
            while (el.length && !el.hasClass('ganttview-group-header')) { show(el); el = el.next(); }
        }

        const gridRow = jQuery(`.ganttview-group-grid-row[data-group-name="${groupName}"]`, container);
        if (gridRow.length) {
            let el = gridRow.next();
            while (el.length && !el.hasClass('ganttview-group-grid-row')) { show(el); el = el.next(); }
        }

        const blockRow = jQuery(`.ganttview-group-block-row[data-group-name="${groupName}"]`, container);
        if (blockRow.length) {
            let el = blockRow.next();
            while (el.length && !el.hasClass('ganttview-group-block-row')) { show(el); el = el.next(); }
        }
    }

    _getAllGroupNames() {
        return this.data.filter(item => item.type === 'group').map(item => item.name);
    }

    _collapseAllGroups() {
        const names = this._getAllGroupNames();
        for (const name of names) this._collapseGroup(name, false);
        this.saveCollapsedGroups(names);
        this._updateToggleGroupsButton();
        this.snapTodayMarker();
        this.renderDependencyArrows();
    }

    _expandAllGroups() {
        for (const name of this._getAllGroupNames()) this._expandGroup(name, false);
        this.saveCollapsedGroups([]);
        this._updateToggleGroupsButton();
        this.snapTodayMarker();
        this.renderDependencyArrows();
    }

    _expandAllSubtasks() {
        const collapsedGroups = this.getCollapsedGroups();
        const taskIds = [];
        let currentGroup = null;

        for (const item of this.data) {
            if (item.type === 'group') { currentGroup = item.name; continue; }
            if (item.type !== 'task' || !item.subtasks || !item.subtasks.length) continue;
            taskIds.push(item.id);
            const toggle = jQuery(`.ganttview-subtask-toggle[data-task-id="${item.id}"]`, this.options.container);
            if (!toggle.length) continue;
            toggle.find('i').removeClass('fa-caret-right').addClass('fa-caret-down');
            if (!currentGroup || !collapsedGroups.includes(currentGroup)) {
                const sel = `[data-parent-task="${item.id}"]`;
                jQuery(`.ganttview-subtask-row${sel}, .ganttview-subtask-block-row${sel}, .ganttview-subtask-grid-row${sel}`, this.options.container).show();
            }
        }

        localStorage.setItem(this.getExpandedKey(), JSON.stringify(taskIds));
        this._updateToggleSubtasksButton();
        this.snapTodayMarker();
        this.renderDependencyArrows();
    }

    _collapseAllSubtasks() {
        for (const item of this.data) {
            if (item.type !== 'task' || !item.subtasks || !item.subtasks.length) continue;
            const toggle = jQuery(`.ganttview-subtask-toggle[data-task-id="${item.id}"]`, this.options.container);
            if (!toggle.length) continue;
            toggle.find('i').removeClass('fa-caret-down').addClass('fa-caret-right');
            const sel = `[data-parent-task="${item.id}"]`;
            jQuery(`.ganttview-subtask-row${sel}, .ganttview-subtask-block-row${sel}, .ganttview-subtask-grid-row${sel}`, this.options.container).hide();
        }

        localStorage.setItem(this.getExpandedKey(), JSON.stringify([]));
        this._updateToggleSubtasksButton();
        this.snapTodayMarker();
        this.renderDependencyArrows();
    }

    // --- Toggle buttons ---

    _renderToggleButtons() {
        const hasGroups = this._groupBy && this._groupBy !== 'none';
        const hasSubtasks = this.data.some(item => item.type === 'task' && item.subtasks && item.subtasks.length);

        const toolbar = jQuery('<div>', { 'class': 'ganttview-toggle-toolbar' });

        if (hasGroups) {
            const collapsed = this.getCollapsedGroups();
            const allNames = this._getAllGroupNames();
            const allCollapsed = allNames.length > 0 && allNames.every(n => collapsed.includes(n));
            toolbar.append(jQuery('<button>', {
                'class': 'gantt-toggle-btn gantt-toggle-groups',
                title: allCollapsed ? 'Expand all groups' : 'Collapse all groups'
            }).append(jQuery('<i>', { 'class': `fa ${allCollapsed ? 'fa-plus-square-o' : 'fa-minus-square-o'}` })));
        }

        if (hasSubtasks) {
            const hasAnyExpanded = this.getExpandedTasks().length > 0;
            toolbar.append(jQuery('<button>', {
                'class': 'gantt-toggle-btn gantt-toggle-subtasks',
                title: hasAnyExpanded ? 'Collapse all subtasks' : 'Expand all subtasks'
            }).append(jQuery('<i>', { 'class': `fa ${hasAnyExpanded ? 'fa-minus-square-o' : 'fa-plus-square-o'}` })));
        }

        toolbar.append(jQuery('<button>', {
            'class': 'gantt-toggle-btn gantt-scroll-today',
            title: 'Scroll to today'
        }).append(jQuery('<i>', { 'class': 'fa fa-crosshairs' })));

        jQuery('.ganttview', this.options.container).prepend(toolbar);

        toolbar.on('click', '.gantt-scroll-today', () => {
            this.scrollToToday();
        });

        toolbar.on('click', '.gantt-toggle-groups', () => {
            const icon = toolbar.find('.gantt-toggle-groups i');
            if (icon.hasClass('fa-minus-square-o')) {
                this._collapseAllGroups();
            } else {
                this._expandAllGroups();
            }
        });

        toolbar.on('click', '.gantt-toggle-subtasks', () => {
            const icon = toolbar.find('.gantt-toggle-subtasks i');
            if (icon.hasClass('fa-minus-square-o')) {
                this._collapseAllSubtasks();
            } else {
                this._expandAllSubtasks();
            }
        });
    }

    _updateToggleGroupsButton() {
        const btn = jQuery('.gantt-toggle-groups', this.options.container);
        if (!btn.length) return;
        const allNames = this._getAllGroupNames();
        const collapsed = this.getCollapsedGroups();
        const allCollapsed = allNames.length > 0 && allNames.every(n => collapsed.includes(n));
        btn.find('i').toggleClass('fa-plus-square-o', allCollapsed).toggleClass('fa-minus-square-o', !allCollapsed);
        btn.attr('title', allCollapsed ? 'Expand all groups' : 'Collapse all groups');
    }

    _updateToggleSubtasksButton() {
        const btn = jQuery('.gantt-toggle-subtasks', this.options.container);
        if (!btn.length) return;
        const hasAny = this.getExpandedTasks().length > 0;
        btn.find('i').toggleClass('fa-minus-square-o', hasAny).toggleClass('fa-plus-square-o', !hasAny);
        btn.attr('title', hasAny ? 'Collapse all subtasks' : 'Expand all subtasks');
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

    // --- Group collapse state persistence ---

    getCollapsedGroupsKey() {
        return `gantt-collapsed-groups-${this._groupBy}-${window.location.pathname}${window.location.search}`;
    }

    getCollapsedGroups() {
        try { return JSON.parse(localStorage.getItem(this.getCollapsedGroupsKey())) || []; }
        catch (e) { return []; }
    }

    saveCollapsedGroups(list) {
        localStorage.setItem(this.getCollapsedGroupsKey(), JSON.stringify(list));
    }

    addCollapsedGroup(name) {
        const list = this.getCollapsedGroups();
        if (!list.includes(name)) list.push(name);
        this.saveCollapsedGroups(list);
    }

    removeCollapsedGroup(name) {
        this.saveCollapsedGroups(this.getCollapsedGroups().filter(n => n !== name));
    }

    restoreCollapsedGroups() {
        if (!this._groupBy || this._groupBy === 'none') return;
        const collapsed = this.getCollapsedGroups();
        for (const groupName of collapsed) {
            this._collapseGroup(groupName, false);
        }
    }
}
