import { beforeEach, describe, expect, it, vi } from 'vitest';
import { puzzles as built_in_puzzles } from '../public/js/maps.js';
import {
    load_puzzles, has_puzzle, add_puzzle, update_puzzle,
    rename_puzzle, delete_puzzle, reorder_puzzles, record_solution,
} from '../public/js/storage.js';

let store;

function names() {
    return load_puzzles().map((puzzle) => puzzle.name);
}

beforeEach(() => {
    store = {};

    vi.stubGlobal('localStorage', {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => store[key] = value,
        removeItem: (key) => delete store[key],
    });
});

describe('puzzle storage', () => {
    it('lists built-in puzzles by default', () => {
        expect(names()).toEqual(built_in_puzzles.map(({ name }) => name));
        expect(load_puzzles().every((puzzle) => puzzle.built_in)).toBe(true);
    });

    it('adds, renames and deletes saved puzzles', () => {
        add_puzzle({ name: 'Mine', map: [[0]], color_map: ['red'] });
        expect(has_puzzle([[0]])).toBe(true);

        const { id } = load_puzzles().at(-1);
        rename_puzzle(id, 'Renamed');
        expect(names().at(-1)).toBe('Renamed');

        delete_puzzle(id);
        expect(has_puzzle([[0]])).toBe(false);
    });

    it('renames built-in puzzles', () => {
        rename_puzzle('builtin-0', 'Easy');
        expect(names()[0]).toBe('Easy');
    });

    it('persists the order', () => {
        const ids = load_puzzles().map((puzzle) => puzzle.id);
        reorder_puzzles([...ids].reverse());

        expect(load_puzzles().map((puzzle) => puzzle.id)).toEqual([...ids].reverse());
    });

    it('migrates puzzles saved in the legacy format', () => {
        store['queens-clone.saved-puzzles'] = JSON.stringify([{ map: [[1]], color_map: ['blue'] }]);

        expect(names()[0]).toBe('Saved 1');
        expect(names()[0]).toBe('Saved 1');
        expect(store['queens-clone.saved-puzzles']).toBeUndefined();
    });

    it('records solutions and keeps the best time', () => {
        const solution = [[0, 0], [3, 1], [1, 2], [4, 3], [2, 4]];

        record_solution('builtin-0', solution, 90);
        const { solved_at } = load_puzzles()[0];

        record_solution('builtin-0', solution, 120);
        record_solution('builtin-0', solution, 45);
        rename_puzzle('builtin-0', 'Easy');

        expect(load_puzzles()[0]).toMatchObject({
            name: 'Easy', solution, best_time: 45, solved_at,
        });
    });

    it('records solutions for saved puzzles', () => {
        add_puzzle({ name: 'Mine', map: [[0]], color_map: ['red'] });
        const { id } = load_puzzles().at(-1);

        record_solution(id, [[0, 0]], 3);

        expect(load_puzzles().at(-1)).toMatchObject({
            map: [[0]], solution: [[0, 0]], best_time: 3,
        });
    });

    it('updates saved puzzles and resets progress when the layout changes', () => {
        const id = add_puzzle({ name: 'Mine', map: [[0]], color_map: ['red'] });
        record_solution(id, [[0, 0]], 3);

        update_puzzle(id, { name: 'Renamed', map: [[0]], color_map: ['blue'] });
        expect(load_puzzles().at(-1)).toMatchObject({ name: 'Renamed', color_map: ['blue'], best_time: 3 });

        update_puzzle(id, { name: 'Renamed', map: [[1]], color_map: ['blue'] });
        expect(load_puzzles().at(-1).solution).toBeUndefined();
        expect(load_puzzles().at(-1).best_time).toBeUndefined();
    });

    it('ignores a puzzle itself when checking for duplicates', () => {
        const id = add_puzzle({ name: 'Mine', map: [[0]], color_map: ['red'] });

        expect(has_puzzle([[0]], id)).toBe(false);
        expect(has_puzzle([[0]])).toBe(true);
    });

    it('does not update built-in puzzles', () => {
        update_puzzle('builtin-0', { name: 'Changed', map: [[0]], color_map: ['red'] });
        expect(load_puzzles()[0].map).toEqual(built_in_puzzles[0].map);
    });

    it('merges saved copies of built-in puzzles, keeping their progress', () => {
        const relabeled = built_in_puzzles[1].map.map((row) => row.map((value) => value + 20));

        store['queens-clone.puzzles'] = JSON.stringify([
            { id: 'saved-copy', name: 'Copy', map: relabeled, color_map: {}, solution: [[0, 0]], best_time: 42 },
        ]);

        const puzzles = load_puzzles();

        expect(puzzles.some((puzzle) => puzzle.id === 'saved-copy')).toBe(false);
        expect(puzzles.find((puzzle) => puzzle.id === 'builtin-1')).toMatchObject({ solution: [[0, 0]], best_time: 42 });
        expect(has_puzzle(relabeled)).toBe(true);
    });
});
