const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = path.join(__dirname, '../public/static/og-image.png');

const BOARD = [
    [7, 7, 7, 4, 4, 4, 4, 4, 4],
    [2, 7, 8, 4, 5, 4, 6, 4, 5],
    [2, 8, 8, 4, 5, 4, 6, 4, 5],
    [2, 2, 8, 4, 5, 6, 6, 6, 5],
    [2, 2, 2, 4, 5, 5, 5, 5, 5],
    [2, 3, 2, 4, 4, 4, 4, 4, 4],
    [3, 3, 2, 2, 2, 2, 11, 11, 11],
    [3, 1, 1, 1, 11, 2, 11, 11, 11],
    [1, 1, 1, 11, 11, 11, 11, 11, 11],
];

const QUEENS = [[0, 0], [7, 1], [2, 2], [6, 3], [4, 4], [1, 5], [5, 6], [3, 7], [8, 8]];

const COLORS = {
    1: '#b7a5dd', 2: '#a4bef9', 3: '#e7f297', 4: '#f1cb9a', 5: '#e58268', 6: '#dfdfdf',
    7: '#b7b2a0', 8: '#bedda7', 9: '#b1d1d7', 10: '#99ece9', 11: '#d1a3bd',
};

function rgba(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [value >> 16, (value >> 8) & 255, value & 255, 255];
}

function encode_png(rgba_data, width, height) {
    const rows = Buffer.alloc((width * 4 + 1) * height);

    for (let y = 0; y < height; y++) {
        rows[y * (width * 4 + 1)] = 0;
        Buffer.from(rgba_data.buffer, rgba_data.byteOffset + y * width * 4, width * 4)
            .copy(rows, y * (width * 4 + 1) + 1);
    }

    const chunk = (type, data) => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);

        const body = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(zlib.crc32(body));

        return Buffer.concat([length, body, crc]);
    };

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 6, 0, 0, 0], 8);

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function draw_queen(cv, image, cx, cy, size) {
    const scale = size / 100;
    const point = (x, y) => new cv.Point(Math.round(cx + (x - 50) * scale), Math.round(cy + (y - 45) * scale));
    const gold = new cv.Scalar(...rgba('#e0a526'));
    const outline = new cv.Scalar(...rgba('#8a6508'));

    const crown = [[66, 54], [50, 6], [34, 54], [5, 29], [18, 78], [82, 78], [95, 29]];
    const polygon = cv.matFromArray(crown.length, 1, cv.CV_32SC2, crown.flatMap(([x, y]) => {
        const p = point(x, y);
        return [p.x, p.y];
    }));

    const polygons = new cv.MatVector();
    polygons.push_back(polygon);
    cv.fillPoly(image, polygons, gold, cv.LINE_AA);
    cv.polylines(image, polygons, true, outline, 2, cv.LINE_AA);

    for (const [x, y] of [[50, 5], [95, 28], [5, 28]])
        cv.circle(image, point(x, y), Math.round(5 * scale), gold, -1, cv.LINE_AA);

    cv.rectangle(image, point(15, 82), point(85, 90), gold, -1, cv.LINE_AA);

    polygons.delete();
    polygon.delete();
}

function draw_text(cv, image, text, x, y, scale, color, thickness) {
    cv.putText(image, text, new cv.Point(x, y), cv.FONT_HERSHEY_DUPLEX,
        scale, new cv.Scalar(...rgba(color)), thickness, cv.LINE_AA);
}

async function main() {
    let cv = require('../public/static/vendor/opencv.js');

    if (cv instanceof Promise)
        cv = await cv;

    if (!cv.Mat)
        await new Promise((resolve) => cv.onRuntimeInitialized = resolve);

    const image = new cv.Mat(HEIGHT, WIDTH, cv.CV_8UC4, new cv.Scalar(...rgba('#f6f4ef')));

    const tile = 58;
    const left = 60;
    const top = (HEIGHT - tile * BOARD.length) / 2;
    const separator = new cv.Scalar(...rgba('#444444'));
    const border = new cv.Scalar(0, 0, 0, 255);

    BOARD.forEach((row, y) => row.forEach((color, x) => {
        const p1 = new cv.Point(left + x * tile, top + y * tile);
        const p2 = new cv.Point(p1.x + tile, p1.y + tile);

        cv.rectangle(image, p1, p2, new cv.Scalar(...rgba(COLORS[color])), -1);
        cv.rectangle(image, p1, p2, separator, 1);
    }));

    BOARD.forEach((row, y) => row.forEach((color, x) => {
        const cx = left + x * tile;
        const cy = top + y * tile;

        if (x + 1 < row.length && row[x + 1] !== color)
            cv.line(image, new cv.Point(cx + tile, cy), new cv.Point(cx + tile, cy + tile), border, 3);

        if (y + 1 < BOARD.length && BOARD[y + 1][x] !== color)
            cv.line(image, new cv.Point(cx, cy + tile), new cv.Point(cx + tile, cy + tile), border, 3);
    }));

    const size = tile * BOARD.length;
    cv.rectangle(image, new cv.Point(left, top), new cv.Point(left + size, top + size), border, 5);

    for (const [x, y] of QUEENS)
        draw_queen(cv, image, left + x * tile + tile / 2, top + y * tile + tile / 2, tile * 0.55);

    const text_left = left + size + 70;
    draw_text(cv, image, 'Queendom', text_left, 200, 2.3, '#695fdb', 5);

    const lines = [
        'Unlimited Queens Puzzles',
        'Draw Your Own Boards',
        'Import from Screenshots',
        'Auto X, Undo, Solutions',
    ];

    lines.forEach((line, index) => {
        const y = 300 + index * 70;
        cv.circle(image, new cv.Point(text_left + 10, y - 12), 7, new cv.Scalar(...rgba('#695fdb')), -1, cv.LINE_AA);
        draw_text(cv, image, line, text_left + 35, y, 1.15, '#333333', 2);
    });

    fs.writeFileSync(OUTPUT, encode_png(image.data, WIDTH, HEIGHT));
    image.delete();

    console.log('Wrote', path.relative(process.cwd(), OUTPUT));
}

main();
