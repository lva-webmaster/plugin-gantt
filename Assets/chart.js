// Based on jQuery.ganttView v.0.8.8 Copyright (c) 2010 JC Grubbs - jc.grubbs@devmynd.com - MIT License
var Gantt = function() {
    this.data = [];
    this.dateFormat = $("body").data("js-date-format") || 'yy-mm-dd';

    this.options = {
        container: "#gantt-chart",
        showWeekends: true,
        showToday: true,
        allowMoves: true,
        allowResizes: true,
        cellWidth: 21,
        cellHeight: 31,
        slideWidth: 1000,
        vHeaderWidth: 200
    };
};

// Convert a block's pixel position and width to a day index and cell count
Gantt.prototype.readBlockPosition = function(block) {
    var el = block[0];
    var pixelLeft = (parseInt(el.style.marginLeft) || 0) + (parseInt(el.style.left) || 0);
    var pixelWidth = parseInt(el.style.width) || block.outerWidth();
    var pixelRight = pixelLeft + pixelWidth + 1;

    var pos = this._cellPositions;
    if (pos && pos.length > 0) {
        var dayIndex = 0, endIndex = 0;
        var bestDist = Infinity;
        for (var i = 0; i < pos.length; i++) {
            var d = Math.abs(pos[i] - pixelLeft);
            if (d < bestDist) { bestDist = d; dayIndex = i; }
            if (pos[i] > pixelLeft + 10) break;
        }
        bestDist = Infinity;
        for (var j = dayIndex; j < pos.length; j++) {
            var d2 = Math.abs(pos[j] - pixelRight);
            if (d2 < bestDist) { bestDist = d2; endIndex = j; }
            if (pos[j] > pixelRight + 10) break;
        }
        var cellCount = endIndex - dayIndex;
        if (cellCount < 1) cellCount = 1;
        return { dayIndex: dayIndex, cellCount: cellCount };
    }

    var cw = this.options.cellWidth;
    var dayIndex2 = Math.round(pixelLeft / cw);
    var cellCount2 = Math.round((pixelWidth + 1) / cw);
    if (cellCount2 < 1) cellCount2 = 1;
    return { dayIndex: dayIndex2, cellCount: cellCount2 };
};

// Cache actual rendered cell positions after grid is in the DOM
Gantt.prototype.measureCellWidth = function() {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var cells = container.find(".ganttview-grid-row:first .ganttview-grid-row-cell");
    var cRect = container[0].getBoundingClientRect();
    var scroll = container.scrollLeft();

    this._cellPositions = [];
    for (var i = 0; i < cells.length; i++) {
        var r = cells[i].getBoundingClientRect();
        this._cellPositions.push(Math.round(r.left - cRect.left + scroll));
    }
    if (cells.length > 0) {
        var last = cells[cells.length - 1].getBoundingClientRect();
        this._cellEndPosition = Math.round(last.right - cRect.left + scroll);
    }

    if (cells.length >= 2) {
        this._renderedCellWidth = this._cellPositions[1] - this._cellPositions[0];
    } else {
        this._renderedCellWidth = this.options.cellWidth;
    }
};

// Convert a day index and cell count to pixel margin-left and width
Gantt.prototype.calcBlockPixels = function(dayIndex, cellCount) {
    var pos = this._cellPositions;
    if (pos && pos[dayIndex] !== undefined) {
        var left = pos[dayIndex];
        var endIdx = dayIndex + cellCount;
        var right = (pos[endIdx] !== undefined) ? pos[endIdx] : (pos[pos.length - 1] + this._renderedCellWidth);
        return { marginLeft: left, width: right - left - 1 };
    }
    var cw = this.options.cellWidth;
    return { marginLeft: dayIndex * cw, width: cellCount * cw - 1 };
};

// Find the nearest cell position to a pixel offset
Gantt.prototype.snapToCell = function(pixelOffset) {
    var pos = this._cellPositions;
    if (!pos || !pos.length) return pixelOffset;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < pos.length; i++) {
        var d = Math.abs(pos[i] - pixelOffset);
        if (d < bestDist) { bestDist = d; best = i; }
        if (pos[i] > pixelOffset + this.options.cellWidth) break;
    }
    return pos[best];
};

// Re-position all blocks to match actual rendered cell positions
Gantt.prototype.snapAllBlocks = function() {
    var self = this;
    jQuery("div.ganttview-block", this.options.container).each(function() {
        var block = jQuery(this);
        var record = block.data("record");
        if (record && record.start && record.end) {
            var dayIndex = self.daysBetween(self._startDate, record.start);
            var cellCount = self.daysBetween(record.start, record.end) + 1;
            var px = self.calcBlockPixels(dayIndex, cellCount);
            this.style.marginLeft = px.marginLeft + "px";
            this.style.width = px.width + "px";
            return;
        }
        var sub = block.data("subtask");
        if (sub && sub.due_date) {
            var subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
            var subIdx = self.daysBetween(self._startDate, subDate);
            var subPx = self.calcBlockPixels(subIdx, 1);
            this.style.marginLeft = subPx.marginLeft + "px";
            this.style.width = subPx.width + "px";
        }
    });
};

// Expanded subtask state persistence
Gantt.prototype.getExpandedKey = function() {
    return 'gantt-expanded-' + window.location.pathname + window.location.search;
};

Gantt.prototype.getExpandedTasks = function() {
    try { return JSON.parse(localStorage.getItem(this.getExpandedKey())) || []; }
    catch(e) { return []; }
};

Gantt.prototype.addExpandedTask = function(taskId) {
    var list = this.getExpandedTasks();
    if (list.indexOf(taskId) === -1) list.push(taskId);
    localStorage.setItem(this.getExpandedKey(), JSON.stringify(list));
};

Gantt.prototype.removeExpandedTask = function(taskId) {
    var list = this.getExpandedTasks().filter(function(id) { return id !== taskId; });
    localStorage.setItem(this.getExpandedKey(), JSON.stringify(list));
};

Gantt.prototype.restoreExpandedTasks = function() {
    var list = this.getExpandedTasks();
    for (var i = 0; i < list.length; i++) {
        var toggle = jQuery('.ganttview-subtask-toggle[data-task-id="' + list[i] + '"]', this.options.container);
        if (toggle.length) {
            toggle.find('i').removeClass('fa-caret-right').addClass('fa-caret-down');
            var sel = '[data-parent-task="' + list[i] + '"]';
            jQuery('.ganttview-subtask-row' + sel + ', .ganttview-subtask-block-row' + sel + ', .ganttview-subtask-grid-row' + sel, this.options.container).show();
        }
    }
};

// Setup draggable for subtask blocks
Gantt.prototype.listenForSubtaskMove = function() {
    var self = this;
    var rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);

    jQuery("div.ganttview-subtask-block", this.options.container).draggable({
        axis: "x",
        delay: 300,
        cancel: false,
        grid: [rcw, rcw],
        start: function() {
            var parent = jQuery(this).data("parent-record");
            if (parent && parent.end) {
                var maxDayIndex = self.daysBetween(self._startDate, parent.end);
                self._subtaskMaxLeft = self.calcBlockPixels(maxDayIndex, 1).marginLeft;
            } else {
                self._subtaskMaxLeft = null;
            }
            self.showDateIndicator(jQuery(this), self._startDate);
        },
        drag: function(event, ui) {
            var marginLeft = parseInt(jQuery(this).css("margin-left")) || 0;
            var effectiveLeft = marginLeft + ui.position.left;
            var snapped = self.snapToCell(effectiveLeft);
            if (self._subtaskMaxLeft !== null && snapped > self._subtaskMaxLeft) {
                snapped = self._subtaskMaxLeft;
            }
            ui.position.left = snapped - marginLeft;
            self.updateDateIndicator(jQuery(this), self._startDate);
        },
        stop: function() {
            self.hideDateIndicator();
            var block = jQuery(this);
            var pos = self.readBlockPosition(block);
            var px = self.calcBlockPixels(pos.dayIndex, 1);

            var el = block[0];
            el.style.top = "";
            el.style.left = "";
            el.style.position = "relative";
            el.style.marginLeft = px.marginLeft + "px";
            el.style.width = px.width + "px";

            var newDate = self.addDays(self.cloneDate(self._startDate), pos.dayIndex);
            var sub = block.data("subtask");
            if (sub) {
                sub.due_date = [newDate.getFullYear(), newDate.getMonth() + 1, newDate.getDate()];
                var dateStr = newDate.getFullYear() + '-' + (newDate.getMonth() + 1) + '-' + newDate.getDate();
                self.saveSubtask(sub.id, dateStr);
            }
            self.highlightSubtaskViolations();
        }
    });
};

Gantt.prototype.highlightSubtaskViolations = function() {
    var container = jQuery(this.options.container);
    container.find(".ganttview-subtask-block").removeClass("ganttview-dep-violation");
    container.find(".ganttview-subtask-warning").remove();

    var tasksWithViolations = {};

    for (var i = 0; i < this.data.length; i++) {
        var task = this.data[i];
        if (!task.subtasks || !task.subtasks.length || !task.end) continue;

        for (var s = 0; s < task.subtasks.length; s++) {
            var sub = task.subtasks[s];
            if (!sub.due_date) continue;
            var subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
            if (this.compareDate(subDate, task.end) === 1) {
                tasksWithViolations[task.id] = true;
                var block = null;
                container.find(".ganttview-subtask-block").each(function() {
                    var d = jQuery(this).data("subtask");
                    if (d && d.id === sub.id) { block = jQuery(this); return false; }
                });
                if (block) block.addClass("ganttview-dep-violation");
            }
        }
    }

    container.find(".ganttview-subtask-toggle").each(function() {
        var taskId = jQuery(this).data("task-id");
        if (tasksWithViolations[taskId]) {
            jQuery(this).after(jQuery("<i>", {
                "class": "fa fa-exclamation-triangle ganttview-subtask-warning",
                "title": "Subtask scheduled after parent task due date",
                "style": "color:#e74c3c;margin-right:3px;font-size:11px"
            }));
        }
    });
};

Gantt.prototype.moveSubtasksWithParent = function(record, oldStart, oldEnd) {
    if (!record.subtasks || !record.subtasks.length) return;
    if (!oldStart || !record.start) return;

    var dayShift = this.daysBetween(oldStart, record.start);
    if (dayShift === 0 && this.compareDate(oldEnd, record.end) === 0) return;

    var self = this;
    var container = jQuery(this.options.container);

    for (var i = 0; i < record.subtasks.length; i++) {
        var sub = record.subtasks[i];
        if (!sub.due_date) continue;

        var subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
        var newSubDate = this.addDays(this.cloneDate(subDate), dayShift);

        if (this.compareDate(newSubDate, record.end) === 1) {
            newSubDate = this.cloneDate(record.end);
        }
        if (this.compareDate(newSubDate, record.start) === -1) {
            newSubDate = this.cloneDate(record.start);
        }

        sub.due_date = [newSubDate.getFullYear(), newSubDate.getMonth() + 1, newSubDate.getDate()];

        var block = null;
        container.find(".ganttview-subtask-block").each(function() {
            var d = jQuery(this).data("subtask");
            if (d && d.id === sub.id) { block = jQuery(this); return false; }
        });

        if (block) {
            var dayIndex = this.daysBetween(this._startDate, newSubDate);
            var px = this.calcBlockPixels(dayIndex, 1);
            block[0].style.marginLeft = px.marginLeft + "px";
            block[0].style.width = px.width + "px";
        }

        var dateStr = newSubDate.getFullYear() + '-' + (newSubDate.getMonth() + 1) + '-' + newSubDate.getDate();
        this.saveSubtask(sub.id, dateStr);
    }
};

Gantt.prototype.saveSubtask = function(subtaskId, dueDateStr) {
    var self = this;
    $.ajax({
        cache: false,
        url: $(this.options.container).data("save-subtask-url"),
        contentType: "application/json",
        type: "POST",
        processData: false,
        data: JSON.stringify({ id: subtaskId, due_date: dueDateStr }),
        success: function() { self.showSaveStatus('Saved'); },
        error: function() { self.showSaveStatus('Save failed', true); }
    });
};

// Save record after a resize or move
Gantt.prototype.saveRecord = function(record) {
    var self = this;
    $.ajax({
        cache: false,
        url: $(this.options.container).data("save-url"),
        contentType: "application/json",
        type: "POST",
        processData: false,
        data: JSON.stringify(record),
        success: function() {
            self.showSaveStatus('Saved');
        },
        error: function() {
            self.showSaveStatus('Save failed', true);
        }
    });
};

Gantt.prototype.showSaveStatus = function(message, isError) {
    if (!this._saveIndicator) {
        this._saveIndicator = jQuery("<div>", { "class": "ganttview-save-indicator" });
        jQuery("body").append(this._saveIndicator);
    }
    this._saveIndicator
        .text(message)
        .toggleClass('error', !!isError)
        .stop(true)
        .fadeIn(100)
        .delay(1500)
        .fadeOut(400);
};

// Build the Gantt chart
Gantt.prototype.show = function() {
    this.data = this.prepareData($(this.options.container).data('records'));

    var containerWidth = $(this.options.container).width() - this.options.vHeaderWidth;
    var minDays = Math.floor(containerWidth / this.options.cellWidth) + 5;
    var range = this.getDateRange(minDays);
    this._startDate = range[0];
    this._endDate = range[1];
    var container = $(this.options.container);
    this._hasSubtaskdate = container.data('has-subtaskdate') === 1;
    var chart = jQuery("<div>", { "class": "ganttview" });

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

    if (! $(this.options.container).data('readonly')) {
        this.listenForBlockResize();
        this.listenForBlockMove();
    }
    else {
        this.options.allowResizes = false;
        this.options.allowMoves = false;
    }

    this.buildDependencyIndex();
    this.highlightDependencyViolations();
    this.renderDependencyArrows();

    var self = this;

    jQuery(this.options.container).on('click', '.ganttview-subtask-toggle', function(e) {
        e.preventDefault();
        var taskId = jQuery(this).data('task-id');
        var icon = jQuery(this).find('i');
        var expanded = icon.hasClass('fa-caret-down');
        icon.toggleClass('fa-caret-right fa-caret-down');
        var sel = '[data-parent-task="' + taskId + '"]';
        var targets = jQuery('.ganttview-subtask-row' + sel + ', .ganttview-subtask-block-row' + sel + ', .ganttview-subtask-grid-row' + sel, self.options.container);
        if (expanded) {
            targets.slideUp(150);
            self.removeExpandedTask(taskId);
        } else {
            targets.slideDown(150);
            self.addExpandedTask(taskId);
        }
        setTimeout(function() { self.snapTodayMarker(); self.renderDependencyArrows(); }, 200);
    });

    jQuery(this.options.container).on('click', '.ganttview-block-edit, .ganttview-vtheader-edit, .ganttview-subtask-edit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        KB.modal.open(this.getAttribute('href'), 'medium', false);
    });

    if (this._hasSubtaskdate) {
        this.listenForSubtaskMove();
        this.restoreExpandedTasks();
        this.highlightSubtaskViolations();
    }
    this.snapTodayMarker();
    this.renderDependencyArrows();
    var resnapTimer = null;
    window.addEventListener('resize', function() {
        clearTimeout(resnapTimer);
        resnapTimer = setTimeout(function() {
            self.measureCellWidth();
            self.snapAllBlocks();
            self.snapTodayMarker();
            self.renderDependencyArrows();
        }, 150);
    });
};

Gantt.prototype.buildDependencyIndex = function() {
    this._taskIndex = {};
    this._blockedBy = {};
    for (var i = 0; i < this.data.length; i++) {
        var task = this.data[i];
        this._taskIndex[task.id] = task;
        if (task.dependencies) {
            for (var j = 0; j < task.dependencies.length; j++) {
                var blockedId = task.dependencies[j];
                if (!this._blockedBy[blockedId]) this._blockedBy[blockedId] = [];
                this._blockedBy[blockedId].push(task.id);
            }
        }
    }
};

Gantt.prototype.getBlockElement = function(taskId) {
    var result = null;
    jQuery("div.ganttview-block", this.options.container).each(function() {
        if ($(this).data("record") && $(this).data("record").id === taskId) {
            result = $(this);
            return false;
        }
    });
    return result;
};

Gantt.prototype.renderDependencyArrows = function() {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    jQuery(".ganttview-dep-svg", container).remove();

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ganttview-dep-svg");
    svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2";

    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    var marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "gantt-arrow");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "4");
    marker.setAttribute("refX", "5");
    marker.setAttribute("refY", "2");
    marker.setAttribute("orient", "auto");
    var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 5 2, 0 4");
    polygon.setAttribute("fill", "#000");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    var self = this;
    var hasArrows = false;
    var cRect = container[0].getBoundingClientRect();
    var scroll = container.scrollLeft();

    for (var i = 0; i < this.data.length; i++) {
        var task = this.data[i];
        if (!task.dependencies || !task.dependencies.length) continue;

        var fromBlock = this.getBlockElement(task.id);
        if (!fromBlock) continue;

        for (var j = 0; j < task.dependencies.length; j++) {
            var toBlock = this.getBlockElement(task.dependencies[j]);
            if (!toBlock) continue;

            var fromEl = fromBlock[0];
            var fromML = (parseInt(fromEl.style.marginLeft) || 0) + (parseInt(fromEl.style.left) || 0);
            var fromW = parseInt(fromEl.style.width) || fromBlock.outerWidth();
            var fromRect = fromEl.getBoundingClientRect();
            var fromMidY = fromRect.top + fromRect.height / 2 - cRect.top + container.scrollTop();

            var toEl = toBlock[0];
            var toML = (parseInt(toEl.style.marginLeft) || 0) + (parseInt(toEl.style.left) || 0);
            var toRect = toEl.getBoundingClientRect();
            var toMidY = toRect.top + toRect.height / 2 - cRect.top + container.scrollTop();

            var x1 = fromML + fromW;
            var y1 = fromMidY;
            var x2 = toML;
            var y2 = toMidY;

            var cp = Math.max(Math.abs(x2 - x1) * 0.4, 30);
            var d = "M" + x1 + "," + y1
              + " C" + (x1 + cp) + "," + y1
              + " " + (x2 - cp) + "," + y2
              + " " + x2 + "," + y2;

            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
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
};

Gantt.prototype.highlightDependencyViolations = function() {
    jQuery("div.ganttview-block", this.options.container).removeClass("ganttview-dep-violation");
    for (var taskId in this._blockedBy) {
        var id = parseInt(taskId);
        var blockerEnd = this.getBlockerEndDate(id);
        if (!blockerEnd) continue;
        var task = this._taskIndex[id];
        if (!task) continue;
        var minStart = this.addDays(this.cloneDate(blockerEnd), 1);
        if (this.compareDate(task.start, minStart) === -1) {
            var block = this.getBlockElement(id);
            if (block) block.addClass("ganttview-dep-violation");
        }
    }
};

Gantt.prototype.enforceDependencyConstraint = function(block) {
    var record = block.data("record");
    if (!record) return;

    if (record.dependencies) {
        for (var i = 0; i < record.dependencies.length; i++) {
            this.enforceBlockedConstraint(record.dependencies[i]);
        }
    }

    this.enforceBlockedConstraint(record.id);
};

Gantt.prototype.enforceBlockedConstraint = function(taskId) {
    var blockerEnd = this.getBlockerEndDate(taskId);
    if (!blockerEnd) return;

    var block = this.getBlockElement(taskId);
    if (!block) return;
    var record = block.data("record");
    if (!record) return;

    var minStart = this.addDays(this.cloneDate(blockerEnd), 1);

    if (this.compareDate(record.start, minStart) === -1) {
        var duration = this.daysBetween(record.start, record.end);
        record.start = minStart;
        record.end = this.addDays(this.cloneDate(record.start), duration);

        var dayIndex = this.daysBetween(this._startDate, record.start);
        var cellCount = duration + 1;
        var px = this.calcBlockPixels(dayIndex, cellCount);

        block[0].style.marginLeft = px.marginLeft + "px";
        block[0].style.width = px.width + "px";
        block.attr("title", this.getBarTitleText(record));
        block.data("record", record);
        this.saveRecord(record);
    }
};

Gantt.prototype.getBlockerEndDate = function(taskId) {
    var blockers = this._blockedBy[taskId];
    if (!blockers || !blockers.length) return null;
    var latest = null;
    for (var i = 0; i < blockers.length; i++) {
        var blocker = this._taskIndex[blockers[i]];
        if (blocker && blocker.end) {
            if (!latest || this.compareDate(blocker.end, latest) === 1) {
                latest = blocker.end;
            }
        }
    }
    return latest;
};

Gantt.prototype.getMinDragPosition = function(block) {
    var record = block.data("record");
    if (!record) return null;
    var blockerEnd = this.getBlockerEndDate(record.id);
    if (!blockerEnd) return null;
    var minStart = this.addDays(this.cloneDate(blockerEnd), 1);
    var dayIndex = this.daysBetween(this._startDate, minStart);
    return this.calcBlockPixels(dayIndex, 1).marginLeft;
};

Gantt.prototype.infoTooltip = function(content) {
    var wrapper = $("<div>").append(content);
    var html = '<div class="markdown">' + wrapper.html() + '</div>';
    var script = $("<script>", {"type": "text/template"});
    script[0].textContent = html;
    var icon = $('<i>', {"class": "fa fa-info-circle"});
    return $('<span>', {"class": "tooltip"}).append(icon).append(script);
};

// Render record list on the left
Gantt.prototype.renderVerticalHeader = function() {
    var headerDiv = jQuery("<div>", { "class": "ganttview-vtheader" });
    var itemDiv = jQuery("<div>", { "class": "ganttview-vtheader-item" });
    var seriesDiv = jQuery("<div>", { "class": "ganttview-vtheader-series" });

    for (var i = 0; i < this.data.length; i++) {
        var content = jQuery("<span>")
            .append(this.infoTooltip(this.getVerticalHeaderTooltip(this.data[i])))
            .append("&nbsp;");

        if (this.data[i].type == "task") {
            var task = this.data[i];
            if (task.subtasks && task.subtasks.length) {
                var toggle = jQuery("<a>", {"class": "ganttview-subtask-toggle", "href": "#", "data-task-id": task.id})
                    .append(jQuery("<i>", {"class": "fa fa-caret-right"}));
                content.append(toggle);
            }
            var editUrl = task.link.replace('action=show', 'action=edit').replace('TaskViewController', 'TaskModificationController');
            content.append(jQuery("<a>", {
                "class": "ganttview-vtheader-edit js-modal-large",
                "href": editUrl,
                "title": "Edit"
            }).append(jQuery("<i>", {"class": "fa fa-edit"})));
            content.append(jQuery('<strong>').text('#'+task.id+' '));
            content.append(jQuery("<a>", {"href": task.link, "title": task.title}).text(task.title));
            if (task.assignee) {
                content.append(jQuery('<span>', {"class": "ganttview-vtheader-assignee"}).text(' — ' + task.assignee));
            }
        }
        else {
            content
                .append(jQuery("<a>", {"href": this.data[i].board_link, "title": $(this.options.container).data("label-board-link")}).append('<i class="fa fa-th"></i>'))
                .append("&nbsp;")
                .append(jQuery("<a>", {"href": this.data[i].gantt_link, "title": $(this.options.container).data("label-gantt-link")}).append('<i class="fa fa-sliders"></i>'))
                .append("&nbsp;")
                .append(jQuery("<a>", {"href": this.data[i].link}).text(this.data[i].title));
        }

        seriesDiv.append(jQuery("<div>", {"class": "ganttview-vtheader-series-name"}).append(content));

        if (this.data[i].type == "task" && this.data[i].subtasks && this.data[i].subtasks.length) {
            var subs = this.data[i].subtasks;
            var taskId = this.data[i].id;
            for (var s = 0; s < subs.length; s++) {
                var statusIcon = subs[s].status === 2 ? 'fa-check-square-o' : subs[s].status === 1 ? 'fa-minus-square-o' : 'fa-square-o';
                var subEditUrl = '/?controller=SubtaskController&action=edit&task_id=' + taskId + '&subtask_id=' + subs[s].id;
                var subContent = jQuery("<span>")
                    .append(jQuery("<a>", {
                        "class": "ganttview-vtheader-edit ganttview-subtask-edit",
                        "href": subEditUrl,
                        "title": "Edit subtask"
                    }).append(jQuery("<i>", {"class": "fa fa-edit"})))
                    .append(jQuery("<i>", {"class": "fa " + statusIcon, "style": "margin-right:4px;opacity:0.5"}))
                    .append(jQuery("<span>").text(subs[s].title));
                if (subs[s].assignee) {
                    subContent.append(jQuery('<span>', {"class": "ganttview-vtheader-assignee"}).text(' — ' + subs[s].assignee));
                }
                seriesDiv.append(jQuery("<div>", {
                    "class": "ganttview-vtheader-series-name ganttview-subtask-row",
                    "data-parent-task": taskId,
                    "style": "display:none; padding-left:24px"
                }).append(subContent));
            }
        }
    }

    itemDiv.append(seriesDiv);
    headerDiv.append(itemDiv);

    return headerDiv;
};

// Render right part of the chart (top header + grid + bars)
Gantt.prototype.renderSlider = function(startDate, endDate) {
    var slideDiv = jQuery("<div>", {"class": "ganttview-slide-container"});
    var dates = this.getDates(startDate, endDate);

    slideDiv.append(this.renderHorizontalHeader(dates));
    slideDiv.append(this.renderGrid(dates));
    slideDiv.append(this.addBlockContainers());
    this.addBlocks(slideDiv, startDate);
    this.addTodayMarker(slideDiv, startDate, endDate);

    return slideDiv;
};

Gantt.prototype.addTodayMarker = function(slider, startDate, endDate) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    this._todayOffset = null;

    if (this.compareDate(today, startDate) < 0 || this.compareDate(today, endDate) > 0) {
        return;
    }

    var offset = this.daysBetween(startDate, today);
    this._todayOffset = offset;
    var left = (offset * this.options.cellWidth) + Math.floor(this.options.cellWidth / 2);
    var height = (this.data.length * 32) + 41;

    var marker = jQuery("<div>", {
        "class": "ganttview-today-marker",
        "css": {
            "left": left + "px",
            "height": height + "px"
        },
        "title": $.datepicker.formatDate(this.dateFormat, today)
    });

    slider.append(marker);
};

Gantt.prototype.snapTodayMarker = function() {
    if (this._todayOffset === null) return;
    var marker = jQuery(".ganttview-today-marker", this.options.container);
    if (!marker.length) return;
    var px = this.calcBlockPixels(this._todayOffset, 1);
    var cw = this._renderedCellWidth || this.options.cellWidth;
    marker.css("left", (px.marginLeft + Math.floor(cw / 2)) + "px");
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    if (container.length) {
        var cRect = container[0].getBoundingClientRect();
        var blocks = jQuery(".ganttview-blocks", this.options.container);
        var bottom = blocks.length ? blocks[0].getBoundingClientRect().bottom - cRect.top : cRect.height;
        marker.css("height", bottom + "px");
    }
};

Gantt.prototype.scrollToToday = function() {
    if (this._todayOffset === null) return;
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var px = this.calcBlockPixels(this._todayOffset, 1);
    var viewWidth = container.width();
    container.scrollLeft(Math.max(0, px.marginLeft - viewWidth / 3));
};

// Render top header (days)
Gantt.prototype.renderHorizontalHeader = function(dates) {
    var headerDiv = jQuery("<div>", { "class": "ganttview-hzheader" });
    var monthsDiv = jQuery("<div>", { "class": "ganttview-hzheader-months" });
    var daysDiv = jQuery("<div>", { "class": "ganttview-hzheader-days" });
    var totalW = 0;

    for (var y in dates) {
        for (var m in dates[y]) {
            var w = dates[y][m].length * this.options.cellWidth;
            totalW = totalW + w;

            monthsDiv.append(jQuery("<div>", {
                "class": "ganttview-hzheader-month",
                "css": { "width": (w - 1) + "px" }
            }).append($.datepicker.regional[$("html").attr('lang')].monthNames[m] + " " + y));

            for (var d in dates[y][m]) {
                daysDiv.append(jQuery("<div>", { "class": "ganttview-hzheader-day" }).append(dates[y][m][d].getDate()));
            }
        }
    }

    monthsDiv.css("width", totalW + "px");
    daysDiv.css("width", totalW + "px");
    headerDiv.append(monthsDiv).append(daysDiv);

    return headerDiv;
};

// Render grid
Gantt.prototype.renderGrid = function(dates) {
    var gridDiv = jQuery("<div>", { "class": "ganttview-grid" });
    var rowDiv = jQuery("<div>", { "class": "ganttview-grid-row" });

    for (var y in dates) {
        for (var m in dates[y]) {
            for (var d in dates[y][m]) {
                var cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
                if (this.options.showWeekends && this.isWeekend(dates[y][m][d])) {
                    cellDiv.addClass("ganttview-weekend");
                }
                if (this.options.showToday && this.isToday(dates[y][m][d])) {
                    cellDiv.addClass("ganttview-today");
                }
                rowDiv.append(cellDiv);
            }
        }
    }
    var w = jQuery("div.ganttview-grid-row-cell", rowDiv).length * this.options.cellWidth;
    rowDiv.css("width", w + "px");
    gridDiv.css("width", w + "px");

    for (var i = 0; i < this.data.length; i++) {
        gridDiv.append(rowDiv.clone());
        if (this.data[i].subtasks && this.data[i].subtasks.length) {
            for (var s = 0; s < this.data[i].subtasks.length; s++) {
                var subGridRow = rowDiv.clone().addClass("ganttview-subtask-grid-row")
                    .attr("data-parent-task", this.data[i].id)
                    .css("display", "none");
                gridDiv.append(subGridRow);
            }
        }
    }

    return gridDiv;
};

// Render bar containers
Gantt.prototype.addBlockContainers = function() {
    var blocksDiv = jQuery("<div>", { "class": "ganttview-blocks" });

    for (var i = 0; i < this.data.length; i++) {
        blocksDiv.append(jQuery("<div>", { "class": "ganttview-block-container" }));
        if (this.data[i].subtasks && this.data[i].subtasks.length) {
            for (var s = 0; s < this.data[i].subtasks.length; s++) {
                blocksDiv.append(jQuery("<div>", {
                    "class": "ganttview-block-container ganttview-subtask-block-row",
                    "data-parent-task": this.data[i].id,
                    "style": "display:none"
                }));
            }
        }
    }

    return blocksDiv;
};

// Render bars
Gantt.prototype.addBlocks = function(slider, start) {
    var rows = jQuery("div.ganttview-blocks div.ganttview-block-container", slider);
    var rowIdx = 0;

    for (var i = 0; i < this.data.length; i++) {
        var series = this.data[i];
        var size = this.daysBetween(series.start, series.end) + 1;
        var offset = this.daysBetween(start, series.start);
        var px = this.calcBlockPixels(offset, size);
        var text = jQuery("<div>", {
          "class": "ganttview-block-text",
          "css": {
              "width": Math.max(0, px.width - 10) + "px"
          }
        });

        var block = jQuery("<div>", {
            "class": "ganttview-block" + (this.options.allowMoves ? " ganttview-block-movable" : ""),
            "css": {
                "width": px.width + "px",
                "margin-left": px.marginLeft + "px"
            }
        }).append(text);

        if (series.type === 'task') {
            this.addTaskBarText(text, series, size);
            var editUrl = series.link.replace('action=show', 'action=edit').replace('TaskViewController', 'TaskModificationController');
            var editBtn = jQuery("<a>", {
                "class": "ganttview-block-edit js-modal-large",
                "href": editUrl
            }).append(jQuery("<i>", { "class": "fa fa-edit" }));
            block.append(editBtn);
            if (size < 3) block.addClass("ganttview-block-narrow");
        }

        block.attr("title", this.getBarTitleText(series));
        block.data("record", series);
        this.setBarColor(block, series);

        jQuery(rows[rowIdx]).append(block);
        rowIdx = rowIdx + 1;

        if (series.subtasks && series.subtasks.length) {
            for (var s = 0; s < series.subtasks.length; s++) {
                var sub = series.subtasks[s];
                if (sub.due_date) {
                    var subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
                    var subOffset = this.daysBetween(start, subDate);
                    var subPx = this.calcBlockPixels(subOffset, 1);
                    var statusClass = sub.status === 2 ? ' ganttview-subtask-done' : sub.status === 1 ? ' ganttview-subtask-inprogress' : '';
                    var subBlock = jQuery("<div>", {
                        "class": "ganttview-block ganttview-subtask-block ganttview-block-movable" + statusClass,
                        "css": { "width": subPx.width + "px", "margin-left": subPx.marginLeft + "px" },
                        "title": sub.title + (sub.assignee ? ' (' + sub.assignee + ')' : '') + '\n' + sub.status_label + '\nDue: ' + this.dayName(subDate) + ' ' + $.datepicker.formatDate(this.dateFormat, subDate)
                    });
                    subBlock.data("subtask", sub);
                    subBlock.data("parent-record", series);
                    jQuery(rows[rowIdx]).append(subBlock);
                }
                rowIdx = rowIdx + 1;
            }
        }
    }
};

Gantt.prototype.addTaskBarText = function(container, record, size) {
    if (size >= 6) {
        container.html($('<span>').text('#' + record.id + ' ' + record.title));
    } else if (size >= 3) {
        container.html($('<span>').text('#' + record.id));
    }
};

Gantt.prototype.formatShortDate = function(date) {
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return monthNames[date.getMonth()] + ' ' + date.getDate();
};

Gantt.prototype.dayName = function(date) {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
};

Gantt.prototype.getBarTitleText = function(record) {
    var parts = [];

    if (record.type === 'task') {
        parts.push('#' + record.id + ' ' + record.title);
        parts.push(record.column_title + ' (' + record.progress + ')');
        if (record.assignee) parts.push(record.assignee);
        if (record.category) parts.push(record.category);
    } else {
        parts.push(record.title);
    }

    if (record.not_defined) {
        parts.push($(this.options.container).data("label-not-defined"));
    } else {
        var days = this.daysBetween(record.start, record.end) + 1;
        if (record.start_formatted && record.end_formatted) {
            parts.push(record.start_formatted + ' → ' + record.end_formatted + ' (' + days + 'd)');
        } else {
            var startStr = this.dayName(record.start) + ' ' + $.datepicker.formatDate(this.dateFormat, record.start);
            var endStr = this.dayName(record.end) + ' ' + $.datepicker.formatDate(this.dateFormat, record.end);
            parts.push(startStr + ' → ' + endStr + ' (' + days + 'd)');
        }
    }

    return parts.join('\n');
};

// Get tooltip for vertical header
Gantt.prototype.getVerticalHeaderTooltip = function(record) {
    if (record.type === 'task') {
        return this.getTaskTooltip(record);
    }

    return this.getProjectTooltip(record);
};

Gantt.prototype.getTaskTooltip = function(record) {
    var assigneeLabel = $(this.options.container).data("label-assignee");
    var categoryLabel = $(this.options.container).data("label-category") || "Category:";
    var priorityLabel = $(this.options.container).data("label-priority") || "Priority:";
    var tooltip = $('<span>')
        .append($('<strong>').text(record.column_title + ' (' + record.progress + ')'))
        .append($('<br>'))
        .append($('<span>').text('#' + record.id + ' ' + record.title))
        .append($('<br>'))
        .append($('<span>').text(assigneeLabel + ' ' + (record.assignee ? record.assignee : '')));

    if (record.category) {
        tooltip.append($('<br>')).append($('<span>').text(categoryLabel + ' ' + record.category));
    }

    if (record.priority) {
        tooltip.append($('<br>')).append($('<span>').text(priorityLabel + ' ' + record.priority));
    }

    return this.getTooltipFooter(record, tooltip);
};

Gantt.prototype.getProjectTooltip = function(record) {
    var tooltip = $('<span>');

    if ('project-manager' in record.users) {
        var projectManagerLabel = $(this.options.container).data('label-project-manager');
        var list = $('<ul>');

        for (var user_id in record.users['project-manager']) {
            list.append($('<li>').append($('<span>').text(record.users['project-manager'][user_id])));
        }

        tooltip.append($('<strong>').text(projectManagerLabel));
        tooltip.append($('<br>'));
        tooltip.append(list);
    }

    return this.getTooltipFooter(record, tooltip);
};

Gantt.prototype.getTooltipFooter = function(record, tooltip) {
    var notDefinedLabel = $(this.options.container).data("label-not-defined");
    var startDateLabel = $(this.options.container).data("label-start-date");
    var startEndLabel = $(this.options.container).data("label-end-date");

    if (record.not_defined) {
        tooltip.append($('<br>')).append($('<em>').text(notDefinedLabel));
    } else {
        var startText = record.start_formatted || $.datepicker.formatDate(this.dateFormat, record.start);
        var endText = record.end_formatted || $.datepicker.formatDate(this.dateFormat, record.end);
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startDateLabel + ' ' + startText));
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startEndLabel + ' ' + endText));
    }

    return tooltip;
};

// Set bar color
Gantt.prototype.setBarColor = function(block, record) {
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

    if (record.progress != "0%") {
        var progressBar = $(block).find(".ganttview-progress-bar");

        if (progressBar.length) {
            progressBar.css("width", record.progress);
        } else {
            block.append(jQuery("<div>", {
                "class": "ganttview-progress-bar",
                "css": {
                    "background-color": record.color.border,
                    "width": record.progress,
                }
            }));
        }
    }
};

// Setup jquery-ui resizable
Gantt.prototype.listenForBlockResize = function() {
    var self = this;

    var rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);
    jQuery("div.ganttview-block:not(.ganttview-subtask-block)", this.options.container).resizable({
        grid: [rcw, rcw],
        handles: "e,w",
        cancel: ".ganttview-block-edit",
        delay: 300,
        minWidth: rcw - 1,
        start: function() {
            self._resizeMinLeft = self.getMinDragPosition(jQuery(this));
            self.showDateIndicator(jQuery(this), self._startDate);
        },
        resize: function(event, ui) {
            var marginLeft = parseInt(jQuery(this).css("margin-left")) || 0;
            var minLeft = -marginLeft;

            if (self._resizeMinLeft !== null) {
                var depMinLeft = self._resizeMinLeft - marginLeft;
                if (depMinLeft > minLeft) minLeft = depMinLeft;
            }
            if (ui.position.left < minLeft) {
                ui.size.width += (ui.position.left - minLeft);
                ui.position.left = minLeft;
            }

            var effectiveLeft = marginLeft + ui.position.left;
            var effectiveRight = effectiveLeft + ui.size.width + 1;

            var snappedLeft = self.snapToCell(effectiveLeft);
            var snappedRight = self.snapToCell(effectiveRight);
            if (snappedRight <= snappedLeft) snappedRight = snappedLeft + (self._renderedCellWidth || self.options.cellWidth);

            ui.position.left = snappedLeft - marginLeft;
            ui.size.width = snappedRight - snappedLeft - 1;

            var pos = self._cellPositions;
            var dayIndex = 0, endIndex = 0;
            if (pos) {
                for (var si = 0; si < pos.length; si++) { if (pos[si] >= snappedLeft - 1) { dayIndex = si; break; } }
                for (var ei = dayIndex; ei < pos.length; ei++) { if (pos[ei] >= snappedRight - 1) { endIndex = ei; break; } }
            }
            var cellCount = endIndex - dayIndex;
            if (cellCount < 1) cellCount = 1;
            self.showDateIndicatorDirect(jQuery(this), dayIndex, cellCount, self._startDate);

            var px = self.calcBlockPixels(dayIndex, cellCount);
            var container = jQuery("div.ganttview-slide-container", self.options.container);
            var gridWidth = jQuery(".ganttview-grid-row", container).first().children().length * self.options.cellWidth;
            if (px.marginLeft + px.width > gridWidth - 2 * self.options.cellWidth) {
                self.expandRight(14);
            }

            requestAnimationFrame(function() { self.renderDependencyArrows(); });
        },
        stop: function() {
            self.hideDateIndicator();
            var block = jQuery(this);
            var container = jQuery("div.ganttview-slide-container", self.options.container);

            var pos = self.readBlockPosition(block);
            var px = self.calcBlockPixels(pos.dayIndex, pos.cellCount);
            var gridWidth = jQuery(".ganttview-grid-row", container).first().children().length * self.options.cellWidth;
            var blockRight = px.marginLeft + px.width;
            if (blockRight > gridWidth) {
                var daysNeeded = Math.ceil((blockRight - gridWidth) / self.options.cellWidth) + 3;
                self.expandRight(daysNeeded);
            }

            var record = block.data("record");
            var oldStart = record ? self.cloneDate(record.start) : null;
            var oldEnd = record ? self.cloneDate(record.end) : null;
            self.updateDataAndPosition(block, self._startDate);
            self.enforceDependencyConstraint(block);
            if (record) self.moveSubtasksWithParent(record, oldStart, oldEnd);
            self.saveRecord(block.data("record"));
            self.highlightDependencyViolations(); self.highlightSubtaskViolations();
            self.renderDependencyArrows();
        }
    });
};

// Setup jquery-ui drag and drop
Gantt.prototype.listenForBlockMove = function() {
    var self = this;

    var rcw = Math.round(this._renderedCellWidth || this.options.cellWidth);
    jQuery("div.ganttview-block:not(.ganttview-subtask-block)", this.options.container).draggable({
        axis: "x",
        delay: 300,
        cancel: ".ganttview-block-edit",
        grid: [rcw, rcw],
        start: function(event) {
            self._activeBlock = jQuery(this);
            self._lastMouseX = event.clientX;
            self._dragMinLeft = self.getMinDragPosition(jQuery(this));
            self.showDateIndicator(jQuery(this), self._startDate);
            self.startAutoScroll();
        },
        drag: function(event, ui) {
            var marginLeft = parseInt(jQuery(this).css("margin-left")) || 0;
            var effectiveLeft = marginLeft + ui.position.left;
            var snapped = self.snapToCell(effectiveLeft);
            ui.position.left = snapped - marginLeft;

            if (self._dragMinLeft !== null && snapped < self._dragMinLeft) {
                ui.position.left = self._dragMinLeft - marginLeft;
            }
            self._lastMouseX = event.clientX;
            self.updateDateIndicator(jQuery(this), self._startDate);
            self.renderDependencyArrows();
        },
        stop: function() {
            self.stopAutoScroll();
            self.hideDateIndicator();
            self._activeBlock = null;
            var block = jQuery(this);
            var record = block.data("record");
            var oldStart = record ? self.cloneDate(record.start) : null;
            var oldEnd = record ? self.cloneDate(record.end) : null;
            self.updateDataAndPosition(block, self._startDate);
            self.enforceDependencyConstraint(block);
            if (record) self.moveSubtasksWithParent(record, oldStart, oldEnd);
            self.saveRecord(block.data("record"));
            self.highlightDependencyViolations(); self.highlightSubtaskViolations();
            self.renderDependencyArrows();
        }
    });
};

// Show floating date indicator during drag/resize
Gantt.prototype.showDateIndicator = function(block, startDate) {
    if (!this._dateIndicator) {
        this._dateIndicator = jQuery("<div>", { "class": "ganttview-date-indicator" });
        jQuery("body").append(this._dateIndicator);
    }
    this.updateDateIndicator(block, startDate);
    this._dateIndicator.stop(true).fadeIn(120);
};

Gantt.prototype.updateDateIndicator = function(block, startDate) {
    if (!this._dateIndicator) return;

    var pos = this.readBlockPosition(block);
    var newStart = this.addDays(this.cloneDate(startDate), pos.dayIndex);
    var newEnd = this.addDays(this.cloneDate(newStart), pos.cellCount - 1);

    var startStr = this.dayName(newStart) + ' ' + $.datepicker.formatDate(this.dateFormat, newStart);
    var endStr = this.dayName(newEnd) + ' ' + $.datepicker.formatDate(this.dateFormat, newEnd);
    var days = pos.cellCount;

    this._dateIndicator.text(startStr + '  →  ' + endStr + '  (' + days + 'd)');

    var rect = block[0].getBoundingClientRect();
    this._dateIndicator.css({
        left: (rect.left + rect.width / 2) + 'px',
        top: (rect.top - 36) + 'px'
    });
};

Gantt.prototype.showDateIndicatorDirect = function(block, dayIndex, cellCount, startDate) {
    if (!this._dateIndicator) {
        this._dateIndicator = jQuery("<div>", { "class": "ganttview-date-indicator" });
        jQuery("body").append(this._dateIndicator);
    }

    var newStart = this.addDays(this.cloneDate(startDate), dayIndex);
    var newEnd = this.addDays(this.cloneDate(newStart), cellCount - 1);

    var startStr = this.dayName(newStart) + ' ' + $.datepicker.formatDate(this.dateFormat, newStart);
    var endStr = this.dayName(newEnd) + ' ' + $.datepicker.formatDate(this.dateFormat, newEnd);

    this._dateIndicator.text(startStr + '  →  ' + endStr + '  (' + cellCount + 'd)');

    var rect = block[0].getBoundingClientRect();
    this._dateIndicator.css({
        left: (rect.left + rect.width / 2) + 'px',
        top: (rect.top - 36) + 'px'
    });
    this._dateIndicator.stop(true).fadeIn(120);
};

Gantt.prototype.hideDateIndicator = function() {
    if (this._dateIndicator) {
        this._dateIndicator.stop(true).fadeOut(200);
    }
};

// Auto-scroll the slide container when dragging near edges
Gantt.prototype.startAutoScroll = function() {
    var self = this;
    var container = jQuery("div.ganttview-slide-container", this.options.container);

    this._autoScrollTimer = setInterval(function() {
        if (self._lastMouseX === undefined) return;

        var rect = container[0].getBoundingClientRect();
        var mx = self._lastMouseX;
        var edge = 60;
        var maxSpeed = 8;
        var scrollLeft = container.scrollLeft();
        var maxScrollLeft = container[0].scrollWidth - container[0].clientWidth;

        if (mx > rect.right - edge) {
            var factor = Math.min(1, (mx - (rect.right - edge)) / edge);
            var speed = Math.ceil(maxSpeed * factor);
            if (scrollLeft >= maxScrollLeft - 5) {
                self.expandRight(14);
            }
            container.scrollLeft(scrollLeft + speed);
        }
        else if (mx < rect.left + edge) {
            var factor = Math.min(1, ((rect.left + edge) - mx) / edge);
            var speed = Math.ceil(maxSpeed * factor);
            if (scrollLeft <= 5) {
                self.expandLeft(14);
                scrollLeft = container.scrollLeft();
            }
            container.scrollLeft(Math.max(0, scrollLeft - speed));
        }
    }, 20);
};

Gantt.prototype.stopAutoScroll = function() {
    if (this._autoScrollTimer) {
        clearInterval(this._autoScrollTimer);
        this._autoScrollTimer = null;
    }
    delete this._lastMouseX;
};

Gantt.prototype.getMonthLabel = function(date) {
    var regional = $.datepicker.regional[$("html").attr('lang')];
    var names = regional ? regional.monthNames : ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[date.getMonth()] + " " + date.getFullYear();
};

// Append date columns to the right
Gantt.prototype.expandRight = function(count) {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var monthsDiv = jQuery(".ganttview-hzheader-months", container);
    var daysDiv = jQuery(".ganttview-hzheader-days", container);
    var gridRows = jQuery(".ganttview-grid-row", container);

    for (var i = 0; i < count; i++) {
        this._endDate = this.addDays(this.cloneDate(this._endDate), 1);
        var date = this.cloneDate(this._endDate);

        daysDiv.append(jQuery("<div>", { "class": "ganttview-hzheader-day" }).text(date.getDate()));

        var cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
        if (this.isWeekend(date)) cellDiv.addClass("ganttview-weekend");
        if (this.isToday(date)) cellDiv.addClass("ganttview-today");
        gridRows.each(function() { jQuery(this).append(cellDiv.clone()); });

        var label = this.getMonthLabel(date);
        var lastMonth = monthsDiv.children().last();
        if (lastMonth.length && lastMonth.text().trim() === label) {
            lastMonth.css("width", (parseInt(lastMonth.css("width")) + this.options.cellWidth) + "px");
        } else {
            monthsDiv.append(jQuery("<div>", {
                "class": "ganttview-hzheader-month",
                "css": { "width": (this.options.cellWidth - 1) + "px" }
            }).text(label));
        }
    }
    this.updateGridWidths();
    this.measureCellWidth();
};

// Prepend date columns to the left
Gantt.prototype.expandLeft = function(count) {
    var self = this;
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var monthsDiv = jQuery(".ganttview-hzheader-months", container);
    var daysDiv = jQuery(".ganttview-hzheader-days", container);
    var gridRows = jQuery(".ganttview-grid-row", container);

    for (var i = 0; i < count; i++) {
        this._startDate = this.addDays(this._startDate, -1);
        var date = this.cloneDate(this._startDate);

        daysDiv.prepend(jQuery("<div>", { "class": "ganttview-hzheader-day" }).text(date.getDate()));

        var cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
        if (this.isWeekend(date)) cellDiv.addClass("ganttview-weekend");
        if (this.isToday(date)) cellDiv.addClass("ganttview-today");
        gridRows.each(function() { jQuery(this).prepend(cellDiv.clone()); });

        var label = this.getMonthLabel(date);
        var firstMonth = monthsDiv.children().first();
        if (firstMonth.length && firstMonth.text().trim() === label) {
            firstMonth.css("width", (parseInt(firstMonth.css("width")) + this.options.cellWidth) + "px");
        } else {
            monthsDiv.prepend(jQuery("<div>", {
                "class": "ganttview-hzheader-month",
                "css": { "width": (this.options.cellWidth - 1) + "px" }
            }).text(label));
        }
    }
    this.updateGridWidths();

    var shift = count * this.options.cellWidth;
    container.scrollLeft(container.scrollLeft() + shift);
    var activeEl = this._activeBlock ? this._activeBlock[0] : null;
    jQuery("div.ganttview-block", this.options.container).each(function() {
        if (this === activeEl) return;
        var ml = parseInt(jQuery(this).css("margin-left")) || 0;
        jQuery(this).css("margin-left", (ml + shift) + "px");
    });
};

Gantt.prototype.updateGridWidths = function() {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var gridRows = jQuery(".ganttview-grid-row", container);
    var totalCells = gridRows.first().children().length;
    var totalW = totalCells * this.options.cellWidth + 1;
    jQuery(".ganttview-hzheader-months", container).css("width", totalW + "px");
    jQuery(".ganttview-hzheader-days", container).css("width", totalW + "px");
    jQuery(".ganttview-grid", container).css("width", totalW + "px");
    gridRows.css("width", totalW + "px");
};

// Update the record data and the position on the chart
Gantt.prototype.updateDataAndPosition = function(block, startDate) {
    var record = block.data("record");
    var pos = this.readBlockPosition(block);
    var px = this.calcBlockPixels(pos.dayIndex, pos.cellCount);

    record.not_defined = false;
    this.setBarColor(block, record);

    record.start = this.addDays(this.cloneDate(startDate), pos.dayIndex);
    record.end = this.addDays(this.cloneDate(record.start), pos.cellCount - 1);
    record.date_started_not_defined = false;
    record.date_due_not_defined = false;

    if (record.type === "task") {
        var textEl = jQuery("div.ganttview-block-text", block);
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

    var el = block[0];
    el.style.top = "";
    el.style.left = "";
    el.style.position = "relative";
    el.style.marginLeft = px.marginLeft + "px";
    el.style.width = px.width + "px";
};

// Creates a 3 dimensional array [year][month][day] of every day
// between the given start and end dates
Gantt.prototype.getDates = function(start, end) {
    var dates = [];
    dates[start.getFullYear()] = [];
    dates[start.getFullYear()][start.getMonth()] = [start];
    var last = start;

    while (this.compareDate(last, end) == -1) {
        var next = this.addDays(this.cloneDate(last), 1);

        if (! dates[next.getFullYear()]) {
            dates[next.getFullYear()] = [];
        }

        if (! dates[next.getFullYear()][next.getMonth()]) {
            dates[next.getFullYear()][next.getMonth()] = [];
        }

        dates[next.getFullYear()][next.getMonth()].push(next);
        last = next;
    }

    return dates;
};

// Convert data to Date object
Gantt.prototype.prepareData = function(data) {
    for (var i = 0; i < data.length; i++) {
        var start = new Date(data[i].start[0], data[i].start[1] - 1, data[i].start[2], 0, 0, 0, 0);
        data[i].start = start;

        var end = new Date(data[i].end[0], data[i].end[1] - 1, data[i].end[2], 0, 0, 0, 0);
        data[i].end = end;
    }

    return data;
};

// Get the start and end date from the data provided
Gantt.prototype.getDateRange = function(minDays) {
    var minStart = new Date();
    var maxEnd = new Date();

    for (var i = 0; i < this.data.length; i++) {
        var start = new Date();
        start.setTime(Date.parse(this.data[i].start));

        var end = new Date();
        end.setTime(Date.parse(this.data[i].end));

        if (i == 0) {
            minStart = start;
            maxEnd = end;
        }

        if (this.compareDate(minStart, start) == 1) {
            minStart = start;
        }

        if (this.compareDate(maxEnd, end) == -1) {
            maxEnd = end;
        }
    }

    // Insure that the width of the chart is at least the slide width to avoid empty
    // whitespace to the right of the grid
    if (this.daysBetween(minStart, maxEnd) < minDays) {
        maxEnd = this.addDays(this.cloneDate(minStart), minDays);
    }

    // Start a week before the minStart to give room for resizing
    minStart.setDate(minStart.getDate() - 7);

    return [minStart, maxEnd];
};

// Returns the number of day between 2 dates
Gantt.prototype.daysBetween = function(start, end) {
    if (! start || ! end) {
        return 0;
    }

    var count = 0, date = this.cloneDate(start);

    while (this.compareDate(date, end) == -1) {
        count = count + 1;
        this.addDays(date, 1);
    }

    return count;
};

// Return true if it's the weekend
Gantt.prototype.isWeekend = function(date) {
    return date.getDay() % 6 == 0;
};

// Return true if it's today
Gantt.prototype.isToday = function(date) {
   var today = new Date();
   return today.toDateString() == date.toDateString();
 };

// Clone Date object
Gantt.prototype.cloneDate = function(date) {
    return new Date(date.getTime());
};

// Add days to a Date object
Gantt.prototype.addDays = function(date, value) {
    date.setDate(date.getDate() + value * 1);
    return date;
};

/**
 * Compares the first date to the second date and returns an number indication of their relative values.
 *
 * -1 = date1 is lessthan date2
 * 0 = values are equal
 * 1 = date1 is greaterthan date2.
 */
Gantt.prototype.compareDate = function(date1, date2) {
    if (isNaN(date1) || isNaN(date2)) {
        throw new Error(date1 + " - " + date2);
    } else if (date1 instanceof Date && date2 instanceof Date) {
        return (date1 < date2) ? -1 : (date1 > date2) ? 1 : 0;
    } else {
        throw new TypeError(date1 + " - " + date2);
    }
};
