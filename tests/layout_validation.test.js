import { describe, expect, it } from 'vitest';
import { find_layout_issues } from '../public/js/layout_validation.js';

describe('find_layout_issues', () => {
    it('accepts N connected regions', () => {
        expect(find_layout_issues([
            [0, 0, 1, 1],
            [0, 2, 2, 1],
            [3, 3, 2, 1],
            [3, 3, 3, 1],
        ])).toEqual([]);
    });

    it('reports unused colors', () => {
        expect(find_layout_issues([
            [0, 0, 1, 1],
            [0, 0, 1, 1],
            [2, 2, 1, 1],
            [2, 2, 1, 1],
        ])).toEqual([{ color: 3, type: 'unused' }]);
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
