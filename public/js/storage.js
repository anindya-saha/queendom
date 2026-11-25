import { Configuaration } from './configure.js';
import { puzzles as built_in_maps } from './maps.js';

const PUZZLES_KEY = 'queens-clone.puzzles';
const LEGACY_SAVED_PUZZLES_KEY = 'queens-clone.saved-puzzles';
const BUILT_IN_PREFIX = 'builtin-';

function read_json(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    }
    catch {
        return null;
    }
}

function generate_id() {
    return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function read_entries() {
    const entries = read_json(PUZZLES_KEY);

    if (entries)
        return entries;

    const legacy = read_json(LEGACY_SAVED_PUZZLES_KEY) ?? [];

    const migrated = legacy.map(({ color_map, map }, index) => ({
        id: generate_id(),
        name: `Saved ${index + 1}`,
        color_map,
        map,
    }));

    localStorage.setItem(PUZZLES_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_SAVED_PUZZLES_KEY);

    return migrated;
}

function write_entries(puzzles) {
    const entries = puzzles.map(({ map, color_map, built_in, ...entry }) =>
        built_in ? entry : { ...entry, map, color_map });

    localStorage.setItem(PUZZLES_KEY, JSON.stringify(entries));
}

export function load_puzzles() {
    const entries = read_entries();
    const ids = new Set(entries.map((entry) => entry.id));

    built_in_maps.forEach((map, index) => {
        const id = BUILT_IN_PREFIX + index;

        if (!ids.has(id))
            entries.push({ id, name: `Puzzle ${index + 1}` });
    });

    return entries.flatMap((entry) => {
        if (!entry.id.startsWith(BUILT_IN_PREFIX))
            return [entry];

        const map = built_in_maps[entry.id.slice(BUILT_IN_PREFIX.length)];

        if (!map)
            return [];

        return [{ ...entry, map, color_map: Configuaration.theme.color_map, built_in: true }];
    });
}

export function has_puzzle(map, except_id) {
    const serialized_map = JSON.stringify(map);

    return load_puzzles().some((puzzle) =>
        puzzle.id !== except_id && JSON.stringify(puzzle.map) === serialized_map);
}

export function add_puzzle({ name, color_map, map }) {
    const puzzles = load_puzzles();
    const id = generate_id();

    puzzles.push({ id, name, color_map, map });
    write_entries(puzzles);

    return id;
}

export function update_puzzle(id, { name, color_map, map }) {
    const puzzles = load_puzzles();
    const puzzle = puzzles.find((puzzle) => puzzle.id === id);

    if (!puzzle || puzzle.built_in)
        return;

    if (JSON.stringify(puzzle.map) !== JSON.stringify(map)) {
        delete puzzle.solution;
        delete puzzle.best_time;
        delete puzzle.solved_at;
    }

    Object.assign(puzzle, { name, color_map, map });
    write_entries(puzzles);
}

export function rename_puzzle(id, name) {
    const puzzles = load_puzzles();
    const puzzle = puzzles.find((puzzle) => puzzle.id === id);

    if (puzzle)
        puzzle.name = name;

    write_entries(puzzles);
}

export function record_solution(id, solution, time) {
    const puzzles = load_puzzles();
    const puzzle = puzzles.find((puzzle) => puzzle.id === id);

    if (!puzzle)
        return;

    puzzle.solution = solution;
    puzzle.best_time = Math.min(puzzle.best_time ?? Infinity, time);
    puzzle.solved_at ??= new Date().toISOString();

    write_entries(puzzles);
}

export function delete_puzzle(id) {
    write_entries(load_puzzles().filter((puzzle) => puzzle.id !== id));
}

export function reorder_puzzles(ids) {
    const puzzles = load_puzzles();
    const order = new Map(ids.map((id, index) => [id, index]));

    puzzles.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
    write_entries(puzzles);
}
