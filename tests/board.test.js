import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, Marks } from '../public/js/board.js';
import { Global } from '../public/js/game.js';
import { example_map } from '../public/js/maps.js';

const solution = [[0, 0], [3, 1], [1, 2], [4, 3], [2, 4]];

function marks(board) {
    return board.marks_grid.map((row) => row.join(''));
}

describe('Board', () => {
    let board;

    beforeEach(() => {
        Global.auto_marks = true;
        board = new Board(example_map, 500, 500);
    });

    it('reports a win when every queen is placed validly', () => {
        const on_valid_queens = vi.fn();
        board.handlers.on_valid_queens = on_valid_queens;

        for (const [x, y] of solution)
            board.set_mark(x, y, Marks.QUEEN);

        expect(on_valid_queens).toHaveBeenLastCalledWith(5);
    });

    it('reports conflicting queens in the same row', () => {
        const on_invalid_queens = vi.fn();
        board.handlers.on_invalid_queens = on_invalid_queens;

        board.set_mark(0, 0, Marks.QUEEN);
        board.set_mark(4, 0, Marks.QUEEN);

        expect(on_invalid_queens).toHaveBeenCalled();
    });

    it('cycles none -> X -> queen -> none', () => {
        board.cycle_mark(2, 2);
        expect(board.get_mark(2, 2)).toBe(Marks.BASIC);

        board.cycle_mark(2, 2);
        expect(board.get_mark(2, 2)).toBe(Marks.QUEEN);

        board.cycle_mark(2, 2);
        expect(board.get_mark(2, 2)).toBe(Marks.NONE);
    });

    describe('auto X marks', () => {
        it('marks the row, column, region and neighbours of a queen', () => {
            board.set_mark(0, 0, Marks.QUEEN);

            expect(marks(board)).toEqual([
                '21111',
                '11000',
                '10000',
                '10000',
                '10000',
            ]);
        });

        it('keeps manual X marks and removes stale auto marks', () => {
            board.set_mark(4, 4, Marks.BASIC);
            board.set_mark(0, 0, Marks.QUEEN);
            board.set_mark(2, 2, Marks.QUEEN);
            board.set_mark(2, 2, Marks.NONE);

            expect(marks(board)).toEqual([
                '21111',
                '11000',
                '10000',
                '10000',
                '10001',
            ]);

            board.set_mark(0, 0, Marks.NONE);

            expect(marks(board)).toEqual([
                '00000',
                '00000',
                '00000',
                '00000',
                '00001',
            ]);
        });

        it('does nothing when disabled', () => {
            Global.auto_marks = false;
            board.set_mark(0, 0, Marks.QUEEN);

            expect(board.marks_grid.flat().filter(Boolean)).toHaveLength(1);
        });
    });

    describe('undo', () => {
        function act(callback) {
            board.begin_action();
            callback();
            board.end_action();
        }

        it('undoes actions one at a time, newest first', () => {
            act(() => board.set_mark(4, 4, Marks.BASIC));
            act(() => board.set_mark(0, 0, Marks.QUEEN));

            board.undo();
            expect(marks(board)).toEqual(['00000', '00000', '00000', '00000', '00001']);

            board.undo();
            expect(board.marks_grid.flat().every((mark) => mark === Marks.NONE)).toBe(true);

            board.undo();
            expect(board.history).toHaveLength(0);
        });

        it('groups a drag stroke into one step', () => {
            act(() => {
                board.set_mark(1, 4, Marks.BASIC);
                board.set_mark(2, 4, Marks.BASIC);
                board.set_mark(3, 4, Marks.BASIC);
            });

            expect(board.history).toHaveLength(1);

            board.undo();
            expect(board.marks_grid[4]).toEqual([0, 0, 0, 0, 0]);
        });

        it('restores auto marks removed with a queen', () => {
            act(() => board.set_mark(0, 0, Marks.QUEEN));
            const with_queen = marks(board);

            act(() => board.set_mark(0, 0, Marks.NONE));
            board.undo();
            expect(marks(board)).toEqual(with_queen);

            act(() => board.set_mark(0, 0, Marks.NONE));
            expect(board.marks_grid.flat().every((mark) => mark === Marks.NONE)).toBe(true);
        });

        it('removes an undone queen from validation', () => {
            act(() => board.set_mark(4, 1, Marks.BASIC));
            act(() => board.set_mark(4, 1, Marks.QUEEN));
            board.undo();

            expect(board.get_mark(4, 1)).toBe(Marks.BASIC);
            expect(board.validator.queens.length()).toBe(0);
        });

        it('notifies history changes', () => {
            const on_history_changed = vi.fn();
            board.handlers.on_history_changed = on_history_changed;

            act(() => board.set_mark(0, 0, Marks.BASIC));
            board.undo();

            expect(on_history_changed.mock.calls).toEqual([[1], [0]]);
        });
    });
});
