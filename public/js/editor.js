import { Configuaration } from './configure.js';
import { find_layout_issues, get_used_colors } from './layout_validation.js';

const MIN_SIZE = 4;
const MAX_SIZE = Object.keys(Configuaration.theme.color_map).length;
const DEFAULT_SIZE = 7;
const DEFAULT_TRACE_OPACITY = 50;

function create_blank_map(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
}

function normalize_puzzle(map, color_map) {
    const theme_colors = Object.values(Configuaration.theme.color_map);

    if (!map)
        return { map: create_blank_map(DEFAULT_SIZE), palette: theme_colors };

    const values = [...new Set(map.flat())];
    const colors = values.map((value) => color_map[value]);

    return {
        map: map.map((row) => row.map((value) => values.indexOf(value))),
        palette: [...colors, ...theme_colors.filter((color) => !colors.includes(color))],
    };
}

function describe_issue({ color, type, regions, used, required }) {
    if (type === 'color_count') {
        const difference = Math.abs(required - used);
        const change = used < required ? 'add' : 'remove';

        return `${used} of ${required} colors used: ${change} ${difference} color${difference === 1 ? '' : 's'}.`;
    }

    return `Color ${color + 1} is split into ${regions} separate areas.`;
}

export class BoardEditor {
    constructor() {
        const element = (id) => document.getElementById(id);

        this.elements = {
            name: element('editor-name'),
            size: element('editor-size'),
            palette: element('editor-palette'),
            board: element('editor-board'),
            grid: element('editor-grid'),
            trace: element('editor-trace'),
            trace_picker: element('editor-trace-picker'),
            trace_settings: element('editor-trace-settings'),
            opacity: element('editor-opacity'),
            zoom: element('editor-zoom'),
            btn_trace: element('btn-trace'),
            btn_move_trace: element('btn-move-trace'),
            btn_remove_trace: element('btn-remove-trace'),
            issues: element('editor-issues'),
            btn_save: element('btn-editor-save'),
            btn_back: element('btn-editor-back'),
        };

        this.handlers = {
            on_save: undefined,
            on_close: undefined,
        };

        for (let size = MIN_SIZE; size <= MAX_SIZE; size++)
            this.elements.size.add(new Option(`${size}×${size}`, size));

        this.register_events();
    }

    open({ id, name = '', default_name = '', map, color_map, trace_src } = {}) {
        const puzzle = normalize_puzzle(map, color_map);

        this.id = id;
        this.map = puzzle.map;
        this.palette = puzzle.palette;
        this.selected_color = 0;
        this.dirty = !id && Boolean(map || trace_src);

        this.elements.name.value = name;
        this.elements.name.placeholder = default_name;
        this.elements.size.value = this.size();

        this.set_trace(trace_src);
        this.render();
    }

    size() {
        return this.map.length;
    }

    register_events() {
        const { elements } = this;

        elements.size.onchange = () => this.resize(Number(elements.size.value));
        elements.name.oninput = () => this.dirty = true;

        elements.btn_trace.onclick = () => elements.trace_picker.click();
        elements.btn_remove_trace.onclick = () => this.set_trace(undefined);
        elements.btn_move_trace.onclick = () => this.set_moving_trace(!this.moving_trace);

        elements.trace_picker.onchange = (e) => {
            const file = e.target.files[0];
            e.target.value = '';

            if (!file)
                return;

            const reader = new FileReader();
            reader.onload = (e) => this.set_trace(e.target.result);
            reader.readAsDataURL(file);
        };

        elements.opacity.oninput = () => this.update_trace_style();
        elements.zoom.oninput = () => this.update_trace_style();

        elements.board.onpointerdown = (e) => this.handle_pointer_down(e);

        elements.btn_save.onclick = () => this.save();

        elements.btn_back.onclick = () => {
            if (this.dirty && !confirm('Discard unsaved changes?'))
                return;

            this.handlers.on_close?.();
        };
    }

    handle_pointer_down(e) {
        const { board } = this.elements;

        e.preventDefault();
        board.setPointerCapture(e.pointerId);

        const pan_start = {
            x: e.clientX - this.trace_offset.x,
            y: e.clientY - this.trace_offset.y,
        };

        const handle = (e) => {
            if (this.moving_trace) {
                this.trace_offset = { x: e.clientX - pan_start.x, y: e.clientY - pan_start.y };
                this.update_trace_style();
            }
            else
                this.paint_at(e.clientX, e.clientY);
        };

        handle(e);

        board.onpointermove = handle;
        board.onpointerup = board.onpointercancel = () => {
            board.onpointermove = board.onpointerup = board.onpointercancel = null;
        };
    }

    paint_at(client_x, client_y) {
        const cell = document.elementFromPoint(client_x, client_y)?.closest('.editor-cell');

        if (!cell || !this.elements.grid.contains(cell))
            return;

        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);

        if (this.map[y][x] === this.selected_color)
            return;

        this.map[y][x] = this.selected_color;
        cell.style.backgroundColor = this.palette[this.selected_color];
        this.dirty = true;
        this.render_palette();
        this.render_issues();
    }

    resize(size) {
        this.map = Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, x) => this.map[y]?.[x] ?? 0));

        this.dirty = true;
        this.render();
    }

    set_trace(src) {
        const { trace, trace_settings, btn_move_trace, btn_remove_trace } = this.elements;
        const has_trace = Boolean(src);

        if (has_trace)
            trace.src = src;
        else
            trace.removeAttribute('src');

        for (const element of [trace, trace_settings, btn_move_trace, btn_remove_trace])
            element.classList.toggle('not-rendered', !has_trace);

        this.trace_offset = { x: 0, y: 0 };
        this.elements.opacity.value = DEFAULT_TRACE_OPACITY;
        this.elements.zoom.value = 100;
        this.set_moving_trace(false);
        this.update_trace_style();
    }

    set_moving_trace(moving) {
        this.moving_trace = moving;
        this.elements.btn_move_trace.innerText = moving ? 'Done moving' : 'Move image';
        this.elements.board.classList.toggle('moving-trace', moving);
    }

    update_trace_style() {
        const { trace, opacity, zoom } = this.elements;
        const { x, y } = this.trace_offset;

        trace.style.opacity = opacity.value / 100;
        trace.style.transform = `translate(${x}px, ${y}px) scale(${zoom.value / 100})`;
    }

    render() {
        this.render_palette();
        this.render_grid();
        this.render_issues();
    }

    render_palette() {
        const { palette } = this.elements;
        palette.replaceChildren();

        const used_colors = get_used_colors(this.map);

        for (let color = 0; color < this.palette.length; color++) {
            const swatch = document.createElement('button');
            swatch.className = 'editor-swatch';
            swatch.classList.toggle('selected', color === this.selected_color);
            swatch.classList.toggle('used', used_colors.includes(color));
            swatch.style.backgroundColor = this.palette[color];
            swatch.innerText = color + 1;
            swatch.title = `Color ${color + 1}`;

            swatch.onclick = () => {
                this.selected_color = color;
                this.render_palette();
            };

            palette.appendChild(swatch);
        }
    }

    render_grid() {
        const { grid } = this.elements;
        grid.replaceChildren();
        grid.style.gridTemplateColumns = `repeat(${this.size()}, 1fr)`;

        this.map.forEach((row, y) => row.forEach((color, x) => {
            const cell = document.createElement('div');
            cell.className = 'editor-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.style.backgroundColor = this.palette[color];
            grid.appendChild(cell);
        }));
    }

    render_issues() {
        const issues = find_layout_issues(this.map);
        const { issues: container, btn_save } = this.elements;

        container.replaceChildren();
        container.classList.toggle('valid', issues.length === 0);

        const lines = issues.length
            ? issues.map(describe_issue)
            : [`Looks good: ${this.size()} connected color regions.`];

        for (const line of lines) {
            const item = document.createElement('div');
            item.innerText = line;
            container.appendChild(item);
        }

        btn_save.disabled = issues.length > 0;
        btn_save.classList.toggle('disabled', issues.length > 0);
    }

    save() {
        if (find_layout_issues(this.map).length > 0)
            return;

        const { name } = this.elements;

        const used_colors = get_used_colors(this.map);

        const saved = this.handlers.on_save?.({
            id: this.id,
            name: name.value.trim() || name.placeholder,
            map: this.map.map((row) => row.map((color) => used_colors.indexOf(color))),
            color_map: used_colors.map((color) => this.palette[color]),
        });

        if (saved)
            this.dirty = false;
    }
}
