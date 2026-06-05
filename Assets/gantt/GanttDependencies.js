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
        const nid = parseInt(taskId);
        let result = null;
        jQuery("div.ganttview-block", this.options.container).each((_, el) => {
            const rec = $(el).data("record");
            if (rec && parseInt(rec.id) === nid) {
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

        const compact = this._zoomLevel === 'week' || this._zoomLevel === 'month';
        const mW = compact ? 5 : 8;
        const mH = compact ? 4 : 6;

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const makeMarker = (id, color) => {
            const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            m.setAttribute("id", id);
            m.setAttribute("markerWidth", String(mW));
            m.setAttribute("markerHeight", String(mH));
            m.setAttribute("refX", String(mW));
            m.setAttribute("refY", String(mH / 2));
            m.setAttribute("orient", "auto");
            m.setAttribute("markerUnits", "userSpaceOnUse");
            const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            p.setAttribute("points", `0 0, ${mW} ${mH / 2}, 0 ${mH}`);
            p.style.setProperty("fill", color, "important");
            m.appendChild(p);
            return m;
        };
        defs.appendChild(makeMarker("gantt-arrow", "#555"));
        defs.appendChild(makeMarker("gantt-arrow-critical", "#ff4444"));
        defs.appendChild(makeMarker("gantt-arrow-milestone", "#8e44ad"));
        svg.appendChild(defs);

        let hasArrows = false;
        const cRect = container[0].getBoundingClientRect();
        const scrollL = container.scrollLeft();
        const scrollT = container.scrollTop();

        const getBlockCoords = (block) => {
            const rect = block[0].getBoundingClientRect();
            const left = rect.left - cRect.left + scrollL;
            const right = rect.right - cRect.left + scrollL;
            const midY = rect.top + rect.height / 2 - cRect.top + scrollT;
            return { left, right, midY };
        };

        for (const task of this.data) {
            if (task.dependencies && task.dependencies.length) {
                const fromBlock = this.getBlockElement(task.id);
                if (fromBlock && fromBlock.is(':visible')) {
                    const from = getBlockCoords(fromBlock);
                    for (const depId of task.dependencies) {
                        const toBlock = this.getBlockElement(depId);
                        if (!toBlock || !toBlock.is(':visible')) continue;
                        const to = getBlockCoords(toBlock);

                        const isCritLink = this.isOnCriticalChain && this.isOnCriticalChain(task.id) && this.isOnCriticalChain(depId);
                        const sw = isCritLink ? (compact ? 1.5 : 2.5) : (compact ? 0.75 : 1.5);
                        this._appendArrow(svg, from, to, isCritLink ? "#ff4444" : "#555", sw, isCritLink ? "gantt-arrow-critical" : "gantt-arrow");
                        hasArrows = true;
                    }
                }
            }

            if (task.milestone_sources && task.milestone_sources.length) {
                const milestoneBlock = this.getBlockElement(task.id);
                if (milestoneBlock && milestoneBlock.is(':visible')) {
                    const to = getBlockCoords(milestoneBlock);
                    for (const srcId of task.milestone_sources) {
                        const srcBlock = this.getBlockElement(srcId);
                        if (!srcBlock || !srcBlock.is(':visible')) continue;
                        const from = getBlockCoords(srcBlock);

                        this._appendArrow(svg, from, to, "#8e44ad", compact ? 1 : 2, "gantt-arrow-milestone", compact ? "4 2" : "6 3");
                        hasArrows = true;
                    }
                }
            }
        }

        if (hasArrows) {
            container.css("position", "relative");
            container.append(svg);
        }
    }

    _appendArrow(svg, from, to, color, width, markerId, dash) {
        const x1 = from.right;
        const y1 = from.midY;
        const x2 = to.left;
        const y2 = to.midY;

        const cp = Math.max(Math.abs(x2 - x1) * 0.4, 30);
        const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.style.setProperty("fill", "none", "important");
        path.style.setProperty("stroke", color, "important");
        path.style.setProperty("stroke-width", `${width}px`, "important");
        path.setAttribute("marker-end", `url(#${markerId})`);
        if (dash) path.style.setProperty("stroke-dasharray", dash, "important");
        svg.appendChild(path);
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

        for (const task of this.data) {
            if (!task.milestone_sources || !task.milestone_sources.length) continue;
            if (!task.end) continue;
            for (const srcId of task.milestone_sources) {
                const src = this._taskIndex[srcId];
                if (!src || !src.end) continue;
                if (this.compareDate(src.end, task.end) === 1) {
                    const srcBlock = this.getBlockElement(srcId);
                    if (srcBlock) srcBlock.addClass("ganttview-dep-violation");
                    const msBlock = this.getBlockElement(task.id);
                    if (msBlock) msBlock.addClass("ganttview-dep-violation");
                }
            }
        }
    }

    enforceDependencyConstraint(block) {
        const record = block.data("record");
        if (!record) return;

        const visited = new Set();

        if (record.dependencies) {
            for (const depId of record.dependencies) {
                this.enforceBlockedConstraint(depId, visited);
            }
        }

        this.enforceBlockedConstraint(record.id, visited);
        this.enforceMilestoneConstraint(record, visited);
    }

    enforceMilestoneConstraint(record, _visited) {
        if (!record.milestone_sources || !record.milestone_sources.length) return;
        if (!record.end) return;

        let latestSrcEnd = null;
        for (const srcId of record.milestone_sources) {
            const src = this._taskIndex[srcId];
            if (!src || !src.end) continue;
            if (!latestSrcEnd || this.compareDate(src.end, latestSrcEnd) === 1) {
                latestSrcEnd = src.end;
            }
        }
        if (!latestSrcEnd) return;

        if (this.compareDate(record.end, latestSrcEnd) === -1) {
            const duration = this.daysBetween(record.start, record.end);
            record.end = this.cloneDate(latestSrcEnd);
            record.start = this.addDays(this.cloneDate(record.end), -duration);

            const block = this.getBlockElement(record.id);
            if (!block) return;

            const dayIndex = this.daysBetween(this._startDate, record.start);
            const cellCount = duration + 1;
            const px = this.calcBlockPixels(dayIndex, cellCount);

            block[0].style.marginLeft = `${px.marginLeft}px`;
            block[0].style.width = `${px.width}px`;
            block.attr("title", this.getBarTitleText(record));
            block.data("record", record);
            this.saveRecord(record);

            if (record.dependencies && _visited) {
                for (const depId of record.dependencies) {
                    this.enforceBlockedConstraint(depId, _visited);
                }
            }
        }
    }

    enforceBlockedConstraint(taskId, _visited) {
        if (!_visited) _visited = new Set();
        if (_visited.has(taskId)) return;
        _visited.add(taskId);

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

            if (record.dependencies) {
                for (const depId of record.dependencies) {
                    this.enforceBlockedConstraint(depId, _visited);
                }
            }
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

    _notifyHiddenBlockers(taskId) {
        const blockers = this._blockedBy[taskId];
        if (!blockers || !blockers.length) return;

        const blockerEnd = this.getBlockerEndDate(taskId);
        if (!blockerEnd) return;

        const hidden = blockers.filter(id => {
            const b = this.getBlockElement(id);
            if (!b || b.is(':visible')) return false;
            const t = this._taskIndex[id];
            if (!t || !t.end) return false;
            return this.compareDate(t.end, blockerEnd) === 0;
        });
        if (!hidden.length) return;

        const names = hidden.map(id => {
            const t = this._taskIndex[id];
            return t ? `#${id} ${t.title}` : `#${id}`;
        });
        this.showConstraintNotice(`<i class="fa fa-eye-slash"></i> Blocked by hidden task${names.length > 1 ? 's' : ''}:<br>${names.join(', ')}`);
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
