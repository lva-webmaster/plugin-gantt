class GanttCriticalPath extends GanttDependencies {

    computeCriticalPath() {
        const taskMap = {};
        const preds = {};
        const succs = {};

        for (const task of this.data) {
            if (task.type !== 'task') continue;
            const id = parseInt(task.id);
            taskMap[id] = task;
            preds[id] = [];
            succs[id] = [];
        }

        for (const task of this.data) {
            if (!task.dependencies || task.type !== 'task') continue;
            const taskId = parseInt(task.id);
            for (const dep of task.dependencies) {
                const blockedId = parseInt(dep);
                if (!taskMap[blockedId]) continue;
                succs[taskId].push(blockedId);
                preds[blockedId].push(taskId);
            }
        }

        const inChain = new Set();
        for (const id in taskMap) {
            const nid = parseInt(id);
            if (preds[nid].length > 0 || succs[nid].length > 0) {
                inChain.add(nid);
            }
        }

        this._criticalPath = new Set();
        this._criticalChain = new Set();
        this._cpData = {};

        if (inChain.size === 0) return;

        const topo = this._topologicalSort(taskMap, preds, inChain);
        if (topo.length === 0) return;

        const es = {};
        const ef = {};
        const dur = {};

        for (const id of topo) {
            const task = taskMap[id];
            dur[id] = this.daysBetween(task.start, task.end) + 1;
            const taskStart = this.daysBetween(this._startDate, task.start);

            if (preds[id].length === 0) {
                es[id] = taskStart;
            } else {
                const predMax = Math.max(...preds[id].filter(p => ef[p] !== undefined).map(p => ef[p] + 1));
                es[id] = Math.max(taskStart, predMax);
            }
            ef[id] = es[id] + dur[id] - 1;
        }

        const ls = {};
        const lf = {};
        const projectEnd = Math.max(...topo.map(id => ef[id]));

        for (let i = topo.length - 1; i >= 0; i--) {
            const id = topo[i];
            if (succs[id].length === 0 || succs[id].every(s => ls[s] === undefined)) {
                lf[id] = projectEnd;
            } else {
                const succMin = Math.min(...succs[id].filter(s => ls[s] !== undefined).map(s => ls[s] - 1));
                lf[id] = succMin;
            }
            ls[id] = lf[id] - dur[id] + 1;
        }

        for (const id of topo) {
            const float = ls[id] - es[id];
            this._cpData[id] = {
                float,
                earlyStart: es[id],
                earlyFinish: ef[id],
                lateStart: ls[id],
                lateFinish: lf[id],
                duration: dur[id],
                isCritical: float === 0
            };
            if (float === 0) {
                this._criticalPath.add(id);
            }
        }

        const walkBack = (id) => {
            for (const predId of preds[id]) {
                const pid = parseInt(predId);
                if (!this._criticalChain.has(pid) && taskMap[pid]) {
                    this._criticalChain.add(pid);
                    walkBack(pid);
                }
            }
        };
        for (const id of this._criticalPath) {
            this._criticalChain.add(parseInt(id));
            walkBack(id);
        }
    }

    _topologicalSort(taskMap, preds, inChain) {
        const visited = new Set();
        const visiting = new Set();
        const result = [];

        const visit = (id) => {
            if (visited.has(id)) return;
            if (visiting.has(id)) return;
            visiting.add(id);
            for (const pred of preds[id]) {
                if (inChain.has(pred)) visit(pred);
            }
            visiting.delete(id);
            visited.add(id);
            result.push(id);
        };

        for (const id of inChain) visit(id);
        return result;
    }

    highlightCriticalPath() {
        if (!this._criticalChain || this._criticalChain.size === 0) return;

        jQuery("div.ganttview-block:not(.ganttview-subtask-block)", this.options.container).each((_, el) => {
            const block = jQuery(el);
            const record = block.data("record");
            if (!record) return;
            const nid = parseInt(record.id);
            if (this._criticalChain.has(nid)) {
                block.addClass("ganttview-critical-path");
            }
            if (this._cpData[nid]) {
                block.attr("title", this.getBarTitleText(record));
            }
        });
    }

    isOnCriticalChain(taskId) {
        return this._criticalChain && this._criticalChain.has(parseInt(taskId));
    }

    getCriticalPathInfo(taskId) {
        if (!this._cpData) return null;
        const info = this._cpData[parseInt(taskId)];
        if (!info) return null;
        return {
            ...info,
            isOnChain: this._criticalChain && this._criticalChain.has(parseInt(taskId))
        };
    }
}
