class GanttDependencies extends GanttRenderer {

    buildDependencyIndex() {
        this._taskIndex = {};
        this._blockedBy = {};
        for (const task of this.data) {
            this._taskIndex[task.id] = task;
            if (task.dependencies) {
                for (const blockedId of task.dependencies) {
                    if (!this._blockedBy[blockedId]) this._blockedBy[blockedId] = [];
                    this._blockedBy[blockedId].push(task.id);
                }
            }
        }
    }

    getBlockElement(taskId) {
        let result = null;
        jQuery("div.ganttview-block", this.options.container).each((_, el) => {
            if ($(el).data("record") && $(el).data("record").id === taskId) {
                result = $(el);
                return false;
            }
        });
        return result;
    }

    renderDependencyArrows() {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        jQuery(".ganttview-dep-svg", container).remove();

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "ganttview-dep-svg");
        svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2";

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "gantt-arrow");
        marker.setAttribute("markerWidth", "5");
        marker.setAttribute("markerHeight", "4");
        marker.setAttribute("refX", "5");
        marker.setAttribute("refY", "2");
        marker.setAttribute("orient", "auto");
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", "0 0, 5 2, 0 4");
        polygon.setAttribute("fill", "#000");
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);

        let hasArrows = false;
        const cRect = container[0].getBoundingClientRect();

        for (const task of this.data) {
            if (!task.dependencies || !task.dependencies.length) continue;

            const fromBlock = this.getBlockElement(task.id);
            if (!fromBlock) continue;

            for (const depId of task.dependencies) {
                const toBlock = this.getBlockElement(depId);
                if (!toBlock) continue;

                const fromEl = fromBlock[0];
                const fromML = (parseInt(fromEl.style.marginLeft) || 0) + (parseInt(fromEl.style.left) || 0);
                const fromW = parseInt(fromEl.style.width) || fromBlock.outerWidth();
                const fromRect = fromEl.getBoundingClientRect();
                const fromMidY = fromRect.top + fromRect.height / 2 - cRect.top + container.scrollTop();

                const toEl = toBlock[0];
                const toML = (parseInt(toEl.style.marginLeft) || 0) + (parseInt(toEl.style.left) || 0);
                const toRect = toEl.getBoundingClientRect();
                const toMidY = toRect.top + toRect.height / 2 - cRect.top + container.scrollTop();

                const x1 = fromML + fromW;
                const y1 = fromMidY;
                const x2 = toML;
                const y2 = toMidY;

                const cp = Math.max(Math.abs(x2 - x1) * 0.4, 30);
                const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", d);
                path.setAttribute("fill", "none");
                path.setAttribute("stroke", "#000");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("marker-end", "url(#gantt-arrow)");
                svg.appendChild(path);
                hasArrows = true;
            }
        }

        if (hasArrows) {
            container.css("position", "relative");
            container.append(svg);
        }
    }

    highlightDependencyViolations() {
        jQuery("div.ganttview-block", this.options.container).removeClass("ganttview-dep-violation");
        for (const taskId in this._blockedBy) {
            const id = parseInt(taskId);
            const blockerEnd = this.getBlockerEndDate(id);
            if (!blockerEnd) continue;
            const task = this._taskIndex[id];
            if (!task) continue;
            const minStart = this.addDays(this.cloneDate(blockerEnd), 1);
            if (this.compareDate(task.start, minStart) === -1) {
                const block = this.getBlockElement(id);
                if (block) block.addClass("ganttview-dep-violation");
            }
        }
    }

    enforceDependencyConstraint(block) {
        const record = block.data("record");
        if (!record) return;

        if (record.dependencies) {
            for (const depId of record.dependencies) {
                this.enforceBlockedConstraint(depId);
            }
        }

        this.enforceBlockedConstraint(record.id);
    }

    enforceBlockedConstraint(taskId) {
        const blockerEnd = this.getBlockerEndDate(taskId);
        if (!blockerEnd) return;

        const block = this.getBlockElement(taskId);
        if (!block) return;
        const record = block.data("record");
        if (!record) return;

        const minStart = this.addDays(this.cloneDate(blockerEnd), 1);

        if (this.compareDate(record.start, minStart) === -1) {
            const duration = this.daysBetween(record.start, record.end);
            record.start = minStart;
            record.end = this.addDays(this.cloneDate(record.start), duration);

            const dayIndex = this.daysBetween(this._startDate, record.start);
            const cellCount = duration + 1;
            const px = this.calcBlockPixels(dayIndex, cellCount);

            block[0].style.marginLeft = `${px.marginLeft}px`;
            block[0].style.width = `${px.width}px`;
            block.attr("title", this.getBarTitleText(record));
            block.data("record", record);
            this.saveRecord(record);
        }
    }

    getBlockerEndDate(taskId) {
        const blockers = this._blockedBy[taskId];
        if (!blockers || !blockers.length) return null;
        let latest = null;
        for (const blockerId of blockers) {
            const blocker = this._taskIndex[blockerId];
            if (blocker && blocker.end) {
                if (!latest || this.compareDate(blocker.end, latest) === 1) {
                    latest = blocker.end;
                }
            }
        }
        return latest;
    }

    getMinDragPosition(block) {
        const record = block.data("record");
        if (!record) return null;
        const blockerEnd = this.getBlockerEndDate(record.id);
        if (!blockerEnd) return null;
        const minStart = this.addDays(this.cloneDate(blockerEnd), 1);
        const dayIndex = this.daysBetween(this._startDate, minStart);
        return this.calcBlockPixels(dayIndex, 1).marginLeft;
    }

    // --- Subtask constraint management ---

    highlightSubtaskViolations() {
        const container = jQuery(this.options.container);
        container.find(".ganttview-subtask-block").removeClass("ganttview-dep-violation");
        container.find(".ganttview-subtask-warning").remove();

        const tasksWithViolations = {};

        for (const task of this.data) {
            if (!task.subtasks || !task.subtasks.length || !task.end) continue;

            for (const sub of task.subtasks) {
                if (!sub.due_date) continue;
                const subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
                if (this.compareDate(subDate, task.end) === 1) {
                    tasksWithViolations[task.id] = true;
                    let block = null;
                    container.find(".ganttview-subtask-block").each((_, el) => {
                        const d = jQuery(el).data("subtask");
                        if (d && d.id === sub.id) { block = jQuery(el); return false; }
                    });
                    if (block) block.addClass("ganttview-dep-violation");
                }
            }
        }

        container.find(".ganttview-subtask-toggle").each((_, el) => {
            const taskId = jQuery(el).data("task-id");
            if (tasksWithViolations[taskId]) {
                jQuery(el).after(jQuery("<i>", {
                    "class": "fa fa-exclamation-triangle ganttview-subtask-warning",
                    title: "Subtask scheduled after parent task due date",
                    style: "color:#e74c3c;margin-right:3px;font-size:11px"
                }));
            }
        });
    }

    moveSubtasksWithParent(record, oldStart, oldEnd) {
        if (!record.subtasks || !record.subtasks.length) return;
        if (!oldStart || !record.start) return;

        const dayShift = this.daysBetween(oldStart, record.start);
        if (dayShift === 0 && this.compareDate(oldEnd, record.end) === 0) return;

        const container = jQuery(this.options.container);

        for (const sub of record.subtasks) {
            if (!sub.due_date) continue;

            const subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
            let newSubDate = this.addDays(this.cloneDate(subDate), dayShift);

            if (this.compareDate(newSubDate, record.end) === 1) {
                newSubDate = this.cloneDate(record.end);
            }
            if (this.compareDate(newSubDate, record.start) === -1) {
                newSubDate = this.cloneDate(record.start);
            }

            sub.due_date = [newSubDate.getFullYear(), newSubDate.getMonth() + 1, newSubDate.getDate()];

            let block = null;
            container.find(".ganttview-subtask-block").each((_, el) => {
                const d = jQuery(el).data("subtask");
                if (d && d.id === sub.id) { block = jQuery(el); return false; }
            });

            if (block) {
                const dayIndex = this.daysBetween(this._startDate, newSubDate);
                const px = this.calcBlockPixels(dayIndex, 1);
                block[0].style.marginLeft = `${px.marginLeft}px`;
                block[0].style.width = `${px.width}px`;
            }

            const dateStr = `${newSubDate.getFullYear()}-${newSubDate.getMonth() + 1}-${newSubDate.getDate()}`;
            this.saveSubtask(sub.id, dateStr);
        }
    }
}
