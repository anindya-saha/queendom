import { describe, expect, it } from 'vitest';
import { find_layout_issues, get_used_colors } from '../public/js/layout_validation.js';

describe('find_layout_issues', () => {
    it('accepts N connected regions of any palette colors', () => {
        expect(find_layout_issues([
            [3, 3, 9, 9],
            [3, 7, 7, 9],
            [0, 0, 7, 9],
            [0, 0, 0, 9],
        ])).toEqual([]);
    });

    it('reports too few colors', () => {
        expect(find_layout_issues([
            [0, 0, 8, 8],
            [0, 0, 8, 8],
            [2, 2, 8, 8],
            [2, 2, 8, 8],
        ])).toEqual([{ type: 'color_count', used: 3, required: 4 }]);
    });

    it('reports too many colors', () => {
        expect(find_layout_issues([
            [0, 1, 2, 3],
            [4, 4, 4, 4],
            [4, 4, 4, 4],
            [4, 4, 4, 4],
        ])).toEqual([{ type: 'color_count', used: 5, required: 4 }]);
    });

    it('reports colors split into several areas', () => {
        expect(find_layout_issues([
            [0, 1, 0, 3],
            [1, 1, 2, 3],
            [2, 2, 2, 3],
            [3, 3, 3, 3],
        ])).toEqual([{ color: 0, type: 'split', regions: 2 }]);
    });

    it('treats diagonal neighbours as separate areas', () => {
        expect(find_layout_issues([
            [0, 1, 2, 3],
            [1, 0, 2, 3],
            [2, 2, 2, 3],
            [3, 3, 3, 3],
        ])).toEqual([
            { color: 0, type: 'split', regions: 2 },
            { color: 1, type: 'split', regions: 2 },
        ]);
    });
});

describe('get_used_colors', () => {
    it('lists colors in order of first appearance', () => {
        expect(get_used_colors([[5, 2], [2, 9]])).toEqual([5, 2, 9]);
    });
});
