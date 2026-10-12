#!/usr/bin/env node
import assert from 'node:assert/strict';
import { isGreenleafPersistedImageUrl } from '../src/utils/greenleafProductImages.ts';

assert.equal(isGreenleafPersistedImageUrl('data:image/png;base64,abc'), true);
assert.equal(isGreenleafPersistedImageUrl('/product-images/p-12.svg'), false);
assert.equal(isGreenleafPersistedImageUrl('/product-images/lima-1001.svg'), false);
console.log('greenleaf image policy smoke: PASS');
