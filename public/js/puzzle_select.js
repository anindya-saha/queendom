import { format_time } from './format.js';

function create_action_button(class_name, title, text, on_click) {
    const button = document.createElement('button');
    button.className = `puzzle-action ${class_name}`;
    button.title = title;
    button.innerText = text;
    button.onclick = (e) => {
        e.stopPropagation();
        on_click?.();
    };

    return button;
}

function enable_dragging(container, tile, handle, on_reorder) {
    handle.onpointerdown = (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        tile.classList.add('dragging');

        handle.onpointermove = (e) => {
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.puzzle-tile');

            if (!target || target === tile || target.parentElement !== container)
                return;

            const tiles = [...container.children];

            if (tiles.indexOf(target) > tiles.indexOf(tile))
                target.after(tile);
            else
                target.before(tile);
        };

        handle.onpointerup = handle.onpointercancel = () => {
            handle.onpointermove = handle.onpointerup = handle.onpointercancel = null;
            tile.classList.remove('dragging');
            on_reorder([...container.children].map((child) => child.dataset.id));
        };
    };
}

export function render_puzzle_select(container, puzzles, handlers) {
    const { on_select, on_rename, on_edit, on_delete, on_reorder } = handlers;

    container.replaceChildren();

    for (const puzzle of puzzles) {
        const { id, name, map, color_map, built_in, solution, best_time } = puzzle;

        const tile = document.createElement('div');
        tile.className = solution ? 'puzzle-tile solved' : 'puzzle-tile';
        tile.dataset.id = id;
        tile.onclick = () => on_select(puzzle);

        const preview = document.createElement('div');
        preview.className = 'puzzle-preview';
        preview.style.gridTemplateColumns = `repeat(${map[0].length}, 1fr)`;

        for (const row of map) {
            for (const color of row) {
                const cell = document.createElement('div');
                cell.style.backgroundColor = color_map[color];
                preview.appendChild(cell);
            }
        }

        const label = document.createElement('span');
        label.className = 'puzzle-label';
        label.innerText = name;

        const size = document.createElement('span');
        size.className = 'puzzle-size';
        size.innerText = `${map.length}×${map[0].length}`;

        if (solution)
            size.innerText += ` · ✓ ${format_time(best_time)}`;

        const handle = create_action_button('puzzle-handle', 'Drag to reorder', '⠿');
        enable_dragging(container, tile, handle, on_reorder);

        const actions = document.createElement('div');
        actions.className = 'puzzle-actions';
        if (built_in)
            actions.appendChild(create_action_button('puzzle-rename', 'Rename puzzle', '✎', () => on_rename(puzzle)));
        else
            actions.appendChild(create_action_button('puzzle-edit', 'Edit puzzle', '✎', () => on_edit(puzzle)));

        if (!built_in)
            actions.appendChild(create_action_button('puzzle-delete', 'Delete puzzle', '×', () => on_delete(puzzle)));

        tile.append(preview, label, size, handle, actions);
        container.appendChild(tile);
    }
}
