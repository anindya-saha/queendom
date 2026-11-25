function count_regions(map, color) {
    const size = map.length;
    const visited = new Set();
    let regions = 0;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (map[y][x] !== color || visited.has(x + y * size))
                continue;

            regions++;
            const stack = [[x, y]];
            visited.add(x + y * size);

            while (stack.length) {
                const [cx, cy] = stack.pop();

                for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
                    if (nx < 0 || ny < 0 || nx >= size || ny >= size)
                        continue;

                    if (map[ny][nx] !== color || visited.has(nx + ny * size))
                        continue;

                    visited.add(nx + ny * size);
                    stack.push([nx, ny]);
                }
            }
        }
    }

    return regions;
}

export function find_layout_issues(map) {
    const issues = [];

    for (let color = 0; color < map.length; color++) {
        const regions = count_regions(map, color);

        if (regions === 0)
            issues.push({ color, type: 'unused' });
        else if (regions > 1)
            issues.push({ color, type: 'split', regions });
    }

    return issues;
}
