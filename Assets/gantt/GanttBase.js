// Based on jQuery.ganttView v.0.8.8 Copyright (c) 2010 JC Grubbs - jc.grubbs@devmynd.com - MIT License

class GanttBase {
    constructor() {
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
    }

    // --- Date utilities ---

    cloneDate(date) {
        return new Date(date.getTime());
    }

    addDays(date, value) {
        date.setDate(date.getDate() + value * 1);
        return date;
    }

    compareDate(date1, date2) {
        if (isNaN(date1) || isNaN(date2)) {
            throw new Error(`${date1} - ${date2}`);
        } else if (date1 instanceof Date && date2 instanceof Date) {
            return (date1 < date2) ? -1 : (date1 > date2) ? 1 : 0;
        } else {
            throw new TypeError(`${date1} - ${date2}`);
        }
    }

    daysBetween(start, end) {
        if (!start || !end) return 0;
        let count = 0;
        const date = this.cloneDate(start);
        while (this.compareDate(date, end) === -1) {
            count++;
            this.addDays(date, 1);
        }
        return count;
    }

    isWeekend(date) {
        return date.getDay() % 6 === 0;
    }

    isToday(date) {
        return new Date().toDateString() === date.toDateString();
    }

    dayName(date) {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    }

    formatShortDate(date) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    }

    // --- Grid cell measurement and positioning ---

    readBlockPosition(block) {
        const el = block[0];
        const pixelLeft = (parseInt(el.style.marginLeft) || 0) + (parseInt(el.style.left) || 0);
        const pixelWidth = parseInt(el.style.width) || block.outerWidth();
        const pixelRight = pixelLeft + pixelWidth + 1;

        const pos = this._cellPositions;
        if (pos && pos.length > 0) {
            let dayIndex = 0;
            let endIndex = 0;
            let bestDist = Infinity;
            for (let i = 0; i < pos.length; i++) {
                const d = Math.abs(pos[i] - pixelLeft);
                if (d < bestDist) { bestDist = d; dayIndex = i; }
                if (pos[i] > pixelLeft + 10) break;
            }
            bestDist = Infinity;
            for (let j = dayIndex; j < pos.length; j++) {
                const d = Math.abs(pos[j] - pixelRight);
                if (d < bestDist) { bestDist = d; endIndex = j; }
                if (pos[j] > pixelRight + 10) break;
            }
            let cellCount = endIndex - dayIndex;
            if (cellCount < 1) cellCount = 1;
            return { dayIndex, cellCount };
        }

        const cw = this.options.cellWidth;
        const dayIndex = Math.round(pixelLeft / cw);
        let cellCount = Math.round((pixelWidth + 1) / cw);
        if (cellCount < 1) cellCount = 1;
        return { dayIndex, cellCount };
    }

    measureCellWidth() {
        const container = jQuery("div.ganttview-slide-container", this.options.container);
        const cells = container.find(".ganttview-grid-row:first .ganttview-grid-row-cell");
        const cRect = container[0].getBoundingClientRect();
        const scroll = container.scrollLeft();

        this._cellPositions = [];
        for (let i = 0; i < cells.length; i++) {
            const r = cells[i].getBoundingClientRect();
            this._cellPositions.push(Math.round(r.left - cRect.left + scroll));
        }
        if (cells.length > 0) {
            const last = cells[cells.length - 1].getBoundingClientRect();
            this._cellEndPosition = Math.round(last.right - cRect.left + scroll);
        }

        if (cells.length >= 2) {
            this._renderedCellWidth = this._cellPositions[1] - this._cellPositions[0];
        } else {
            this._renderedCellWidth = this.options.cellWidth;
        }
    }

    calcBlockPixels(dayIndex, cellCount) {
        const pos = this._cellPositions;
        if (pos && pos[dayIndex] !== undefined) {
            const left = pos[dayIndex];
            const endIdx = dayIndex + cellCount;
            const right = (pos[endIdx] !== undefined) ? pos[endIdx] : (pos[pos.length - 1] + this._renderedCellWidth);
            return { marginLeft: left, width: right - left - 1 };
        }
        const cw = this.options.cellWidth;
        return { marginLeft: dayIndex * cw, width: cellCount * cw - 1 };
    }

    snapToCell(pixelOffset) {
        const pos = this._cellPositions;
        if (!pos || !pos.length) return pixelOffset;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < pos.length; i++) {
            const d = Math.abs(pos[i] - pixelOffset);
            if (d < bestDist) { bestDist = d; best = i; }
            if (pos[i] > pixelOffset + this.options.cellWidth) break;
        }
        return pos[best];
    }

    snapAllBlocks() {
        jQuery("div.ganttview-block", this.options.container).each((_, el) => {
            const block = jQuery(el);
            const record = block.data("record");
            if (record && record.start && record.end) {
                const dayIndex = this.daysBetween(this._startDate, record.start);
                const cellCount = this.daysBetween(record.start, record.end) + 1;
                const px = this.calcBlockPixels(dayIndex, cellCount);
                el.style.marginLeft = `${px.marginLeft}px`;
                el.style.width = `${px.width}px`;
                return;
            }
            const sub = block.data("subtask");
            if (sub && sub.due_date) {
                const subDate = new Date(sub.due_date[0], sub.due_date[1] - 1, sub.due_date[2]);
                const subIdx = this.daysBetween(this._startDate, subDate);
                const subPx = this.calcBlockPixels(subIdx, 1);
                el.style.marginLeft = `${subPx.marginLeft}px`;
                el.style.width = `${subPx.width}px`;
            }
        });
    }

    // --- Data preparation ---

    prepareData(data) {
        for (const item of data) {
            item.start = new Date(item.start[0], item.start[1] - 1, item.start[2], 0, 0, 0, 0);
            item.end = new Date(item.end[0], item.end[1] - 1, item.end[2], 0, 0, 0, 0);
        }
        return data;
    }

    getDates(start, end) {
        const dates = [];
        dates[start.getFullYear()] = [];
        dates[start.getFullYear()][start.getMonth()] = [start];
        let last = start;

        while (this.compareDate(last, end) === -1) {
            const next = this.addDays(this.cloneDate(last), 1);
            if (!dates[next.getFullYear()]) {
                dates[next.getFullYear()] = [];
            }
            if (!dates[next.getFullYear()][next.getMonth()]) {
                dates[next.getFullYear()][next.getMonth()] = [];
            }
            dates[next.getFullYear()][next.getMonth()].push(next);
            last = next;
        }

        return dates;
    }

    getDateRange(minDays) {
        let minStart = null;
        let maxEnd = null;

        for (const item of this.data) {
            const start = new Date();
            start.setTime(Date.parse(item.start));
            const end = new Date();
            end.setTime(Date.parse(item.end));

            if (!minStart || this.compareDate(minStart, start) === 1) {
                minStart = start;
            }
            if (!maxEnd || this.compareDate(maxEnd, end) === -1) {
                maxEnd = end;
            }
        }

        if (!minStart) minStart = new Date();
        if (!maxEnd) maxEnd = new Date();

        if (this.daysBetween(minStart, maxEnd) < minDays) {
            maxEnd = this.addDays(this.cloneDate(minStart), minDays);
        }

        minStart.setDate(minStart.getDate() - 7);
        return [minStart, maxEnd];
    }

    // --- Persistence ---

    saveRecord(record) {
        $.ajax({
            cache: false,
            url: $(this.options.container).data("save-url"),
            contentType: "application/json",
            type: "POST",
            processData: false,
            data: JSON.stringify(record),
            success: () => this.showSaveStatus('Saved'),
            error: () => this.showSaveStatus('Save failed', true)
        });
    }

    saveSubtask(subtaskId, dueDateStr) {
        $.ajax({
            cache: false,
            url: $(this.options.container).data("save-subtask-url"),
            contentType: "application/json",
            type: "POST",
            processData: false,
            data: JSON.stringify({ id: subtaskId, due_date: dueDateStr }),
            success: () => this.showSaveStatus('Saved'),
            error: () => this.showSaveStatus('Save failed', true)
        });
    }

    showSaveStatus(message, isError) {
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
    }
}
