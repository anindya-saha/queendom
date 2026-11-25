import { QueensValidator } from './validator.js';
import { Global } from './game.js';

export const Marks = {
    NONE: 0,
    BASIC: 1,
    QUEEN: 2,
};

export class Board {
    constructor(layout, width, height) {
        this.validator = new QueensValidator();

        this.handlers = {
            on_mark_applied: undefined,
            on_invalid_queens: undefined,
            on_valid_queens: undefined,
            on_remove_queen: undefined,
            on_history_changed: undefined,
        };

        this.reset(layout);
        this.width = width;
        this.height = height;

        this.validator.handlers.on_valid_queens = (num_queens) => {
            this.handlers.on_valid_queens?.(num_queens);
        };

        this.validator.handlers.on_remove_queen = () => {
            this.handlers.on_remove_queen?.();
        };

        this.validator.handlers.on_invalid_proximity = (coords) => {
            const cells = coords.map(({x, y}) => this.to_relative_int(x, y));
            this.handlers.on_invalid_queens?.(cells);
        }

        this.validator.handlers.on_invalid_color = (x, y) => {
            this.handlers.on_invalid_queens?.(this.get_cells_by_color(x, y));
        };

        this.validator.handlers.on_invalid_column = (column) => {
            this.handlers.on_invalid_queens?.(this.get_cells_by_column(column));
        };

        this.validator.handlers.on_invalid_row = (row) => {
            this.handlers.on_invalid_queens?.(this.get_cells_by_row(row));
        };
    }

    reset(layout) {
        this.layout = layout;
        this.clear();
    }

    clear() {
        this.validator.clear();
        this.auto_marks = new Set();
        this.restoring = false;
        this.marks_grid = [];
        this.initialize_marks_grid();
        this.clear_history();
    }

    clear_history() {
        this.history = [];
        this.current_action = undefined;
        this.handlers.on_history_changed?.(0);
    }

    begin_action() {
        this.current_action ??= [];
    }

    end_action() {
        if (this.current_action?.length) {
            this.history.push(this.current_action);
            this.handlers.on_history_changed?.(this.history.length);
        }

        this.current_action = undefined;
    }

    undo() {
        const action = this.history.pop();

        if (!action)
            return;

        this.restoring = true;

        for (const { x, y, mark, was_auto } of action.reverse()) {
            this.set_mark(x, y, mark);

            if (was_auto)
                this.auto_marks.add(this.to_relative_int(x, y));
        }

        this.restoring = false;
        this.handlers.on_history_changed?.(this.history.length);
    }

    initialize_marks_grid() {
        for (let y = 0; y < this.rows(); y++) {
            this.marks_grid.push([]);

            for (let x = 0; x < this.columns(); x++) {
                this.marks_grid[y].push(Marks.NONE);
            }
        }
    }

    get_tile_size() {
        return (Math.min(this.width, this.height) - Global.RENDER_OFFSET * 2) / this.columns();
    }

    iterate(callback) {
        outer: for (let y = 0; y < this.rows(); y++) {
            for (let x = 0; x < this.columns(); x++) {
                let terminate = callback.bind(this)(x, y, this.get_color(x, y), this.get_mark(x, y));

                if (terminate)
                    break outer;
            }
        }
    }

    get_cells_by_column(x) {
        const column = new Set();

        for (let y = 0; y < this.rows(); y++)
            column.add(this.to_relative_int(x, y));

        return column;
    }

    get_cells_by_row(y) {
        const row = new Set();

        for (let x = 0; x < this.columns(); x++)
            row.add(this.to_relative_int(x, y));

        return row;
    }

    get_cells_by_color(x, y) {
        const visited = new Set();
        const color = this.get_color(x, y);

        this._get_cells_by_color(x, y, color, visited);

        return visited;
    }

    _get_cells_by_color(x, y, color, visited) {
        if (!this.within_bounds(x, y))
            return;

        const index = this.to_relative_int(x, y);
        const current_color = this.get_color(x, y);

        if (visited.has(index) || current_color !== color)
            return

        visited.add(index);

        this._get_cells_by_color(x+1, y, color, visited);
        this._get_cells_by_color(x-1, y, color, visited);
        this._get_cells_by_color(x, y+1, color, visited);
        this._get_cells_by_color(x, y-1, color, visited);
    }

    to_relative_int(x, y) {
        return x + y * this.columns();
    }

    from_relative_int(v) {
        return {
            x: v % this.columns(),
            y: Math.floor(v / this.columns()),
        }
    }

    to_relative_position(global_x, global_y) {
        const {RENDER_OFFSET} = Global;
        const TILE_SIZE = this.get_tile_size();

        return {
            x: Math.floor((global_x - RENDER_OFFSET) / TILE_SIZE),
            y: Math.floor((global_y - RENDER_OFFSET) / TILE_SIZE),
        };
    }

    to_global_position(relative_x, relative_y) {
        const {RENDER_OFFSET} = Global;
        const TILE_SIZE = this.get_tile_size();

        return {
            x: RENDER_OFFSET + relative_x * TILE_SIZE,
            y: RENDER_OFFSET + relative_y * TILE_SIZE,
        };
    }

    cycle_mark(x, y) {
        if (!this.within_bounds(x, y))
            return

        let mark = this.marks_grid[y][x];

        if (!mark)
            mark = 1;
        else {
            const marks = Object.keys(Marks).length;
            mark = (mark << 1) % (1 << (marks - 1));
        }

        this.set_mark(x, y, mark);
    }

    set_mark(x, y, mark) {
        if (!this.within_bounds(x, y))
            return;

        const current_mark = this.get_mark(x, y);

        if (mark === current_mark)
            return;

        const color = this.get_color(x, y);
        const index = this.to_relative_int(x, y);

        if (!this.restoring)
            this.current_action?.push({ x, y, mark: current_mark, was_auto: this.auto_marks.has(index) });

        this.marks_grid[y][x] = mark;
        this.auto_marks.delete(index);
        this.handlers.on_mark_applied?.(x, y);

        if (mark === Marks.QUEEN) {
            this.validator.push_and_validate(x, y, color);

            if (Global.auto_marks && !this.restoring)
                this.apply_auto_marks(x, y);
        }
        else if (current_mark === Marks.QUEEN) {
            this.validator.remove_and_revalidate(x, y, color);

            if (!this.restoring)
                this.remove_stale_auto_marks();
        }
    }

    get_blocked_cells(x, y) {
        const cells = new Set([
            ...this.get_cells_by_row(y),
            ...this.get_cells_by_column(x),
            ...this.get_cells_by_color(x, y),
        ]);

        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if (this.within_bounds(x + dx, y + dy))
                    cells.add(this.to_relative_int(x + dx, y + dy));

        cells.delete(this.to_relative_int(x, y));
        return cells;
    }

    apply_auto_marks(x, y) {
        for (const cell of this.get_blocked_cells(x, y)) {
            const pos = this.from_relative_int(cell);

            if (this.get_mark(pos.x, pos.y) !== Marks.NONE)
                continue;

            this.set_mark(pos.x, pos.y, Marks.BASIC);
            this.auto_marks.add(cell);
        }
    }

    remove_stale_auto_marks() {
        const blocked = new Set();

        this.iterate((x, y, color, mark) => {
            if (mark === Marks.QUEEN)
                this.get_blocked_cells(x, y).forEach((cell) => blocked.add(cell));
        });

        for (const cell of [...this.auto_marks]) {
            if (blocked.has(cell))
                continue;

            const pos = this.from_relative_int(cell);
            this.set_mark(pos.x, pos.y, Marks.NONE);
        }
    }

    get_mark(x, y) {
        if (!this.within_bounds(x, y))
            return Marks.NONE;

        return this.marks_grid[y][x];
    }

    get_color(x, y) {
        if (!this.within_bounds(x, y))
            return -1

        return this.layout[y][x];
    }

    rows() {
        return this.layout.length;
    }

    columns() {
        return this.layout[0].length;
    }

    within_bounds(x, y) {
        return x >= 0 && x < this.columns() && y >= 0 && y < this.rows();
    }
}
