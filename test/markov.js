var Markov = require('../markov');
var createTestObjects = require('./object');

var markovTest = createTestObjects.wrapper({
    type: Markov,
    expected: function() {
        var start = new Array(this.args && this.args[0] && this.args[0].stateSize || 1);
        for (var i=0, n=start.length; i<n; i++) start[i] = null;
        start = String(start);
        var exp = {
            transitions: {}
        };
        exp.transitions[start] = [];
        return exp;
    }
}, ['markov']);

markovTest('Markov addTokens', function(assert) {
    assert.markov.okSteps([
        {
            op: ['addTokens', []]
        },
        {
            op: ['addTokens', 'this is a testing sentence'.split(' ')],
            expect: {
                transitions: {
                    '': [[1, 'this']],
                    this: [[1, 'is']],
                    is: [[1, 'a']],
                    a: [[1, 'testing']],
                    testing: [[1, 'sentence']],
                    sentence: [[1, null]],
                }
            }
        },
        {
            op: ['addTokens', 'here is another testing sentence'.split(' ')],
            expect: {
                transitions: {
                    '': [[1, 'here'], [1, 'this']],
                    here: [[1, 'is']],
                    is: [[1, 'a'], [1, 'another']],
                    another: [[1, 'testing']],
                    testing: [[2, 'sentence']],
                    sentence: [[2, null]],
                }
            }
        }
    ]);
    assert.end();
});

markovTest('Markov special keywords', function(assert) {
    assert.markov.okStep({
        op: ['addTokens', 'the token constructor is special'.split(' ')],
        expect: {
            transitions: {
                '': [[1, 'the']],
                the: [[1, 'token']],
                token: [[1, 'constructor']],
                constructor: [[1, 'is']],
                is: [[1, 'special']],
                special: [[1, null]]
            }
        },
    });
    assert.end();
});

markovTest('Markov save/load', function(assert) {
    assert.markov.okStep({
        op: function setup(markov) {
            markov.addTokens('a b c'.split(' '));
            markov.addTokens('a b d'.split(' '));
            markov.addTokens('c e g'.split(' '));
        },
        expect: {
            transitions: {
                '': [[2, 'a'], [1, 'c']],
                a: [[2, 'b']],
                b: [[1, 'c'], [1, 'd']],
                c: [[1, 'e'], [1, null]],
                d: [[1, null]],
                e: [[1, 'g']],
                g: [[1, null]],
            }
        }
    });
    var data = assert.markov.the.save();
    assert.deepEqual(data, {
        stateSize: 1,
        transitions: assert.markov.expected.transitions
    }, 'saved data matches');
    var copy = Markov.load(data);
    assert.deepEqual(copy.transitions, assert.markov.expected.transitions, 'loaded transitions');
    assert.end();
});

markovTest('Markov createState', {
    markov1: null,
    markov2: {
        args: [{stateSize: 2}]
    },
    markov3: {
        args: [{stateSize: 3}]
    }
}, function(assert) {

    assert.equal(
        String(assert.markov1.the.createState('wat')),
        'wat',
        'markov1 createState wats'
    );

    assert.equal(
        String(assert.markov2.the.createState('wat')),
        ',wat',
        'markov2 createState wats'
    );

    assert.equal(
        String(assert.markov3.the.createState('wat')),
        ',,wat',
        'markov3 createState wats'
    );

    assert.equal(
        String(assert.markov1.the.createState('beep', 'boop')),
        'beep',
        'markov2 createState beeps but doesn\'t boop'
    );

    assert.equal(
        String(assert.markov2.the.createState('beep', 'boop')),
        'beep,boop',
        'markov2 createState beep boops'
    );

    assert.equal(
        String(assert.markov3.the.createState('beep', 'boop')),
        ',beep,boop',
        'markov3 createState beep boops'
    );

    assert.equal(
        String(assert.markov1.the.createState('beep', 'boop', 'blip')),
        'beep',
        'markov2 createState beeps but doesn\'t boop or blip'
    );

    assert.equal(
        String(assert.markov2.the.createState('beep', 'boop', 'blip')),
        'beep,boop',
        'markov2 createState beep and boops but doesn\'t blip'
    );

    assert.equal(
        String(assert.markov3.the.createState('beep', 'boop', 'blip')),
        'beep,boop,blip',
        'markov3 createState beep boops and blips'
    );


    assert.end();
});

markovTest('Markov merge', {
    markova: null,
    markovb: null,
    markovc: {args: [{stateSize: 2}]}
}, function(assert) {
    assert.markova.okStep({
        op: ['addTokens', ['this', 'is', 'a', 'testing', 'sentence']],
        expect: {
            transitions: {
                '': [[1, 'this']],
                this: [[1, 'is']],
                is: [[1, 'a']],
                a: [[1, 'testing']],
                testing: [[1, 'sentence']],
                sentence: [[1, null]],
            }
        }
    });
    assert.markovb.okStep({
        op: ['addTokens', ['here', 'is', 'another', 'testing', 'sentence']],
        expect: {
            transitions: {
                '': [[1, 'here']],
                here: [[1, 'is']],
                is: [[1, 'another']],
                another: [[1, 'testing']],
                testing: [[1, 'sentence']],
                sentence: [[1, null]],
            }
        }
    });
    assert.markova.the.merge(assert.markovb.the);
    assert.markova.okState('after markova.merge(markovb)', {
        transitions: {
            '': [[1, 'here'], [1, 'this']],
            this: [[1, 'is']],
            here: [[1, 'is']],
            is: [[1, 'a'], [1, 'another']],
            a: [[1, 'testing']],
            another: [[1, 'testing']],
            testing: [[2, 'sentence']],
            sentence: [[2, null]],
        }
    });
    assert.throws(function() {
        assert.markova.the.merge(assert.markovc.the);
    }, /differing state size/, 'cannot merge different sized markovs');
    assert.end();
});

markovTest('Build a 2-markov', {
    markov: {
        args: [{stateSize: 2}]
    }
}, function(assert) {
    assert.markov.okSteps([
        {
            op: ['addTokens', 'now is the time for action'.split(' ')],
            expect: {
                transitions: {
                    ',': [[1, 'now']],
                    ',now': [[1, 'is']],
                    'now,is': [[1, 'the']],
                    'is,the': [[1, 'time']],
                    'the,time': [[1, 'for']],
                    'time,for': [[1, 'action']],
                    'for,action': [[1, null]]
                }
            }
        },

        {
            op: ['addTokens', 'tomorrow is the time for sleep'.split(' ')],
            expect: {
                transitions: {
                    ',': [[1, 'now'], [1, 'tomorrow']],
                    ',tomorrow': [[1, 'is']],
                    'tomorrow,is': [[1, 'the']],
                    'is,the': [[2, 'time']],
                    'the,time': [[2, 'for']],
                    'time,for': [[1, 'action'], [1, 'sleep']],
                    'for,sleep': [[1, null]]
                }
            }
        }

    ]);

    assert.end();
});
