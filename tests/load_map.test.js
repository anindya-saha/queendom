import { createRequire } from 'module';
import { readFileSync } from 'fs';
import jpeg from 'jpeg-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { default_map } from '../public/js/maps.js';

const require = createRequire(import.meta.url);

let load_map_from_image;

async function init_opencv() {
    let cv = require('../public/static/vendor/opencv.js');

    if (cv instanceof Promise)
        cv = await cv;

    if (!cv.Mat)
        await new Promise((resolve) => cv.onRuntimeInitialized = resolve);

    return cv;
}

function load(image_data) {
    globalThis.cv.imread = () => globalThis.cv.matFromImageData(image_data);
    return load_map_from_image(null);
}

function draw_board(map, tile_size = 60, margin = 30) {
    const { cv } = globalThis;
    const size = map.length * tile_size + margin * 2;
    const image = new cv.Mat(size, size, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));

    const palette = [
        [183, 165, 221], [164, 190, 249], [231, 242, 151], [241, 203, 154],
        [229, 130, 104], [223, 223, 223], [183, 178, 160], [190, 221, 167],
        [177, 209, 215], [153, 236, 233], [209, 163, 189],
    ];

    map.forEach((row, y) => row.forEach((color, x) => {
        const top_left = new cv.Point(margin + x * tile_size, margin + y * tile_size);
        const bottom_right = new cv.Point(top_left.x + tile_size, top_left.y + tile_size);

        cv.rectangle(image, top_left, bottom_right, new cv.Scalar(...palette[color - 1], 255), -1);
        cv.rectangle(image, top_left, bottom_right, new cv.Scalar(60, 60, 60, 255), 1);
    }));

    cv.rectangle(image, new cv.Point(margin, margin),
        new cv.Point(size - margin, size - margin), new cv.Scalar(0, 0, 0, 255), 4);

    const data = new Uint8ClampedArray(image.data);
    image.delete();

    return { data, width: size, height: size };
}

function same_regions(actual, expected) {
    const mapping = new Map();

    return actual.every((row, y) => row.every((value, x) => {
        if (!mapping.has(value))
            mapping.set(value, expected[y][x]);

        return mapping.get(value) === expected[y][x];
    })) && new Set(mapping.values()).size === mapping.size;
}

beforeAll(async () => {
    globalThis.cv = await init_opencv();
    ({ load_map_from_image } = await import('../public/js/load_map.js'));
}, 60000);

describe('load_map_from_image', () => {
    it('reads a clean generated board', async () => {
        const { map, color_map } = await load(draw_board(default_map));

        expect(color_map).toHaveLength(9);
        expect(same_regions(map, default_map)).toBe(true);
    });

    it('reads a photo of a screen with uneven lighting', async () => {
        const photo = jpeg.decode(readFileSync(new URL('./fixtures/photo-9x9.jpeg', import.meta.url)), { useTArray: true });
        const { map } = await load(photo);

        expect(map).toEqual([
            [0, 0, 0, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 2, 2, 2, 2, 1, 1],
            [0, 0, 3, 2, 4, 4, 4, 4, 1],
            [5, 5, 3, 6, 6, 6, 6, 4, 1],
            [5, 3, 3, 6, 7, 6, 4, 4, 1],
            [5, 3, 6, 6, 6, 6, 4, 5, 1],
            [5, 3, 3, 3, 8, 4, 4, 5, 1],
            [5, 5, 8, 8, 8, 4, 5, 5, 1],
            [5, 5, 5, 5, 5, 5, 5, 1, 1],
        ]);
    });
});
