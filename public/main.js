import { Game, Global } from './js/game.js';
import { load_map_from_image } from './js/load_map.js';
import { load_opencv } from './js/opencv_loader.js';
import { render_puzzle_select } from './js/puzzle_select.js';
import { BoardEditor } from './js/editor.js';
import {
    load_puzzles, has_puzzle, add_puzzle, update_puzzle,
    rename_puzzle, delete_puzzle, reorder_puzzles, record_solution,
} from './js/storage.js';

const game = new Game();
const editor = new BoardEditor();
let current_puzzle_id;

main();

function main() {
    register_actions();
    hide_loading_banner();

    game.start();
    show_puzzle_select();
}

function show_view(id) {
    for (const view of document.querySelectorAll('.view'))
        view.classList.toggle('not-rendered', view.id !== id);
}

function show_puzzle_select() {
    game.reset();
    show_view('puzzle-select');
}

function show_game({ id, color_map, map }) {
    current_puzzle_id = id;

    show_view('game-view');
    game.reload({ color_map, map });
    update_solution_button();
}

function show_editor(puzzle = {}) {
    show_view('editor-view');
    editor.open({ default_name: `Puzzle ${load_puzzles().length + 1}`, ...puzzle });
}

function save_edited_puzzle({ id, name, color_map, map }) {
    if (has_puzzle(map, id)) {
        alert('A puzzle with this layout already exists.');
        return false;
    }

    if (id)
        update_puzzle(id, { name, color_map, map });
    else
        add_puzzle({ name, color_map, map });

    refresh_puzzle_select();
    show_puzzle_select();
    return true;
}

function get_current_puzzle() {
    return load_puzzles().find((puzzle) => puzzle.id === current_puzzle_id);
}

function update_solution_button() {
    document.getElementById('btn-solution').classList
        .toggle('not-rendered', !get_current_puzzle()?.solution);
}

function refresh_puzzle_select() {
    render_puzzle_select(document.getElementById('puzzle-grid'), load_puzzles(), {
        on_select: show_game,
        on_edit: show_editor,
        on_reorder: reorder_puzzles,

        on_rename: ({ id, name }) => {
            const new_name = prompt('Rename puzzle', name)?.trim();

            if (!new_name)
                return;

            rename_puzzle(id, new_name);
            refresh_puzzle_select();
        },

        on_delete: ({ id, name }) => {
            if (!confirm(`Delete "${name}"?`))
                return;

            delete_puzzle(id);
            refresh_puzzle_select();
        },
    });
}

let is_popup_deferred = false;

function register_actions() {
    const btn_clear = document.getElementById('btn-clear');
    const btn_load = document.getElementById('btn-load');
    const btn_new_puzzle = document.getElementById('btn-new-puzzle');
    const btn_auto_marks = document.getElementById('btn-auto-marks');
    const btn_back = document.getElementById('btn-back');
    const btn_solution = document.getElementById('btn-solution');
    const btn_undo = document.getElementById('btn-undo');
    const file_picker = document.getElementById('file-picker');
    const image = document.getElementById('load-target');

    image.onload = async () => {
        await load_opencv()
            .then(() => load_map_from_image(image))
            .then((puzzle) => show_editor({ ...puzzle, trace_src: image.src }))
            .catch((error) => {
                console.log(error);
                is_popup_deferred = true;
                show_editor({ trace_src: image.src });
            });

        hide_loading_banner();

    };

    file_picker.onchange = (e) => {
        let file = e.target.files[0];
        e.target.value = '';

        if (!file)
            return;

        show_loading_banner();

        let reader = new FileReader();

        reader.onload = (e) => image.src = e.target.result;
        reader.readAsDataURL(file);
    };

    const loader = document.getElementById('loading-banner');

    loader.addEventListener('transitionend', () => {
        loader.classList.add('not-rendered');
    });

    document.querySelector('.spinner').addEventListener('animationend', () => {
        loader.classList.add('hidden');

        if (is_popup_deferred) {
            show_error_popup();
            is_popup_deferred = false;
        }
    });

    document.addEventListener('click', () => {
        hide_error_popup();
    });

    btn_clear.onclick = () => game.clear();
    btn_back.onclick = () => show_puzzle_select();
    btn_new_puzzle.onclick = () => show_editor();

    editor.handlers.on_save = save_edited_puzzle;
    editor.handlers.on_close = show_puzzle_select;
    btn_undo.onclick = () => game.undo();

    game.board.handlers.on_history_changed = (length) => {
        btn_undo.disabled = length === 0;
        btn_undo.classList.toggle('disabled', length === 0);
    };

    document.addEventListener('keydown', (e) => {
        const is_game_visible = !document.getElementById('game-view').classList.contains('not-rendered');

        if (is_game_visible && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            game.undo();
        }
    });
    btn_solution.onclick = () => game.show_solution(get_current_puzzle().solution);

    game.handlers.on_completed = (solution, time) => {
        record_solution(current_puzzle_id, solution, time);
        refresh_puzzle_select();
        update_solution_button();
    };

    refresh_puzzle_select();

    btn_auto_marks.onclick = () => {
        Global.auto_marks = !Global.auto_marks;
        btn_auto_marks.innerText = `Auto X: ${Global.auto_marks ? 'On' : 'Off'}`;
    };
    btn_load.onclick = () => {
        load_opencv().catch(console.log);
        file_picker.click();
    };
}

function show_loading_banner() {
    document.querySelector('.spinner-bar').style.animationPlayState = 'running';
    document.getElementById('loading-banner')
        .classList.remove('animate-closing', 'not-rendered', 'hidden');
}

function hide_loading_banner() {
    setTimeout(() => {
        document.querySelector('.spinner-bar').style.animationPlayState = 'paused';
        document.getElementById('loading-banner').classList.add('animate-closing');
    }, 500);
}

function show_error_popup() {
    const error_popup = document.getElementById('error-popup');
    error_popup.style.display = 'flex';
    error_popup.classList.add('animate-popup');

    game.input.disable();
}

function hide_error_popup() {
    const error_popup = document.getElementById('error-popup');
    error_popup.style.display = 'none';
    error_popup.classList.remove('animate-popup');

    game.input.enable();
}
