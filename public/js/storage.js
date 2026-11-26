import { Configuaration } from './configure.js';
import { puzzles as built_in_puzzles } from './maps.js';

const PUZZLES_KEY = 'queendom.puzzles';
const PREVIOUS_PUZZLES_KEY = 'queens-clone.puzzles';
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

    const previous = read_json(PREVIOUS_PUZZLES_KEY);

    if (previous) {
        localStorage.setItem(PUZZLES_KEY, JSON.stringify(previous));
        localStorage.removeItem(PREVIOUS_PUZZLES_KEY);
        return previous;
    }

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

function to_layout_key(map) {
    const labels = new Map();

    return JSON.stringify(map.map((row) => row.map((value) => {
        if (!labels.has(value))
            labels.set(value, labels.size);

        return labels.get(value);
    })));
}

function merge_progress(built_in, saved) {
    if (!saved.solution)
        return;

    built_in.solution ??= saved.solution;
    built_in.best_time = Math.min(built_in.best_time ?? Infinity, saved.best_time ?? Infinity);

    if (!built_in.solved_at || (saved.solved_at && saved.solved_at < built_in.solved_at))
        built_in.solved_at = saved.solved_at;
}

export function load_puzzles() {
    const entries = read_entries();
    const ids = new Set(entries.map((entry) => entry.id));

    built_in_puzzles.forEach(({ name }, index) => {
        const id = BUILT_IN_PREFIX + index;

        if (!ids.has(id))
            entries.push({ id, name });
    });

    const puzzles = entries.flatMap((entry) => {
        if (!entry.id.startsWith(BUILT_IN_PREFIX))
            return [entry];

        const built_in = built_in_puzzles[entry.id.slice(BUILT_IN_PREFIX.length)];

        if (!built_in)
            return [];

        return [{ ...entry, map: built_in.map, color_map: Configuaration.theme.color_map, built_in: true }];
    });

    const built_ins_by_layout = new Map(puzzles
        .filter((puzzle) => puzzle.built_in)
        .map((puzzle) => [to_layout_key(puzzle.map), puzzle]));

    return puzzles.filter((puzzle) => {
        const built_in = !puzzle.built_in && built_ins_by_layout.get(to_layout_key(puzzle.map));

        if (built_in)
            merge_progress(built_in, puzzle);

        return !built_in;
    });
}

export function has_puzzle(map, except_id) {
    const layout_key = to_layout_key(map);

    return load_puzzles().some((puzzle) =>
        puzzle.id !== except_id && to_layout_key(puzzle.map) === layout_key);
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
