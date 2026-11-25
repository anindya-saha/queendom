import { Renderer } from './render.js';
import { Board, Marks } from './board.js';
import { InputStateHandler } from './input_handler.js';
import { Configuaration } from './configure.js';
import { format_time } from './format.js';

// Undefined properties are populated during runtime
export const Global = {
    ...Configuaration,
};

export class Game {
    constructor() {
        this.canvas = document.getElementById('canvas');

        const { clientWidth , clientHeight } = this.canvas;
        this.canvas.setAttribute('viewBox', `0 0 ${clientWidth} ${clientHeight}`);

        this.board = new Board(Global.map, clientWidth, clientHeight);
        this.renderer = new Renderer(Global.theme, this.canvas, this.board);
        this.input = new InputStateHandler(this.board);
        this.timer = undefined;
        this.revealing = false;

        this.handlers = {
            on_completed: undefined,
        };

        this.reset();
    }

    start() {
        this.register_handlers();
        this.register_mouse_events();
        this.renderer.render_board(Global.theme.color_map);
    }

    register_handlers() {
        const { board, renderer, input } = this;

        board.handlers.on_mark_applied = (x, y) => renderer.render_mark(x, y);
        board.handlers.on_remove_queen = () => renderer.clear_invalid_cells();
        board.handlers.on_invalid_queens = (cells) => renderer.render_invalid_cells(cells);

        board.handlers.on_valid_queens = (num_queens) => {
            const win_condition = Math.min(board.columns(), board.rows());

            if (num_queens === win_condition) {
                this.complete();

                if (!this.revealing)
                    this.handlers.on_completed?.(this.get_queen_positions(), this.time);
            }
        };

        input.handlers.on_first_click = () => {
            this.timer = setInterval(() => {
                this.time++;
                this.update_elapsed_time()
            }, 1000);
        }

        input.handlers.on_action_start = () => board.begin_action();
        input.handlers.on_action_end = () => board.end_action();

        input.handlers.on_hover_changing = () => renderer.clear_mouse_position();
        input.handlers.on_hover_changed = ({x, y}) => renderer.render_mouse_position(x, y);
        input.handlers.on_clear = ({x, y}) => board.set_mark(x, y, Marks.NONE);
        input.handlers.on_mark = ({x, y}) => board.set_mark(x, y, Marks.BASIC);
        input.handlers.on_toggle = ({x, y}) => board.cycle_mark(x, y);
    }

    register_mouse_events() {
        const { board, canvas, input } = this;

        canvas.oncontextmenu = (e) => e.preventDefault();
        canvas.add_event_listener = function(name, tr) {
            this.addEventListener(name, function(e) {
                let event = tr(e);
                let rect = this.getBoundingClientRect();

                const scale = board.width / rect.width;

                const global_pos = {
                    x: (event.clientX - rect.left) * scale,
                    y: (event.clientY - rect.top) * scale,
                }

                const relative_pos = board.to_relative_position(global_pos.x, global_pos.y);
                const mark = board.get_mark(relative_pos.x, relative_pos.y);

                input.handle(name, global_pos, relative_pos, mark);
            });
        }

        const noop = (e) => e;
        const first_touch = (e) => e.touches[0];
        const first_changed_touch = (e) => e.changedTouches[0];

        if (!('ontouchstart' in window)) {
            canvas.add_event_listener('mousedown', noop);
            canvas.add_event_listener('mousemove', noop);
            canvas.add_event_listener('mouseleave', noop);
            canvas.add_event_listener('mouseup', noop);
        }

        canvas.add_event_listener('touchstart', first_touch);
        canvas.add_event_listener('touchmove', first_touch);
        canvas.add_event_listener('touchend', first_changed_touch);
    }

    undo() {
        if (!this.completed)
            this.board.undo();
    }

    complete() {
        clearInterval(this.timer);
        this.completed = true;

        this.renderer.clear_mouse_position();
        this.renderer.animate_completion();
        this.input.disable();
        this.board.clear_history();

        document.getElementById('btn-clear').innerText = 'Restart';
    }

    get_queen_positions() {
        const positions = [];

        this.board.iterate((x, y, color, mark) => {
            if (mark === Marks.QUEEN)
                positions.push([x, y]);
        });

        return positions;
    }

    show_solution(solution) {
        this.reset();
        this.board.clear();
        this.renderer.clear_marks();

        this.revealing = true;

        for (const [x, y] of solution)
            this.board.set_mark(x, y, Marks.QUEEN);

        this.revealing = false;
    }

    update_elapsed_time() {
        document.getElementById('time').innerText = format_time(this.time);
    }

    clear() {
        this.board.clear();
        this.renderer.clear_marks();
        this.input.enable();

        if (this.completed)
            this.reset();
    }

    reset() {
        this.time = 0;
        this.update_elapsed_time();

        this.completed = false;
        this.input.reset();

        if (this.timer)
            clearInterval(this.timer);

        this.timer = undefined;
        document.getElementById('btn-clear').innerText = 'Clear';
    }

    reload({ color_map, map }) {
        this.reset();
        this.board.reset(map);
        this.renderer.reset();
        this.renderer.render_board(color_map);
    }
}
