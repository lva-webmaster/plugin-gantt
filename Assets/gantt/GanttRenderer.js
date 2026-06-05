class GanttRenderer extends GanttBase {

    renderVerticalHeader() {
        const headerDiv = jQuery("<div>", { "class": "ganttview-vtheader" });
        const itemDiv = jQuery("<div>", { "class": "ganttview-vtheader-item" });
        const seriesDiv = jQuery("<div>", { "class": "ganttview-vtheader-series" });

        for (const item of this.data) {
            const content = jQuery("<span>")
                .append(this.infoTooltip(this.getVerticalHeaderTooltip(item)))
                .append("&nbsp;");

            if (item.type === "task") {
                if (item.subtasks && item.subtasks.length) {
                    const toggle = jQuery("<a>", { "class": "ganttview-subtask-toggle", href: "#", "data-task-id": item.id })
                        .append(jQuery("<i>", { "class": "fa fa-caret-right" }));
                    content.append(toggle);
                }
                const editUrl = item.link.replace('action=show', 'action=edit').replace('TaskViewController', 'TaskModificationController');
                content.append(jQuery("<a>", {
                    "class": "ganttview-vtheader-edit js-modal-large",
                    href: editUrl,
                    title: "Edit"
                }).append(jQuery("<i>", { "class": "fa fa-edit" })));
                content.append(jQuery('<strong>').text(`#${item.id} `));
                content.append(jQuery("<a>", { href: item.link, title: item.title }).text(item.title));
                if (item.assignee) {
                    content.append(jQuery('<span>', { "class": "ganttview-vtheader-assignee" }).text(` — ${item.assignee}`));
                }
            } else {
                content
                    .append(jQuery("<a>", { href: item.board_link, title: $(this.options.container).data("label-board-link") }).append('<i class="fa fa-th"></i>'))
                    .append("&nbsp;")
                    .append(jQuery("<a>", { href: item.gantt_link, title: $(this.options.container).data("label-gantt-link") }).append('<i class="fa fa-sliders"></i>'))
                    .append("&nbsp;")
                    .append(jQuery("<a>", { href: item.link }).text(item.title));
            }

            seriesDiv.append(jQuery("<div>", { "class": "ganttview-vtheader-series-name" }).append(content));

            if (item.type === "task" && item.subtasks && item.subtasks.length) {
                for (const sub of item.subtasks) {
                    const statusIcon = sub.status === 2 ? 'fa-check-square-o' : sub.status === 1 ? 'fa-minus-square-o' : 'fa-square-o';
                    const subEditUrl = `/?controller=SubtaskController&action=edit&task_id=${item.id}&subtask_id=${sub.id}`;
                    const subContent = jQuery("<span>")
                        .append(jQuery("<a>", {
                            "class": "ganttview-vtheader-edit ganttview-subtask-edit",
                            href: subEditUrl,
                            title: "Edit subtask"
                        }).append(jQuery("<i>", { "class": "fa fa-edit" })))
                        .append(jQuery("<i>", { "class": `fa ${statusIcon}`, style: "margin-right:4px;opacity:0.5" }))
                        .append(jQuery("<span>").text(sub.title));
                    if (sub.assignee) {
                        subContent.append(jQuery('<span>', { "class": "ganttview-vtheader-assignee" }).text(` — ${sub.assignee}`));
                    }
                    seriesDiv.append(jQuery("<div>", {
                        "class": "ganttview-vtheader-series-name ganttview-subtask-row",
                        "data-parent-task": item.id,
                        style: "display:none; padding-left:24px"
                    }).append(subContent));
                }
            }
        }

        itemDiv.append(seriesDiv);
        headerDiv.append(itemDiv);
        return headerDiv;
    }

    renderSlider(startDate, endDate) {
        const slideDiv = jQuery("<div>", { "class": "ganttview-slide-container" });
        const dates = this.getDates(startDate, endDate);

        slideDiv.append(this.renderHorizontalHeader(dates));
        slideDiv.append(this.renderGrid(dates));
        slideDiv.append(this.addBlockContainers());
        this.addBlocks(slideDiv, startDate);
        this.addTodayMarker(slideDiv, startDate, endDate);

        return slideDiv;
    }

    renderHorizontalHeader(dates) {
        const headerDiv = jQuery("<div>", { "class": "ganttview-hzheader" });
        const monthsDiv = jQuery("<div>", { "class": "ganttview-hzheader-months" });
        const daysDiv = jQuery("<div>", { "class": "ganttview-hzheader-days" });
        let totalW = 0;

        for (const y in dates) {
            for (const m in dates[y]) {
                const w = dates[y][m].length * this.options.cellWidth;
                totalW += w;

                monthsDiv.append(jQuery("<div>", {
                    "class": "ganttview-hzheader-month",
                    css: { width: `${w - 1}px` }
                }).append(`${$.datepicker.regional[$("html").attr('lang')].monthNames[m]} ${y}`));

                for (const date of dates[y][m]) {
                    daysDiv.append(jQuery("<div>", { "class": "ganttview-hzheader-day" }).append(date.getDate()));
                }
            }
        }

        monthsDiv.css("width", `${totalW}px`);
        daysDiv.css("width", `${totalW}px`);
        headerDiv.append(monthsDiv).append(daysDiv);
        return headerDiv;
    }

    renderGrid(dates) {
        const gridDiv = jQuery("<div>", { "class": "ganttview-grid" });
        const rowDiv = jQuery("<div>", { "class": "ganttview-grid-row" });

        for (const y in dates) {
            for (const m in dates[y]) {
                for (const date of dates[y][m]) {
                    const cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
                    if (this.options.showWeekends && this.isWeekend(date)) {
                        cellDiv.addClass("ganttview-weekend");
                    }
                    if (this.options.showToday && this.isToday(date)) {
                        cellDiv.addClass("ganttview-today");
                    }
                    rowDiv.append(cellDiv);
                }
            }
        }
        const w = jQuery("div.ganttview-grid-row-cell", rowDiv).length * this.options.cellWidth;
        rowDiv.css("width", `${w}px`);
        gridDiv.css("width", `${w}px`);

        for (const item of this.data) {
            gridDiv.append(rowDiv.clone());
            if (item.subtasks && item.subtasks.length) {
                for (const sub of item.subtasks) {
                    const subGridRow = rowDiv.clone().addClass("ganttview-subtask-grid-row")
                        .attr("data-parent-task", item.id)
                        .css("display", "none");
                    gridDiv.append(subGridRow);
                }
            }
        }

        return gridDiv;
    }

    addBlockContainers() {
        const blocksDiv = jQuery("<div>", { "class": "ganttview-blocks" });

        for (const item of this.data) {
            blocksDiv.append(jQuery("<div>", { "class": "ganttview-block-container" }));
            if (item.subtasks && item.subtasks.length) {
                for (const sub of item.subtasks) {
                    blocksDiv.append(jQuery("<div>", {
                        "class": "ganttview-block-container ganttview-subtask-block-row",
                        "data-parent-task": item.id,
                        style: "display:none"
                    }));
                }
            }
        }

        return blocksDiv;
    }

    addBlocks(slider, start) {
        const rows = jQuery("div.ganttview-blocks div.ganttview-block-container", slider);
        let rowIdx = 0;

        for (const series of this.data) {
            const size = this.daysBetween(series.start, series.end) + 1;
            const offset = this.daysBetween(start, series.start);
            const px = this.calcBlockPixels(offset, size);
            const text = jQuery("<div>", {
                "class": "ganttview-block-text",
                css: { width: `${Math.max(0, px.width - 10)}px` }
            });

            const block = jQuery("<div>", {
                "class": `ganttview-block${this.options.allowMoves ? " ganttview-block-movable" : ""}`,
                css: {
                    width: `${px.width}px`,
                    "margin-left": `${px.marginLeft}px`
                }
            }).append(text);

            if (series.type === 'task') {
                this.addTaskBarText(text, series, size);
                const editUrl = series.link.replace('action=show', 'action=edit').replace('TaskViewController', 'TaskModificationController');
                const editBtn = jQuery("<a>", {
                    "class": "ganttview-block-edit js-modal-large",
                    href: editUrl
                }).append(jQuery("<i>", { "class": "fa fa-edit" }));
                block.append(editBtn);
                if (size < 3) block.addClass("ganttview-block-narrow");
            }

            block.attr("title", this.getBarTitleText(series));
            block.data("record", series);
            this.setBarColor(block, series);

            jQuery(rows[rowIdx]).append(block);
            rowIdx++;

            if (series.subtasks && series.subtasks.length) {
                for (const sub of series.subtasks) {
                    if (sub.due_date) {
                        const subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
                        const subOffset = this.daysBetween(start, subDate);
                        const subPx = this.calcBlockPixels(subOffset, 1);
                        const statusClass = sub.status === 2 ? ' ganttview-subtask-done' : sub.status === 1 ? ' ganttview-subtask-inprogress' : '';
                        const subTitle = `${sub.title}${sub.assignee ? ` (${sub.assignee})` : ''}\n${sub.status_label}\nDue: ${this.dayName(subDate)} ${$.datepicker.formatDate(this.dateFormat, subDate)}`;
                        const subBlock = jQuery("<div>", {
                            "class": `ganttview-block ganttview-subtask-block ganttview-block-movable${statusClass}`,
                            css: { width: `${subPx.width}px`, "margin-left": `${subPx.marginLeft}px` },
                            title: subTitle
                        });
                        subBlock.data("subtask", sub);
                        subBlock.data("parent-record", series);
                        jQuery(rows[rowIdx]).append(subBlock);
                    }
                    rowIdx++;
                }
            }
        }
    }

    addTodayMarker(slider, startDate, endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this._todayOffset = null;

        if (this.compareDate(today, startDate) < 0 || this.compareDate(today, endDate) > 0) {
            return;
        }

        const offset = this.daysBetween(startDate, today);
        this._todayOffset = offset;
        const left = (offset * this.options.cellWidth) + Math.floor(this.options.cellWidth / 2);
        const height = (this.data.length * 32) + 41;

        const marker = jQuery("<div>", {
            "class": "ganttview-today-marker",
            css: {
                left: `${left}px`,
                height: `${height}px`
            },
            title: $.datepicker.formatDate(this.dateFormat, today)
        });

        slider.append(marker);
    }

    snapTodayMarker() {
        if (this._todayOffset === null) return;
        const marker = jQuery(".ganttview-today-marker", this.options.container);
        if (!marker.length) return;
        const px = this.calcBlockPixels(this._todayOffset, 1);
        const cw = this._renderedCellWidth || this.options.cellWidth;
        marker.css("left", `${px.marginLeft + Math.floor(cw / 2)}px`);
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        if (container.length) {
            const cRect = container[0].getBoundingClientRect();
            const blocks = jQuery(".ganttview-blocks", this.options.container);
            const bottom = blocks.length ? blocks[0].getBoundingClientRect().bottom - cRect.top : cRect.height;
            marker.css("height", `${bottom}px`);
        }
    }

    scrollToToday() {
        if (this._todayOffset === null) return;
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        const px = this.calcBlockPixels(this._todayOffset, 1);
        const viewWidth = container.width();
        container.scrollLeft(Math.max(0, px.marginLeft - viewWidth / 3));
    }

    // --- Bar text and tooltips ---

    addTaskBarText(container, record, size) {
        if (size >= 6) {
            container.html($('<span>').text(`#${record.id} ${record.title}`));
        } else if (size >= 3) {
            container.html($('<span>').text(`#${record.id}`));
        }
    }

    getBarTitleText(record) {
        const parts = [];

        if (record.type === 'task') {
            parts.push(`#${record.id} ${record.title}`);
            parts.push(`${record.column_title} (${record.progress})`);
            if (record.assignee) parts.push(record.assignee);
            if (record.category) parts.push(record.category);
        } else {
            parts.push(record.title);
        }

        if (record.not_defined) {
            parts.push($(this.options.container).data("label-not-defined"));
        } else {
            const days = this.daysBetween(record.start, record.end) + 1;
            if (record.start_formatted && record.end_formatted) {
                parts.push(`${record.start_formatted} → ${record.end_formatted} (${days}d)`);
            } else {
                const startStr = `${this.dayName(record.start)} ${$.datepicker.formatDate(this.dateFormat, record.start)}`;
                const endStr = `${this.dayName(record.end)} ${$.datepicker.formatDate(this.dateFormat, record.end)}`;
                parts.push(`${startStr} → ${endStr} (${days}d)`);
            }
        }

        return parts.join('\n');
    }

    infoTooltip(content) {
        const wrapper = $("<div>").append(content);
        const html = `<div class="markdown">${wrapper.html()}</div>`;
        const script = $("<script>", { type: "text/template" });
        script[0].textContent = html;
        const icon = $('<i>', { "class": "fa fa-info-circle" });
        return $('<span>', { "class": "tooltip" }).append(icon).append(script);
    }

    getVerticalHeaderTooltip(record) {
        if (record.type === 'task') {
            return this.getTaskTooltip(record);
        }
        return this.getProjectTooltip(record);
    }

    getTaskTooltip(record) {
        const assigneeLabel = $(this.options.container).data("label-assignee");
        const categoryLabel = $(this.options.container).data("label-category") || "Category:";
        const priorityLabel = $(this.options.container).data("label-priority") || "Priority:";
        const tooltip = $('<span>')
            .append($('<strong>').text(`${record.column_title} (${record.progress})`))
            .append($('<br>'))
            .append($('<span>').text(`#${record.id} ${record.title}`))
            .append($('<br>'))
            .append($('<span>').text(`${assigneeLabel} ${record.assignee || ''}`));

        if (record.category) {
            tooltip.append($('<br>')).append($('<span>').text(`${categoryLabel} ${record.category}`));
        }
        if (record.priority) {
            tooltip.append($('<br>')).append($('<span>').text(`${priorityLabel} ${record.priority}`));
        }

        return this.getTooltipFooter(record, tooltip);
    }

    getProjectTooltip(record) {
        const tooltip = $('<span>');

        if ('project-manager' in record.users) {
            const projectManagerLabel = $(this.options.container).data('label-project-manager');
            const list = $('<ul>');

            for (const name of Object.values(record.users['project-manager'])) {
                list.append($('<li>').append($('<span>').text(name)));
            }

            tooltip.append($('<strong>').text(projectManagerLabel));
            tooltip.append($('<br>'));
            tooltip.append(list);
        }

        return this.getTooltipFooter(record, tooltip);
    }

    getTooltipFooter(record, tooltip) {
        const notDefinedLabel = $(this.options.container).data("label-not-defined");
        const startDateLabel = $(this.options.container).data("label-start-date");
        const startEndLabel = $(this.options.container).data("label-end-date");

        if (record.not_defined) {
            tooltip.append($('<br>')).append($('<em>').text(notDefinedLabel));
        } else {
            const startText = record.start_formatted || $.datepicker.formatDate(this.dateFormat, record.start);
            const endText = record.end_formatted || $.datepicker.formatDate(this.dateFormat, record.end);
            tooltip.append($('<br>'));
            tooltip.append($('<strong>').text(`${startDateLabel} ${startText}`));
            tooltip.append($('<br>'));
            tooltip.append($('<strong>').text(`${startEndLabel} ${endText}`));
        }

        return tooltip;
    }

    // --- Bar styling and data sync ---

    setBarColor(block, record) {
        block.css("background-color", record.color.border);
        block.css("border-color", record.color.border);

        if (record.not_defined) {
            if (record.date_started_not_defined) {
                block.css("border-left", "2px solid #000");
            }
            if (record.date_due_not_defined) {
                block.css("border-right", "2px solid #000");
            }
        }

        if (record.progress !== "0%") {
            const progressBar = $(block).find(".ganttview-progress-bar");

            if (progressBar.length) {
                progressBar.css("width", record.progress);
            } else {
                block.append(jQuery("<div>", {
                    "class": "ganttview-progress-bar",
                    css: {
                        "background-color": record.color.border,
                        width: record.progress
                    }
                }));
            }
        }
    }

    updateDataAndPosition(block, startDate) {
        const record = block.data("record");
        const pos = this.readBlockPosition(block);
        const px = this.calcBlockPixels(pos.dayIndex, pos.cellCount);

        record.not_defined = false;
        this.setBarColor(block, record);

        record.start = this.addDays(this.cloneDate(startDate), pos.dayIndex);
        record.end = this.addDays(this.cloneDate(record.start), pos.cellCount - 1);
        record.date_started_not_defined = false;
        record.date_due_not_defined = false;

        if (record.type === "task") {
            const textEl = jQuery("div.ganttview-block-text", block);
            textEl.empty();
            this.addTaskBarText(textEl, record, pos.cellCount);
            if (pos.cellCount < 3) {
                block.addClass("ganttview-block-narrow");
            } else {
                block.removeClass("ganttview-block-narrow");
            }
        }

        block.attr("title", this.getBarTitleText(record));
        block.data("record", record);

        const el = block[0];
        el.style.top = "";
        el.style.left = "";
        el.style.position = "relative";
        el.style.marginLeft = `${px.marginLeft}px`;
        el.style.width = `${px.width}px`;
    }

    // --- Grid expansion ---

    getMonthLabel(date) {
        const regional = $.datepicker.regional[$("html").attr('lang')];
        const names = regional ? regional.monthNames : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${names[date.getMonth()]} ${date.getFullYear()}`;
    }

    expandRight(count) {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        const monthsDiv = jQuery(".ganttview-hzheader-months", container);
        const daysDiv = jQuery(".ganttview-hzheader-days", container);
        const gridRows = jQuery(".ganttview-grid-row", container);

        for (let i = 0; i < count; i++) {
            this._endDate = this.addDays(this.cloneDate(this._endDate), 1);
            const date = this.cloneDate(this._endDate);

            daysDiv.append(jQuery("<div>", { "class": "ganttview-hzheader-day" }).text(date.getDate()));

            const cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
            if (this.isWeekend(date)) cellDiv.addClass("ganttview-weekend");
            if (this.isToday(date)) cellDiv.addClass("ganttview-today");
            gridRows.each((_, el) => jQuery(el).append(cellDiv.clone()));

            const label = this.getMonthLabel(date);
            const lastMonth = monthsDiv.children().last();
            if (lastMonth.length && lastMonth.text().trim() === label) {
                lastMonth.css("width", `${parseInt(lastMonth.css("width")) + this.options.cellWidth}px`);
            } else {
                monthsDiv.append(jQuery("<div>", {
                    "class": "ganttview-hzheader-month",
                    css: { width: `${this.options.cellWidth - 1}px` }
                }).text(label));
            }
        }
        this.updateGridWidths();
        this.measureCellWidth();
    }

    expandLeft(count) {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        const monthsDiv = jQuery(".ganttview-hzheader-months", container);
        const daysDiv = jQuery(".ganttview-hzheader-days", container);
        const gridRows = jQuery(".ganttview-grid-row", container);

        for (let i = 0; i < count; i++) {
            this._startDate = this.addDays(this._startDate, -1);
            const date = this.cloneDate(this._startDate);

            daysDiv.prepend(jQuery("<div>", { "class": "ganttview-hzheader-day" }).text(date.getDate()));

            const cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
            if (this.isWeekend(date)) cellDiv.addClass("ganttview-weekend");
            if (this.isToday(date)) cellDiv.addClass("ganttview-today");
            gridRows.each((_, el) => jQuery(el).prepend(cellDiv.clone()));

            const label = this.getMonthLabel(date);
            const firstMonth = monthsDiv.children().first();
            if (firstMonth.length && firstMonth.text().trim() === label) {
                firstMonth.css("width", `${parseInt(firstMonth.css("width")) + this.options.cellWidth}px`);
            } else {
                monthsDiv.prepend(jQuery("<div>", {
                    "class": "ganttview-hzheader-month",
                    css: { width: `${this.options.cellWidth - 1}px` }
                }).text(label));
            }
        }
        this.updateGridWidths();

        const shift = count * this.options.cellWidth;
        container.scrollLeft(container.scrollLeft() + shift);
        const activeEl = this._activeBlock ? this._activeBlock[0] : null;
        jQuery("div.ganttview-block", this.options.container).each((_, el) => {
            if (el === activeEl) return;
            const ml = parseInt(jQuery(el).css("margin-left")) || 0;
            jQuery(el).css("margin-left", `${ml + shift}px`);
        });
    }

    updateGridWidths() {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        const gridRows = jQuery(".ganttview-grid-row", container);
        const totalCells = gridRows.first().children().length;
        const totalW = totalCells * this.options.cellWidth + 1;
        jQuery(".ganttview-hzheader-months", container).css("width", `${totalW}px`);
        jQuery(".ganttview-hzheader-days", container).css("width", `${totalW}px`);
        jQuery(".ganttview-grid", container).css("width", `${totalW}px`);
        gridRows.css("width", `${totalW}px`);
    }
}
