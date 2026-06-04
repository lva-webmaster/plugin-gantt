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

// Save record after a resize or move
Gantt.prototype.saveRecord = function(record) {
    $.ajax({
        cache: false,
        url: $(this.options.container).data("save-url"),
        contentType: "application/json",
        type: "POST",
        processData: false,
        data: JSON.stringify(record)
    });
};

// Build the Gantt chart
Gantt.prototype.show = function() {
    this.data = this.prepareData($(this.options.container).data('records'));

    var minDays = Math.floor((this.options.slideWidth / this.options.cellWidth) + 5);
    var range = this.getDateRange(minDays);
    this._startDate = range[0];
    this._endDate = range[1];
    var container = $(this.options.container);
    var chart = jQuery("<div>", { "class": "ganttview" });

    chart.append(this.renderVerticalHeader());
    chart.append(this.renderSlider(this._startDate, this._endDate));
    container.append(chart);

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
            content.append(jQuery('<strong>').text('#'+this.data[i].id+' '));
            content.append(jQuery("<a>", {"href": this.data[i].link, "title": this.data[i].title}).text(this.data[i].title));
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

    if (this.compareDate(today, startDate) < 0 || this.compareDate(today, endDate) > 0) {
        return;
    }

    var offset = this.daysBetween(startDate, today);
    var left = (offset * this.options.cellWidth) + Math.floor(this.options.cellWidth / 2);
    var height = (this.data.length * this.options.cellHeight) + 41;

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
    }

    return gridDiv;
};

// Render bar containers
Gantt.prototype.addBlockContainers = function() {
    var blocksDiv = jQuery("<div>", { "class": "ganttview-blocks" });

    for (var i = 0; i < this.data.length; i++) {
        blocksDiv.append(jQuery("<div>", { "class": "ganttview-block-container" }));
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
        var text = jQuery("<div>", {
          "class": "ganttview-block-text",
          "css": {
              "width": ((size * this.options.cellWidth) - 19) + "px"
          }
        });

        var block = jQuery("<div>", {
            "class": "ganttview-block" + (this.options.allowMoves ? " ganttview-block-movable" : ""),
            "css": {
                "width": ((size * this.options.cellWidth) - 9) + "px",
                "margin-left": (offset * this.options.cellWidth) + "px"
            }
        }).append(text);

        if (series.type === 'task') {
            this.addTaskBarText(text, series, size);
        }

        block.attr("title", this.getBarTitleText(series));
        block.data("record", series);
        this.setBarColor(block, series);

        jQuery(rows[rowIdx]).append(block);
        rowIdx = rowIdx + 1;
    }
};

Gantt.prototype.addTaskBarText = function(container, record, size) {
    var dateStr = this.formatShortDate(record.start) + ' → ' + this.formatShortDate(record.end);
    if (size >= 8) {
        container.html($('<span>').text(record.progress + ' - #' + record.id + ' ' + record.title + '  (' + dateStr + ')'));
    }
    else if (size >= 4) {
        container.html($('<span>').text(record.progress + ' - #' + record.id + ' ' + record.title));
    }
    else if (size >= 2) {
        container.html($('<span>').text(record.progress));
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
        var startStr = this.dayName(record.start) + ' ' + $.datepicker.formatDate(this.dateFormat, record.start);
        var endStr = this.dayName(record.end) + ' ' + $.datepicker.formatDate(this.dateFormat, record.end);
        parts.push(startStr + ' → ' + endStr + ' (' + days + 'd)');
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
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startDateLabel + ' ' + $.datepicker.formatDate(this.dateFormat, record.start)));
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startEndLabel + ' ' + $.datepicker.formatDate(this.dateFormat, record.end)));
    }

    return tooltip;
};

// Set bar color
Gantt.prototype.setBarColor = function(block, record) {
    block.css("background-color", record.color.background);
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

    jQuery("div.ganttview-block", this.options.container).resizable({
        grid: this.options.cellWidth,
        handles: "e,w",
        delay: 300,
        start: function(event) {
            self._lastMouseX = event.clientX;
            self.showDateIndicator(jQuery(this), self._startDate);
            self.startAutoScroll();
        },
        resize: function(event) {
            self._lastMouseX = event.clientX;
            self.updateDateIndicator(jQuery(this), self._startDate);
        },
        stop: function() {
            self.stopAutoScroll();
            self.hideDateIndicator();
            var block = jQuery(this);
            self.updateDataAndPosition(block, self._startDate);
            self.saveRecord(block.data("record"));
        }
    });
};

// Setup jquery-ui drag and drop
Gantt.prototype.listenForBlockMove = function() {
    var self = this;

    jQuery("div.ganttview-block", this.options.container).draggable({
        axis: "x",
        delay: 300,
        grid: [this.options.cellWidth, this.options.cellWidth],
        start: function(event) {
            self._lastMouseX = event.clientX;
            self.showDateIndicator(jQuery(this), self._startDate);
            self.startAutoScroll();
        },
        drag: function(event) {
            self._lastMouseX = event.clientX;
            self.updateDateIndicator(jQuery(this), self._startDate);
        },
        stop: function() {
            self.stopAutoScroll();
            self.hideDateIndicator();
            var block = jQuery(this);
            self.updateDataAndPosition(block, self._startDate);
            self.saveRecord(block.data("record"));
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

    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var scroll = container.scrollLeft();
    var offset = block.offset().left - container.offset().left - 1 + scroll;

    var daysFromStart = Math.round(offset / this.options.cellWidth);
    var newStart = this.addDays(this.cloneDate(startDate), daysFromStart);

    var width = block.outerWidth();
    var numberOfDays = Math.round(width / this.options.cellWidth) - 1;
    var newEnd = this.addDays(this.cloneDate(newStart), numberOfDays);

    var startStr = this.dayName(newStart) + ' ' + $.datepicker.formatDate(this.dateFormat, newStart);
    var endStr = this.dayName(newEnd) + ' ' + $.datepicker.formatDate(this.dateFormat, newEnd);
    var days = numberOfDays + 1;

    this._dateIndicator.text(startStr + '  →  ' + endStr + '  (' + days + 'd)');

    var rect = block[0].getBoundingClientRect();
    this._dateIndicator.css({
        left: (rect.left + rect.width / 2) + 'px',
        top: (rect.top - 36) + 'px'
    });
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
    jQuery("div.ganttview-block", this.options.container).each(function() {
        var ml = parseInt(jQuery(this).css("margin-left")) || 0;
        jQuery(this).css("margin-left", (ml + shift) + "px");
    });
};

Gantt.prototype.updateGridWidths = function() {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var gridRows = jQuery(".ganttview-grid-row", container);
    var totalCells = gridRows.first().children().length;
    var totalW = totalCells * this.options.cellWidth;
    jQuery(".ganttview-hzheader-months", container).css("width", totalW + "px");
    jQuery(".ganttview-hzheader-days", container).css("width", totalW + "px");
    jQuery(".ganttview-grid", container).css("width", totalW + "px");
    gridRows.css("width", totalW + "px");
};

// Update the record data and the position on the chart
Gantt.prototype.updateDataAndPosition = function(block, startDate) {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var scroll = container.scrollLeft();
    var offset = block.offset().left - container.offset().left - 1 + scroll;
    var record = block.data("record");

    // Restore color for defined block
    record.not_defined = false;
    this.setBarColor(block, record);

    // Set new start date
    var daysFromStart = Math.round(offset / this.options.cellWidth);
    var newStart = this.addDays(this.cloneDate(startDate), daysFromStart);
    if (!record.date_started_not_defined || this.compareDate(newStart, record.start)) {
        record.start = this.addDays(this.cloneDate(startDate), daysFromStart);
        record.date_started_not_defined = true;
    }
    else if (record.date_started_not_defined) {
        delete record.start;
    }

    // Set new end date
    var width = block.outerWidth();
    var numberOfDays = Math.round(width / this.options.cellWidth) - 1;
    var newEnd = this.addDays(this.cloneDate(newStart), numberOfDays);
    if (!record.date_due_not_defined || this.compareDate(newEnd, record.end)) {
        record.end = newEnd;
        record.date_due_not_defined = true;
    }
    else if (record.date_due_not_defined) {
        delete record.end;
    }

    if (record.type === "task" && numberOfDays > 0) {
        this.addTaskBarText(jQuery("div.ganttview-block-text", block), record, numberOfDays);
    }

    block.attr("title", this.getBarTitleText(record));
    block.data("record", record);

    // Remove top and left properties to avoid incorrect block positioning,
    // set position to relative to keep blocks relative to scrollbar when scrolling
    block
        .css("top", "")
        .css("left", "")
        .css("position", "relative")
        .css("margin-left", offset + "px");
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

    // Always start one day before the minStart
    minStart.setDate(minStart.getDate() - 1);

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
