class GanttToast {
    constructor({ maxCount = 4, timeout = 5000 } = {}) {
        this.maxCount = maxCount;
        this.timeout = timeout;
        this.toasts = [];
        this.container = document.createElement('div');
        this.container.classList.add('gantt-toast-container');
        document.body.appendChild(this.container);
    }

    show(message, type = 'success') {
        while (this.toasts.length >= this.maxCount) {
            this._remove(this.toasts[0], true);
        }

        const toast = document.createElement('div');
        toast.classList.add('gantt-toast', `gantt-toast-${type}`);
        toast.innerHTML = message;
        toast.addEventListener('click', () => this._remove(toast));

        this.container.appendChild(toast);
        this.toasts.push(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => this._remove(toast), this.timeout);
    }

    _remove(toast, force) {
        if (!toast) return;
        if (force) {
            this._finalize(toast);
        } else {
            toast.classList.remove('show');
            setTimeout(() => this._finalize(toast), 300);
        }
    }

    _finalize(toast) {
        if (this.container.contains(toast)) {
            this.container.removeChild(toast);
            this.toasts = this.toasts.filter(t => t !== toast);
        }
    }
}
