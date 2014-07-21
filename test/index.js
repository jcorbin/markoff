var test = require('tape');

var markoff = require('../index.js');

test('markoff is a function', function (assert) {
    assert.strictEqual(typeof markoff, 'function');
    assert.end();
});
