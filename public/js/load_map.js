const MIN_IMAGE_RESOLUTION = 1000;

const COLOR_SIMILARITY_THRESHOLD = 20;
const TILE_PADDING_RATIO = 0.05;

const GRID_SAMPLE_OUTER_RATIO = 0.08;
const GRID_SAMPLE_INNER_RATIO = 0.22;

const MIN_BOARD_DIMENSION = 200;
const BOARD_SQUARENESS_TOLERANCE = 0.05;
const MIN_BOARD_AREA = MIN_BOARD_DIMENSION * MIN_BOARD_DIMENSION;

export function load_map_from_image(image_element) {
    return new Promise((resolve, reject) => {
        let image = cv.imread(image_element);

        const color = image.ucharPtr(1, 1);
        const min_dimension = Math.min(image.cols, image.rows);

        if (min_dimension < MIN_IMAGE_RESOLUTION) {
            const ratio = MIN_IMAGE_RESOLUTION / min_dimension;
            cv.resize(image, image, new cv.Size(ratio * image.cols, ratio * image.rows));
        }

        cv.copyMakeBorder(image, image, 10, 10, 20, 20, cv.BORDER_CONSTANT, color);

        let edges = new cv.Mat();
        cv.Canny(image, edges, 100, 200);

        let kernel;

        kernel = new cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1)
        kernel.delete();

        kernel = cv.Mat.ones(9, 9, cv.CV_8U);
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        kernel.delete();

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();

        cv.findContours(edges, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
        edges.delete();

        let board_index = get_board_contour_index(contours, hierarchy);

        if (board_index === -1)
            return  reject('Could not find the board.');

        let children_data = get_children_contour_data(board_index, contours, hierarchy);

        let valid_tile_count = children_data.length;
        let divisions = Math.sqrt(valid_tile_count);
        let tile_colors;

        if (divisions >= 4 && divisions === Math.floor(divisions))
            tile_colors = get_tile_colors(divisions, children_data, image, contours, hierarchy);
        else {
            divisions = estimate_grid_divisions(children_data);

            if (divisions < 4)
                return reject('Error while parsing the board');

            tile_colors = get_grid_tile_colors(divisions, children_data, image);
        }

        let map_data = group_by_similar_color(tile_colors);

        if (map_data.color_map.length !== divisions)
            map_data = group_by_connected_regions(tile_colors, divisions);

        console.log('Board has divisions:', divisions);

        contours.delete();
        hierarchy.delete();
        image.delete();

        if (map_data.color_map.length !== divisions)
            return reject('Colors don\'t match width board dimensions');

        resolve(map_data);
    });
}

function is_similar(color1, color2, threshold) {
    return color1.every((c1, i) => Math.abs(c1 - color2[i]) < threshold);
}

function get_similar_color_index(color, color_map, threshold) {
    for (let i = 0; i < color_map.length; i++) {
        const existing_color = color_map[i];

        if (is_similar(existing_color, color, threshold))
            return i;
    }

    return -1;
}

function get_board_contour_index(contours, hierarchy) {
    let index = 0;
    let board_contour_index = -1;
    let largest_area = 0;
    let queue = [];

    let iterations = 0;

    while (largest_area < MIN_BOARD_AREA) {

        let next  = hierarchy.intPtr(0, index)[0];
        let child = hierarchy.intPtr(0, index)[2];

        if (child >= 0) {
            queue.push(child);

            iterations++;

            let contour = contours.get(index);
            let bounds = cv.boundingRect(contour);

            // is roughly a square
            if (Math.abs(bounds.width - bounds.height) <= BOARD_SQUARENESS_TOLERANCE * Math.max(bounds.width, bounds.height)) {
                let area = bounds.width * bounds.height;

                if (area > largest_area) {
                    board_contour_index = index;
                    largest_area = area;
                }
            }
        }

        if (next >= 0)
            index = next;

        else if (queue.length > 0)
            index = queue.shift();

        else break;
    }

    console.log('Found board in iterations:', iterations, 'out of contours:', contours.size());
    return board_contour_index;
}

function get_children_contour_data(board_contour_index, contours, hierarchy) {
    let children_contour_data = [];
    let child_index = hierarchy.intPtr(0, board_contour_index)[2];

    while (child_index !== -1) {
        let bounds = cv.boundingRect(contours.get(child_index));

        if (bounds.width > 20 && bounds.height > 20)
            children_contour_data.push({index: child_index, bounds});

        child_index = hierarchy.intPtr(0, child_index)[0];
    }

    return children_contour_data;
}

function get_tile_colors(divisions, children_data, image, contours, hierarchy) {
    let tile_colors = [];

    const white = new cv.Scalar(255);
    const black = new cv.Scalar(0);

    for (let i = 0; i < divisions; i++)
        tile_colors.push([]);

    let translated_contours = new cv.MatVector();

    for (let y = 0; y < divisions; y++) {
        let row = children_data.splice(children_data.length - divisions, divisions);
        row = row.sort((a, b) => a.bounds.x - b.bounds.x);

        for (let x = 0; x < divisions; x++) {
            let item = row[x];
            let tile = image.roi(item.bounds);

            let child_index = hierarchy.intPtr(0, item.index)[2];

            let mask = new cv.Mat.zeros(tile.rows, tile.cols, cv.CV_8UC1);
            let padding = tile.cols * TILE_PADDING_RATIO;

            cv.rectangle(mask,
                {x: padding, y: padding},
                {x: tile.cols - padding, y: tile.rows - padding}, white, -1);

            if (child_index !== -1) {
                let transformation = cv.matFromArray(2, 3, cv.CV_32F,
                    [1, 0, -item.bounds.x,
                     0, 1, -item.bounds.y]);

                let contour = contours.get(child_index);
                translated_contours.push_back(contour);
                cv.transform(contour, contour, transformation);

                let index = translated_contours.size() - 1;
                cv.drawContours(mask, translated_contours, index, black, -1);

                transformation.delete();
            }

            let composite = new cv.Mat();
            cv.bitwise_and(tile, tile, composite, mask);

            tile_colors[y][x] = cv.mean(composite, mask).map(Math.round);

            tile.delete();
            mask.delete();
            composite.delete();
        }
    }

    translated_contours.delete();

    return tile_colors;
}

function to_css_color(color) {
    return `rgb(${color.join(',')})`;
}

function group_by_similar_color(tile_colors) {
    let color_map = [];

    const map = tile_colors.map((row) => row.map((color) => {
        let index = get_similar_color_index(color, color_map, COLOR_SIMILARITY_THRESHOLD);

        if (index === -1) {
            color_map.push(color);
            index = color_map.length - 1;
        }

        return index;
    }));

    return { color_map: color_map.map(to_css_color), map };
}

function color_distance(color1, color2) {
    return Math.hypot(...color1.map((c, i) => c - color2[i]));
}

// regions are contiguous, so merging the most similar neighbouring tiles first
// tolerates gradual lighting changes across the board
function group_by_connected_regions(tile_colors, divisions) {
    const parent = Array.from({ length: divisions * divisions }, (_, i) => i);
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));

    const edges = [];

    for (let y = 0; y < divisions; y++) {
        for (let x = 0; x < divisions; x++) {
            const index = x + y * divisions;

            if (x + 1 < divisions)
                edges.push({ a: index, b: index + 1,
                    distance: color_distance(tile_colors[y][x], tile_colors[y][x + 1]) });

            if (y + 1 < divisions)
                edges.push({ a: index, b: index + divisions,
                    distance: color_distance(tile_colors[y][x], tile_colors[y + 1][x]) });
        }
    }

    edges.sort((a, b) => a.distance - b.distance);

    let regions = divisions * divisions;

    for (const { a, b } of edges) {
        if (regions === divisions)
            break;

        const root_a = find(a);
        const root_b = find(b);

        if (root_a !== root_b) {
            parent[root_a] = root_b;
            regions--;
        }
    }

    const region_indices = new Map();
    const region_colors = [];

    const map = tile_colors.map((row, y) => row.map((color, x) => {
        const root = find(x + y * divisions);

        if (!region_indices.has(root)) {
            region_indices.set(root, region_colors.length);
            region_colors.push([]);
        }

        const index = region_indices.get(root);
        region_colors[index].push(color);

        return index;
    }));

    const color_map = region_colors.map((colors) =>
        to_css_color(colors[0].map((_, c) =>
            Math.round(colors.reduce((sum, color) => sum + color[c], 0) / colors.length))));

    return { color_map, map };
}


function get_grid_bounds(children_data) {
    const bounds = children_data.map((child) => child.bounds);

    return {
        left: Math.min(...bounds.map(({ x }) => x)),
        top: Math.min(...bounds.map(({ y }) => y)),
        right: Math.max(...bounds.map(({ x, width }) => x + width)),
        bottom: Math.max(...bounds.map(({ y, height }) => y + height)),
    };
}

function estimate_grid_divisions(children_data) {
    if (children_data.length === 0)
        return 0;

    const sizes = children_data
        .map(({ bounds }) => Math.min(bounds.width, bounds.height))
        .sort((a, b) => a - b);

    const tile_size = sizes[Math.floor(sizes.length / 2)];
    const { left, top, right, bottom } = get_grid_bounds(children_data);

    const columns = Math.round((right - left) / tile_size);
    const rows = Math.round((bottom - top) / tile_size);

    return columns === rows ? columns : 0;
}

function median(values) {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
}

function sample_tile_color(image, x, y, width, height) {
    const channels = image.channels();
    const samples = Array.from({ length: channels }, () => []);

    const outer_x = width * GRID_SAMPLE_OUTER_RATIO;
    const outer_y = height * GRID_SAMPLE_OUTER_RATIO;
    const inner_x = width * GRID_SAMPLE_INNER_RATIO;
    const inner_y = height * GRID_SAMPLE_INNER_RATIO;

    for (let dy = outer_y; dy < height - outer_y; dy++) {
        for (let dx = outer_x; dx < width - outer_x; dx++) {
            const is_center = dx > inner_x && dx < width - inner_x &&
                              dy > inner_y && dy < height - inner_y;

            if (is_center)
                continue;

            const offset = (Math.floor(y + dy) * image.cols + Math.floor(x + dx)) * channels;

            for (let c = 0; c < channels; c++)
                samples[c].push(image.data[offset + c]);
        }
    }

    return samples.map(median);
}

function get_grid_tile_colors(divisions, children_data, image) {
    const { left, top, right, bottom } = get_grid_bounds(children_data);
    const tile_width = (right - left) / divisions;
    const tile_height = (bottom - top) / divisions;

    return Array.from({ length: divisions }, (_, y) =>
        Array.from({ length: divisions }, (_, x) =>
            sample_tile_color(image,
                left + x * tile_width, top + y * tile_height, tile_width, tile_height)));
}
