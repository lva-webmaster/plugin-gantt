class GanttInteraction extends GanttDependencies {

    listenForBlockResize() {
        const rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);
        jQuery("div.ganttview-block:not(.ganttview-subtask-block)", this.options.container).resizable({
            grid: [rcw, rcw],
            handles: "e,w",
            cancel: ".ganttview-block-edit",
            delay: 300,
            minWidth: rcw - 1,
            start: (event, ui) => {
                this._resizeMinLeft = this.getMinDragPosition(ui.element);
                this.showDateIndicator(ui.element, this._startDate);
            },
            resize: (event, ui) => {
                const marginLeft = parseInt(ui.element.css("margin-left")) || 0;
                let minLeft = -marginLeft;

                if (this._resizeMinLeft !== null) {
                    const depMinLeft = this._resizeMinLeft - marginLeft;
                    if (depMinLeft > minLeft) minLeft = depMinLeft;
                }
                if (ui.position.left < minLeft) {
                    ui.size.width += (ui.position.left - minLeft);
                    ui.position.left = minLeft;
                }

                const effectiveLeft = marginLeft + ui.position.left;
                const effectiveRight = effectiveLeft + ui.size.width + 1;

                const snappedLeft = this.snapToCell(effectiveLeft);
                let snappedRight = this.snapToCell(effectiveRight);
                if (snappedRight <= snappedLeft) snappedRight = snappedLeft + (this._renderedCellWidth || this.options.cellWidth);

                ui.position.left = snappedLeft - marginLeft;
                ui.size.width = snappedRight - snappedLeft - 1;

                const pos = this._cellPositions;
                let dayIndex = 0;
                let endIndex = 0;
                if (pos) {
                    for (let si = 0; si < pos.length; si++) { if (pos[si] >= snappedLeft - 1) { dayIndex = si; break; } }
                    for (let ei = dayIndex; ei < pos.length; ei++) { if (pos[ei] >= snappedRight - 1) { endIndex = ei; break; } }
                }
                let cellCount = endIndex - dayIndex;
                if (cellCount < 1) cellCount = 1;
                this.showDateIndicatorDirect(ui.element, dayIndex, cellCount, this._startDate);

                const px = this.calcBlockPixels(dayIndex, cellCount);
                const container = jQuery("div.ganttview-slide-container", this.options.container);
                const gridWidth = jQuery(".ganttview-grid-row", container).first().children().length * this.options.cellWidth;
                if (px.marginLeft + px.width > gridWidth - 2 * this.options.cellWidth) {
                    this.expandRight(14);
                }

                requestAnimationFrame(() => this.renderDependencyArrows());
            },
            stop: (event, ui) => {
                this.hideDateIndicator();
                const block = ui.element;
                const container = jQuery("div.ganttview-slide-container", this.options.container);

                const pos = this.readBlockPosition(block);
                const px = this.calcBlockPixels(pos.dayIndex, pos.cellCount);
                const gridWidth = jQuery(".ganttview-grid-row", container).first().children().length * this.options.cellWidth;
                const blockRight = px.marginLeft + px.width;
                if (blockRight > gridWidth) {
                    const daysNeeded = Math.ceil((blockRight - gridWidth) / this.options.cellWidth) + 3;
                    this.expandRight(daysNeeded);
                }

                const record = block.data("record");
                const oldStart = record ? this.cloneDate(record.start) : null;
                const oldEnd = record ? this.cloneDate(record.end) : null;
                this.updateDataAndPosition(block, this._startDate);
                this.enforceDependencyConstraint(block);
                if (record) this.moveSubtasksWithParent(record, oldStart, oldEnd);
                this.saveRecord(block.data("record"));
                this.highlightDependencyViolations();
                this.highlightSubtaskViolations();
                this.renderDependencyArrows();
            }
        });
    }

    listenForBlockMove() {
        const rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);
        jQuery("div.ganttview-block:not(.ganttview-subtask-block)", this.options.container).draggable({
            axis: "x",
            delay: 300,
            cancel: ".ganttview-block-edit",
            grid: [rcw, rcw],
            start: (event, ui) => {
                this._activeBlock = ui.helper;
                this._lastMouseX = event.clientX;
                this._dragMinLeft = this.getMinDragPosition(ui.helper);
                this.showDateIndicator(ui.helper, this._startDate);
                this.startAutoScroll();
            },
            drag: (event, ui) => {
                const marginLeft = parseInt(ui.helper.css("margin-left")) || 0;
                const effectiveLeft = marginLeft + ui.position.left;
                const snapped = this.snapToCell(effectiveLeft);
                ui.position.left = snapped - marginLeft;

                if (this._dragMinLeft !== null && snapped < this._dragMinLeft) {
                    ui.position.left = this._dragMinLeft - marginLeft;
                }
                this._lastMouseX = event.clientX;
                this.updateDateIndicator(ui.helper, this._startDate);
                this.renderDependencyArrows();
            },
            stop: (event, ui) => {
                this.stopAutoScroll();
                this.hideDateIndicator();
                this._activeBlock = null;
                const block = ui.helper;
                const record = block.data("record");
                const oldStart = record ? this.cloneDate(record.start) : null;
                const oldEnd = record ? this.cloneDate(record.end) : null;
                this.updateDataAndPosition(block, this._startDate);
                this.enforceDependencyConstraint(block);
                if (record) this.moveSubtasksWithParent(record, oldStart, oldEnd);
                this.saveRecord(block.data("record"));
                this.highlightDependencyViolations();
                this.highlightSubtaskViolations();
                this.renderDependencyArrows();
            }
        });
    }

    listenForSubtaskMove() {
        const rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);

        jQuery("div.ganttview-subtask-block", this.options.container).draggable({
            axis: "x",
            delay: 300,
            cancel: false,
            grid: [rcw, rcw],
            start: (event, ui) => {
                const parent = ui.helper.data("parent-record");
                if (parent && parent.end) {
                    const maxDayIndex = this.daysBetween(this._startDate, parent.end);
                    this._subtaskMaxLeft = this.calcBlockPixels(maxDayIndex, 1).marginLeft;
                } else {
                    this._subtaskMaxLeft = null;
                }
                this.showDateIndicator(ui.helper, this._startDate);
            },
            drag: (event, ui) => {
                const marginLeft = parseInt(ui.helper.css("margin-left")) || 0;
                const effectiveLeft = marginLeft + ui.position.left;
                let snapped = this.snapToCell(effectiveLeft);
                if (this._subtaskMaxLeft !== null && snapped > this._subtaskMaxLeft) {
                    snapped = this._subtaskMaxLeft;
                }
                ui.position.left = snapped - marginLeft;
                this.updateDateIndicator(ui.helper, this._startDate);
            },
            stop: (event, ui) => {
                this.hideDateIndicator();
                const block = ui.helper;
                const pos = this.readBlockPosition(block);
                const px = this.calcBlockPixels(pos.dayIndex, 1);

                const el = block[0];
                el.style.top = "";
                el.style.left = "";
                el.style.position = "relative";
                el.style.marginLeft = `${px.marginLeft}px`;
                el.style.width = `${px.width}px`;

                const newDate = this.addDays(this.cloneDate(this._startDate), pos.dayIndex);
                const sub = block.data("subtask");
                if (sub) {
                    sub.due_date = [newDate.getFullYear(), newDate.getMonth() + 1, newDate.getDate()];
                    const dateStr = `${newDate.getFullYear()}-${newDate.getMonth() + 1}-${newDate.getDate()}`;
                    this.saveSubtask(sub.id, dateStr);
                }
                this.highlightSubtaskViolations();
            }
        });
    }

    // --- Floating date indicator ---

    showDateIndicator(block, startDate) {
        if (!this._dateIndicator) {
            this._dateIndicator = jQuery("<div>", { "class": "ganttview-date-indicator" });
            jQuery("body").append(this._dateIndicator);
        }
        this.updateDateIndicator(block, startDate);
        this._dateIndicator.stop(true).fadeIn(120);
    }

    updateDateIndicator(block, startDate) {
        if (!this._dateIndicator) return;

        const pos = this.readBlockPosition(block);
        const newStart = this.addDays(this.cloneDate(startDate), pos.dayIndex);
        const newEnd = this.addDays(this.cloneDate(newStart), pos.cellCount - 1);

        const startStr = `${this.dayName(newStart)} ${$.datepicker.formatDate(this.dateFormat, newStart)}`;
        const endStr = `${this.dayName(newEnd)} ${$.datepicker.formatDate(this.dateFormat, newEnd)}`;

        this._dateIndicator.text(`${startStr}  →  ${endStr}  (${pos.cellCount}d)`);

        const rect = block[0].getBoundingClientRect();
        this._dateIndicator.css({
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top - 36}px`
        });
    }

    showDateIndicatorDirect(block, dayIndex, cellCount, startDate) {
        if (!this._dateIndicator) {
            this._dateIndicator = jQuery("<div>", { "class": "ganttview-date-indicator" });
            jQuery("body").append(this._dateIndicator);
        }

        const newStart = this.addDays(this.cloneDate(startDate), dayIndex);
        const newEnd = this.addDays(this.cloneDate(newStart), cellCount - 1);

        const startStr = `${this.dayName(newStart)} ${$.datepicker.formatDate(this.dateFormat, newStart)}`;
        const endStr = `${this.dayName(newEnd)} ${$.datepicker.formatDate(this.dateFormat, newEnd)}`;

        this._dateIndicator.text(`${startStr}  →  ${endStr}  (${cellCount}d)`);

        const rect = block[0].getBoundingClientRect();
        this._dateIndicator.css({
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top - 36}px`
        });
        this._dateIndicator.stop(true).fadeIn(120);
    }

    hideDateIndicator() {
        if (this._dateIndicator) {
            this._dateIndicator.stop(true).fadeOut(200);
        }
    }

    // --- Auto-scroll during drag ---

    startAutoScroll() {
        const container = jQuery("div.ganttview-slide-container", this.options.container);

        this._autoScrollTimer = setInterval(() => {
            if (this._lastMouseX === undefined) return;

            const rect = container[0].getBoundingClientRect();
            const mx = this._lastMouseX;
            const edge = 60;
            const maxSpeed = 8;
            let scrollLeft = container.scrollLeft();
            const maxScrollLeft = container[0].scrollWidth - container[0].clientWidth;

            if (mx > rect.right - edge) {
                const factor = Math.min(1, (mx - (rect.right - edge)) / edge);
                const speed = Math.ceil(maxSpeed * factor);
                if (scrollLeft >= maxScrollLeft - 5) {
                    this.expandRight(14);
                }
                container.scrollLeft(scrollLeft + speed);
            } else if (mx < rect.left + edge) {
                const factor = Math.min(1, ((rect.left + edge) - mx) / edge);
                const speed = Math.ceil(maxSpeed * factor);
                if (scrollLeft <= 5) {
                    this.expandLeft(14);
                    scrollLeft = container.scrollLeft();
                }
                container.scrollLeft(Math.max(0, scrollLeft - speed));
            }
        }, 20);
    }

    stopAutoScroll() {
        if (this._autoScrollTimer) {
            clearInterval(this._autoScrollTimer);
            this._autoScrollTimer = null;
        }
        delete this._lastMouseX;
    }
}
